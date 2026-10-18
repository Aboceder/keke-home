import "@fontsource/baloo-2/500.css";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";
import type { Metadata, Viewport } from "next";
import { DEFAULT_THEME, DARK_THEME, THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "可可的喂养台",
  description: "可可的喂养、排便与照片记录",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  appleWebApp: {
    title: "可可的喂养台",
    statusBarStyle: "default",
  },
  // Next.js 16 的 appleWebApp.capable 有 bug（生成成了 mobile-web-app-capable），
  // 这里用 other 手动补上 iOS 独立窗口需要的 meta
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFFDF9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="${DEFAULT_THEME}"&&t!=="${DARK_THEME}")t="${DEFAULT_THEME}";var r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t==="${DARK_THEME}"?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="${DARK_THEME}"?"#282a36":"#FFFDF9")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-svh antialiased">{children}</body>
    </html>
  );
}
