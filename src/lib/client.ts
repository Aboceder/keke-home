const TZ = "Asia/Shanghai";

const dtf = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 当前北京时间 "YYYY-MM-DDTHH:mm"，用于 datetime-local 输入默认值 */
export function nowInputValue(): string {
  const p = dtf.formatToParts(new Date());
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** 统一请求封装，出错抛出后端 message */
export async function api<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const isForm = opts?.body instanceof FormData;
  const res = await fetch(url, {
    ...opts,
    headers: isForm ? undefined : { "Content-Type": "application/json", ...opts?.headers },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(data?.error || "请求失败");
  return data;
}

/** 秒 → "0s" / "X min"（单位用英文） */
export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)} min`;
}

/** 秒 → "H:MM:SS"（计时器大数字） */
export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** 秒 → 分钟概数（统计栏）：不足 1 小时显示 "Xmin"，超过显示 "XhYmin"，不显示秒 */
export function fmtDurationMin(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin}min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h${m}min` : `${h}h`;
}
