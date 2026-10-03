import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { activeSleepState } from "@/lib/active-sleep";
import { prisma } from "@/lib/prisma";
import { MAX_SLEEP_SECONDS, sleepSeconds } from "@/lib/sleep";
import { nowDt } from "@/lib/time";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function err(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function conflict() {
  return err("睡眠状态已变化，请根据最新状态重试", 409);
}

export async function GET() {
  return Response.json(activeSleepState(await prisma.activeSleep.findUnique({ where: { id: 1 } })));
}

/**
 * 开始 / 结束睡眠。
 * - start        开始睡觉（无需 version）
 * - wake         结束睡眠并保存一段记录
 * wake 需提交查询到的 version；条件写入保证同一版本只有一次操作成功。
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    version?: unknown;
  } | null;
  if (!body?.action) return err("缺少 action");

  if (body.action === "start") {
    try {
      // 由唯一主键保证全局只有一条记录，避免先检查再创建的并发窗口。
      const row = await prisma.activeSleep.create({
        data: { id: 1, version: randomUUID(), startedAt: nowDt(), startedAtMs: new Date() },
      });
      return Response.json({ ok: true, startedAt: row.startedAt });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return err("已经有一段进行中的睡眠", 409);
      }
      throw error;
    }
  }

  if (body.action !== "wake") return err("未知 action");
  if (body.version === undefined) return err("页面已更新，请刷新页面后操作", 409);
  if (body.version !== null && typeof body.version !== "string") return err("无效的计时版本");

  const row = await prisma.activeSleep.findUnique({ where: { id: 1 } });
  if (!row || row.version !== body.version) return conflict();
  const where = { id: 1, version: row.version };

  // 用落库后的墙上时间算时长，保证与后续校验、编辑看到的是同一个值
  const endedAt = nowDt();
  const recorded = sleepSeconds(row.startedAt, endedAt);

  // 不足 1 分钟按误触处理：清掉计时但不落记录。
  // 否则会存下 0 秒的记录，而「醒来必须晚于入睡」的校验会让它连编辑都保存不了。
  if (recorded < 60) {
    const removed = await prisma.activeSleep.deleteMany({ where });
    if (removed.count !== 1) return conflict();
    return Response.json({ ok: true, discarded: true });
  }

  const sleep = await prisma.$transaction(async (tx) => {
    // 先按版本消费计时记录，再保存结果；保存失败时删除也会回滚。
    const removed = await tx.activeSleep.deleteMany({ where });
    if (removed.count !== 1) return null;
    return tx.sleep.create({ data: { startedAt: row.startedAt, endedAt } });
  });
  if (!sleep) return conflict();

  // 计时路径不拦截超长睡眠（拦了会留下一条无法结束的计时），只回传警告让页面提示核对
  const warning =
    recorded > MAX_SLEEP_SECONDS
      ? `这段睡眠 ${Math.round(recorded / 3600)} 小时，超过 ${MAX_SLEEP_SECONDS / 3600} 小时，请核对是否忘记点醒来`
      : undefined;
  return Response.json({ ok: true, id: sleep.id, endedAt, warning });
}