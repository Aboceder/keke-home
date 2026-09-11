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
  stoolTexture: string; // "稀 2、软 1"，空串表示都没填
  stoolColor: string; // "黄 3、绿 1"
  stoolOthers: string[]; // 性状/颜色选「其他」时的补充文字
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
      select: { texture: true, color: true, textureOther: true, colorOther: true },
    }),
  ]);

  const stoolTexture = groupCounts(stools.map((s) => s.texture));
  const stoolColor = groupCounts(stools.map((s) => s.color));
  const stoolOthers = stools
    .flatMap((s) => [s.textureOther, s.colorOther])
    .filter((v): v is string => Boolean(v?.trim()));

  const stats: RangeStats = {
    breastCount: feedings.length,
    breastSeconds: feedings.reduce((s, f) => s + (f.leftSeconds ?? 0) + (f.rightSeconds ?? 0), 0),
    bottleCount: bottles.length,
    bottleMl: bottles.reduce((s, b) => s + b.amountMl, 0),
    formulaMl: bottles.filter((b) => b.type === "奶粉").reduce((s, b) => s + b.amountMl, 0),
    breastMl: bottles.filter((b) => b.type === "母乳").reduce((s, b) => s + b.amountMl, 0),
    stoolCount: stools.length,
    stoolTexture,
    stoolColor,
    stoolOthers,
  };
  return stats;
}

/** 非 null 值分组计数，拼成 "稀 2、软 1"；全部为 null 返回空串 */
function groupCounts(values: (string | null)[]): string {
  const counts = new Map<string, number>();
  let nullCount = 0;
  for (const v of values) {
    if (v == null) nullCount++;
    else counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const parts = [...counts.entries()] // 次数多的排前面
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}`);
  if (nullCount > 0) parts.push(`未记录 ${nullCount}`);
  return parts.join("、");
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
  const texture = stats.stoolTexture ? `（${stats.stoolTexture}）` : "";
  const parts = [
    `母乳 ${stats.breastCount} 次 ${fmtMinutes(stats.breastSeconds)}`,
    `奶瓶 ${stats.bottleCount} 次 ${stats.bottleMl}ml（奶粉 ${stats.formulaMl} / 母乳 ${stats.breastMl}）`,
    `便便 ${stats.stoolCount} 次${texture}`,
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
  const curMin = Math.round(cur.breastSeconds / 60);
  const prevMin = Math.round(prev.breastSeconds / 60);
  const stoolDetail = (s: RangeStats) => {
    const bits = [s.stoolTexture, s.stoolColor].filter(Boolean);
    return bits.length > 0 ? `（${bits.join("；")}）` : "";
  };
  const others = [...cur.stoolOthers, ...prev.stoolOthers];
  return [
    `可可（婴儿）的喂养记录对比。${curLabel}：母乳 ${cur.breastCount} 次 ${curMin} 分钟，奶瓶 ${cur.bottleCount} 次 ${cur.bottleMl}ml（奶粉 ${cur.formulaMl}ml、母乳 ${cur.breastMl}ml），便便 ${cur.stoolCount} 次${stoolDetail(cur)}。`,
    `${prevLabel}：母乳 ${prev.breastCount} 次 ${prevMin} 分钟，奶瓶 ${prev.bottleCount} 次 ${prev.bottleMl}ml（奶粉 ${prev.formulaMl}ml、母乳 ${prev.breastMl}ml），便便 ${prev.stoolCount} 次${stoolDetail(prev)}。`,
    others.length > 0 ? `便便的补充说明：${others.join("；")}。` : "",
    `写 2~3 句中文，给家人看的。要求：`,
    `1. 先算好变化（次数/时长/奶量/便便的增减），用一句概括最值得注意的变化，变化大时直接说"明显变多/变少"，并提醒是否需要留意；`,
    `2. 便便部分重点看性状和颜色：出现水样便、绿色便、黑色便、干硬等异常要提醒观察，正常则不用展开说；`,
    `3. 禁止逐项罗列数字，禁止出现括号补充说明；正文里最多出现 3 个具体数字；`,
    `4. 像家人说话一样自然温暖，最后一句给实用建议（如有异常信号优先提醒观察精神状态、尿量等）。`,
    `示例风格："可可今天吃得比昨天少了不少，奶量和亲喂时长都减半了，便便也少了。小婴儿偶尔一天吃得少不用太紧张，先观察精神状态和小便次数，如果明天还是这么少，或者精神不好，就要上心一点了。"`,
  ].filter(Boolean).join("\n");
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

/** 每日日报：昨天 vs 前天，每天 00:01 推送（凌晨推送，昨天全天数据已完整，无遗漏） */
export async function sendDailyReport(): Promise<void> {
  if (!barkConfigured()) return;
  const day = dateDaysAgo(1); // 报告昨天的完整自然日
  const prevDay = dateDaysAgo(2);

  const [cur, prev] = await Promise.all([
    rangeStats(day, day),
    rangeStats(prevDay, prevDay),
  ]);
  const summary = await summarizeWithFallback(
    "日报",
    cur,
    prev,
    `昨天（${day}）`,
    `前天（${prevDay}）`,
  );
  await barkPush(`可可日报 ${day.slice(5).replace("-", "/")}`, `${linesFor(cur)}。\n${summary}`);
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