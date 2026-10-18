"use client";

import {
  BottleModal,
  ManualFeedingModal,
  SleepModal,
  StartFeedingModal,
  StartSleepModal,
  StoolModal,
} from "@/components/RecordModals";
import { api, fmtClock, fmtDuration, fmtDurationMin } from "@/lib/client";
import { CountUp } from "@/components/CountUp";
import { PullToRefreshIndicator, usePullToRefresh } from "@/components/PullToRefresh";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isOvernight, sleepSeconds } from "@/lib/sleep";
import type { ActiveSleepState, ActiveState, DayData, Side, TimerData } from "@/lib/types";
import {
  AlertCircle,
  AlertTriangle,
  Baby,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Milk,
  Moon,
  Scale,
  Sparkles,
  Toilet,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Filter = "all" | "breast" | "bottle" | "stool" | "sleep";

const SIDE_NAME: Record<Side, string> = { left: "左侧", right: "右侧" };

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ---------------- 常驻喂养条（签名元素） ---------------- */

function ActiveBar({
  active,
  nowMs,
  anchor,
  onAction,
  busy,
}: {
  active: ActiveState;
  nowMs: number;
  anchor: { startedAt: string; elapsed: number; atMs: number } | null;
  onAction: (action: "endSide" | "switch" | "resume" | "finish", side?: Side) => void;
  busy: boolean;
}) {
  // 锚点 = 换侧时的服务器秒数 + 本地钟增量；同侧期间连续走秒，
  // 不用「设备当前时间 - 服务器开始时间」：设备与服务器时钟偏差会导致算出负数
  const liveElapsed =
    active.activeSide && anchor
      ? Math.max(0, anchor.elapsed + Math.floor((nowMs - anchor.atMs) / 1000))
      : 0;

  const doneTotal = (active.leftSeconds ?? 0) + (active.rightSeconds ?? 0);

  if (active.activeSide) {
    return (
      <div role="alert" className="alert bg-primary text-primary-content rounded-2xl shadow-lg">
        <div className="flex items-center gap-1.5">
          <span className="breathing-dot size-3 rounded-full bg-current" />
          <Baby className="size-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm opacity-80">母乳 · {SIDE_NAME[active.activeSide]}计时中</p>
          <p className="font-digits text-3xl leading-none font-bold">{fmtClock(liveElapsed)}</p>
        </div>
        <button className="btn" disabled={busy} onClick={() => onAction("endSide")}>
          结束本侧
        </button>
      </div>
    );
  }

  // 有一侧已结束：待处理提醒（所有设备同步显示）
  const doneSide = active.leftDone ? "left" : active.rightDone ? "right" : null;
  const bothDone = active.leftDone && active.rightDone;
  const sideDoneSeconds = doneSide
    ? doneSide === "left"
      ? active.leftSeconds
      : active.rightSeconds
    : null;
  const switchTarget: Side | null = !active.leftDone
    ? "left"
    : !active.rightDone
      ? "right"
      : null;

  return (
    <div role="alert" className="alert alert-warning flex-wrap rounded-2xl shadow-lg">
      <AlertTriangle className="size-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">
          {bothDone
            ? `已喂 ${fmtDuration(doneTotal)}`
            : doneSide && sideDoneSeconds != null
              ? `${SIDE_NAME[doneSide]}已喂 ${fmtDuration(sideDoneSeconds)}`
              : "一侧已喂完"}
        </p>
      </div>
      <div className="flex gap-2">
        {bothDone ? (
          <>
            <button className="btn btn-sm" disabled={busy} onClick={() => onAction("resume", "left")}>
              继续左
            </button>
            <button className="btn btn-sm" disabled={busy} onClick={() => onAction("resume", "right")}>
              继续右
            </button>
          </>
        ) : (
          doneSide && (
            <button className="btn btn-sm" disabled={busy} onClick={() => onAction("resume", doneSide)}>
              继续
            </button>
          )
        )}
        {switchTarget && (
          <button
            className="btn btn-sm"
            disabled={busy}
            onClick={() => onAction("switch", switchTarget)}
          >
            切换{SIDE_NAME[switchTarget]}
          </button>
        )}
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onAction("finish")}>
          结束
        </button>
      </div>
    </div>
  );
}

