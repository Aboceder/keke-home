import type { ActiveSleep } from "@prisma/client";
import type { ActiveSleepState, WakeState } from "@/lib/types";

/** 进行中睡眠的状态；与 activeState() 同构，客户端按服务器秒数建立本地计时锚点 */
export function activeSleepState(row: ActiveSleep | null): ActiveSleepState {
  if (!row) {
    return { exists: false, version: null, startedAt: "", startedAtMs: null, elapsed: 0 };
  }
  return {
    exists: true,
    version: row.version,
    startedAt: row.startedAt,
    startedAtMs: row.startedAtMs.toISOString(),
    elapsed: Math.max(0, Math.floor((Date.now() - row.startedAtMs.getTime()) / 1000)),
  };
}

/** 超过这个时长仍未记录醒来，就认为睡眠数据已经太旧，不再显示清醒时长 */
const WAKE_STALE_SECONDS = 24 * 3600;

/**
 * 清醒间隔：距最近一次醒来的时长。
 * 正在睡（active 非空）时没有「清醒」，返回 null；最近一次醒来超过 24 小时也返回 null，
 * 避免很久没记录时显示一个没有意义的巨大数字。
 */
export function wakeState(
  active: ActiveSleep | null,
  lastSleep: { endedAt: string } | null,
): WakeState {
  if (active || !lastSleep) return { lastWokeAt: null, awakeSeconds: null };
  const endedMs = Date.parse(`${lastSleep.endedAt.replace(" ", "T")}:00+08:00`);
  const seconds = Math.max(0, Math.floor((Date.now() - endedMs) / 1000));
  if (seconds > WAKE_STALE_SECONDS) return { lastWokeAt: null, awakeSeconds: null };
  return { lastWokeAt: lastSleep.endedAt, awakeSeconds: seconds };
}