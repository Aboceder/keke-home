"use client";

import { ArrowDown, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const THRESHOLD = 64;
const MAX_PULL = 96;

/** 移动端下拉刷新；同时暴露 refresh() 给桌面端按钮复用。 */
export function usePullToRefresh(onRefresh: () => Promise<unknown> | unknown) {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  const refreshingRef = useRef(false);
  const gesture = useRef({
    startY: 0,
    startX: 0,
    tracking: false,
    pulling: false,
    distance: 0,
  });

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setDistance(52);
    try {
      await onRefreshRef.current();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      setDistance(0);
    }
  }, []);

  useEffect(() => {
    const start = (e: TouchEvent) => {
      const target = e.target;
      if (
        refreshingRef.current ||
        window.scrollY > 0 ||
        e.touches.length !== 1 ||
        (target instanceof Element &&
          target.closest("dialog[open], input, textarea, select"))
      ) {
        gesture.current.tracking = false;
        return;
      }
      const touch = e.touches[0];
      gesture.current = {
        startY: touch.clientY,
        startX: touch.clientX,
        tracking: true,
        pulling: false,
        distance: 0,
      };
    };

    const move = (e: TouchEvent) => {
      const g = gesture.current;
      if (!g.tracking || refreshingRef.current || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dy = touch.clientY - g.startY;
      const dx = touch.clientX - g.startX;
      if (!g.pulling) {
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) return;
        g.pulling = true;
      }
      if (window.scrollY > 0 || dy <= 0) {
        g.tracking = false;
        g.pulling = false;
        g.distance = 0;
        setDistance(0);
        return;
      }
      // 只接管明确的向下手势，保留页面的正常滚动
      e.preventDefault();
      const next = Math.min(MAX_PULL, dy * 0.45);
      g.distance = next;
      setDistance(next);
    };

    const end = () => {
      const g = gesture.current;
      if (!g.tracking) return;
      const shouldRefresh = g.pulling && g.distance >= THRESHOLD;
      g.tracking = false;
      g.pulling = false;
      if (!shouldRefresh) {
        g.distance = 0;
        setDistance(0);
        return;
      }
      void refresh();
    };

    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", end);
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
  }, [refresh]);

  return { distance, refreshing, refresh };
}

export function PullToRefreshIndicator({
  distance,
  refreshing,
}: {
  distance: number;
  refreshing: boolean;
}) {
  const visible = refreshing || distance > 0;
  const progress = Math.min(1, distance / THRESHOLD);

  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-[max(0.75rem,env(safe-area-inset-top))] transition-opacity"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="flex size-9 items-center justify-center rounded-full bg-base-100 shadow-lg">
        {refreshing ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <ArrowDown
            className="size-4 transition-transform"
            style={{ transform: `rotate(${progress * 180}deg)`, opacity: 0.35 + progress * 0.65 }}
          />
        )}
      </div>
    </div>
  );
}
