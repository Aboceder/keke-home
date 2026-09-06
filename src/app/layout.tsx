import "@fontsource/baloo-2/500.css";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";
import type { Metadata, Viewport } from "next";
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
  themeColor: "#282a36",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" data-theme="dracula">
      <body className="min-h-svh antialiased">{children}</body>
    </html>
  );
}