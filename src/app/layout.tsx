import "@fontsource/baloo-2/500.css";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "可可的喂养台",
  description: "可可的喂养、排便与照片记录",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b1815",
};

// 首屏前确定主题：手动选择优先，否则按小时自动（19:00–06:00 为夜间）
const themeScript = `(function(){try{var t=localStorage.getItem("theme-override");if(!t){var h=new Date().getHours();t=(h>=19||h<6)?"nightlight":"daylight";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" data-theme="nightlight" suppressHydrationWarning>
      <body className="min-h-svh antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
