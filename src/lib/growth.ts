// 成长记录（身高体重）的量程、格式化与月龄计算
// 体重一律用「斤」，身高用「cm」，两个值各自可空（可能只称了体重）
// 本文件同时被服务端校验（validators）和客户端页面引用，不要引入服务端专用依赖

/** 体重上限（斤）：按儿童量程收窄，挡住「把 5000 克当成斤填」这类单位错误 */
export const MAX_WEIGHT_JIN = 66;
/** 身高上限（cm） */
export const MAX_HEIGHT_CM = 150;

/** 数值展示：最多 1 位小数，去掉多余的 .0 → "12.6" / "12" */
export function fmtNum(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** 与上一次测量的差值文字："+0.4" / "-0.2" / "持平" */
export function fmtDelta(diff: number): string {
  const d = Math.round(diff * 10) / 10;
  if (d === 0) return "持平";
  return `${d > 0 ? "+" : ""}${fmtNum(d)}`;
}

/**
 * 测量日期对应的月龄文字："12 天" / "2 个月 5 天" / "2 个月"。
 * 不足 1 个月按天数（与首页「已经 X 天啦」同一口径，出生当天算 1 天）；
 * 满 1 个月后按自然月（出生日对齐，月末不足时取当月最后一天），天数为 0 时省略。
 * 未配置出生日期或日期早于出生日时返回 null。
 */
export function ageTextAt(birth: string, date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || date < birth) return null;
  const [by, bm, bd] = birth.split("-").map(Number);
  const [dy, dm, dd] = date.split("-").map(Number);
  const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
  const target = utc(dy, dm, dd);

  // 出生日往后推 months 个月（月末不足时取当月最后一天）
  const anchor = (months: number) => {
    const y = by + Math.floor((bm - 1 + months) / 12);
    const m = (bm - 1 + months) % 12;
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return utc(y, m + 1, Math.min(bd, lastDay));
  };

  let months = (dy - by) * 12 + (dm - bm);
  while (months > 0 && anchor(months) > target) months -= 1;
  const days = Math.round((target - anchor(months)) / 86400000);

  if (months === 0) return `${days + 1} 天`;
  return days === 0 ? `${months} 个月` : `${months} 个月 ${days} 天`;
}
