"use client";

import { PhotoViewer } from "@/components/PhotoViewer";
import { BottleModal, ManualFeedingModal, PhotoUploadModal, StartFeedingModal, StoolModal } from "@/components/RecordModals";
import { api, fmtClock, fmtDuration } from "@/lib/client";
import type { ActiveState, DayData, Side } from "@/lib/types";
import Image from "next/image";
import {
  AlertCircle,
  AlertTriangle,
  Baby,
  Camera,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Milk,
  Moon,
  Pencil,
  Sparkles,
  Sun,
  Trash2,
  Utensils,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type Filter = "all" | "breast" | "bottle" | "stool" | "photo";

const SIDE_NAME: Record<Side, string> = { left: "左侧", right: "右侧" };

/** 主题跟随 <html data-theme>（由 layout 内联脚本设定，切换由 MutationObserver 同步） */
function useTheme(): "nightlight" | "daylight" {
  const theme = useSyncExternalStore(
    (notify) => {
      const obs = new MutationObserver(notify);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => obs.disconnect();
    },
    () => document.documentElement.getAttribute("data-theme") ?? "nightlight",
    () => "nightlight",
  );
  return theme === "daylight" ? "daylight" : "nightlight";
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ---------------- 常驻喂养条（签名元素） ---------------- */

function ActiveBar({
  active,
  nowMs,
  onAction,
  busy,
}: {
  active: ActiveState;
  nowMs: number;
  onAction: (action: "endSide" | "switch" | "finish", side?: Side) => void;
  busy: boolean;
}) {
  const liveElapsed =
    active.activeSide && active.activeSideStartedAt
      ? Math.max(0, Math.floor((nowMs - Date.parse(active.activeSideStartedAt)) / 1000))
      : 0;

  const doneTotal = (active.leftSeconds ?? 0) + (active.rightSeconds ?? 0);

  if (active.activeSide) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 p-3">
        <div role="alert" className="alert bg-primary text-primary-content mx-auto max-w-xl rounded-2xl shadow-lg">
          <div className="flex items-center gap-1.5">
            <span className="breathing-dot size-3 rounded-full bg-current" />
            <Milk className="size-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm opacity-80">母乳 · {SIDE_NAME[active.activeSide]}计时中</p>
            <p className="font-digits text-3xl leading-none font-bold">{fmtClock(liveElapsed)}</p>
          </div>
          <button className="btn" disabled={busy} onClick={() => onAction("endSide")}>
            结束本侧
          </button>
        </div>
      </div>
    );
  }

  // 有一侧已结束：待处理提醒（所有设备同步显示）
  // 切换目标 = 尚未计时过的一侧（可能两侧都已喂，此时只保留「结束喂奶」）
  const doneSide = active.leftDone ? "left" : active.rightDone ? "right" : null;
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
    <div className="fixed inset-x-0 bottom-0 z-40 p-3">
      <div role="alert" className="alert alert-warning mx-auto flex-wrap max-w-xl rounded-2xl shadow-lg">
        <AlertTriangle className="size-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">一侧已喂完，切换另一侧还是结束喂奶？</p>
          <p className="font-digits text-sm opacity-80">
            已喂 {fmtDuration(doneTotal)}
            {sideDoneSeconds != null && `（本侧 ${fmtDuration(sideDoneSeconds)}）`}
          </p>
        </div>
        <div className="flex gap-2">
          {switchTarget && (
            <button
              className="btn btn-sm"
              disabled={busy}
              onClick={() => onAction("switch", switchTarget)}
            >
              切换到{SIDE_NAME[switchTarget]}
            </button>
          )}
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onAction("finish")}>
            结束喂奶
          </button>
        </div>
      </div>
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
    <li className="list-row items-center gap-3">
      <span className="font-digits w-12 shrink-0 text-center text-base font-semibold opacity-80">
        {time}
      </span>
      <span className={`badge badge-sm shrink-0 gap-1 ${badgeClass}`}>
        {icon}
        {badge}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{title}</p>
        {note && <p className="truncate text-xs opacity-60">{note}</p>}
      </div>
      <div className="flex shrink-0">
        <div className="tooltip" data-tip="编辑">
          <button className="btn btn-ghost btn-square btn-xs" onClick={onEdit} aria-label="编辑">
            <Pencil className="size-3.5" />
          </button>
        </div>
        <div className="tooltip" data-tip="删除">
          <button className="btn btn-ghost btn-square btn-xs text-error" onClick={onDelete} aria-label="删除">
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
  const [toast, setToast] = useState<string | null>(null);

  const [modal, setModal] = useState<
    | { type: "startFeeding" }
    | { type: "bottle" }
    | { type: "stool" }
    | { type: "manualFeeding" }
    | { type: "photo" }
    | { type: "editBottle"; id: number }
    | { type: "editStool"; id: number }
    | { type: "editFeeding"; id: number }
    | null
  >(null);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: "feeding" | "bottle" | "stool";
    id: number;
    label: string;
  } | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showError = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setData(await api<DayData>(`/api/day?date=${date}`));
    } catch (err) {
      showError(err instanceof Error ? err.message : "加载失败");
    }
  }, [date, showError]);

  // 自动同步：轮询（可见页每 2 秒）+ 计时本地走秒
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      api<DayData>(`/api/day?date=${date}`)
        .then((d) => {
          if (alive) setData(d);
        })
        .catch(() => {});
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [date]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const active = data?.active;

  const theme = useTheme();

  function toggleTheme() {
    const next = theme === "nightlight" ? "daylight" : "nightlight";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme-override", next);
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  function handleActive(action: "endSide" | "switch" | "finish", side?: Side) {
    run(() => api("/api/active", { method: "POST", body: JSON.stringify({ action, side }) }));
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    const { kind, id } = confirmDelete;
    setConfirmDelete(null);
    await run(() => api(`/api/${kind}s/${id}`, { method: "DELETE" }));
  }

  if (!data) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </main>
    );
  }

  const isToday = data.date === data.today;
  const editingBottle = modal?.type === "editBottle" ? data.bottles.find((b) => b.id === modal.id) : undefined;
  const editingStool = modal?.type === "editStool" ? data.stools.find((s) => s.id === modal.id) : undefined;
  const editingFeeding = modal?.type === "editFeeding" ? data.feedings.find((f) => f.id === modal.id) : undefined;

  // 时间线合并
  type Entry = { kind: "breast" | "bottle" | "stool"; time: string; node: React.ReactNode };
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
          title={`${sides.join(" · ") || "时长待补"}（共 ${fmtDuration((f.leftSeconds ?? 0) + (f.rightSeconds ?? 0))}）`}
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
          title={`${b.amountMl} 毫升`}
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
    const detail = [
      s.texture === "其他" ? `其他（${s.textureOther}）` : s.texture,
      s.color === "其他" ? `其他（${s.colorOther}）` : s.color,
    ]
      .filter(Boolean)
      .join(" · ");
    entries.push({
      kind: "stool",
      time: s.time,
      node: (
        <Row
          key={`s${s.id}`}
          time={s.time.slice(11)}
          icon={<Droplets className="size-3" />}
          badge="排便"
          badgeClass="badge-accent"
          title={detail || "仅时间"}
          note={s.note}
          onEdit={() => setModal({ type: "editStool", id: s.id })}
          onDelete={() => setConfirmDelete({ kind: "stool", id: s.id, label: `排便记录（${s.time.slice(11)}）` })}
        />
      ),
    });
  }
  entries.sort((a, b) => (a.time < b.time ? 1 : -1));

  const showPhotos = filter === "all" || filter === "photo";
  const showEntries = filter === "all" || filter !== "photo";

  return (
    <main className="mx-auto max-w-xl px-4 pb-40 pt-4">
      {/* 顶栏：logo + 标题 + 主题切换 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Image
            src="/icon.png"
            alt="可可"
            width={40}
            height={40}
            className="size-10 rounded-xl shadow-sm"
          />
          <h1 className="text-xl font-bold">可可的喂养台</h1>
        </div>
        <button className="btn btn-circle btn-ghost btn-sm" onClick={toggleTheme} aria-label="切换昼夜主题">
          {theme === "nightlight" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
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
        <div className="rounded-box bg-base-200 px-3 py-3">
          <div className="stat-title flex items-center gap-1">
            <Baby className="size-3.5 opacity-70" />
            母乳
          </div>
          <div className="stat-value font-digits">{data.stats.breastCount}</div>
          <div className="stat-desc">次</div>
        </div>
        <div className="rounded-box bg-base-200 px-3 py-3">
          <div className="stat-title flex items-center gap-1">
            <Milk className="size-3.5 opacity-70" />
            奶瓶
          </div>
          <div className="stat-value font-digits">{data.stats.bottleCount}</div>
          <div className="stat-desc">次 · {data.stats.bottleMl} 毫升</div>
        </div>
        <div className="rounded-box bg-base-200 px-3 py-3">
          <div className="stat-title flex items-center gap-1">
            <Utensils className="size-3.5 opacity-70" />
            总喂养
          </div>
          <div className="stat-value font-digits">{data.stats.feedCount}</div>
          <div className="stat-desc">次</div>
        </div>
        <div className="rounded-box bg-base-200 px-3 py-3">
          <div className="stat-title flex items-center gap-1">
            <Droplets className="size-3.5 opacity-70" />
            排便
          </div>
          <div className="stat-value font-digits">{data.stats.stoolCount}</div>
          <div className="stat-desc">次</div>
        </div>
      </div>

      {/* 四个固定入口 */}
      <div className="mb-2 grid grid-cols-2 gap-3">
        <button
          className="btn btn-primary btn-lg h-16 text-base"
          disabled={busy || !!active?.exists}
          onClick={() => setModal({ type: "startFeeding" })}
        >
          <Baby className="size-5" />
          {active?.exists ? "喂养中…" : "开始母乳"}
        </button>
        <button className="btn btn-lg h-16 text-base" onClick={() => setModal({ type: "bottle" })}>
          <Milk className="size-5" />
          记录奶瓶
        </button>
        <button className="btn btn-lg h-16 text-base" onClick={() => setModal({ type: "stool" })}>
          <Droplets className="size-5" />
          记录排便
        </button>
        <button className="btn btn-lg h-16 text-base" onClick={() => setModal({ type: "photo" })}>
          <Camera className="size-5" />
          上传照片
        </button>
      </div>
      <div className="mb-4 text-center">
        <button className="btn btn-ghost btn-xs" onClick={() => setModal({ type: "manualFeeding" })}>
          <Pencil className="size-3.5" />
          补录母乳（手动填写时长）
        </button>
      </div>

      {/* 类型筛选：默认全部，单选 */}
      <div className="join mb-3 w-full">
        {(
          [
            ["all", "全部"],
            ["breast", "母乳"],
            ["bottle", "奶瓶"],
            ["stool", "排便"],
            ["photo", "照片"],
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

      {/* 当天照片（时间线顶部独立区域） */}
      {showPhotos && data.photos.length > 0 && (
        <section className="mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {data.photos.map((p, i) => (
              <button key={p.id} className="shrink-0" onClick={() => setViewerIdx(i)} aria-label={p.note ?? "查看照片"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${p.id}/image?v=thumb`}
                  alt={p.note ?? "可可的照片"}
                  className="size-24 rounded-xl object-cover shadow-sm"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 时间线 */}
      {showEntries && (
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
      )}

      {/* 常驻喂养条 */}
      {active?.exists && <ActiveBar active={active} nowMs={nowMs} onAction={handleActive} busy={busy} />}

      {/* 错误提示 */}
      {toast && (
        <div className="toast toast-top toast-center z-50">
          <div role="alert" className="alert alert-error text-sm shadow-lg">
            <AlertCircle className="size-4" />
            <span>{toast}</span>
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
      {modal?.type === "photo" && (
        <PhotoUploadModal today={data.today} onClose={() => setModal(null)} onSaved={refresh} />
      )}

      {/* 照片查看器 */}
      {viewerIdx != null && (
        <PhotoViewer
          photos={data.photos}
          index={viewerIdx}
          today={data.today}
          onClose={() => setViewerIdx(null)}
          onError={showError}
          onChanged={refresh}
        />
      )}

      {/* 删除确认 */}
      {confirmDelete && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" />
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