"use client";

export interface ChartSeries {
  name: string;
  colorVar: string;
  values: number[];
}

/** 轻量 SVG 柱状图（无第三方库）：支持多系列堆叠、横纵坐标、悬停显示数值 */
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

      {/* 堆叠柱 */}
      {labels.map((_, i) => {
        const total = totals[i];
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
        const tip = series
          .map((sr) => `${sr.name} ${format(sr.values[i] ?? 0)}`)
          .join("，");

        return (
          <g key={i}>
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
            {/* 透明覆盖层用于整根柱子的悬停提示 */}
            <rect x={x} y={baseline - fullH} width={barW} height={fullH} fill="transparent">
              <title>{`${labels[i]}：${tip}`}</title>
            </rect>
          </g>
        );
      })}

      {/* X 轴日期标签 */}
      {[...labelIdx].sort((a, b) => a - b).map((i) => {
        const x = marginLeft + i * slot + slot / 2;
        return (
          <text
            key={i}
            x={x}
            y={H - 6}
            textAnchor="middle"
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