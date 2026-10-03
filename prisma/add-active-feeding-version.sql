-- 已有数据库首次升级时执行一次；可空列保留旧计时记录，不影响其他表。
ALTER TABLE "ActiveFeeding" ADD COLUMN "version" TEXT;
