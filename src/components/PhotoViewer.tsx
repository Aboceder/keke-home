"use client";

import { api } from "@/lib/client";
import type { PhotoRecord } from "@/lib/types";
import { useEffect, useState } from "react";

interface Props {
  photos: PhotoRecord[];
  index: number;
  today: string;
  onClose: () => void;
  onError: (message: string) => void;
  onChanged: () => void | Promise<void>;
}

/** 照片原图查看器：同一天照片可前后切换，可编辑日期、备注，可删除 */
export function PhotoViewer({ photos, index, today, onClose, onError, onChanged }: Props) {
  const [idx, setIdx] = useState(index);
  const photo = photos[idx];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && idx > 0) setIdx(idx - 1);
      if (e.key === "ArrowRight" && idx < photos.length - 1) setIdx(idx + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, photos.length, onClose]);

  if (!photo) return null;

  async function remove() {
    try {
      await api(`/api/photos/${photo.id}`, { method: "DELETE" });
      await onChanged();
      if (photos.length <= 1) {
        onClose();
      } else {
        setIdx((i) => Math.min(i, photos.length - 2));
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center justify-between p-3 text-white">
        <button className="btn btn-sm btn-ghost text-white" onClick={onClose}>
          关闭
        </button>
        <span className="font-digits text-sm opacity-80">
          {idx + 1} / {photos.length}
        </span>
        <span className="w-16" />
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {idx > 0 && (
          <button
            aria-label="上一张"
            className="btn btn-circle btn-ghost text-white absolute left-2 z-10"
            onClick={() => setIdx(idx - 1)}
          >
            ‹
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/photos/${photo.id}/image`}
          alt={photo.note ?? "宝宝照片"}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
        {idx < photos.length - 1 && (
          <button
            aria-label="下一张"
            className="btn btn-circle btn-ghost text-white absolute right-2 z-10"
            onClick={() => setIdx(idx + 1)}
          >
            ›
          </button>
        )}
      </div>

      <PhotoEditPanel
        key={photo.id}
        photo={photo}
        today={today}
        onDelete={remove}
        onError={onError}
        onChanged={onChanged}
      />
    </div>
  );
}

/** key 按照片 id 重置，避免跨照片残留编辑状态 */
function PhotoEditPanel({
  photo,
  today,
  onDelete,
  onError,
  onChanged,
}: {
  photo: PhotoRecord;
  today: string;
  onDelete: () => void | Promise<void>;
  onError: (message: string) => void;
  onChanged: () => void | Promise<void>;
}) {
  const [date, setDate] = useState(photo.date);
  const [note, setNote] = useState(photo.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api(`/api/photos/${photo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ date, note }),
      });
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 bg-base-100/95 p-3">
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-sm opacity-70">日期</span>
          <input
            type="date"
            className="input w-full"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="flex-[2]">
          <span className="mb-1 block text-sm opacity-70">备注</span>
          <input
            type="text"
            className="input w-full"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="可为空"
          />
        </label>
      </div>
      <div className="flex items-center justify-between gap-2">
        {confirmDelete ? (
          <>
            <span className="text-sm">删除后不可恢复，确认删除？</span>
            <div className="flex gap-2">
              <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>
                取消
              </button>
              <button className="btn btn-error btn-sm" disabled={busy} onClick={onDelete}>
                确认删除
              </button>
            </div>
          </>
        ) : (
          <>
            <button className="btn btn-error btn-sm" disabled={busy} onClick={() => setConfirmDelete(true)}>
              删除
            </button>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
              保存修改
            </button>
          </>
        )}
      </div>
    </div>
  );
}
