"use client";

import { api, nowInputValue } from "@/lib/client";
import { MAX_HEIGHT_CM, MAX_WEIGHT_JIN } from "@/lib/growth";
import { isOvernight } from "@/lib/sleep";
import type { BottleRecord, FeedingRecord, GrowthRecord, Side, SleepRecord, StoolRecord } from "@/lib/types";
import { STOOL_COLORS, STOOL_TEXTURES } from "@/lib/types";
import { Baby, Check, Milk, Moon, Pencil, Scale, Toilet, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SelectDropdown } from "@/components/SelectDropdown";

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
  return <p className="text-danger-ink text-sm">{message}</p>;
}

/* ---------------- 开始母乳：选择左侧或右侧 ---------------- */

export function StartFeedingModal({
  onClose,
  onStart,
  onManual,
  busy,
}: {
  onClose: () => void;
  onStart: (side: Side) => void;
  onManual: () => void;
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
        <div className="flex items-center justify-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onManual}>
            <Pencil className="size-3.5" />
            补录母乳（手动填写时长）
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
  const [type, setType] = useState(initial?.type ?? "奶粉");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { time: time.replace("T", " "), amountMl: Number(amount), type, note };
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
        <Field legend="奶的类型">
          <SelectDropdown value={type} options={["奶粉", "母乳"]} emptyLabel="请选择" onSelect={setType} />
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

/* ---------------- 便便 ---------------- */

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
    <Modal title={initial ? "编辑便便记录" : "记录便便"} icon={<Toilet className="size-5" />} onClose={onClose}>
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
          <SelectDropdown
            value={texture}
            options={["不记录", ...STOOL_TEXTURES]}
            emptyLabel="不记录"
            onSelect={(v) => setTexture(v === "不记录" ? "" : v)}
          />
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
          <SelectDropdown
            value={color}
            options={["不记录", ...STOOL_COLORS]}
            emptyLabel="不记录"
            onSelect={(v) => setColor(v === "不记录" ? "" : v)}
          />
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

/* ---------------- 身高体重（成长记录） ---------------- */

/** 数值输入框的当前值：已有记录按原值显示，新增时留空 */
function numInput(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

export function GrowthModal({
  initial,
  onClose,
  onSaved,
}: CommonProps & { initial?: GrowthRecord }) {
  // 身高体重只到「天」，不需要时间
  const [date, setDate] = useState(initial?.date ?? nowInputValue().slice(0, 10));
  const [weight, setWeight] = useState(numInput(initial?.weightJin));
  const [height, setHeight] = useState(numInput(initial?.heightCm));
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        date,
        weightJin: weight === "" ? null : Number(weight),
        heightCm: height === "" ? null : Number(height),
        note,
      };
      await api(initial ? `/api/growth/${initial.id}` : "/api/growth", {
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
      title={initial ? "编辑成长记录" : "记录身高体重"}
      icon={<Scale className="size-5" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-2">
        <Field legend="测量日期">
          <input
            type="date"
            className="input w-full font-digits"
            value={date}
            max={nowInputValue().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field legend="体重（斤）" hint="可为空">
            <input
              type="number"
              inputMode="decimal"
              min={0.1}
              max={MAX_WEIGHT_JIN}
              step={0.1}
              className="input w-full font-digits"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="12.6"
            />
          </Field>
          <Field legend="身高（cm）" hint="可为空">
            <input
              type="number"
              inputMode="decimal"
              min={0.1}
              max={MAX_HEIGHT_CM}
              step={0.1}
              className="input w-full font-digits"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="58.5"
            />
          </Field>
        </div>
        <p className="text-xs opacity-60">体重和身高至少填一项，可以只称体重。</p>
        <Field legend="备注（可选）">
          <textarea
            className="textarea w-full"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如 社区体检"
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
  if (!seconds) return "";
  return String(Math.round((seconds / 60) * 100) / 100);
}

export function ManualFeedingModal({
  initial,
  onClose,
  onSaved,
}: CommonProps & { initial?: FeedingRecord }) {
  const [startedAt, setStartedAt] = useState(
    initial ? initial.startedAt.replace(" ", "T") : nowInputValue(),
  );
  const [left, setLeft] = useState(initial ? secToMinInput(initial.leftSeconds ?? null) : "");
  const [right, setRight] = useState(initial ? secToMinInput(initial.rightSeconds ?? null) : "");
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
          <Field legend="左侧时长（min）" hint="支持小数，可为空">
            <input
              type="number"
              min={0.01}
              step={0.01}
              className="input w-full"
              value={left}
              onChange={(e) => setLeft(e.target.value)}
              placeholder="0.5"
            />
          </Field>
          <Field legend="右侧时长（min）" hint="支持小数，可为空">
            <input
              type="number"
              min={0.01}
              step={0.01}
              className="input w-full"
              value={right}
              onChange={(e) => setRight(e.target.value)}
              placeholder="0.5"
            />
          </Field>
        </div>
        <FormError message={error} />
        <FormActions onClose={onClose} busy={busy} />
      </form>
    </Modal>
  );
}

/* ---------------- 睡眠：开始计时 / 补录 ---------------- */

const MAX_SLEEP_HOURS = 8;

/** nowInputValue() 往前推 n 分钟的 datetime-local 值 */
function minutesAgoInput(minutes: number): string {
  const d = new Date(`${nowInputValue()}:00`);
  d.setMinutes(d.getMinutes() - minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StartSleepModal({
  onClose,
  onStart,
  onManual,
  busy,
}: {
  onClose: () => void;
  onStart: () => void;
  onManual: () => void;
  busy: boolean;
}) {
  return (
    <Modal title="记录睡眠" icon={<Moon className="size-5" />} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm opacity-70">
          点「开始睡觉」开始计时，宝宝醒来再点「醒来」；也可以直接补录一段已经睡完的。
        </p>
        <button className="btn btn-info h-16 w-full text-base" disabled={busy} onClick={onStart}>
          <Moon className="size-5" />
          开始睡觉
        </button>
        <div className="flex items-center justify-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onManual}>
            <Pencil className="size-3.5" />
            补录睡眠（手动填写时间）
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

export function SleepModal({
  initial,
  onClose,
  onSaved,
}: CommonProps & { initial?: SleepRecord }) {
  const [startedAt, setStartedAt] = useState(
    initial ? initial.startedAt.replace(" ", "T") : minutesAgoInput(60),
  );
  const [endedAt, setEndedAt] = useState(
    initial ? initial.endedAt.replace(" ", "T") : nowInputValue(),
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        startedAt: startedAt.replace("T", " "),
        endedAt: endedAt.replace("T", " "),
        note,
      };
      await api(initial ? `/api/sleeps/${initial.id}` : "/api/sleeps", {
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

  const overnight =
    startedAt.length >= 16 && endedAt.length >= 16 &&
    isOvernight(startedAt.replace("T", " "), endedAt.replace("T", " "));

  return (
    <Modal
      title={initial ? "编辑睡眠记录" : "补录睡眠"}
      icon={<Moon className="size-5" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-2">
        <Field legend="入睡时间">
          <input
            type="datetime-local"
            className="input w-full"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            required
          />
        </Field>
        <Field legend="醒来时间" hint={`必须晚于入睡时间，单次不超过 ${MAX_SLEEP_HOURS} 小时`}>
          <input
            type="datetime-local"
            className="input w-full"
            value={endedAt}
            onChange={(e) => setEndedAt(e.target.value)}
            required
          />
        </Field>
        <Field legend="备注（可选）">
          <textarea
            className="textarea w-full"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如 抱睡"
          />
        </Field>
        {overnight && (
          <p className="text-xs opacity-60">
            这段睡眠跨天：时间线显示在入睡当天，统计会按天拆开算。
          </p>
        )}
        <FormError message={error} />
        <FormActions onClose={onClose} busy={busy} />
      </form>
    </Modal>
  );
}

