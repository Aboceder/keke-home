import { ageDaysAt } from "@/lib/age";
import { activeState } from "@/lib/active-feeding";
import { prisma } from "@/lib/prisma";
import { normalizeDate, nowDate } from "@/lib/time";
import type { DayData } from "@/lib/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("date");
  const date = param === null ? nowDate() : normalizeDate(param);
  if (!date) return Response.json({ error: "日期格式不正确" }, { status: 400 });

  const [feedings, bottles, stools, activeRow] = await Promise.all([
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
    prisma.activeFeeding.findUnique({ where: { id: 1 } }),
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
    },
    feedings,
    bottles,
    stools,
    active: activeState(activeRow),
  };

  return Response.json(data);
}
