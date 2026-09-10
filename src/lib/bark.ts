// Bark 推送：BARK_URLS 为逗号分隔的推送 URL（https://api.day.app/xxxx）或直接 device key
// 文档：https://bark.day.app

const GROUP = "keke";

function extractKey(entry: string): string {
  const trimmed = entry.trim();
  // 支持完整 URL 或纯 key 两种填法
  const m = trimmed.match(/\/([A-Za-z0-9]+)\/?$/);
  return m ? m[1] : trimmed;
}

export async function barkPush(title: string, body: string): Promise<void> {
  const raw = process.env.BARK_URLS;
  if (!raw) return; // 未配置则静默跳过

  const keys = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(extractKey);

  await Promise.allSettled(
    keys.map(async (deviceKey) => {
      const res = await fetch("https://api.day.app/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_key: deviceKey, title, body, group: GROUP }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.error(`[bark] 推送失败 ${res.status}: ${await res.text()}`);
      }
    }),
  );
}

export function barkConfigured(): boolean {
  return Boolean(process.env.BARK_URLS);
}