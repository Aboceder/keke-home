import { activeState } from "@/lib/active-feeding";
import { activeSleepState, wakeState } from "@/lib/active-sleep";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [active, activeSleep, lastSleep] = await Promise.all([
    prisma.activeFeeding.findUnique({ where: { id: 1 } }),
    prisma.activeSleep.findUnique({ where: { id: 1 } }),
    prisma.sleep.findFirst({ orderBy: { endedAt: "desc" }, select: { endedAt: true } }),
  ]);

  return Response.json({
    active: activeState(active),
    activeSleep: activeSleepState(activeSleep),
    wake: wakeState(activeSleep, lastSleep),
  });
}
