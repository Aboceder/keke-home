// 宝宝日龄：从环境变量 DATE_OF_BRITH（"YYYY-MM-DD"）计算出生天数
// 未配置、格式不对或出生日期在未来时返回 null，调用方自行隐藏
import { DATE_RE } from "@/lib/time";

/** 出生日期 "YYYY-MM-DD"，未配置或格式不对返回 null */
export function birthDate(): string | null {
  const raw = (process.env.DATE_OF_BRITH ?? process.env.DATE_OF_BIRTH ?? "").trim();
  return DATE_RE.test(raw) ? raw : null;
}

/** 出生当天算第 1 天；到 date（"YYYY-MM-DD" 北京日期）是第几天；不可算时返回 null */
export function ageDaysAt(date: string): number | null {
  const birth = birthDate();
  if (!birth || date < birth) return null;
  const toUtc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((toUtc(date) - toUtc(birth)) / 86400000) + 1;
}
