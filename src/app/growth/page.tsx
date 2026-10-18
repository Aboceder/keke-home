"use client";

import { GrowthModal } from "@/components/RecordModals";
import { LineChart } from "@/components/LineChart";
import type { LinePoint } from "@/components/LineChart";
import { PullToRefreshIndicator, usePullToRefresh } from "@/components/PullToRefresh";
import { api } from "@/lib/client";
import { ageTextAt, fmtDelta, fmtNum } from "@/lib/growth";
import type { GrowthRecord } from "@/lib/types";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Ruler,
  Scale,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface GrowthData {
  birthDate: string | null;
  rows: GrowthRecord[];
}

function fetchGrowth(): Promise<GrowthData> {
  return api<GrowthData>("/api/growth");
}

type Field = "weightJin" | "heightCm";

/** 某条记录相对「上一次有该字段数值的记录」的增量；没有上一次时返回 null */
function deltaAt(rows: GrowthRecord[], index: number, field: Field): number | null {
  const current = rows[index][field];
  if (current == null) return null;
  for (let i = index + 1; i < rows.length; i++) {
    const prev = rows[i][field];
    if (prev != null) return current - prev;
  }
  return null;
}

/** 最近一次有该字段数值的记录（rows 按日期倒序，所以就是第一个有值的） */
function latestWith(rows: GrowthRecord[], field: Field): { value: number; delta: number | null } | null {
  const i = rows.findIndex((r) => r[field] != null);
  if (i < 0) return null;
  return { value: rows[i][field]!, delta: deltaAt(rows, i, field) };
}

function fmtDate(d: string): string {
  return `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`;
}

/** 图表点：按日期升序，跳过缺测的记录 */
function pointsFor(rows: GrowthRecord[], field: Field, unit: string): LinePoint[] {
  return [...rows]
    .reverse()
    .filter((r) => r[field] != null)
    .map((r) => ({
      date: r.date,
      value: r[field]!,
      tip: `${fmtDate(r.date)}：${fmtNum(r[field]!)} ${unit}`,
    }));
}

/** 图表卡片：标题 + 最新值/增量 + 折线图 */
function ChartCard({
  title,
  icon,
  unit,
  colorVar,
  points,
  latest,
  domain,
}: {
  title: string;
  icon: React.ReactNode;
  unit: string;
  colorVar: string;
  points: LinePoint[];
  latest: { value: number; delta: number | null } | null;
  domain?: { start: string; end: string };
}) {
  return (
    <section className="rounded-box bg-base-200 p-3">
      <div className="mb-1 flex items-baseline justify-between px-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </div>
        {latest && (
          <div className="flex items-baseline gap-1.5">
            <span className="font-digits text-base font-bold">
              {fmtNum(latest.value)} <span className="text-xs font-normal opacity-70">{unit}</span>
            </span>
            {latest.delta != null && (
              <span className="text-xs opacity-60">较上次 {fmtDelta(latest.delta)}</span>
            )}
          </div>
        )}
      </div>
      {points.length > 0 ? (
        <LineChart points={points} unit={unit} colorVar={colorVar} domain={domain} />
      ) : (
        <p className="py-10 text-center text-sm opacity-60">还没有{title}记录</p>
      )}
    </section>
  );
}

