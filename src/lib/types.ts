export type Side = "left" | "right";

export interface ActiveState {
  exists: boolean;
  version: string | null; // 操作时提交此版本，拒绝其他设备操作后过期的请求
  startedAt: string; // "YYYY-MM-DD HH:mm"
  activeSide: Side | null; // null = 有一侧已结束，等待切换或结束
  activeSideStartedAt: string | null; // ISO 时间，客户端据此本地走秒
  leftSeconds: number | null;
  rightSeconds: number | null;
  leftDone: boolean;
  rightDone: boolean;
  elapsed: number; // 当前计时侧经过的秒数（未计时为 0）
}

export interface FeedingRecord {
  id: number;
  startedAt: string;
  leftSeconds: number | null;
  rightSeconds: number | null;
  note: string | null;
}

export interface BottleRecord {
  id: number;
  time: string;
  amountMl: number;
  type: string;
  note: string | null;
}

export interface StoolRecord {
  id: number;
  time: string;
  texture: string | null;
  textureOther: string | null;
  color: string | null;
  colorOther: string | null;
  note: string | null;
}

export interface SleepRecord {
  id: number;
  startedAt: string;
  endedAt: string;
  note: string | null;
}

/** 身高体重：一条记录可能只有体重、只有身高，或两者都有 */
export interface GrowthRecord {
  id: number;
  date: string; // "YYYY-MM-DD"
  weightJin: number | null; // 斤
  heightCm: number | null; // cm
  note: string | null;
}

export interface ActiveSleepState {
  exists: boolean;
  version: string | null; // 操作时提交此版本，拒绝其他设备操作后过期的请求
  startedAt: string; // "YYYY-MM-DD HH:mm"
  startedAtMs: string | null; // ISO 时间，客户端据此本地走秒
  elapsed: number; // 已睡秒数（未计时为 0）
}

/** 清醒间隔：距最近一次醒来的时长 */
export interface WakeState {
  lastWokeAt: string | null; // 最近一次醒来 "YYYY-MM-DD HH:mm"
  awakeSeconds: number | null; // 距该次醒来的秒数；正在睡或数据过旧时为 null
}

export interface DayStats {
  breastCount: number;
  breastSeconds: number;
  bottleCount: number;
  feedCount: number;
  bottleMl: number;
  stoolCount: number;
  sleepSeconds: number; // 落在当天的实际睡眠时长（跨天时段按重叠拆分）
}

export interface DayData {
  today: string; // 当前北京日期，客户端判断「后一天」边界
  date: string;
  ageDays: number | null; // 宝宝出生天数（未配置 DATE_OF_BRITH 为 null）
  stats: DayStats;
  feedings: FeedingRecord[];
  bottles: BottleRecord[];
  stools: StoolRecord[];
  sleeps: SleepRecord[]; // 按 startedAt 归档（入睡当天），跨天的完整时段只出现在入睡日
}

/** 轻量计时状态：单独轮询，避免为了同步计时反复拉整天的记录 */
export interface TimerData {
  active: ActiveState;
  activeSleep: ActiveSleepState;
  wake: WakeState;
}

export const STOOL_TEXTURES = ["稀", "软", "成形", "干硬", "其他"] as const;
export const STOOL_COLORS = ["黄", "黄褐", "绿", "棕", "黑", "其他"] as const;
