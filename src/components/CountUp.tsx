"use client";

import { useEffect, useRef, useState } from "react";

/** 数字从 0 滚动到目标值；值变化时平滑过渡；rAF 被节流时有兜底 */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (from === to) return;

    const finish = () => {
      displayRef.current = to;
      setDisplay(to);
    };

    // 尊重系统「减弱动态效果」
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(finish, 0);
      return () => clearTimeout(t);
    }

    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(from + (to - from) * eased);
      // 缓存每帧显示值；动画中断后从当前位置继续，避免 A→B→A 时误判为无需更新。
      displayRef.current = next;
      setDisplay(next);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        finish();
      }
    };
    raf = requestAnimationFrame(step);
    // 兜底：rAF 被节流（隐藏标签页/低功耗）时也保证显示最终值
    const fallback = setTimeout(finish, duration + 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
  }, [value, duration]);

  return <>{display}</>;
}
