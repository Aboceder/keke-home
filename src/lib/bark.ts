// Bark 推送：BARK_KEYS 为逗号分隔的 device key（Bark app 里 URL 最后那段）
// 可选配置：
//   BARK_SERVER  自建服务器地址（默认 https://api.day.app）
//   BARK_GROUP   通知分组（iPhone 通知中心按组折叠，默认 "可可"）
//   BARK_ICON    通知图标 URL（需公网可访问）
// 文档：https://bark.day.app

function extractKey(entry: string): string {
  // 允许手滑贴了完整 URL：取最后一段
  const trimmed = entry.trim();
  const m = trimmed.match(/\/([A-Za-z0-9]+)\/?$/);
  return m && trimmed.includes("/") ? m[1] : trimmed;
}

export type BarkLevel = "active" | "timeSensitive";

export async function barkPush(
  title: string,
  body: string,
  level: BarkLevel = "active",
): Promise<void> {
  const raw = process.env.BARK_KEYS;
  if (!raw) return; // 未配置则静默跳过

  const server = (process.env.BARK_SERVER ?? "https://api.day.app").replace(/\/$/, "");
  const group = process.env.BARK_GROUP?.trim() || "可可";
  const icon = process.env.BARK_ICON?.trim() || "";
  const keys = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(extractKey);

  await Promise.allSettled(
    keys.map(async (deviceKey) => {
      const res = await fetch(`${server}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_key: deviceKey,
          title,
          body,
          group,
          level,
          ...(icon ? { icon } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.error(`[bark] 推送失败 ${res.status}: ${await res.text()}`);
      }
    }),
  );
}

export function barkConfigured(): boolean {
  return Boolean(process.env.BARK_KEYS);
}