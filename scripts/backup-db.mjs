import { DatabaseSync, backup } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
const dir = resolve(process.env.NEXTSTEP_DATA_DIR ?? "data");
const file = join(dir, "nextstep.db");
if (!existsSync(file)) {
  console.log("尚无数据库，无需备份。");
} else {
  mkdirSync(join(dir, "backups"), { recursive: true });
  const target = join(dir, "backups", `nextstep-${Date.now()}.db`);
  const db = new DatabaseSync(file);
  try {
    await backup(db, target);
    console.log("数据库备份完成：", target);
  } finally {
    db.close();
  }
}
