import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许局域网设备访问 dev 服务器（HMR/开发资源跨源访问）
  // *.local 走 mDNS 主机名（跟 IP 无关），192.168.0.* / 192.168.10.* 备用网段
  allowedDevOrigins: ["*.local", "192.168.0.*", "192.168.10.*"],
  // 所有 API 响应禁用缓存：否则 iOS Safari 会对无 Cache-Control 的 GET
  // 做启发式缓存，轮询拿到旧数据，母乳切换一侧后计时条不更新
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;