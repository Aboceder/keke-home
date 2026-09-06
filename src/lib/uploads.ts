import { randomBytes } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

export const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

export function ensureUploadsDir() {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

/** 保存文件并返回随机文件名（防路径穿越，扩展名白名单校验） */
export function saveUpload(buf: Buffer, ext: string): string {
  const safeExt = ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext)
    ? ext
    : "bin";
  ensureUploadsDir();
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${safeExt}`;
  writeFileSync(path.join(UPLOADS_DIR, name), buf);
  return name;
}

/** 解析上传目录中的文件名，拒绝路径穿越 */
export function resolveUpload(name: string): string | null {
  if (!/^[\w.-]+$/.test(name)) return null;
  const p = path.join(UPLOADS_DIR, name);
  if (!p.startsWith(UPLOADS_DIR)) return null;
  return p;
}
