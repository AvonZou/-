import { getStore } from "../lib/db";
const store = getStore();
console.log(
  "SQLite 初始化完成，迁移版本：",
  store.db.prepare("PRAGMA user_version").get(),
);
store.close();
