"use client";

import { useEffect, useId, useState } from "react";

export interface ChartSeries {
  name: string;
  colorVar: string;
  values: number[];
}

/** 柱体层：数据变化时（key 变化）重新从基线向上生长 */
function Bars({
  labels,
  series,
  format,
  marginLeft,
  baseline,
  max,
  plotH,
  slot,
  barW,
}: {
  labels: string[];
  series: ChartSeries[];
  format: (value: number) => string;
  marginLeft: number;
  baseline: number;
  max: number;
  plotH: number;
  slot: number;
  barW: number;
}) {
  const [grow, setGrow] = useState(false);
  const uid = useId();
  useEffect(() => {
    const t = setTimeout(() => setGrow(true), 40);
    return () => clearTimeout(t);
  }, []);

  return (
    <g>
      {labels.map((_, i) => {
        const total = series.reduce((s, sr) => s + (sr.values[i] ?? 0), 0);
        const x = marginLeft + i * slot + (slot - barW) / 2;
        let acc = 0;
        const segments = series.map((sr) => {
          const v = sr.values[i] ?? 0;
          const h = v === 0 ? 0 : Math.max(2, (v / max) * plotH);
          const y = baseline - acc - h;
          acc += h;
          return { colorVar: sr.colorVar, y, h };
        });
        const fullH = total === 0 ? 0 : Math.max((total / max) * plotH, 2);
        const tip = series.map((sr) => `${sr.name} ${format(sr.values[i] ?? 0)}`).join("，");

        return (
          <g
            key={i}
            style={{
              transform: grow ? "scaleY(1)" : "scaleY(0)",
              transformOrigin: `0px ${baseline}px`,
              transformBox: "view-box",
              transition: `transform 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${i * 25}ms`,
            }}
          >
            {/* 整根柱子的圆角裁剪：矩形向下多留一段，让圆角只出现在顶部，堆叠色段保持齐平 */}
            <clipPath id={`${uid}-c${i}`}>
              <rect x={x} y={baseline - fullH} width={barW} height={fullH + 10} rx={Math.min(barW / 2, 4)} />
            </clipPath>
            <g clipPath={`url(#${uid}-c${i})`}>
              {segments.map((seg, si) => (
                <rect
                  key={si}
                  x={x}
                  y={seg.y}
                  width={barW}
                  height={seg.h}
                  style={{ fill: seg.colorVar }}
                  opacity={0.92}
                />
              ))}
            </g>
            {/* 透明覆盖层用于整根柱子的悬停提示 */}
            <rect x={x} y={baseline - fullH} width={barW} height={fullH} fill="transparent">
              <title>{`${labels[i]}：${tip}`}</title>
            </rect>
          </g>
        );
      })}
    </g>
  );
}

/** 轻量 SVG 柱状图（无第三方库）：多系列堆叠、横纵坐标、进入/数据变化时生长动画 */
export function BarChart({
  labels,
  series,
  format,
}: {
  labels: string[];
  series: ChartSeries[];
  format: (value: number) => string;
}) {
  const W = 320;
  const H = 180;
  const marginLeft = 40;
  const marginBottom = 22;
  const top = 10;

  const plotW = W - marginLeft;
  const plotH = H - top - marginBottom;
  const baseline = top + plotH;

  const totals = labels.map((_, i) => series.reduce((s, sr) => s + (sr.values[i] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const slot = plotW / labels.length;
  const barW = Math.max(2, slot * 0.62);

  const xStep = Math.max(1, Math.ceil(labels.length / 7));
  const labelIdx = new Set<number>();
  labels.forEach((_, i) => {
    if (i % xStep === 0) labelIdx.add(i);
  });
  labelIdx.add(0);
  labelIdx.add(labels.length - 1);

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  // 数据签名：数值变化时重新触发生长动画（切换 7/14/30 天、新数据到达后）
  const dataSig = JSON.stringify(series.map((s) => s.values));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="柱状图">
      {/* 横向网格线 + Y 轴刻度 */}
      {ticks.map((f, i) => {
        const t = f * max;
        const y = baseline - f * plotH;
        return (
          <g key={i}>
            <line x1={marginLeft} y1={y} x2={W} y2={y} stroke="currentColor" className="opacity-15" />
            <text
              x={marginLeft - 5}
              y={y + 3}
              textAnchor="end"
              className="fill-current"
              fontSize={8}
              opacity={0.6}
            >
              {i === 0 ? "0" : format(Math.round(t))}
            </text>
          </g>
        );
      })}

      <Bars
        key={dataSig}
        labels={labels}
        series={series}
        format={format}
        marginLeft={marginLeft}
        baseline={baseline}
        max={max}
        plotH={plotH}
        slot={slot}
        barW={barW}
      />

      {/* X 轴日期标签 */}
      {[...labelIdx].sort((a, b) => a - b).map((i) => {
        const center = marginLeft + i * slot + slot / 2;
        // 柱位越密 slot 越小，末尾标签居中后会超出 viewBox 右缘被裁掉（30 天时 slot≈9px），
        // 此时改为贴右缘对齐。左侧有 marginLeft 让位，不需要处理。
        const halfWidth = labels[i].length * 2.2; // fontSize=8 时约每字符 4.4px
        const atRightEdge = i === labels.length - 1 && center + halfWidth > W;
        return (
          <text
            key={i}
            x={atRightEdge ? W : center}
            y={H - 6}
            textAnchor={atRightEdge ? "end" : "middle"}
            className="fill-current"
            fontSize={8}
            opacity={0.6}
          >
            {labels[i]}
          </text>
        );
      })}
    </svg>
  );
}