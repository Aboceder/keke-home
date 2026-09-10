// AI 总结：OpenAI 兼容接口（DeepSeek / Kimi / GLM 等均可），仅用内置 fetch
// env: AI_API_KEY、AI_BASE_URL（默认 DeepSeek）、AI_MODEL（默认 deepseek-chat）

export function aiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

/** 生成一段简短总结；未配置 AI 或调用失败时返回 null（调用方用模板兜底） */
export async function aiSummarize(prompt: string): Promise<string | null> {
  const key = process.env.AI_API_KEY;
  if (!key) return null;
  const baseUrl = (process.env.AI_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.AI_MODEL ?? "deepseek-chat";

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "你是育儿记录助手，根据喂养数据写简短温暖的中文总结。只输出总结正文，不要标题、不要列表符号。",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[ai] 调用失败 ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (err) {
    console.error("[ai] 调用异常:", err instanceof Error ? err.message : err);
    return null;
  }
}