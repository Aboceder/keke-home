"use client";

import { api } from "@/lib/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify({ password }) });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-xs bg-base-200 shadow-sm">
        <div className="card-body">
          <h1 className="card-title">可可的喂养台</h1>
          <p className="text-sm opacity-70">请输入家庭密码</p>
          <label className="floating-label">
            <input
              type="password"
              className="input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder=""
              autoFocus
            />
            <span>密码</span>
          </label>
          {error && <p className="text-sm text-error">{error}</p>}
          <button type="submit" className="btn btn-primary mt-2" disabled={busy || !password}>
            登录
          </button>
        </div>
      </form>
    </main>
  );
}