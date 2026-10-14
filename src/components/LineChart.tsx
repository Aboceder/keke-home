"use client";

import { useEffect, useId, useState } from "react";

export interface LinePoint {
  /** 横轴位置：日期 "YYYY-MM-DD" */
  date: string;
  value: number;
  /** 悬停提示的完整文字，例如「06-05：12.6 斤」 */
  tip: string;
}

/** "YYYY-MM-DD" → epoch 天（仅用于算横轴比例，不涉及时区换算） */
function dayIndex(date: string): number {
  return Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86400000;
}

interface ScaledPoint {
  px: number;
  py: number;
  tip: string;
}

/** 折线层：数据变化时（key 变化）重新描线 */
function Lines({
  points,
  baseline,
  colorVar,
  uid,
}: {
  points: ScaledPoint[];
  baseline: number;
  colorVar: string;
  uid: string;
}) {
  const [grow, setGrow] = useState(false);
  useEffect(() => {
    // 尊重系统「减弱动态效果」：直接显示终态，不描线
    // 用 setTimeout 而不是同步 setState，避免级联渲染（与 CountUp 同一处理）
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setGrow(true), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setGrow(true), 40);
    return () => clearTimeout(t);
  }, []);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.px} ${p.py}`).join(" ");
  const first = points[0];
  const last = points.at(-1)!;
  const single = points.length === 1;

  return (
    <g>
      {/* 折线下方的同色渐变填充，让趋势更醒目 */}
      <defs>
        <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: colorVar }} stopOpacity={0.28} />
          <stop offset="100%" style={{ stopColor: colorVar }} stopOpacity={0} />
        </linearGradient>
      </defs>
      {!single && (
        <path
          d={`${path} L${last.px} ${baseline} L${first.px} ${baseline} Z`}
          fill={`url(#${uid}-fill)`}
          style={{ opacity: grow ? 1 : 0, transition: "opacity 0.6s ease 0.3s" }}
        />
      )}
      {!single && (
        <path
          d={path}
          fill="none"
          stroke={colorVar}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          // 用 pathLength 归一化，任意长度的折线都是 0.9s 描完
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={grow ? 0 : 1}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      )}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.px}
            cy={p.py}
            r={3}
            fill={colorVar}
            opacity={grow ? 1 : 0}
            // 单点时立刻出现，多点时随描线依次浮现
            style={{
              transition: `opacity 0.3s ease ${single ? 0 : (0.1 + (i / points.length) * 0.8).toFixed(2)}s`,
            }}
          />
          {/* 透明大圆做悬停/长按热区 */}
          <circle cx={p.px} cy={p.py} r={9} fill="transparent">
            <title>{p.tip}</title>
          </circle>
        </g>
      ))}
    </g>
  );
}

/**
 * 轻量 SVG 折线图（无第三方库）。
 * 横轴按真实日期比例排布（不是按序号均分），这样才能看出增速变化；
 * 纵轴不从 0 开始，min/max 各留 10% 余量，否则身高体重的曲线会被压平。
 * 缺测的日子不画点，相邻有效点直连。
 */
export function LineChart({
  points,
  unit,
  colorVar,
  decimals = 1,
  marginLeft = 34,
  height = 140,
}: {
  points: LinePoint[];
  unit: string;
  colorVar: string;
  decimals?: number;
  marginLeft?: number;
  height?: number;
}) {
  const uid = useId();
  const W = 320;
  const H = height;
  const marginBottom = 20;
  // 右侧留 6px：最后一个测量点画在横轴末端，不留白会被 viewBox 右缘裁掉半个圆点
  const marginRight = 6;
  const top = 12;
  const plotW = W - marginLeft - marginRight;
  const plotH = H - top - marginBottom;
  const baseline = top + plotH;

  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    // 只测过一次或每次数值相同：给一个对称的展开区间，避免除零
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  } else {
    const pad = (max - min) * 0.1;
    min -= pad;
    max += pad;
  }
  min = Math.max(0, min); // 身高体重都不是负数，留白后下界跑到 0 以下没意义

  const idx = points.map((p) => dayIndex(p.date));
  const minIdx = Math.min(...idx);
  const spanDays = Math.max(...idx) - minIdx;
  // 只有一天的数据时给固定跨度，点落在正中间
  const xAt = (i: number) =>
    spanDays === 0 ? marginLeft + plotW / 2 : marginLeft + ((idx[i] - minIdx) / spanDays) * plotW;
  const yAt = (v: number) => baseline - ((v - min) / (max - min)) * plotH;

  const scaled: ScaledPoint[] = points.map((p, i) => ({
    px: xAt(i),
    py: yAt(p.value),
    tip: p.tip,
  }));

  const dateLabel = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${unit}折线图`}>
      {/* 横向网格线 + 纵轴刻度 */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
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
              {(min + f * (max - min)).toFixed(decimals)}
            </text>
          </g>
        );
      })}

      <Lines
        key={JSON.stringify(points.map((p) => [p.date, p.value]))}
        points={scaled}
        baseline={baseline}
        colorVar={colorVar}
        uid={uid}
      />

      {/* 横轴只标首末测量日；跨度内缺测的日子没有点，不用逐日标注 */}
      {spanDays > 0 && (
        <>
          <text x={marginLeft} y={H - 6} textAnchor="start" className="fill-current" fontSize={8} opacity={0.6}>
            {dateLabel(points[0].date)}
          </text>
          <text x={W} y={H - 6} textAnchor="end" className="fill-current" fontSize={8} opacity={0.6}>
            {dateLabel(points.at(-1)!.date)}
          </text>
        </>
      )}
    </svg>
  );
}
