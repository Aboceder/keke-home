import { ageDaysAt } from "@/lib/age";
import { activeState } from "@/lib/active-feeding";
import { activeSleepState, wakeState } from "@/lib/active-sleep";
import { prisma } from "@/lib/prisma";
import { overlapSeconds } from "@/lib/sleep";
import { normalizeDate, nowDate } from "@/lib/time";
import type { DayData } from "@/lib/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("date");
  const date = param === null ? nowDate() : normalizeDate(param);
  if (!date) return Response.json({ error: "日期格式不正确" }, { status: 400 });

  const [feedings, bottles, stools, sleepRows, activeRow, activeSleepRow, lastSleep] =
    await Promise.all([
      prisma.feeding.findMany({
        where: { startedAt: { startsWith: date } },
        orderBy: { startedAt: "desc" },
      }),
      prisma.bottle.findMany({
        where: { time: { startsWith: date } },
        orderBy: { time: "desc" },
      }),
      prisma.stool.findMany({
        where: { time: { startsWith: date } },
        orderBy: { time: "desc" },
      }),
      // 两类睡眠一次取回：入睡当天开始的（时间线用）+ 前一天入睡、跨到今天醒的（统计用）
      prisma.sleep.findMany({
        where: {
          OR: [
            { startedAt: { startsWith: date } },
            { startedAt: { lt: `${date} 00:00` }, endedAt: { gte: `${date} 00:00` } },
          ],
        },
        orderBy: { startedAt: "desc" },
      }),
      prisma.activeFeeding.findUnique({ where: { id: 1 } }),
      prisma.activeSleep.findUnique({ where: { id: 1 } }),
      prisma.sleep.findFirst({ orderBy: { endedAt: "desc" }, select: { endedAt: true } }),
    ]);

  const bottleMl = bottles.reduce((s, b) => s + b.amountMl, 0);
  const breastSeconds = feedings.reduce(
    (s, f) => s + (f.leftSeconds ?? 0) + (f.rightSeconds ?? 0),
    0,
  );
  const data: DayData = {
    today: nowDate(),
    date,
    ageDays: ageDaysAt(nowDate()),
    stats: {
      breastCount: feedings.length,
      breastSeconds,
      bottleCount: bottles.length,
      feedCount: feedings.length + bottles.length,
      bottleMl,
      stoolCount: stools.length,
      // 跨天时段只算落在当天范围内的部分，与统计页、日报口径一致
      sleepSeconds: sleepRows.reduce((s, x) => s + overlapSeconds(x.startedAt, x.endedAt, date), 0),
    },
    feedings,
    bottles,
    stools,
    // 时间线按入睡时间归档，跨天的完整时段只出现在入睡日
    sleeps: sleepRows.filter((x) => x.startedAt.startsWith(date)),
    active: activeState(activeRow),
    activeSleep: activeSleepState(activeSleepRow),
    wake: wakeState(activeSleepRow, lastSleep),
  };

  return Response.json(data);
}
