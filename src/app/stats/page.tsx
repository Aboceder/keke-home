"use client";

import { BarChart } from "@/components/BarChart";
import { api, fmtDurationMin } from "@/lib/client";
import { ArrowLeft, Baby, Milk, Toilet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface DayStat {
  date: string;
  breastSeconds: number;
  bottleMl: number;
  stoolCount: number;
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
              bars={data.map((d) => ({ label: fmtDate(d.date), value: d.breastSeconds }))}
              colorVar="var(--color-primary)"
              format={(v) => fmtDurationMin(v)}
            />
          </section>

          {/* 奶瓶喂养量 */}
          <section className="rounded-box bg-base-200 p-3">
            <div className="mb-1 flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Milk className="size-4 opacity-80" />
                奶瓶喂养量
              </div>
              <span className="text-xs opacity-60">合计 {bottleTotalMl} ml</span>
            </div>
            <BarChart
              bars={data.map((d) => ({ label: fmtDate(d.date), value: d.bottleMl }))}
              colorVar="var(--color-secondary)"
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
              bars={data.map((d) => ({ label: fmtDate(d.date), value: d.stoolCount }))}
              colorVar="var(--color-accent)"
              format={(v) => `${v} 次`}
            />
          </section>
        </div>
      )}
    </main>
  );
}