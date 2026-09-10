// 日报/周报：数据聚合（程序算）→ AI 总结（可降级为模板）→ Bark 推送
import { prisma } from "@/lib/prisma";
import { dateDaysAgo } from "@/lib/time";
import { aiConfigured, aiSummarize } from "@/lib/ai";
import { barkPush, barkConfigured } from "@/lib/bark";

interface RangeStats {
  breastCount: number;
  breastSeconds: number;
  bottleCount: number;
  bottleMl: number;
  formulaMl: number;
  breastMl: number;
  stoolCount: number;
}

/** 统计 [startDate, endDate] 闭区间（北京日期，含两端） */
export async function rangeStats(startDate: string, endDate: string): Promise<RangeStats> {
  const [feedings, bottles, stools] = await Promise.all([
    prisma.feeding.findMany({
      where: { startedAt: { gte: `${startDate} 00:00`, lte: `${endDate} 23:59` } },
      select: { leftSeconds: true, rightSeconds: true },
    }),
    prisma.bottle.findMany({
      where: { time: { gte: `${startDate} 00:00`, lte: `${endDate} 23:59` } },
      select: { amountMl: true, type: true },
    }),
    prisma.stool.findMany({
      where: { time: { gte: `${startDate} 00:00`, lte: `${endDate} 23:59` } },
      select: { id: true },
    }),
  ]);

  const stats: RangeStats = {
    breastCount: feedings.length,
    breastSeconds: feedings.reduce((s, f) => s + (f.leftSeconds ?? 0) + (f.rightSeconds ?? 0), 0),
    bottleCount: bottles.length,
    bottleMl: bottles.reduce((s, b) => s + b.amountMl, 0),
    formulaMl: bottles.filter((b) => b.type === "奶粉").reduce((s, b) => s + b.amountMl, 0),
    breastMl: bottles.filter((b) => b.type === "母乳").reduce((s, b) => s + b.amountMl, 0),
    stoolCount: stools.length,
  };
  return stats;
}

function fmtMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}分钟`;
  return `${Math.floor(m / 60)}小时${m % 60}分钟`;
}

function deltaLine(label: string, cur: number, prev: number, unit: string): string {
  const diff = cur - prev;
  const arrow = diff > 0 ? `+${diff}` : `${diff}`;
  return `${label} ${cur}${unit}（${diff === 0 ? "持平" : `${diff > 0 ? "多" : "少"} ${arrow.replace("+", "")}${unit}`}）`;
}

function linesFor(stats: RangeStats): string {
  const parts = [
    `母乳 ${stats.breastCount} 次 ${fmtMinutes(stats.breastSeconds)}`,
    `奶瓶 ${stats.bottleCount} 次 ${stats.bottleMl}ml（奶粉 ${stats.formulaMl} / 母乳 ${stats.breastMl}）`,
    `便便 ${stats.stoolCount} 次`,
  ];
  return parts.join("，");
}

function buildPrompt(
  periodName: string,
  cur: RangeStats,
  prev: RangeStats,
  curLabel: string,
  prevLabel: string,
): string {
  return [
    `以下是可可（婴儿）的喂养记录对比，请写 2~3 句中文总结：先说本期概况，再对比${prevLabel}的变化，最后给一句贴心建议。`,
    `${curLabel}：${linesFor(cur)}。`,
    `${prevLabel}：${linesFor(prev)}。`,
    "数字保持准确，不要编造数据。",
  ].join("\n");
}

/** AI 总结，失败/未配置时用程序拼接的模板兜底 */
async function summarizeWithFallback(
  periodName: string,
  cur: RangeStats,
  prev: RangeStats,
  curLabel: string,
  prevLabel: string,
): Promise<string> {
  if (aiConfigured()) {
    const text = await aiSummarize(buildPrompt(periodName, cur, prev, curLabel, prevLabel));
    if (text) return text;
  }
  return [
    deltaLine("母乳", cur.breastCount, prev.breastCount, "次"),
    deltaLine("奶瓶", cur.bottleCount, prev.bottleCount, "次"),
    deltaLine("奶量", cur.bottleMl, prev.bottleMl, "ml"),
    deltaLine("便便", cur.stoolCount, prev.stoolCount, "次"),
  ].join("；");
}

/** 每日日报：今天 vs 昨天，每天 21:00 推送 */
export async function sendDailyReport(): Promise<void> {
  if (!barkConfigured()) return;
  const today = dateDaysAgo(0);
  const yesterday = dateDaysAgo(1);

  const [cur, prev] = await Promise.all([
    rangeStats(today, today),
    rangeStats(yesterday, yesterday),
  ]);
  const summary = await summarizeWithFallback(
    "日报",
    cur,
    prev,
    `今天（${today}）`,
    `昨天（${yesterday}）`,
  );
  await barkPush(`可可日报 ${today.slice(5).replace("-", "/")}`, `${linesFor(cur)}。\n${summary}`);
}

/** 每周周报：上周 vs 上上周，每周一 09:00 推送 */
export async function sendWeeklyReport(): Promise<void> {
  if (!barkConfigured()) return;
  // 上周一 ~ 上周日（昨天所在周为刚结束的周，dateDaysAgo(1) 为周日）
  const end = dateDaysAgo(1);
  const start = dateDaysAgo(7);
  const prevEnd = dateDaysAgo(8);
  const prevStart = dateDaysAgo(14);

  const [cur, prev] = await Promise.all([
    rangeStats(start, end),
    rangeStats(prevStart, prevEnd),
  ]);
  const dailyMl = Math.round(cur.bottleMl / 7);
  const summary = await summarizeWithFallback(
    "周报",
    cur,
    prev,
    `上周（${start} 至 ${end}）`,
    "上上周",
  );
  await barkPush(
    `可可周报 ${start.slice(5).replace("-", "/")}~${end.slice(5).replace("-", "/")}`,
    `母乳 ${cur.breastCount} 次 ${fmtMinutes(cur.breastSeconds)}，奶瓶 ${cur.bottleCount} 次 ${cur.bottleMl}ml（日均 ${dailyMl}ml），便便 ${cur.stoolCount} 次。\n${summary}`,
  );
}