/* ---------------- 常驻睡眠条 ---------------- */

function SleepBar({
  activeSleep,
  liveElapsed,
  onWake,
  busy,
}: {
  activeSleep: ActiveSleepState;
  liveElapsed: number;
  onWake: () => void;
  busy: boolean;
}) {
  return (
    <div role="alert" className="alert alert-info rounded-2xl shadow-lg">
      <div className="flex items-center gap-1.5">
        <span className="breathing-dot size-3 rounded-full bg-current" />
        <Moon className="size-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm opacity-80">睡眠 · {activeSleep.startedAt.slice(11)} 开始</p>
        <p className="font-digits text-3xl leading-none font-bold">{fmtClock(liveElapsed)}</p>
      </div>
      <button className="btn" disabled={busy} onClick={onWake}>
        醒来
      </button>
    </div>
  );
}

/* ---------------- 时间线行 ---------------- */

function Row({
  time,
  icon,
  badge,
  badgeClass,
  title,
  note,
  onEdit,
  onDelete,
}: {
  time: string;
  icon: React.ReactNode;
  badge: string;
  badgeClass: string;
  title: string;
  note: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="list-row items-center cursor-pointer" onClick={onEdit}>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-digits w-12 text-center text-base font-semibold opacity-80">{time}</span>
        <span className={`badge badge-sm gap-1 whitespace-nowrap ${badgeClass}`}>
          {icon}
          {badge}
        </span>
      </div>
      <div className="list-col-grow min-w-0">
        <p className="truncate text-sm">{title}</p>
        {note && <p className="truncate text-xs opacity-60">{note}</p>}
      </div>
      <div className="flex shrink-0">
        <div className="tooltip" data-tip="删除">
          <button
            className="btn btn-ghost btn-square btn-xs text-trash"
            aria-label="删除"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

/* ---------------- 主组件 ---------------- */

export function FeedingStation() {
  const [date, setDate] = useState<string>(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date()));
  const [data, setData] = useState<DayData | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "error" | "warning" } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const currentDate = useRef<string | null>(null);
  const pendingRequest = useRef<AbortController | null>(null);
  const timerRequest = useRef<AbortController | null>(null);
  const lastTimerKey = useRef<string | null>(null);
  const [timers, setTimers] = useState<TimerData | null>(null);

  const [modal, setModal] = useState<
    | { type: "startFeeding" }
    | { type: "bottle" }
    | { type: "stool" }
    | { type: "manualFeeding" }
    | { type: "startSleep" }
    | { type: "manualSleep" }
    | { type: "editBottle"; id: number }
    | { type: "editStool"; id: number }
    | { type: "editFeeding"; id: number }
    | { type: "editSleep"; id: number }
    | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: "feeding" | "bottle" | "stool" | "sleep";
    id: number;
    label: string;
  } | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((text: string, kind: "error" | "warning" = "error") => {
    setToast({ text, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    // 警告是给人看的提示（比如睡眠超长），留久一点
    toastTimer.current = setTimeout(() => setToast(null), kind === "warning" ? 6000 : 3500);
  }, []);
  const showError = useCallback((text: string) => showToast(text, "error"), [showToast]);

  // 计时锚点：同一侧计时期间保持不变（本地连续走秒），换侧（activeSideStartedAt 变化）才重置；
  // 免疫设备与服务器时钟偏差，也避免轮询重置导致的显示卡顿
  const [anchor, setAnchor] = useState<{ startedAt: string; elapsed: number; atMs: number } | null>(null);
  // 睡眠只有「开始」一个时刻，用 startedAtMs 判断是否是新的一段计时
  const [sleepAnchor, setSleepAnchor] = useState<{ startedAtMs: string; elapsed: number; atMs: number } | null>(null);
  const applyTimers = useCallback((t: TimerData) => {
    const a = t.active;
    const startedAt = a.activeSideStartedAt;
    if (a.exists && a.activeSide && startedAt) {
      setAnchor((prev) =>
        prev && prev.startedAt === startedAt
          ? prev
          : { startedAt, elapsed: a.elapsed, atMs: Date.now() },
      );
    } else {
      setAnchor(null);
    }
    const s = t.activeSleep;
    if (s.exists && s.startedAtMs) {
      setSleepAnchor((prev) =>
        prev && prev.startedAtMs === s.startedAtMs
          ? prev
          : { startedAtMs: s.startedAtMs!, elapsed: s.elapsed, atMs: Date.now() },
      );
    } else {
      setSleepAnchor(null);
    }
    setTimers(t);
  }, []);

  const applyData = useCallback((d: DayData) => {
    setData(d);
  }, []);

  const refresh = useCallback(async () => {
    // 旧日期的保存回调不能取消新日期的请求，也不能把页面切回旧数据。
    if (currentDate.current !== date) return;
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    try {
      const next = await api<DayData>(`/api/day?date=${date}`, { signal: controller.signal });
      if (pendingRequest.current === controller && !controller.signal.aborted) {
        applyData(next);
        setLoadError(null);
      }
    } catch {
      if (pendingRequest.current === controller && !controller.signal.aborted) {
        setLoadError("记录加载失败，请稍后重试。");
      }
    } finally {
      if (pendingRequest.current === controller) pendingRequest.current = null;
    }
  }, [date, applyData]);

  const refreshTimers = useCallback(async (refreshRecordsOnChange = true) => {
    timerRequest.current?.abort();
    const controller = new AbortController();
    timerRequest.current = controller;
    try {
      const next = await api<TimerData>("/api/timers", { signal: controller.signal });
      if (timerRequest.current !== controller || controller.signal.aborted) return;
      // elapsed 每秒都在变；只比较计时状态本身，避免计时中每 2 秒重拉整天数据
      const key = JSON.stringify({
        active: {
          exists: next.active.exists,
          version: next.active.version,
          activeSide: next.active.activeSide,
          activeSideStartedAt: next.active.activeSideStartedAt,
          leftSeconds: next.active.leftSeconds,
          rightSeconds: next.active.rightSeconds,
          leftDone: next.active.leftDone,
          rightDone: next.active.rightDone,
        },
        activeSleep: {
          exists: next.activeSleep.exists,
          version: next.activeSleep.version,
          startedAt: next.activeSleep.startedAt,
          startedAtMs: next.activeSleep.startedAtMs,
        },
      });
      const changed = lastTimerKey.current !== null && lastTimerKey.current !== key;
      lastTimerKey.current = key;
      applyTimers(next);
      // 计时结束会落一条记录：状态变化后补拉当天数据
      if (changed && refreshRecordsOnChange) await refresh();
    } catch {
      // 计时轮询失败不打断页面；下一次 tick 自动重试
    } finally {
      if (timerRequest.current === controller) timerRequest.current = null;
    }
  }, [applyTimers, refresh]);

  // 普通记录：进入页面、日期切换、窗口聚焦/可见、下拉刷新时读取
  useEffect(() => {
    currentDate.current = date;
    // 用 setTimeout 触发首拉，避免在 effect 内同步调用会 setState 的异步函数
    const first = setTimeout(() => void refresh(), 0);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      currentDate.current = null;
      pendingRequest.current?.abort();
      pendingRequest.current = null;
      clearTimeout(first);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [date, refresh]);

  // 只轮询轻量计时状态；可见页每 2 秒，本地计时数字仍按秒走
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible" || timerRequest.current) return;
      void refreshTimers();
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      timerRequest.current?.abort();
      timerRequest.current = null;
      clearInterval(t);
    };
  }, [refreshTimers]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const active = timers?.active;
  const activeSleep = timers?.activeSleep;
  const pull = usePullToRefresh(async () => {
    await Promise.all([refresh(), refreshTimers(false)]);
  });

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      showError(err instanceof Error ? err.message : "操作失败");
    } finally {
      // 冲突操作失败后也重新读取状态，让按钮跟随另一台设备的操作结果。
      await Promise.all([refresh(), refreshTimers(false)]);
      setBusy(false);
    }
  }

  function handleActive(action: "endSide" | "switch" | "resume" | "finish", side?: Side) {
    run(() => api("/api/active", {
      method: "POST",
      body: JSON.stringify({ action, side, version: active?.version }),
    }));
  }

  function handleSleepStart() {
    run(() => api("/api/active-sleep", {
      method: "POST",
      body: JSON.stringify({ action: "start" }),
    }));
  }

  // 结束睡眠要看响应里的 discarded / warning，不能走无返回值的 run()
  async function handleSleepWake() {
    setBusy(true);
    try {
      const res = await api<{ discarded?: boolean; warning?: string }>("/api/active-sleep", {
        method: "POST",
        body: JSON.stringify({ action: "wake", version: activeSleep?.version }),
      });
      if (res.discarded) showToast("睡眠不足 1 分钟，已取消计时", "warning");
      else if (res.warning) showToast(res.warning, "warning");
    } catch (err) {
      showError(err instanceof Error ? err.message : "操作失败");
    } finally {
      await Promise.all([refresh(), refreshTimers(false)]);
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    const { kind, id } = confirmDelete;
    setConfirmDelete(null);
    await run(() => api(`/api/${kind}s/${id}`, { method: "DELETE" }));
  }

  const loadErrorNotice = loadError && (
    <div role="alert" className="alert sm:alert-horizontal">
      <AlertCircle className="size-5" />
      <span>{loadError}</span>
      <button className="btn btn-sm" onClick={() => void refresh()}>重试</button>
    </div>
  );

  if (!data) {
    return (
      <main className="mx-auto flex min-h-svh max-w-xl items-center justify-center px-4">
        {loadErrorNotice || <span role="status" aria-label="正在加载记录" className="loading loading-spinner loading-lg" />}
      </main>
    );
  }

  const isToday = data.date === data.today;
  const editingBottle = modal?.type === "editBottle" ? data.bottles.find((b) => b.id === modal.id) : undefined;
  const editingStool = modal?.type === "editStool" ? data.stools.find((s) => s.id === modal.id) : undefined;
  const editingFeeding = modal?.type === "editFeeding" ? data.feedings.find((f) => f.id === modal.id) : undefined;
  const editingSleep = modal?.type === "editSleep" ? data.sleeps.find((s) => s.id === modal.id) : undefined;

  // 时间线合并
  type Entry = { kind: "breast" | "bottle" | "stool" | "sleep"; time: string; node: React.ReactNode };
  const entries: Entry[] = [];
  for (const f of data.feedings) {
    const sides = [
      f.leftSeconds != null ? `左 ${fmtDuration(f.leftSeconds)}` : null,
      f.rightSeconds != null ? `右 ${fmtDuration(f.rightSeconds)}` : null,
    ].filter(Boolean);
    entries.push({
      kind: "breast",
      time: f.startedAt,
      node: (
        <Row
          key={`f${f.id}`}
          time={f.startedAt.slice(11)}
          icon={<Baby className="size-3" />}
          badge="母乳"
          badgeClass="badge-primary"
          title={sides.join(" · ") || fmtDuration((f.leftSeconds ?? 0) + (f.rightSeconds ?? 0))}
          note={f.note}
          onEdit={() => setModal({ type: "editFeeding", id: f.id })}
          onDelete={() =>
            setConfirmDelete({
              kind: "feeding",
              id: f.id,
              label: `母乳记录（${f.startedAt.slice(11)} 开始）`,
            })
          }
        />
      ),
    });
  }
  for (const b of data.bottles) {
    entries.push({
      kind: "bottle",
      time: b.time,
      node: (
        <Row
          key={`b${b.id}`}
          time={b.time.slice(11)}
          icon={<Milk className="size-3" />}
          badge="奶瓶"
          badgeClass="badge-secondary"
          title={`${b.amountMl}ml·${b.type}`}
          note={b.note}
          onEdit={() => setModal({ type: "editBottle", id: b.id })}
          onDelete={() =>
            setConfirmDelete({ kind: "bottle", id: b.id, label: `奶瓶记录（${b.time.slice(11)}，${b.amountMl} 毫升）` })
          }
        />
      ),
    });
  }
  for (const s of data.stools) {
    const detail = [s.textureOther ?? s.texture, s.colorOther ?? s.color]
      .filter(Boolean)
      .join(" · ");
    entries.push({
      kind: "stool",
      time: s.time,
      node: (
        <Row
          key={`s${s.id}`}
          time={s.time.slice(11)}
          icon={<Toilet className="size-3" />}
          badge="便便"
          badgeClass="badge-accent"
          title={detail || "仅时间"}
          note={s.note}
          onEdit={() => setModal({ type: "editStool", id: s.id })}
          onDelete={() => setConfirmDelete({ kind: "stool", id: s.id, label: `便便记录（${s.time.slice(11)}）` })}
        />
      ),
    });
  }
  // 睡眠在时间线上是一条区间记录：按入睡时刻归位，时长单独算（跨天时完整时段只出现在入睡日）
  for (const s of data.sleeps) {
    const overnight = isOvernight(s.startedAt, s.endedAt);
    entries.push({
      kind: "sleep",
      time: s.startedAt,
      node: (
        <Row
          key={`z${s.id}`}
          time={s.startedAt.slice(11)}
          icon={<Moon className="size-3" />}
          badge="睡眠"
          badgeClass="badge-info"
          title={`${fmtDuration(sleepSeconds(s.startedAt, s.endedAt))} · ${overnight ? "跨天到" : "到"} ${s.endedAt.slice(11)}`}
          note={s.note}
          onEdit={() => setModal({ type: "editSleep", id: s.id })}
          onDelete={() =>
            setConfirmDelete({
              kind: "sleep",
              id: s.id,
              label: `睡眠记录（${s.startedAt.slice(11)} 开始）`,
            })
          }
        />
      ),
    });
  }
  entries.sort((a, b) => (a.time < b.time ? 1 : -1));

  const sleepLiveElapsed = sleepAnchor
    ? Math.max(0, sleepAnchor.elapsed + Math.floor((nowMs - sleepAnchor.atMs) / 1000))
    : 0;
  const bothBars = !!activeSleep?.exists && !!active?.exists;

  return (
    <main className={`mx-auto max-w-xl px-4 pt-4 ${bothBars ? "pb-56" : "pb-40"}`}>
      <PullToRefreshIndicator distance={pull.distance} refreshing={pull.refreshing} />
      {loadErrorNotice && <div className="mb-4">{loadErrorNotice}</div>}
      {/* 顶栏：logo + 标题 + 统计入口 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/duofu.gif"
            alt="可可"
            className="size-10 rounded-xl shadow-sm"
          />
          <div className="flex items-center gap-2">
            <h1 className="shiny-title text-xl font-bold whitespace-nowrap">可可的喂养台</h1>
            {data.ageDays != null && (
              <span className="badge badge-primary badge-sm whitespace-nowrap font-digits">
                {data.ageDays}天
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/growth" className="btn btn-ghost btn-square btn-sm" aria-label="成长记录">
            <Scale className="size-5" />
          </Link>
          <Link href="/stats" className="btn btn-ghost btn-square btn-sm" aria-label="统计">
            <BarChart3 className="size-5" />
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {/* 日期导航 */}
      <div className="mb-4 flex items-center gap-2">
        <button className="btn btn-circle btn-sm" onClick={() => setDate(shiftDate(data.date, -1))} aria-label="前一天">
          <ChevronLeft className="size-4" />
        </button>
        <input
          type="date"
          className="input input-sm flex-1 font-digits"
          value={data.date}
          max={data.today}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
        <button
          className="btn btn-circle btn-sm"
          disabled={isToday}
          onClick={() => setDate(shiftDate(data.date, 1))}
          aria-label="后一天"
        >
          <ChevronRight className="size-4" />
        </button>
        {!isToday && (
          <button className="btn btn-sm btn-ghost" onClick={() => setDate(data.today)}>
            今天
          </button>
        )}
      </div>

      {/* 统计（不随筛选变化）：移动端 2x2，桌面 4 列 */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-box bg-base-200 px-3 py-2.5">
          <div className="stat-title flex items-center gap-1">
            <Baby className="size-3.5 opacity-70" />
            母乳
          </div>
          <div className="flex items-baseline gap-1">
            <span className="stat-value font-digits"><CountUp value={data.stats.breastCount} /></span>
            <span className="text-xs opacity-60">次 · {fmtDurationMin(data.stats.breastSeconds)}</span>
          </div>
        </div>
        <div className="rounded-box bg-base-200 px-3 py-2.5">
          <div className="stat-title flex items-center gap-1">
            <Milk className="size-3.5 opacity-70" />
            奶瓶
          </div>
          <div className="flex items-baseline gap-1">
            <span className="stat-value font-digits"><CountUp value={data.stats.bottleCount} /></span>
            <span className="text-xs opacity-60">次 · {data.stats.bottleMl} ml</span>
          </div>
        </div>
        <div className="rounded-box bg-base-200 px-3 py-2.5">
          <div className="stat-title flex items-center gap-1">
            <Moon className="size-3.5 opacity-70" />
            睡眠
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-digits text-2xl leading-none font-bold">
              {fmtDurationMin(data.stats.sleepSeconds)}
            </span>
          </div>
        </div>
        <div className="rounded-box bg-base-200 px-3 py-2.5">
          <div className="stat-title flex items-center gap-1">
            <Toilet className="size-3.5 opacity-70" />
            便便
          </div>
          <div className="flex items-baseline gap-1">
            <span className="stat-value font-digits"><CountUp value={data.stats.stoolCount} /></span>
            <span className="text-xs opacity-60">次</span>
          </div>
        </div>
      </div>

      {/* 四个固定入口：一行摆开，允许睡眠与喂养同时进行，但同类不能重复开 */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        <button
          className="btn btn-primary h-14 min-w-0 gap-1.5 px-1 text-sm"
          disabled={busy || !!active?.exists}
          onClick={() => setModal({ type: "startFeeding" })}
        >
          <Baby className="size-5 shrink-0" />
          母乳
        </button>
        <button
          className="btn btn-secondary h-14 min-w-0 gap-1.5 px-1 text-sm"
          onClick={() => setModal({ type: "bottle" })}
        >
          <Milk className="size-5 shrink-0" />
          奶瓶
        </button>
        <button
          className="btn btn-accent h-14 min-w-0 gap-1.5 px-1 text-sm"
          onClick={() => setModal({ type: "stool" })}
        >
          <Toilet className="size-5 shrink-0" />
          便便
        </button>
        <button
          className="btn btn-info h-14 min-w-0 gap-1.5 px-1 text-sm"
          disabled={busy || !!activeSleep?.exists}
          onClick={() => setModal({ type: "startSleep" })}
        >
          <Moon className="size-5 shrink-0" />
          睡眠
        </button>
      </div>

      {/* 类型筛选：默认全部，单选 */}
      <div className="join mb-3 w-full">
        {(
          [
            ["all", "全部"],
            ["breast", "母乳"],
            ["bottle", "奶瓶"],
            ["stool", "便便"],
            ["sleep", "睡眠"],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            className={`btn btn-sm join-item flex-1 ${filter === value ? "btn-neutral" : ""}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 时间线 */}
      <section>
          {entries.length === 0 ? (
            <div className="py-12 text-center">
              <Sparkles className="mx-auto mb-2 size-6 opacity-40" />
              <p className="text-sm opacity-60">今天还没有记录，从上方按钮开始吧。</p>
            </div>
          ) : (
            <ul className="list bg-base-100 rounded-2xl shadow-sm">
              {entries
                .filter((e) => filter === "all" || filter === e.kind)
                .map((e) => e.node)}
            </ul>
          )}
      </section>

      {/* 常驻计时条：睡眠在上、喂养在下，共用一个固定容器，两条同时开着也不会互相遮挡 */}
      {(activeSleep?.exists || active?.exists) && (
        <div className="fixed inset-x-0 bottom-0 z-40 pb-3.5">
          <div className="mx-auto max-w-xl space-y-2 px-4">
            {activeSleep?.exists && (
              <SleepBar
                activeSleep={activeSleep}
                liveElapsed={sleepLiveElapsed}
                onWake={handleSleepWake}
                busy={busy}
              />
            )}
            {active?.exists && (
              <ActiveBar active={active} nowMs={nowMs} anchor={anchor} onAction={handleActive} busy={busy} />
            )}
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {toast && (
        <div className="toast toast-top toast-center z-50">
          <div
            role="alert"
            className={`alert text-sm shadow-lg ${toast.kind === "error" ? "alert-error" : "alert-warning"}`}
          >
            {toast.kind === "error" ? (
              <AlertCircle className="size-4" />
            ) : (
              <AlertTriangle className="size-4" />
            )}
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* 弹窗 */}
      {modal?.type === "startFeeding" && (
        <StartFeedingModal
          busy={busy}
          onClose={() => setModal(null)}
          onStart={(side) => {
            setModal(null);
            run(() => api("/api/active", { method: "POST", body: JSON.stringify({ action: "start", side }) }));
          }}
          onManual={() => setModal({ type: "manualFeeding" })}
        />
      )}
      {modal?.type === "bottle" && (
        <BottleModal onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal?.type === "editBottle" && editingBottle && (
        <BottleModal initial={editingBottle} onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal?.type === "stool" && (
        <StoolModal onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal?.type === "editStool" && editingStool && (
        <StoolModal initial={editingStool} onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal?.type === "manualFeeding" && (
        <ManualFeedingModal onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal?.type === "editFeeding" && editingFeeding && (
        <ManualFeedingModal initial={editingFeeding} onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal?.type === "startSleep" && (
        <StartSleepModal
          busy={busy}
          onClose={() => setModal(null)}
          onStart={() => {
            setModal(null);
            handleSleepStart();
          }}
          onManual={() => setModal({ type: "manualSleep" })}
        />
      )}
      {modal?.type === "manualSleep" && (
        <SleepModal onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal?.type === "editSleep" && editingSleep && (
        <SleepModal initial={editingSleep} onClose={() => setModal(null)} onSaved={refresh} />
      )}

      {/* 删除确认 */}
      {confirmDelete && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning-ink" />
              <h3 className="text-lg font-bold">确认删除</h3>
            </div>
            <p className="py-3 text-sm">
              将删除{confirmDelete.label}，删除后不可恢复。
            </p>
            <div className="modal-action">
              <button className="btn" onClick={() => setConfirmDelete(null)}>
                取消
              </button>
              <button className="btn btn-error" onClick={handleDelete}>
                <Trash2 className="size-4" />
                删除
              </button>
            </div>
          </div>
          <button className="modal-backdrop" onClick={() => setConfirmDelete(null)} aria-label="关闭" />
        </dialog>
      )}
    </main>
  );
}
