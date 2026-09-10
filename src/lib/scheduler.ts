// 定时任务：喂养间隔提醒、计时遗忘提醒、每日日报、每周周报
// 由 instrumentation.ts 在服务启动时调用一次（globalThis 标记防止 dev 热重载重复注册）
import cron from "node-cron";
import { prisma } from "@/lib/prisma";
import { sendDailyReport, sendWeeklyReport } from "@/lib/report";
import { barkPush, barkConfigured } from "@/lib/bark";

const TZ = "Asia/Shanghai";
const INTERVAL_ALERT_HOURS = 4; // 喂养间隔阈值
const FORGET_ALERT_MINUTES = 45; // 单侧计时遗忘阈值
const INTERVAL_COOLDOWN_MS = 60 * 60 * 1000; // 间隔提醒冷却 1 小时
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 实时提醒检查周期

// 静音时段（北京时间）：22:30 ~ 07:30 不发提醒（日报周报在白天不受影响）
function isQuietHours(): boolean {
  const h = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const minutes = Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  return minutes >= 22 * 60 + 30 || minutes < 7 * 60 + 30;
}

/** 距最近一次喂养（母乳开始时间 / 奶瓶时间）多少毫秒 */
async function msSinceLastFeed(): Promise<number | null> {
  const [lastFeeding, lastBottle] = await Promise.all([
    prisma.feeding.findFirst({ orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
    prisma.bottle.findFirst({ orderBy: { time: "desc" }, select: { time: true } }),
  ]);
  const candidates = [lastFeeding?.startedAt, lastBottle?.time].filter(Boolean) as string[];
  if (candidates.length === 0) return null;
  const latest = candidates.sort().at(-1)!;
  // 墙上时间字符串转回真实时刻：与当前墙上时间的分钟差换算（够用，误差 < 1 分钟）
  return Date.now() - Date.parse(latest.replace(" ", "T") + ":00+08:00");
}

// ---- 防重复状态（内存即可，重启后最多多提醒一次，可接受） ----
let lastIntervalAlertAt = 0;
const forgetAlerted = new Set<number>(); // 已提醒过的 activeSideStartedAt（ms）

async function checkFeedingInterval(): Promise<void> {
  if (isQuietHours()) return;
  if (Date.now() - lastIntervalAlertAt < INTERVAL_COOLDOWN_MS) return;

  const active = await prisma.activeFeeding.findUnique({ where: { id: 1 } });
  if (active) return; // 正在计时中不提醒

  const ms = await msSinceLastFeed();
  if (ms == null || ms < INTERVAL_ALERT_HOURS * 3600000) return;

  const hours = Math.floor(ms / 3600000);
  lastIntervalAlertAt = Date.now();
  await barkPush("喂养提醒", `可可已经 ${hours} 小时没有吃奶了，该喂啦～`, "timeSensitive");
}

async function checkForgetTimer(): Promise<void> {
  if (isQuietHours()) return;
  const active = await prisma.activeFeeding.findUnique({ where: { id: 1 } });
  if (!active?.activeSideStartedAt) return;

  const startedMs = active.activeSideStartedAt.getTime();
  if (Date.now() - startedMs < FORGET_ALERT_MINUTES * 60000) return;
  if (forgetAlerted.has(startedMs)) return;

  forgetAlerted.add(startedMs);
  // 集合防膨胀：只保留最近 10 个
  if (forgetAlerted.size > 10) {
    const oldest = forgetAlerted.values().next().value;
    if (oldest != null) forgetAlerted.delete(oldest);
  }
  await barkPush("计时提醒", `母乳计时已经进行超过 ${FORGET_ALERT_MINUTES} 分钟，是不是忘记结束了？`, "timeSensitive");
}

function checkReminders(): void {
  Promise.all([checkFeedingInterval(), checkForgetTimer()]).catch((err) =>
    console.error("[scheduler] 提醒检查失败:", err),
  );
}

export function startScheduler(): void {
  if (!barkConfigured()) {
    console.log("[scheduler] 未配置 BARK_KEYS，定时任务跳过");
    return;
  }

  // 实时提醒：每 5 分钟
  setInterval(checkReminders, CHECK_INTERVAL_MS);

  // 每日日报 21:00（北京时间）
  cron.schedule("0 21 * * *", () => {
    sendDailyReport().catch((err) => console.error("[scheduler] 日报失败:", err));
  }, { timezone: TZ });

  // 每周周报 周一 09:00（北京时间）
  cron.schedule("0 9 * * 1", () => {
    sendWeeklyReport().catch((err) => console.error("[scheduler] 周报失败:", err));
  }, { timezone: TZ });

  console.log("[scheduler] 定时任务已启动：间隔/遗忘提醒(5min)、日报(21:00)、周报(周一09:00)");
}