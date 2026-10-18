"use client";

import { BarChart } from "@/components/BarChart";
import type { ChartSeries } from "@/components/BarChart";
import { api, fmtDurationMin } from "@/lib/client";
import { ArrowLeft, Baby, Milk, Moon, Toilet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface DayStat {
  date: string;
  breastSeconds: number;
  bottleMl: number;
  formulaMl: number;
  breastBottleMl: number;
  stoolCount: number;
  sleepSeconds: number; // 落在当天的实际睡眠时长（跨天按重叠拆分）
}

const RANGES = [7, 14, 30];

function fmtDate(d: string): string {
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
}

export default function StatsPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<DayStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ days: number; data: DayStat[] }>(`/api/stats?days=${days}`)
      .then((r) => {
        if (alive) setData(r.data);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "加载失败");
      });
    return () => {
      alive = false;
    };
  }, [days]);

  const breastTotalSeconds = data ? data.reduce((s, d) => s + d.breastSeconds, 0) : 0;
  const bottleTotalMl = data ? data.reduce((s, d) => s + d.bottleMl, 0) : 0;
  const stoolTotal = data ? data.reduce((s, d) => s + d.stoolCount, 0) : 0;
  const sleepTotalSeconds = data ? data.reduce((s, d) => s + d.sleepSeconds, 0) : 0;

  const labels = data ? data.map((d) => fmtDate(d.date)) : [];
  const breastSeries: ChartSeries[] = data
    ? [{ name: "母乳", colorVar: "var(--color-primary)", values: data.map((d) => d.breastSeconds) }]
    : [];
  const bottleSeries: ChartSeries[] = data
    ? [
        { name: "奶粉", colorVar: "var(--color-secondary)", values: data.map((d) => d.formulaMl) },
        { name: "母乳", colorVar: "var(--color-primary)", values: data.map((d) => d.breastBottleMl) },
      ]
    : [];
  const stoolSeries: ChartSeries[] = data
    ? [{ name: "便便", colorVar: "var(--color-accent)", values: data.map((d) => d.stoolCount) }]
    : [];
  const sleepSeries: ChartSeries[] = data
    ? [{ name: "睡眠", colorVar: "var(--color-info)", values: data.map((d) => d.sleepSeconds) }]
    : [];

  return (
    <main className="mx-auto max-w-xl px-4 pb-10 pt-4">
      {/* 顶栏 */}
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="btn btn-ghost btn-sm">
          <ArrowLeft className="size-4" />
          返回
        </Link>
        <h1 className="text-lg font-bold">综合统计</h1>
        <span className="w-16" />
      </div>

      {/* 范围切换 */}
      <div className="join mb-4 w-full">
        {RANGES.map((n) => (
          <button
            key={n}
            className={`btn btn-sm join-item flex-1 ${days === n ? "btn-neutral" : ""}`}
            onClick={() => setDays(n)}
          >
            近{n}天
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {!data && !error && (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {data && (
        <div className="space-y-3">
          {/* 母乳时长 */}
          <section className="rounded-box bg-base-200 p-3">
            <div className="mb-1 flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Baby className="size-4 opacity-80" />
                母乳时长
              </div>
              <span className="text-xs opacity-60">合计 {fmtDurationMin(breastTotalSeconds)}</span>
            </div>
            <BarChart
              labels={labels}
              series={breastSeries}
              format={(v) => fmtDurationMin(v)}
            />
          </section>

          {/* 奶瓶喂养量 */}
          <section className="rounded-box bg-base-200 p-3">
            <div className="mb-1 flex items-center justify-between gap-2 px-1">
              <div className="flex shrink-0 items-center gap-1.5 text-sm font-semibold">
                <Milk className="size-4 opacity-80" />
                奶瓶喂养量
              </div>
              <div className="flex min-w-0 items-center gap-2 text-xs opacity-70">
                <span className="flex shrink-0 items-center gap-1">
                  <span className="size-2 rounded-full" style={{ background: "var(--color-secondary)" }} />
                  奶粉
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="size-2 rounded-full" style={{ background: "var(--color-primary)" }} />
                  母乳
                </span>
                <span className="shrink-0 opacity-90">合计 {bottleTotalMl} ml</span>
              </div>
            </div>
            <BarChart
              labels={labels}
              series={bottleSeries}
              format={(v) => `${v} ml`}
            />
          </section>

          {/* 便便次数 */}
          <section className="rounded-box bg-base-200 p-3">
            <div className="mb-1 flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Toilet className="size-4 opacity-80" />
                便便次数
              </div>
              <span className="text-xs opacity-60">合计 {stoolTotal} 次</span>
            </div>
            <BarChart
              labels={labels}
              series={stoolSeries}
              format={(v) => `${v} 次`}
            />
          </section>

          {/* 睡眠时长（跨天时段按重叠拆分到相邻两天） */}
          <section className="rounded-box bg-base-200 p-3">
            <div className="mb-1 flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Moon className="size-4 opacity-80" />
                睡眠时长
              </div>
              <span className="text-xs opacity-60">合计 {fmtDurationMin(sleepTotalSeconds)}</span>
            </div>
            <BarChart
              labels={labels}
              series={sleepSeries}
              format={(v) => fmtDurationMin(v)}
              marginLeft={48}
            />
            <p className="mt-1 px-1 text-xs opacity-50">跨天的睡眠按天拆开计入</p>
          </section>
        </div>
      )}
    </main>
  );
}
