import type { ActiveFeeding } from "@prisma/client";
import type { ActiveState, Side } from "@/lib/types";

/** 两个查询入口使用相同的状态与版本，客户端按服务器秒数建立本地计时锚点。 */
export function activeState(row: ActiveFeeding | null): ActiveState {
  if (!row) {
    return {
      exists: false,
      version: null,
      startedAt: "",
      activeSide: null,
      activeSideStartedAt: null,
      leftSeconds: null,
      rightSeconds: null,
      leftDone: false,
      rightDone: false,
      elapsed: 0,
    };
  }

  const base = row.activeSide === "left" ? (row.leftSeconds ?? 0) : (row.rightSeconds ?? 0);
  const elapsed = row.activeSide && row.activeSideStartedAt
    ? base + Math.max(0, Math.floor((Date.now() - row.activeSideStartedAt.getTime()) / 1000))
    : 0;

  return {
    exists: true,
    version: row.version,
    startedAt: row.startedAt,
    activeSide: row.activeSide as Side | null,
    activeSideStartedAt: row.activeSideStartedAt?.toISOString() ?? null,
    leftSeconds: row.leftSeconds,
    rightSeconds: row.rightSeconds,
    leftDone: row.leftDone,
    rightDone: row.rightDone,
    elapsed,
  };
}
