-- 已有数据库首次升级到「成长记录（身高体重）」版本时执行一次（由 prisma migrate diff 生成，勿手改）。
-- 全新安装按 README「快速开始」用 prisma db push 即可，不需要执行本文件。

-- CreateTable
CREATE TABLE "Growth" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "weightJin" REAL,
    "heightCm" REAL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Growth_date_idx" ON "Growth"("date");
