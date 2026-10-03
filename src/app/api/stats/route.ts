import { prisma } from "@/lib/prisma";
import { overlapSeconds } from "@/lib/sleep";
import { dateDaysAgo } from "@/lib/time";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface DayAgg {
  breastSeconds: number;
  bottleMl: number;
  formulaMl: number;
  breastBottleMl: number;
  stoolCount: number;
}

export async function GET(request: NextRequest) {
  const daysRaw = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const days = Number.isInteger(daysRaw) ? Math.min(60, Math.max(2, daysRaw)) : 30;

  const startDate = dateDaysAgo(days - 1);

  const [feedings, bottles, stools, sleeps] = await Promise.all([
    prisma.feeding.findMany({
      where: { startedAt: { gte: `${startDate} 00:00` } },
      select: { startedAt: true, leftSeconds: true, rightSeconds: true },
    }),
    prisma.bottle.findMany({
      where: { time: { gte: `${startDate} 00:00` } },
      select: { time: true, amountMl: true, type: true },
    }),
    prisma.stool.findMany({
      where: { time: { gte: `${startDate} 00:00` } },
      select: { time: true },
    }),
    // 只要结束时间落在区间内就取回来：既包含区间内的睡眠，也包含「前一天入睡、跨到第一天醒」的那段
    prisma.sleep.findMany({
      where: { endedAt: { gte: `${startDate} 00:00` } },
      select: { startedAt: true, endedAt: true },
    }),
  ]);

  const map = new Map<string, DayAgg>();
  const get = (d: string): DayAgg => {
    let row = map.get(d);
    if (!row) {
      row = { breastSeconds: 0, bottleMl: 0, formulaMl: 0, breastBottleMl: 0, stoolCount: 0 };
      map.set(d, row);
    }
    return row;
  };

  for (const f of feedings) {
    const row = get(f.startedAt.slice(0, 10));
    row.breastSeconds += (f.leftSeconds ?? 0) + (f.rightSeconds ?? 0);
  }
  for (const b of bottles) {
    const row = get(b.time.slice(0, 10));
    row.bottleMl += b.amountMl;
    if (b.type === "母乳") row.breastBottleMl += b.amountMl;
    else row.formulaMl += b.amountMl;
  }
  for (const s of stools) {
    const row = get(s.time.slice(0, 10));
    row.stoolCount += 1;
  }

  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dateDaysAgo(i);
    const row = map.get(date);
    data.push({
      date,
      breastSeconds: row?.breastSeconds ?? 0,
      bottleMl: row?.bottleMl ?? 0,
      formulaMl: row?.formulaMl ?? 0,
      breastBottleMl: row?.breastBottleMl ?? 0,
      stoolCount: row?.stoolCount ?? 0,
      // 跨天时段按重叠拆分到相邻两天，同一条记录会分别计入
      sleepSeconds: sleeps.reduce((s, x) => s + overlapSeconds(x.startedAt, x.endedAt, date), 0),
    });
  }

  return Response.json({ days, data });
}