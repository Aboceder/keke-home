"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** 用 daisyUI dropdown + menu 实现的自定义下拉（非原生 select） */
export function SelectDropdown({
  value,
  options,
  emptyLabel = "请选择",
  onSelect,
}: {
  value: string; // 当前值，可为空串
  options: string[]; // 可选标签列表
  emptyLabel?: string; // value 为空时按钮上显示的文字
  onSelect: (option: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = value || emptyLabel;

  // 点击组件外部时收起
  useEffect(() => {
    function onDoc(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  return (
    <div ref={ref} className={`dropdown dropdown-bottom w-full ${open ? "dropdown-open" : ""}`}>
      <button
        type="button"
        className="btn w-full justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value ? "" : "opacity-60"}>{selected}</span>
        <ChevronDown
          className={`size-4 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <ul className="dropdown-content menu z-30 mt-1 w-full rounded-box bg-base-100 p-2 shadow-lg">
        {options.map((o) => (
          <li key={o}>
            <button
              type="button"
              className={o === selected ? "menu-active" : ""}
              onClick={() => {
                onSelect(o);
                setOpen(false);
              }}
            >
              <span>{o}</span>
              {o === selected && <Check className="size-4" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}