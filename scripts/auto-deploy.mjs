// 自动部署守护：常驻 pm2，每分钟检查远程 main 是否有新提交，
// 有则 git pull → pnpm install → pnpm build → pm2 restart 应用进程。
// 在部署机上启动一次即可：
//   pm2 start scripts/auto-deploy.mjs --name keke-deploy
//   pm2 save && pm2 startup   # 开机自启（按提示执行输出的命令）
// 前提：该机器 clone 自 Gitee（origin 指向 Gitee），pm2 已有名为 keke-home 的应用进程。
import { execSync } from "node:child_process";

const DIR = process.cwd(); // 用 pm2 启动时以仓库根为 cwd，或改这里为绝对路径
const INTERVAL_MS = 60_000;
const APP_NAME = "keke-home";
const run = (cmd) => execSync(cmd, { stdio: "inherit", cwd: DIR });
let head = execSync("git rev-parse HEAD", { cwd: DIR }).toString().trim();

async function check() {
  try {
    run("git fetch origin main");
    const remote = execSync("git rev-parse origin/main", { cwd: DIR }).toString().trim();
    if (remote === head) return;
    console.log(`[auto-deploy] 检测到新提交 ${remote.slice(0, 7)}，开始部署`);
    run("git pull origin main");
    run("pnpm install --frozen-lockfile");
    run("pnpm build");
    run(`pm2 restart ${APP_NAME}`);
    head = remote;
    console.log("[auto-deploy] 部署完成");
  } catch (err) {
    console.error("[auto-deploy] 部署失败：", err instanceof Error ? err.message : err);
  }
}

console.log(`[auto-deploy] 启动，每 ${INTERVAL_MS / 1000} 秒检查远程更新`);
check();
setInterval(check, INTERVAL_MS);
