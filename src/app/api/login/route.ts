import { NextResponse } from "next/server";

async function sha256(text: string): Promise<string> {
  const data = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(data)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const password = process.env.AUTH_PASSWORD;
  if (!password) {
    return Response.json({ error: "服务器未设置密码" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  if (body?.password !== password) {
    return Response.json({ error: "密码错误" }, { status: 401 });
  }

  const value = await sha256(password);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth", value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}