import { prisma } from "@/lib/prisma";
import { nowDt } from "@/lib/time";
import type { ActiveState, Side } from "@/lib/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const SIDES: Side[] = ["left", "right"];

async function getActive() {
  return prisma.activeFeeding.findUnique({ where: { id: 1 } });
}

function err(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  const row = await getActive();
  if (!row) {
    const empty: ActiveState = {
      exists: false,
      startedAt: "",
      activeSide: null,
      activeSideStartedAt: null,
      leftSeconds: null,
      rightSeconds: null,
      leftDone: false,
      rightDone: false,
      elapsed: 0,
    };
    return Response.json(empty);
  }
  // elapsed = 该侧总时长（含 resume 之前累计的）+ 本次正在计的秒数
  const base =
    row.activeSide === "left"
      ? (row.leftSeconds ?? 0)
      : (row.rightSeconds ?? 0);
  const elapsed =
    row.activeSide && row.activeSideStartedAt
      ? base + Math.max(0, Math.floor((Date.now() - row.activeSideStartedAt.getTime()) / 1000))
      : 0;
  return Response.json({
    exists: true,
    startedAt: row.startedAt,
    activeSide: row.activeSide,
    activeSideStartedAt: row.activeSideStartedAt?.toISOString() ?? null,
    leftSeconds: row.leftSeconds,
    rightSeconds: row.rightSeconds,
    leftDone: row.leftDone,
    rightDone: row.rightDone,
    elapsed,
  });
}

/**
 * action:
 * - start  {side}            开始喂奶（某侧开始计时）
 * - endSide                    结束本侧（进入「继续/切换/结束」待选择状态）
 * - resume {side}            反悔：继续喂已结束的那侧（时长累计）
 * - switch {side}            切换到另一侧并计时
 * - finish                     结束喂奶，保存整条母乳记录
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    side?: string;
  } | null;
  if (!body?.action) return err("缺少 action");
  const side = body.side as Side | undefined;

  if (body.action === "start") {
    if (!side || !SIDES.includes(side)) return err("side 必须为 left 或 right");
    if (await getActive()) return err("已有一条进行中的喂奶记录");
    const row = await prisma.activeFeeding.create({
      data: {
        id: 1,
        startedAt: nowDt(),
        activeSide: side,
        activeSideStartedAt: new Date(),
        leftDone: side === "left",
        rightDone: side === "right",
      },
    });
    return Response.json({ ok: true, startedAt: row.startedAt });
  }

  const row = await getActive();
  if (!row) return err("当前没有进行中的喂奶记录");

  if (body.action === "endSide") {
    if (!row.activeSide || !row.activeSideStartedAt) {
      return err("当前没有正在计时的侧");
    }
    const secs = Math.max(
      0,
      Math.floor((Date.now() - row.activeSideStartedAt.getTime()) / 1000),
    );
    const data =
      row.activeSide === "left"
        ? { leftSeconds: (row.leftSeconds ?? 0) + secs, leftDone: true, activeSide: null, activeSideStartedAt: null }
        : { rightSeconds: (row.rightSeconds ?? 0) + secs, rightDone: true, activeSide: null, activeSideStartedAt: null };
    await prisma.activeFeeding.update({ where: { id: 1 }, data });
    return Response.json({ ok: true });
  }

  if (body.action === "resume") {
    if (!side || !SIDES.includes(side)) return err("side 必须为 left 或 right");
    if (row.activeSide) return err("另一侧正在计时，请先结束本侧");
    const done = side === "left" ? row.leftDone : row.rightDone;
    if (!done) return err("该侧尚未计时过");
    await prisma.activeFeeding.update({
      where: { id: 1 },
      data: { activeSide: side, activeSideStartedAt: new Date() },
    });
    return Response.json({ ok: true });
  }

  if (body.action === "switch") {
    if (!side || !SIDES.includes(side)) return err("side 必须为 left 或 right");
    if (row.activeSide) return err("另一侧正在计时，请先结束本侧");
    const targetDone = side === "left" ? row.leftDone : row.rightDone;
    if (targetDone) return err("该侧已计时过，不能再切换");
    await prisma.activeFeeding.update({
      where: { id: 1 },
      data: { activeSide: side, activeSideStartedAt: new Date() },
    });
    return Response.json({ ok: true });
  }

  if (body.action === "finish") {
    // 若仍在计时，先把当前侧收尾
    let leftSeconds = row.leftSeconds;
    let rightSeconds = row.rightSeconds;
    if (row.activeSide && row.activeSideStartedAt) {
      const secs = Math.max(
        0,
        Math.floor((Date.now() - row.activeSideStartedAt.getTime()) / 1000),
      );
      // resume 后再次结束：在已累计时长上叠加本次
      if (row.activeSide === "left") leftSeconds = (row.leftSeconds ?? 0) + secs;
      else rightSeconds = (row.rightSeconds ?? 0) + secs;
    }
    if (!leftSeconds && !rightSeconds) {
      return err("至少要有一侧的时长才能保存");
    }
    const [feeding] = await prisma.$transaction([
      prisma.feeding.create({
        data: {
          startedAt: row.startedAt,
          leftSeconds: leftSeconds || null,
          rightSeconds: rightSeconds || null,
        },
      }),
      prisma.activeFeeding.delete({ where: { id: 1 } }),
    ]);
    return Response.json({ ok: true, id: feeding.id });
  }

  return err("未知 action");
}
