-- 已有数据库首次升级到「睡眠记录」版本时执行一次（由 prisma migrate diff 生成，勿手改）。
-- 全新安装按 README「快速开始」用 prisma db push 即可，不需要执行本文件。

-- CreateTable
CREATE TABLE "Sleep" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startedAt" TEXT NOT NULL,
    "endedAt" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActiveSleep" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "version" TEXT,
    "startedAt" TEXT NOT NULL,
    "startedAtMs" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Sleep_startedAt_idx" ON "Sleep"("startedAt");

-- CreateIndex
CREATE INDEX "Sleep_endedAt_idx" ON "Sleep"("endedAt");

