// 睡眠时段的时长与「按天重叠」计算
// 时间一律是北京墙上时间字符串；Asia/Shanghai 没有夏令时，可直接按固定偏移换算

const TZ_SUFFIX = "+08:00";
const DAY_MS = 86400000;

/** 单次睡眠上限（秒）。超过视为「忘记点醒来」，补录/编辑直接拒绝，计时结束只警告不拦截 */
export const MAX_SLEEP_SECONDS = 8 * 3600;

/** "YYYY-MM-DD HH:mm" → epoch 毫秒 */
export function dtMs(dt: string): number {
  return Date.parse(`${dt.replace(" ", "T")}:00${TZ_SUFFIX}`);
}

/** 一段睡眠的时长（秒）；endedAt 不晚于 startedAt 时返回 0 */
export function sleepSeconds(startedAt: string, endedAt: string): number {
  return Math.max(0, Math.floor((dtMs(endedAt) - dtMs(startedAt)) / 1000));
}

/**
 * 一段睡眠落在指定北京日期内的秒数。
 * 跨天的时段只算落在当天范围内的部分，所以同一条记录会分别计入相邻两天。
 */
export function overlapSeconds(startedAt: string, endedAt: string, date: string): number {
  const dayStart = dtMs(`${date} 00:00`);
  const dayEnd = dayStart + DAY_MS;
  const from = Math.max(dtMs(startedAt), dayStart);
  const to = Math.min(dtMs(endedAt), dayEnd);
  return Math.max(0, Math.floor((to - from) / 1000));
}

/** 是否跨天（入睡与醒来不在同一个北京日期） */
export function isOvernight(startedAt: string, endedAt: string): boolean {
  return startedAt.slice(0, 10) !== endedAt.slice(0, 10);
}
