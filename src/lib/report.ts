// 日报/周报：数据聚合（程序算）→ AI 总结（可降级为模板）→ Bark 推送
import { ageDaysAt, birthDate } from "@/lib/age";
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
  feedCount: number; // 母乳 + 奶瓶总次数
  avgGapMin: number | null; // 相邻两次喂养平均间隔（分钟），次数 < 2 为 null
  maxGapMin: number | null; // 最长一次间隔
  nightFeedCount: number; // 夜奶次数（22:00 ~ 06:00 开始/记录的喂养）
  peakHours: string; // 喂养最集中的时段，如 "10点~12点 4次、16点~18点 3次"，无数据为空串
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
      select: { startedAt: true, leftSeconds: true, rightSeconds: true },
    }),
    prisma.bottle.findMany({
      where: { time: { gte: `${startDate} 00:00`, lte: `${endDate} 23:59` } },
      select: { time: true, amountMl: true, type: true },
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
    ...feedRhythm(
      [
        ...feedings.map((f) => f.startedAt),
        ...bottles.map((b) => b.time),
      ],
    ),
    stoolCount: stools.length,
    stoolTexture,
    stoolColor,
    stoolOthers,
  };
  return stats;
}

/**
 * 进食规律：相邻喂养（母乳开始时间/奶瓶时间）的平均与最长间隔、夜奶次数、最集中时段。
 * 墙上时间字符串字典序即时间序，可直接排序；次数 < 2 算不出间隔。
 */
