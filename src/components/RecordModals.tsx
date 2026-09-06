"use client";

import { api, nowInputValue } from "@/lib/client";
import type { BottleRecord, FeedingRecord, Side, StoolRecord } from "@/lib/types";
import { STOOL_COLORS, STOOL_TEXTURES } from "@/lib/types";
import { Baby, Camera, Check, Droplets, Milk, Pencil, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CommonProps {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

/** daisyUI dialog 弹窗外壳 */
function Modal({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    // showModal 在已开状态下会抛异常；dev 下 effect 会重复执行，加守卫
    if (dialog && !dialog.open) dialog.showModal();
    // showModal 会把焦点放到第一个可聚焦元素（时间/日期输入框），iOS 上会直接弹起原生选择器；
    // 焦点移到弹窗本体，避免自动弹起，需要改时间时用户手动点输入框
    dialog?.focus();
    // 不在清理函数里手动 close()：会触发 close 事件→onClose→父组件清空状态，
    // 导致弹窗刚打开就被关掉。DOM 移除时浏览器会自行关闭 dialog。
  }, []);
  return (
    <dialog ref={ref} className="modal" onClose={onClose}>
      <div className="modal-box max-w-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold" tabIndex={-1} autoFocus>
          {icon}
          {title}
        </h3>
        {children}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="关闭">close</button>
      </form>
    </dialog>
  );
}

/** daisyUI fieldset 包装的表单字段 */
function Field({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{legend}</legend>
      {children}
      {hint && <p className="label opacity-60">{hint}</p>}
    </fieldset>
  );
}

/** 弹窗底部：取消 + 保存 */
function FormActions({
  onClose,
  busy,
  confirmLabel = "保存",
  confirmIcon = <Check className="size-4" />,
}: {
  onClose: () => void;
  busy: boolean;
  confirmLabel?: string;
  confirmIcon?: React.ReactNode;
}) {
  return (
    <div className="modal-action">
      <button type="button" className="btn" onClick={onClose}>
        <X className="size-4" />
        取消
      </button>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {confirmIcon}
        {confirmLabel}
      </button>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-error text-sm">{message}</p>;
}

/* ---------------- 开始母乳：选择左侧或右侧 ---------------- */

export function StartFeedingModal({
  onClose,
  onStart,
  busy,
}: {
  onClose: () => void;
  onStart: (side: Side) => void;
  busy: boolean;
}) {
  return (
    <Modal title="开始喂奶" icon={<Baby className="size-5" />} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm opacity-70">选择先喂哪一侧，结束后可切换另一侧或结束喂奶。</p>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn btn-primary h-16 text-base" disabled={busy} onClick={() => onStart("left")}>
            左侧开始
          </button>
          <button className="btn btn-primary h-16 text-base" disabled={busy} onClick={() => onStart("right")}>
            右侧开始
          </button>
        </div>
        <div className="text-center">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X className="size-4" />
            取消
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- 奶瓶 ---------------- */

export function BottleModal({
  initial,
  onClose,
  onSaved,
}: CommonProps & { initial?: BottleRecord }) {
  const [time, setTime] = useState(initial ? initial.time.replace(" ", "T") : nowInputValue());
  const [amount, setAmount] = useState(initial ? String(initial.amountMl) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { time: time.replace("T", " "), amountMl: Number(amount), note };
      await api(initial ? `/api/bottles/${initial.id}` : "/api/bottles", {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "编辑奶瓶记录" : "记录奶瓶"} icon={<Milk className="size-5" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-2">
        <Field legend="喂奶时间">
          <input
            type="datetime-local"
            className="input w-full"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </Field>
        <Field legend="奶量（ml）">
          <input
            type="number"
            min={1}
            step={1}
            className="input w-full"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="例如 120"
            required
          />
        </Field>
        <Field legend="备注（可选）">
          <textarea
            className="textarea w-full"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如 睡前奶"
          />
        </Field>
        <FormError message={error} />
        <FormActions onClose={onClose} busy={busy} />
      </form>
    </Modal>
  );
}

/* ---------------- 排便 ---------------- */

export function StoolModal({
  initial,
  onClose,
  onSaved,
}: CommonProps & { initial?: StoolRecord }) {
  const [time, setTime] = useState(initial ? initial.time.replace(" ", "T") : nowInputValue());
  const [texture, setTexture] = useState(
    initial ? (initial.textureOther ? "其他" : (initial.texture ?? "")) : "",
  );
  const [textureOther, setTextureOther] = useState(initial?.textureOther ?? "");
  const [color, setColor] = useState(initial ? (initial.colorOther ? "其他" : (initial.color ?? "")) : "");
  const [colorOther, setColorOther] = useState(initial?.colorOther ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        time: time.replace("T", " "),
        texture: texture || null,
        textureOther: texture === "其他" ? textureOther : null,
        color: color || null,
        colorOther: color === "其他" ? colorOther : null,
        note,
      };
      await api(initial ? `/api/stools/${initial.id}` : "/api/stools", {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "编辑排便记录" : "记录排便"} icon={<Droplets className="size-5" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-2">
        <Field legend="时间">
          <input
            type="datetime-local"
            className="input w-full"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </Field>
        <Field legend="性状（可选）">
          <select className="select w-full" value={texture} onChange={(e) => setTexture(e.target.value)}>
            <option value="">不记录</option>
            {STOOL_TEXTURES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        {texture === "其他" && (
          <Field legend="性状补充说明（必填）">
            <input
              type="text"
              className="input w-full"
              value={textureOther}
              onChange={(e) => setTextureOther(e.target.value)}
              required
            />
          </Field>
        )}
        <Field legend="颜色（可选）">
          <select className="select w-full" value={color} onChange={(e) => setColor(e.target.value)}>
            <option value="">不记录</option>
            {STOOL_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        {color === "其他" && (
          <Field legend="颜色补充说明（必填）">
            <input
              type="text"
              className="input w-full"
              value={colorOther}
              onChange={(e) => setColorOther(e.target.value)}
              required
            />
          </Field>
        )}
        <Field legend="备注（可选）">
          <textarea
            className="textarea w-full"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <FormError message={error} />
        <FormActions onClose={onClose} busy={busy} />
      </form>
    </Modal>
  );
}

/* ---------------- 母乳（手动补录 / 编辑） ---------------- */

function secToMinInput(seconds: number | null): string {
  return seconds ? String(Math.round(seconds / 60)) : "";
}

export function ManualFeedingModal({
  initial,
  onClose,
  onSaved,
}: CommonProps & { initial?: FeedingRecord }) {
  const [startedAt, setStartedAt] = useState(
    initial ? initial.startedAt.replace(" ", "T") : nowInputValue(),
  );
  const [left, setLeft] = useState(initial ? secToMinInput(initial.leftSeconds) : "");
  const [right, setRight] = useState(initial ? secToMinInput(initial.rightSeconds) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        startedAt: startedAt.replace("T", " "),
        leftMinutes: left === "" ? null : Number(left),
        rightMinutes: right === "" ? null : Number(right),
      };
      await api(initial ? `/api/feedings/${initial.id}` : "/api/feedings", {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial ? "编辑母乳记录" : "补录母乳"}
      icon={<Pencil className="size-5" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-2">
        <Field legend="开始时间">
          <input
            type="datetime-local"
            className="input w-full"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field legend="左侧时长（min）" hint="可为空">
            <input
              type="number"
              min={1}
              step={1}
              className="input w-full"
              value={left}
              onChange={(e) => setLeft(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field legend="右侧时长（min）" hint="可为空">
            <input
              type="number"
              min={1}
              step={1}
              className="input w-full"
              value={right}
              onChange={(e) => setRight(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
        <FormError message={error} />
        <FormActions onClose={onClose} busy={busy} />
      </form>
    </Modal>
  );
}

/* ---------------- 上传照片 ---------------- */

export function PhotoUploadModal({
  today,
  onClose,
  onSaved,
}: CommonProps & { today: string }) {
  const [date, setDate] = useState(today);
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    setFiles(picked);
    setNotes(picked.map(() => ""));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("date", date);
      for (const f of files) form.append("files", f);
      for (const n of notes) form.append("notes", n);
      await api("/api/photos", { method: "POST", body: form });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="上传照片" icon={<Camera className="size-5" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-2">
        <Field legend="照片日期">
          <input
            type="date"
            className="input w-full"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <Field legend="选择照片" hint="可多选，每张单独填备注">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic"
            multiple
            className="file-input w-full"
            onChange={pickFiles}
          />
        </Field>
        {files.map((f, i) => (
          <Field key={`${f.name}-${i}`} legend={`备注（${f.name}）`}>
            <input
              type="text"
              className="input w-full"
              value={notes[i]}
              onChange={(e) =>
                setNotes((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
              }
              placeholder="可为空"
            />
          </Field>
        ))}
        <FormError message={error} />
        <FormActions
          onClose={onClose}
          busy={busy}
          confirmLabel={files.length > 0 ? `上传 ${files.length} 张` : "上传"}
          confirmIcon={<Upload className="size-4" />}
        />
      </form>
    </Modal>
  );
}