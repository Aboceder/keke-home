import { isFutureDt, normalizeDt, parseMl } from "@/lib/time";
import { MAX_SLEEP_SECONDS, sleepSeconds } from "@/lib/sleep";

/** 母乳记录（手动补录 / 编辑）：开始时间 + 左右侧分钟（支持小数，至少一侧） */
export async function validateFeeding(body: {
  startedAt?: unknown;
  leftMinutes?: unknown;
  rightMinutes?: unknown;
}) {
  const startedAt = normalizeDt(body.startedAt);
  if (!startedAt) return { error: "开始时间格式不正确" };
  if (isFutureDt(startedAt)) return { error: "不能填写未来的时间" };

  const isEmpty = (v: unknown) => v == null || v === "";
  const toSeconds = (v: unknown): number | null | undefined => {
    if (isEmpty(v)) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.round(n * 60);
  };
  const left = toSeconds(body.leftMinutes);
  const right = toSeconds(body.rightMinutes);
  if (!isEmpty(body.leftMinutes) && (left == null || left < 1))
    return { error: "左侧时长必须为大于 0 的分钟数" };
  if (!isEmpty(body.rightMinutes) && (right == null || right < 1))
    return { error: "右侧时长必须为大于 0 的分钟数" };
  if (!left && !right) return { error: "左侧、右侧时长至少填写一侧" };

  return {
    data: {
      startedAt,
      leftSeconds: left,
      rightSeconds: right,
    },
  };
}

/** 奶瓶记录：时间 + 奶量毫升 + 类型（奶粉/母乳，默认奶粉） */
export async function validateBottle(body: {
  time?: unknown;
  amountMl?: unknown;
  type?: unknown;
  note?: unknown;
}) {
  const time = normalizeDt(body.time);
  if (!time) return { error: "喂奶时间格式不正确" };
  if (isFutureDt(time)) return { error: "不能填写未来的时间" };
  const amountMl = parseMl(body.amountMl);
  if (amountMl == null) return { error: "奶量必须为大于 0 的整数毫升" };
  const type = body.type === "母乳" ? "母乳" : "奶粉";
  const note =
    typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  return { data: { time, amountMl, type, note } };
}

const TEXTURES = ["稀", "软", "成形", "干硬", "其他"];
const COLORS = ["黄", "黄褐", "绿", "棕", "黑", "其他"];

function optText(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

/** 排便记录：时间必填，性状颜色备注选填，选"其他"必须补充说明 */
export async function validateStool(body: {
  time?: unknown;
  texture?: unknown;
  textureOther?: unknown;
  color?: unknown;
  colorOther?: unknown;
  note?: unknown;
}) {
  const time = normalizeDt(body.time);
  if (!time) return { error: "便便时间格式不正确" };
  if (isFutureDt(time)) return { error: "不能填写未来的时间" };

  const texture = typeof body.texture === "string" && body.texture ? body.texture : null;
  if (texture && !TEXTURES.includes(texture)) return { error: "性状选项不正确" };
  const textureOther = optText(body.textureOther);
  if (texture === "其他" && !textureOther) return { error: "性状选择\"其他\"时必须补充说明" };

  const color = typeof body.color === "string" && body.color ? body.color : null;
  if (color && !COLORS.includes(color)) return { error: "颜色选项不正确" };
  const colorOther = optText(body.colorOther);
  if (color === "其他" && !colorOther) return { error: "颜色选择\"其他\"时必须补充说明" };

  return {
    data: {
      time,
      texture: texture === "其他" ? null : texture,
      textureOther: texture === "其他" ? textureOther : null,
      color: color === "其他" ? null : color,
      colorOther: color === "其他" ? colorOther : null,
      note: optText(body.note, 500),
    },
  };
}

/** 睡眠记录：入睡 + 醒来两个时刻，醒来必须晚于入睡，单次不超过 8 小时 */
export async function validateSleep(body: {
  startedAt?: unknown;
  endedAt?: unknown;
  note?: unknown;
}) {
  const startedAt = normalizeDt(body.startedAt);
  if (!startedAt) return { error: "入睡时间格式不正确" };
  if (isFutureDt(startedAt)) return { error: "不能填写未来的时间" };

  const endedAt = normalizeDt(body.endedAt);
  if (!endedAt) return { error: "醒来时间格式不正确" };
  if (isFutureDt(endedAt)) return { error: "不能填写未来的时间" };
  // 同格式的定宽字符串可直接按字典序比较
  if (endedAt <= startedAt) return { error: "醒来时间必须晚于入睡时间" };

  if (sleepSeconds(startedAt, endedAt) > MAX_SLEEP_SECONDS)
    return { error: `单次睡眠不能超过 ${MAX_SLEEP_SECONDS / 3600} 小时` };

  return { data: { startedAt, endedAt, note: optText(body.note, 500) } };
}

export function badId() {
  return Response.json({ error: "无效的记录 ID" }, { status: 400 });
}

export function notFound() {
  return Response.json({ error: "记录不存在" }, { status: 404 });
}
