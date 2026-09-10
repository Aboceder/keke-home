import { prisma } from "@/lib/prisma";
import { nowDate } from "@/lib/time";
import type { ActiveState, DayData } from "@/lib/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function activeState(row: {
  startedAt: string;
  activeSide: string | null;
  activeSideStartedAt: Date | null;
  leftSeconds: number | null;
  rightSeconds: number | null;
  leftDone: boolean;
  rightDone: boolean;
}): ActiveState {
  // elapsed = 该侧总时长（含 resume 之前累计的）+ 本次正在计的秒数
  const base =
    row.activeSide === "left"
      ? (row.leftSeconds ?? 0)
      : (row.rightSeconds ?? 0);
  const elapsed =
    row.activeSide && row.activeSideStartedAt
      ? base + Math.max(0, Math.floor((Date.now() - row.activeSideStartedAt.getTime()) / 1000))
      : 0;
  return {
    exists: true,
    startedAt: row.startedAt,
    activeSide: (row.activeSide as "left" | "right" | null) ?? null,
    activeSideStartedAt: row.activeSideStartedAt
      ? row.activeSideStartedAt.toISOString()
      : null,
    leftSeconds: row.leftSeconds,
    rightSeconds: row.rightSeconds,
    leftDone: row.leftDone,
    rightDone: row.rightDone,
    elapsed,
  };
}

export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("date");
  const date = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : nowDate();

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
    active: activeRow
      ? activeState(activeRow)
      : {
          exists: false,
          startedAt: "",
          activeSide: null,
          activeSideStartedAt: null,
          leftSeconds: null,
          rightSeconds: null,
          leftDone: false,
          rightDone: false,
          elapsed: 0,
        },
  };

  return Response.json(data);
}
