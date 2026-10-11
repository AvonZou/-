import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../lib/db";
import {
  emptyTask,
  emptyJob,
  defaultSettings,
  taskInput,
  jobInput,
  type Task,
} from "../lib/model";
import { plan, weekly } from "../lib/planner";
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "nextstep-test-"));
  const file = join(dir, "test.db");
  const store = new Store(file);
  return {
    store,
    file,
    clean() {
      this.store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
test("任务与岗位 CRUD、日志、关联删除和重启持久化", () => {
  const f = fixture();
  try {
    const j = f.store.saveJob({
      ...emptyJob,
      company: "测试公司（示例）",
      title: "品牌营销",
      jd: "真实输入的测试 JD",
      matchScore: 0,
    });
    const t = f.store.saveTask({
      ...emptyTask,
      title: "准备案例",
      jobId: j.id,
    });
    const done = f.store.saveTask(
      {
        ...emptyTask,
        title: "准备案例",
        jobId: j.id,
        status: "已完成",
        actualMinutes: 45,
      },
      t.id,
    );
    assert.ok(done.completedAt);
    assert.equal(f.store.state().tasks[0].actualMinutes, 45);
    f.store.saveJob(
      { ...emptyJob, company: j.company, title: j.title, stage: "面试" },
      j.id,
    );
    assert.match(f.store.state().events[0].title, /阶段变更/);
    const interview = f.store.saveEvent({
      jobId: j.id,
      kind: "面试",
      title: "一面",
      at: "2027-01-15T10:00",
      notes: "会议地址",
    });
    f.store.saveEvent(
      {
        jobId: j.id,
        kind: "面试",
        title: "二面",
        at: "2027-01-16T10:00",
        notes: "",
      },
      interview.id,
    );
    const training = f.store.training(j.id);
    assert.equal(training.module, "面试");
    assert.equal(training.jobId, j.id);
    f.store.close();
    f.store = new Store(f.file);
    assert.equal(f.store.state().tasks.length, 2);
    assert.equal(f.store.state().jobs[0].stage, "面试");
    assert.equal(
      f.store.state().events.find((e) => e.id === interview.id)?.title,
      "二面",
    );
    f.store.remove("jobs", j.id);
    assert.equal(f.store.state().events.length, 0);
    assert.equal(f.store.state().tasks[0].jobId, null);
    f.store.remove("tasks", training.id);
    assert.equal(f.store.state().tasks.length, 1);
    assert.throws(() =>
      f.store.saveTask({ ...emptyTask, title: "无效关联", jobId: j.id }),
    );
    assert.throws(() => f.store.remove("tasks", "missing"));
  } finally {
    f.clean();
  }
});
test("备份预览、恢复、重复跳过与非法关联拒绝", () => {
  const a = fixture(),
    b = fixture();
  try {
    const job = a.store.saveJob({
      ...emptyJob,
      company: "示例",
      title: "岗位",
    });
    a.store.saveTask({ ...emptyTask, title: "关联任务", jobId: job.id });
    a.store.saveEvent({
      jobId: job.id,
      kind: "日志",
      title: "记录",
      at: "",
      notes: "细节",
    });
    a.store.settings({
      ...defaultSettings,
      availableMinutes: 480,
      interviewMode: true,
    });
    const backup = a.store.backup();
    assert.equal(b.store.preview(backup).tasks.new, 1);
    b.store.import(backup);
    assert.equal(b.store.state().settings.availableMinutes, 480);
    assert.deepEqual(b.store.state(), a.store.state());
    b.store.settings({ ...defaultSettings, availableMinutes: 360 });
    assert.equal(b.store.preview(backup).jobs.duplicates, 1);
    b.store.import(backup);
    assert.equal(b.store.state().jobs.length, 1);
    assert.equal(b.store.state().settings.availableMinutes, 360);
    assert.throws(() =>
      b.store.import({ ...backup, tasks: [backup.tasks[0], backup.tasks[0]] }),
    );
    assert.throws(() =>
      b.store.import({
        ...backup,
        tasks: [
          { ...backup.tasks[0], jobId: "00000000-0000-4000-8000-000000000001" },
        ],
      }),
    );
    assert.throws(() => b.store.import({ ...backup, version: 9 }));
    assert.equal(b.store.state().tasks.length, 1);
  } finally {
    a.clean();
    b.clean();
  }
});
test("校验边界：无效日期、非法链接、数值与面试缺失时间", () => {
  assert.equal(
    taskInput.safeParse({ ...emptyTask, title: "", estimatedMinutes: -1 })
      .success,
    false,
  );
  for (const dueDate of ["2026-02-30", "2026-99-01", "abc"])
    assert.equal(
      taskInput.safeParse({ ...emptyTask, title: "x", dueDate }).success,
      false,
    );
  assert.equal(
    jobInput.safeParse({
      ...emptyJob,
      company: "x",
      title: "x",
      officialUrl: "javascript:alert(1)",
    }).success,
    false,
  );
  assert.equal(
    jobInput.safeParse({
      ...emptyJob,
      company: "x",
      title: "x",
      matchScore: 101,
    }).success,
    false,
  );
  const f = fixture();
  try {
    const j = f.store.saveJob({ ...emptyJob, company: "x", title: "x" });
    assert.throws(() =>
      f.store.saveEvent({
        jobId: j.id,
        kind: "面试",
        title: "x",
        at: "",
        notes: "",
      }),
    );
  } finally {
    f.clean();
  }
});
const task = (id: string, patch: Partial<Task> = {}): Task => ({
  ...emptyTask,
  id,
  title: id,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  completedAt: null,
  ...patch,
});
test("规则排程遵循优先级、预算、面试48小时和论文预留", () => {
  const now = new Date("2026-10-11T10:00:00");
  const tasks = [
    task("normal", { priority: "P0", estimatedMinutes: 60 }),
    task("interview", {
      module: "面试",
      jobId: "job",
      priority: "P2",
      estimatedMinutes: 60,
    }),
    task("thesis", { module: "论文", estimatedMinutes: 30 }),
    task("large", { estimatedMinutes: 800 }),
    task("done", { status: "已完成" }),
  ];
  const events = [
    {
      id: "event",
      jobId: "job",
      kind: "面试" as const,
      title: "一面",
      at: "2026-10-12T10:00",
      notes: "",
      createdAt: "",
      updatedAt: "",
    },
  ];
  const result = plan(
    tasks,
    events,
    { ...defaultSettings, interviewMode: true, availableMinutes: 120 },
    now,
  );
  assert.deepEqual(
    result.selected.map((t) => t.id),
    ["interview", "thesis"],
  );
  assert.equal(result.total, 90);
  assert.equal(result.thesisReserved, true);
  const manual = plan(
    tasks,
    events,
    {
      ...defaultSettings,
      availableMinutes: 120,
      scheduleDate: "2026-10-11",
      scheduleOrder: ["interview", "normal"],
    },
    now,
  );
  assert.deepEqual(
    manual.selected.map((t) => t.id),
    ["interview", "normal"],
  );
  const nextDay = plan(
    tasks,
    events,
    {
      ...defaultSettings,
      availableMinutes: 60,
      scheduleDate: "2026-10-10",
      scheduleOrder: ["interview"],
    },
    now,
  );
  assert.equal(nextDay.selected[0].id, "normal");
});
test("周统计只包含当周完成任务，不虚构专注时长", () => {
  const result = weekly(
    [
      task("a", {
        status: "已完成",
        completedAt: "2026-10-06T12:00:00.000Z",
        actualMinutes: 35,
        module: "论文",
      }),
      task("b", {
        status: "已完成",
        completedAt: "2026-09-30T12:00:00.000Z",
        actualMinutes: 999,
      }),
      task("c", { actualMinutes: 120 }),
    ],
    new Date("2026-10-11T12:00:00"),
  );
  assert.equal(result.count, 1);
  assert.equal(result.minutes, 35);
  assert.equal(result.byModule["论文"], 35);
});
