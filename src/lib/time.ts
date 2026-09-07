// 所有日期时间统一为北京时间（Asia/Shanghai）的墙上时间
// 格式："YYYY-MM-DD HH:mm"、"YYYY-MM-DD"
// 同格式字符串可直接按字典序比较大小

const TZ = "Asia/Shanghai";

const dtFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const DT_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 当前北京时间 "YYYY-MM-DD HH:mm" */
export function nowDt(): string {
  const p = dtFmt.formatToParts(new Date());
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}`;
}

/** 当前北京日期 "YYYY-MM-DD" */
export function nowDate(): string {
  return nowDt().slice(0, 10);
}

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 当前北京时间的 N 天前的日期 "YYYY-MM-DD" */
export function dateDaysAgo(daysAgo: number): string {
  const p = dateFmt.formatToParts(new Date(Date.now() - daysAgo * 86400000));
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** 标准化并校验 "YYYY-MM-DD HH:mm"（datetime-local 值为 "YYYY-MM-DDTHH:mm"） */
export function normalizeDt(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace("T", " ").slice(0, 16);
  if (!DT_RE.test(s)) return null;
  const [, hm] = s.split(" ");
  const [h, m] = hm.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  return s;
}

/** 校验日期 "YYYY-MM-DD" */
export function normalizeDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, 10);
  if (!DATE_RE.test(s)) return null;
  return s;
}

/** 是否为未来时间 */
export function isFutureDt(dt: string): boolean {
  return dt > nowDt();
}

/** 是否为未来日期 */
export function isFutureDate(d: string): boolean {
  return d > nowDate();
}

/** "YYYY-MM-DD HH:mm" → "HH:mm" */
export function hm(dt: string): string {
  return dt.slice(11, 16);
}

/** 分钟数（>0 整数）校验 */
export function parseMinutes(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/** 毫升数（>0 整数）校验 */
export function parseMl(v: unknown): number | null {
  return parseMinutes(v);
}
