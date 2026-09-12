export type Side = "left" | "right";

export interface ActiveState {
  exists: boolean;
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

export interface DayStats {
  breastCount: number;
  breastSeconds: number;
  bottleCount: number;
  feedCount: number;
  bottleMl: number;
  stoolCount: number;
}

export interface DayData {
  today: string; // 当前北京日期，客户端判断「后一天」边界
  date: string;
  ageDays: number | null; // 宝宝出生天数（未配置 DATE_OF_BRITH 为 null）
  stats: DayStats;
  feedings: FeedingRecord[];
  bottles: BottleRecord[];
  stools: StoolRecord[];
  active: ActiveState;
}

export const STOOL_TEXTURES = ["稀", "软", "成形", "干硬", "其他"] as const;
export const STOOL_COLORS = ["黄", "黄褐", "绿", "棕", "黑", "其他"] as const;
