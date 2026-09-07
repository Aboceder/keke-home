"use client";

interface Bar {
  label: string;
  value: number;
}

/** 轻量 SVG 柱状图（无第三方库）：带横纵坐标、悬停显示数值 */
export function BarChart({
  bars,
  colorVar,
  format,
}: {
  bars: Bar[];
  colorVar: string;
  format: (value: number) => string;
}) {
  const W = 320;
  const H = 180;
  const marginLeft = 40; // Y 轴标签区
  const marginBottom = 22; // X 轴标签区
  const top = 10;

  const plotW = W - marginLeft;
  const plotH = H - top - marginBottom;
  const baseline = top + plotH;

  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = plotW / bars.length;
  const barW = Math.max(2, slot * 0.62);

  // X 轴标签：最多约 7 个，首尾必标
  const xStep = Math.max(1, Math.ceil(bars.length / 7));
  const labelIdx = new Set<number>();
  bars.forEach((_, i) => {
    if (i % xStep === 0) labelIdx.add(i);
  });
  labelIdx.add(0);
  labelIdx.add(bars.length - 1);

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

      {/* 柱子 */}
      {bars.map((b, i) => {
        const h = b.value === 0 ? 0 : Math.max(2, (b.value / max) * plotH);
        const x = marginLeft + i * slot + (slot - barW) / 2;
        const y = baseline - h;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={2}
            style={{ fill: colorVar }}
            opacity={0.92}
          >
            <title>{`${b.label}：${format(b.value)}`}</title>
          </rect>
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
            {bars[i].label}
          </text>
        );
      })}
    </svg>
  );
}