function feedRhythm(
  times: string[],
): Pick<RangeStats, "feedCount" | "avgGapMin" | "maxGapMin" | "nightFeedCount" | "peakHours"> {
  const sorted = [...times].sort();
  const gaps = sorted.slice(1).map((t, i) => {
    const a = Date.parse(`${sorted[i]}:00+08:00`);
    const b = Date.parse(`${t}:00+08:00`);
    return Math.max(0, Math.round((b - a) / 60000));
  });
  const isNight = (t: string) => {
    const h = Number(t.slice(11, 13));
    return h >= 22 || h < 6;
  };
  // 北京时间按 00~02、02~04 等固定两小时时段分桶，标签与计数覆盖同一区间。
  const hourBuckets = new Map<number, number>();
  for (const t of sorted) {
    const h = Math.floor(Number(t.slice(11, 13)) / 2) * 2;
    hourBuckets.set(h, (hourBuckets.get(h) ?? 0) + 1);
  }
  const peakCount = Math.max(0, ...hourBuckets.values());
  const buckets = [...hourBuckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, n]) => n >= 2 && n >= peakCount / 2)
    .slice(0, 3)
    .sort((a, b) => a[0] - b[0])
    .map(([h, n]) => `${h}点~${(h + 2) % 24}点 ${n}次`);
  return {
    feedCount: sorted.length,
    avgGapMin: gaps.length > 0 ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null,
    maxGapMin: gaps.length > 0 ? Math.max(...gaps) : null,
    nightFeedCount: sorted.filter(isNight).length,
    peakHours: buckets.join("、"),
  };
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
  return `${label} ${cur}${unit}（${diff === 0 ? "持平" : `${diff > 0 ? "多" : "少"} ${Math.abs(diff)}${unit}`}）`;
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
  endDate: string,
): string {
  const birth = birthDate();
  const ageDays = birth ? ageDaysAt(endDate) : null;
  const ageLine =
    birth && ageDays != null
      ? `可可出生日期 ${birth}，到 ${endDate} 是出生第 ${ageDays} 天。请结合月龄阶段（如新生儿/满月/百天/半岁）判断这些数据是否正常，并让建议贴合月龄。`
      : "";
  const curMin = Math.round(cur.breastSeconds / 60);
  const prevMin = Math.round(prev.breastSeconds / 60);
  const stoolDetail = (s: RangeStats) => {
    const bits = [s.stoolTexture, s.stoolColor].filter(Boolean);
    return bits.length > 0 ? `（${bits.join("；")}）` : "";
  };
  const others = [...cur.stoolOthers, ...prev.stoolOthers];
  const rhythmLine = (s: RangeStats) => {
    if (s.avgGapMin == null || s.maxGapMin == null) return "间隔不足两次，无法统计";
    const peak = s.peakHours ? `，喂养集中在 ${s.peakHours}` : "";
    return `共 ${s.feedCount} 次，平均间隔 ${fmtMinutes(s.avgGapMin * 60)}，最长间隔 ${fmtMinutes(s.maxGapMin * 60)}，夜奶（22点~6点）${s.nightFeedCount} 次${peak}`;
  };
  return [
    ageLine,
    `可可（婴儿）的喂养记录对比。${curLabel}：母乳 ${cur.breastCount} 次 ${curMin} 分钟，奶瓶 ${cur.bottleCount} 次 ${cur.bottleMl}ml（奶粉 ${cur.formulaMl}ml、母乳 ${cur.breastMl}ml），进食规律：${rhythmLine(cur)}，便便 ${cur.stoolCount} 次${stoolDetail(cur)}。`,
    `${prevLabel}：母乳 ${prev.breastCount} 次 ${prevMin} 分钟，奶瓶 ${prev.bottleCount} 次 ${prev.bottleMl}ml（奶粉 ${prev.formulaMl}ml、母乳 ${prev.breastMl}ml），进食规律：${rhythmLine(prev)}，便便 ${prev.stoolCount} 次${stoolDetail(prev)}。`,
    others.length > 0 ? `便便的补充说明：${others.join("；")}。` : "",
    `${periodName === "周报" ? "写 4~6 句" : "写 3~5 句"}中文，给家人看的。要求：`,
    `1. 概括喂养变化：次数/时长/奶量/便便的增减，变化大时直接说"明显变多/变少"，并提醒是否需要留意；`,
    `2. 说一说进食规律：结合平均间隔、最长间隔、夜奶次数的变化（比如白天间隔是否在拉长、夜奶是否减少），以及喂养集中的时段（方便家人提前准备、掌握喂奶节奏），贴合月龄讲讲规律是否在变好、有什么可以引导的方向；`,
    `3. 用你的育儿知识，结合月龄和真实数据给一句温馨提示（这个月龄的喂养特点/常见现象/可以尝试的做法）；但数据明显异常时，优先提醒异常和需要观察的信号，不用再展开科普；`,
    `4. 如果数据少得不像这个周期的正常水平（比如一天只记录了一两次、奶量低得离谱），优先提醒家人"是不是忘记记录了"，而不是当成喂养异常；`,
    `5. 便便重点看性状和颜色：出现水样便、绿色便、黑色便、干硬等异常要提醒观察，正常则不用展开说；`,
    `6. 不要像报表一样逐项罗列数字，禁止括号补充说明；数字挑最关键的用，说清意思就好；`,
    `7. 像家人说话一样自然温暖，最后一句给实用建议（如有异常信号优先提醒观察精神状态、尿量等）。`,
    `示例风格："可可最近吃奶的间隔慢慢拉开了，白天能隔三个多小时才饿，夜里也要醒一次。奶量比上星期稳中有升，便便金黄软糊，挺让人放心的。这个月龄可以试着在白天多跟她说说话玩一玩，别一哭就喂，也许很快就能睡整觉啦。"`,
  ].filter(Boolean).join("\n");
}

/** AI 总结，失败/未配置时用程序拼接的模板兜底 */
async function summarizeWithFallback(
  periodName: string,
  cur: RangeStats,
  prev: RangeStats,
  curLabel: string,
  prevLabel: string,
  endDate: string,
): Promise<string> {
  if (aiConfigured()) {
    const text = await aiSummarize(buildPrompt(periodName, cur, prev, curLabel, prevLabel, endDate));
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
    day,
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
    end,
  );
  await barkPush(
    `可可周报 ${start.slice(5).replace("-", "/")}~${end.slice(5).replace("-", "/")}`,
    `母乳 ${cur.breastCount} 次 ${fmtMinutes(cur.breastSeconds)}，奶瓶 ${cur.bottleCount} 次 ${cur.bottleMl}ml（日均 ${dailyMl}ml），便便 ${cur.stoolCount} 次。\n${summary}`,
  );
}