export default function GrowthPage() {
  const [data, setData] = useState<GrowthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ id: number } | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GrowthRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const confirmRef = useRef<HTMLDialogElement>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await fetchGrowth());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  const pull = usePullToRefresh(refresh);

  // 成长数据变化少：进入页面、窗口聚焦/可见或下拉刷新时读取，不做高频轮询
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    const dialog = confirmRef.current;
    if (!dialog) return;
    if (confirmDelete) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [confirmDelete]);

  useEffect(() => {
    let alive = true;
    fetchGrowth()
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "加载失败");
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleDelete() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    setBusy(true);
    try {
      await api(`/api/growth/${target.id}`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "删除失败");
      setTimeout(() => setToast(null), 3500);
    } finally {
      setBusy(false);
    }
  }

  const rows = data?.rows ?? [];
  const editing = modal && modal !== "new" ? rows.find((r) => r.id === modal.id) : undefined;
  const weightPoints = pointsFor(rows, "weightJin", "斤");
  const heightPoints = pointsFor(rows, "heightCm", "cm");
  // 两张图共用完整记录日期范围，缺测日期也会保留在横轴上
  const domain =
    rows.length > 0 ? { start: rows.at(-1)!.date, end: rows[0].date } : undefined;

  return (
    <main className="mx-auto max-w-xl px-4 pb-10 pt-4">
      <PullToRefreshIndicator distance={pull.distance} refreshing={pull.refreshing} />
      {/* 顶栏 */}
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="btn btn-ghost btn-sm">
          <ArrowLeft className="size-4" />
          返回
        </Link>
        <h1 className="text-lg font-bold">成长记录</h1>
        <div className="flex items-center gap-1">
          <button className="btn btn-primary btn-sm" onClick={() => setModal("new")}>
            <Plus className="size-4" />
            记录
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <AlertCircle className="size-5" />
          <span>{error}</span>
          <button className="btn btn-sm" onClick={() => void refresh()}>
            重试
          </button>
        </div>
      )}

      {!data && !error && (
        <div className="flex justify-center py-12">
          <span role="status" aria-label="正在加载" className="loading loading-spinner loading-lg" />
        </div>
      )}

      {data && (
        <div className="space-y-3">
          {/* 两张图共用真实日期横轴，上下对齐可直接对照 */}
          <ChartCard
            title="体重"
            icon={<Scale className="size-4 opacity-80" />}
            unit="斤"
            colorVar="var(--color-secondary)"
            points={weightPoints}
            latest={latestWith(rows, "weightJin")}
            domain={domain}
          />
          <ChartCard
            title="身高"
            icon={<Ruler className="size-4 opacity-80" />}
            unit="cm"
            colorVar="var(--color-info)"
            points={heightPoints}
            latest={latestWith(rows, "heightCm")}
            domain={domain}
          />

          {/* 记录列表：默认收起，避免长历史压住页面；展开后按日期倒序 */}
          {rows.length === 0 ? (
            <div className="py-12 text-center">
              <Sparkles className="mx-auto mb-2 size-6 opacity-40" />
              <p className="text-sm opacity-60">还没有记录，点右上角「记录」开始吧。</p>
            </div>
          ) : (
            <section className="rounded-box overflow-hidden bg-base-100 shadow-sm">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                aria-expanded={listOpen}
                aria-controls="growth-record-list"
                onClick={() => setListOpen((open) => !open)}
              >
                <span className="text-sm font-semibold">
                  全部记录 <span className="font-digits opacity-60">{rows.length}</span>
                </span>
                {listOpen ? (
                  <ChevronUp className="size-4 opacity-60" />
                ) : (
                  <ChevronDown className="size-4 opacity-60" />
                )}
              </button>
              {listOpen && (
                <ul id="growth-record-list" className="list">
                  {rows.map((r, i) => {
                    const weightDelta = deltaAt(rows, i, "weightJin");
                    const heightDelta = deltaAt(rows, i, "heightCm");
                    const age = data.birthDate ? ageTextAt(data.birthDate, r.date) : null;
                    return (
                      <li
                        key={r.id}
                        className="list-row items-center cursor-pointer"
                        onClick={() => setModal({ id: r.id })}
                      >
                        <div className="flex shrink-0 flex-col items-start gap-0.5">
                          <span className="font-digits text-sm font-semibold">{fmtDate(r.date)}</span>
                          {age && <span className="text-xs whitespace-nowrap opacity-50">{age}</span>}
                        </div>
                        <div className="list-col-grow min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            {r.weightJin != null && (
                              <span className="font-digits text-sm">
                                {fmtNum(r.weightJin)}
                                <span className="text-xs opacity-60"> 斤</span>
                                {weightDelta != null && (
                                  <span className="ml-1 text-xs opacity-60">{fmtDelta(weightDelta)}</span>
                                )}
                              </span>
                            )}
                            {r.heightCm != null && (
                              <span className="font-digits text-sm">
                                {fmtNum(r.heightCm)}
                                <span className="text-xs opacity-60"> cm</span>
                                {heightDelta != null && (
                                  <span className="ml-1 text-xs opacity-60">{fmtDelta(heightDelta)}</span>
                                )}
                              </span>
                            )}
                          </div>
                          {r.note && <p className="truncate text-xs opacity-60">{r.note}</p>}
                        </div>
                        <div className="flex shrink-0">
                          <div className="tooltip" data-tip="删除">
                            <button
                              className="btn btn-ghost btn-square btn-xs text-trash"
                              aria-label="删除"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(r);
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {toast && (
        <div className="toast toast-top toast-center z-50">
          <div role="alert" className="alert alert-error text-sm shadow-lg">
            <AlertCircle className="size-4" />
            <span>{toast}</span>
          </div>
        </div>
      )}

      {modal === "new" && <GrowthModal onClose={() => setModal(null)} onSaved={refresh} />}
      {editing && <GrowthModal initial={editing} onClose={() => setModal(null)} onSaved={refresh} />}

      {confirmDelete && (
        <dialog
          ref={confirmRef}
          className="modal"
          onClose={() => setConfirmDelete(null)}
        >
          <div className="modal-box max-w-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning-ink" />
              <h3 className="text-lg font-bold">确认删除</h3>
            </div>
            <p className="py-3 text-sm">
              将删除 {fmtDate(confirmDelete.date)} 的成长记录
              {confirmDelete.weightJin != null && `（${fmtNum(confirmDelete.weightJin)} 斤）`}
              ，删除后不可恢复。
            </p>
            <div className="modal-action">
              <button className="btn" onClick={() => setConfirmDelete(null)}>
                取消
              </button>
              <button className="btn btn-error" disabled={busy} onClick={handleDelete}>
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
