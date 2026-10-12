import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../lib/db";
import {
  applicationStages,
  emptyJob,
  emptyTask,
  defaultSettings,
  type State,
} from "../lib/model";
import { importantTasks, homeReminders } from "../lib/home";

test("四字段编辑与任意流程往返不擦除旧资料；旧备份恢复与关闭重开", () => {
  const dir = mkdtempSync(join(tmpdir(), "nextstep-refactor-"));
  const path = join(dir, "test.db");
  let store = new Store(path);
  try {
    const old = store.saveJob({
      ...emptyJob,
      company: "旧记录（示例）",
      title: "运营",
      stage: "面试",
      jd: "保留正文",
      officialUrl: "https://example.com/job",
      notes: "原始细节",
      nextFollowUp: "2026-10-13",
      matchScore: 72,
    });
    const backup = store.backup();
    const restored = new Store(":memory:");
    restored.import(backup);
    assert.deepEqual(restored.state(), store.state());
    restored.close();
    const draft = {
      company: "新公司（示例）",
      title: "品牌",
      appliedDate: "2026-10-12",
      stage: "面试",
    };
    const edited = store.saveApplication(draft, old.id);
    assert.equal(edited.id, old.id);
    assert.equal(edited.createdAt, old.createdAt);
    for (const field of [
      "jd",
      "officialUrl",
      "notes",
      "nextFollowUp",
      "matchScore",
    ] as const)
      assert.equal(edited[field], old[field]);
    const seq = [...applicationStages, ...applicationStages.slice().reverse()];
    let previous = edited.stage,
      changes = 0;
    for (const stage of seq) {
      store.changeJobStage({ stage }, old.id);
      if (stage !== previous) changes++;
      previous = stage;
    }
    assert.equal(store.state().events.length, changes);
    assert.throws(() => store.changeJobStage({ stage: "不存在" }, old.id));
    assert.throws(() =>
      store.changeJobStage({ stage: "已投递", jd: "覆盖" }, old.id),
    );
    const created = store.saveApplication({
      company: "四字段（示例）",
      title: "市场",
      appliedDate: "2026-10-12",
      stage: "已投递",
    });
    assert.equal(created.jd, "");
    assert.equal(created.stage, "已投递");
    const expected = store.state();
    store.close();
    store = new Store(path);
    assert.deepEqual(store.state(), expected);
    assert.equal(
      store.db.prepare("PRAGMA user_version").get()!.user_version,
      2,
    );
    store.remove("jobs", created.id);
    assert.equal(store.state().jobs.length, 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("首页最多三项，忽略已完成、归档及未来任务；提醒包含截止与跟进", () => {
  const store = new Store(":memory:");
  try {
    for (let i = 0; i < 5; i++)
      store.saveTask({
        ...emptyTask,
        title: `今天任务${i}`,
        dueDate: "2026-10-12",
        priority: i === 4 ? "P0" : "P1",
      });
    store.saveTask({
      ...emptyTask,
      title: "未来任务",
      dueDate: "2026-10-14",
      priority: "P0",
    });
    store.saveTask({
      ...emptyTask,
      title: "已完成",
      status: "已完成",
      dueDate: "2026-10-12",
    });
    store.saveTask({
      ...emptyTask,
      title: "归档",
      archived: true,
      dueDate: "2026-10-12",
    });
    const job = store.saveJob({
      ...emptyJob,
      company: "提醒（示例）",
      title: "品牌",
      stage: "已投递",
      deadline: "2026-10-15",
      nextFollowUp: "2026-10-11",
    });
    store.saveJob({
      ...emptyJob,
      company: "已结束（示例）",
      title: "品牌",
      stage: "主动放弃",
      deadline: "2026-10-15",
      nextFollowUp: "2026-10-11",
    });
    const now = new Date("2026-10-12T12:00:00");
    const state = store.state();
    const top = importantTasks(state, now);
    assert.equal(top.length, 3);
    assert.equal(top[0].title, "今天任务4");
    assert.ok(top.every((t) => t.title.startsWith("今天任务")));
    const reminders = homeReminders(state, now);
    assert.equal(reminders.filter((r) => r.jobId === job.id).length, 2);
    assert.ok(!reminders.some((r) => r.title.includes("已结束")));
    assert.ok(!reminders.some((r) => ["已完成", "归档"].includes(r.title)));
    assert.deepEqual(importantTasks({ ...state, tasks: [] }, now), []);
  } finally {
    store.close();
  }
});

test("更新前备份脚本能备份打开中的 WAL 数据库并独立恢复", () => {
  const dir = mkdtempSync(join(tmpdir(), "nextstep-backup-"));
  const store = new Store(join(dir, "nextstep.db"));
  try {
    store.saveApplication({
      company: "备份（示例）",
      title: "运营",
      appliedDate: "2026-10-12",
      stage: "初筛",
    });
    execFileSync(process.execPath, ["scripts/backup-db.mjs"], {
      env: { ...process.env, NEXTSTEP_DATA_DIR: dir },
    });
    const files = readdirSync(join(dir, "backups"));
    assert.equal(files.length, 1);
    const restored = new Store(join(dir, "backups", files[0]));
    try {
      assert.deepEqual(restored.state(), store.state());
    } finally {
      restored.close();
    }
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
