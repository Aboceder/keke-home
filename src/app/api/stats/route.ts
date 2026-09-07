import { prisma } from "@/lib/prisma";
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

  const [feedings, bottles, stools] = await Promise.all([
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
    });
  }

  return Response.json({ days, data });
}