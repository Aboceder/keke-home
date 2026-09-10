export async function register() {
  // 仅 Node.js 运行时（Edge 等其他运行时跳过）
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // dev 热重载会多次执行 register，用全局标记防重复
  const g = globalThis as unknown as { __kekeSchedulerStarted?: boolean };
  if (g.__kekeSchedulerStarted) return;
  g.__kekeSchedulerStarted = true;

  const { startScheduler } = await import("./lib/scheduler");
  startScheduler();
}