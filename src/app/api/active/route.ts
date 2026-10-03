import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { activeState } from "@/lib/active-feeding";
import { prisma } from "@/lib/prisma";
import { nowDt } from "@/lib/time";
import type { Side } from "@/lib/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const SIDES: Side[] = ["left", "right"];

async function getActive() {
  return prisma.activeFeeding.findUnique({ where: { id: 1 } });
}

function err(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function conflict() {
  return err("喂奶状态已变化，请根据最新状态重试", 409);
}

export async function GET() {
  return Response.json(activeState(await getActive()));
}

/**
 * action:
 * - start  {side}            开始喂奶（某侧开始计时）
 * - endSide                    结束本侧（进入「继续/切换/结束」待选择状态）
 * - resume {side}            反悔：继续喂已结束的那侧（时长累计）
 * - switch {side}            切换到另一侧并计时
 * - finish                     结束喂奶，保存整条母乳记录
 * 除 start 外均需提交查询到的 version；条件写入保证同一版本只有一次操作成功。
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    side?: string;
    version?: unknown;
  } | null;
  if (!body?.action) return err("缺少 action");
  const side = body.side as Side | undefined;

  if (body.action === "start") {
    if (!side || !SIDES.includes(side)) return err("side 必须为 left 或 right");
    try {
      // 由唯一主键保证全局只有一条记录，避免先检查再创建的并发窗口。
      const row = await prisma.activeFeeding.create({
        data: {
          id: 1,
          version: randomUUID(),
          startedAt: nowDt(),
          activeSide: side,
          activeSideStartedAt: new Date(),
          leftDone: side === "left",
          rightDone: side === "right",
        },
      });
      return Response.json({ ok: true, startedAt: row.startedAt });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return err("已有一条进行中的喂奶记录", 409);
      }
      throw error;
    }
  }

  if (!["endSide", "resume", "switch", "finish"].includes(body.action)) return err("未知 action");
  if (body.version === undefined) return err("页面已更新，请刷新页面后操作", 409);
  if (body.version !== null && typeof body.version !== "string") return err("无效的计时版本");

  const row = await getActive();
  if (!row || row.version !== body.version) return conflict();
  const where = { id: 1, version: row.version };

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
    const result = await prisma.activeFeeding.updateMany({ where, data: { ...data, version: randomUUID() } });
    return result.count === 1 ? Response.json({ ok: true }) : conflict();
  }

  if (body.action === "resume") {
    if (!side || !SIDES.includes(side)) return err("side 必须为 left 或 right");
    if (row.activeSide) return err("另一侧正在计时，请先结束本侧");
    const done = side === "left" ? row.leftDone : row.rightDone;
    if (!done) return err("该侧尚未计时过");
    const result = await prisma.activeFeeding.updateMany({
      where,
      data: { activeSide: side, activeSideStartedAt: new Date(), version: randomUUID() },
    });
    return result.count === 1 ? Response.json({ ok: true }) : conflict();
  }

  if (body.action === "switch") {
    if (!side || !SIDES.includes(side)) return err("side 必须为 left 或 right");
    if (row.activeSide) return err("另一侧正在计时，请先结束本侧");
    const targetDone = side === "left" ? row.leftDone : row.rightDone;
    if (targetDone) return err("该侧已计时过，不能再切换");
    const result = await prisma.activeFeeding.updateMany({
      where,
      data: { activeSide: side, activeSideStartedAt: new Date(), version: randomUUID() },
    });
    return result.count === 1 ? Response.json({ ok: true }) : conflict();
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
    const feeding = await prisma.$transaction(async (tx) => {
      // 先按版本消费计时记录，再保存结果；保存失败时删除也会回滚。
      // 新一轮喂奶有不同版本，即使仍使用 id=1，旧请求也无法将它删除。
      const removed = await tx.activeFeeding.deleteMany({ where });
      if (removed.count !== 1) return null;
      return tx.feeding.create({
        data: {
          startedAt: row.startedAt,
          leftSeconds: leftSeconds || null,
          rightSeconds: rightSeconds || null,
        },
      });
    });
    return feeding ? Response.json({ ok: true, id: feeding.id }) : conflict();
  }

  return err("未知 action");
}
