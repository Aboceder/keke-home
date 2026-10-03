# 可可的喂养台

宝宝可可的喂养记录应用：记录母乳、奶瓶与排便。家庭局域网内直接访问，无需登录。

初版需求决策见 [requirements.md](./requirements.md)，当前功能以本文为准。

## 功能

- 🤱 **母乳计时**：选择左侧/右侧开始计时，结束后提醒「切换另一侧或结束喂奶」；计时状态保存在服务器，锁屏/切后台不丢失；全局仅允许一条进行中的喂奶
- 🍼 **奶瓶记录**：时间 + 奶量（毫升）+ 备注
- 💩 **排便记录**：时间 + 性状/颜色（固定选项，选「其他」需补充说明）+ 备注
- 📊 **当日统计**：母乳次数、奶瓶次数与总量、总喂养次数、排便次数
- 🌙 **深色主题**：使用 Dracula 主题
- 🔄 **多设备自动同步**：可见页面每 2 秒轮询，慢请求完成前不叠加请求；加载失败时显示提示并支持重试
- 📈 **统计与报告**：近 7 / 14 / 30 天统计，可选 Bark 提醒、日报与周报；报告按北京时间的固定两小时时段统计喂养集中时间

## 技术栈

- Next.js 16 + React 19 + TypeScript
- Prisma + SQLite
- daisyUI 5 + Tailwind CSS 4
- pnpm

## 快速开始

```bash
pnpm install
pnpm prisma db push    # 初始化数据库
pnpm build
pnpm start --hostname 0.0.0.0
```

同一局域网内访问 `http://[服务器IP]:3000`。

时间统一使用北京时间（Asia/Shanghai），记录保存在本机 `prisma/dev.db`。

## 已有数据库更新

计时并发修复新增 `ActiveFeeding.version` 可空字段。旧的进行中记录迁移后仍保留，首次操作时会生成版本；之后每次操作必须匹配最新版本，冲突或过期请求返回 HTTP 409。

已有数据库首次升级到此版本时，先暂停应用并备份 `prisma/dev.db`，然后执行一次：

```bash
pnpm install --frozen-lockfile
pnpm prisma db execute --file prisma/add-active-feeding-version.sql --schema prisma/schema.prisma
pnpm build
```

升级脚本只添加计时版本列，不调整其他表。完成后按原方式启动应用，并在已打开的设备上刷新页面。`pnpm build` 会生成与当前模型一致的 Prisma Client，但不会修改数据库。现有自动部署脚本也不会同步数据库结构，本次更新需要先完成上述数据库升级；全新安装按「快速开始」执行即可。

开发模式使用 `pnpm dev`，启动前同样会生成 Prisma Client。修改数据库模型后，需要完成对应的数据库升级并重新启动开发服务；热更新不会替换进程中已缓存的 Prisma Client。
