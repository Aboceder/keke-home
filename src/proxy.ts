import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function sha256(text: string): Promise<string> {
  const data = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(data)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function proxy(request: NextRequest) {
  const password = process.env.AUTH_PASSWORD;
  // 未配置密码时直接放行（便于本地开发）
  if (!password) return NextResponse.next();

  const expected = await sha256(password);
  const cookie = request.cookies.get("auth")?.value;
  const ok = cookie === expected;
  const { pathname } = request.nextUrl;

  if (!ok) {
    // 登录页与登录接口放行
    if (pathname === "/login" || pathname === "/api/login") {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 已登录访问登录页 → 回首页
  if (pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // 静态资源与图标不走登录
  matcher: "/((?!_next/static|_next/image|favicon.ico|icon.png|duofu.gif|manifest.webmanifest).*)",
};