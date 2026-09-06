import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许局域网设备访问 dev 服务器（HMR/开发资源跨源访问）
  // *.local 走 mDNS 主机名（跟 IP 无关），192.168.0.* 备用网段
  allowedDevOrigins: ["*.local", "192.168.0.*"],
};

export default nextConfig;