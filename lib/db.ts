import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  taskInput,
  jobInput,
  jobSchema,
  sourceInput,
  type Source,
  eventInput,
  settingsSchema,
  backupSchema,
  defaultSettings,
  type Task,
  type Job,
  type JobEvent,
  type State,
  type Backup,
} from "./model";
import { jobImportRequest, previewJobs } from "./job-import";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
// All changes to persisted structure require a new numbered migration. Never reset user data.
const migrations = [
  `CREATE TABLE jobs (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
   CREATE TABLE tasks (id TEXT PRIMARY KEY, job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL, payload TEXT NOT NULL);
   CREATE TABLE job_events (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, payload TEXT NOT NULL);
   CREATE TABLE app_settings (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
   CREATE INDEX tasks_job ON tasks(job_id); CREATE INDEX events_job ON job_events(job_id);`,
  `CREATE TABLE sources (id TEXT PRIMARY KEY, payload TEXT NOT NULL);`,
];
export class Store {
  db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
    const version = (
      this.db.prepare("PRAGMA user_version").get() as { user_version: number }
    ).user_version;
    if (version > migrations.length)
      throw new AppError("数据库版本比应用新，请升级应用。", 500);
    for (let i = version; i < migrations.length; i++)
      this.transaction(() => {
        this.db.exec(migrations[i]);
        this.db.exec(`PRAGMA user_version=${i + 1}`);
      });
    this.db
      .prepare("INSERT OR IGNORE INTO app_settings(id,payload) VALUES (1,?)")
      .run(JSON.stringify(defaultSettings));
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  rows<T>(table: "tasks" | "jobs" | "job_events" | "sources"): T[] {
    return (
      this.db
        .prepare(`SELECT payload FROM ${table} ORDER BY rowid DESC`)
        .all() as { payload: string }[]
    ).map((r) => JSON.parse(r.payload));
  }
  state(): State {
    const tasks = (
      this.db
        .prepare("SELECT payload, job_id FROM tasks ORDER BY rowid DESC")
        .all() as { payload: string; job_id: string | null }[]
    ).map((r) => ({ ...JSON.parse(r.payload), jobId: r.job_id }));
    return {
      tasks,
      jobs: this.rows<Job>("jobs").map((j) => jobSchema.parse(j)),
      sources: this.rows<Source>("sources"),
      events: this.rows<JobEvent>("job_events"),
      settings: settingsSchema.parse(
        JSON.parse(
          (
            this.db
              .prepare("SELECT payload FROM app_settings WHERE id=1")
              .get() as { payload: string }
          ).payload,
        ),
      ),
    };
  }
  find<T>(table: "tasks" | "jobs" | "job_events" | "sources", id: string): T {
    const r = this.db
      .prepare(`SELECT payload FROM ${table} WHERE id=?`)
      .get(id) as { payload: string } | undefined;
    if (!r) throw new AppError("记录不存在或已删除", 404);
    return JSON.parse(r.payload);
  }
  checkJob(id: string | null) {
    if (id) this.find("jobs", id);
  }
  saveTask(raw: unknown, id?: string): Task {
    const input = taskInput.parse(raw);
    this.checkJob(input.jobId);
    const old = id ? this.find<Task>("tasks", id) : null,
      now = new Date().toISOString();
    const task: Task = {
      ...input,
      id: old?.id ?? randomUUID(),
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
      completedAt: input.status === "已完成" ? (old?.completedAt ?? now) : null,
    };
    this.db
      .prepare(
        "INSERT INTO tasks(id,job_id,payload) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET job_id=excluded.job_id,payload=excluded.payload",
      )
      .run(task.id, task.jobId, JSON.stringify(task));
    return task;
  }
  saveJob(raw: unknown, id?: string): Job {
    const input = jobInput.parse(raw),
      old = id ? this.find<Job>("jobs", id) : null,
      now = new Date().toISOString();
    if (input.sourceId) this.find("sources", input.sourceId);
    const job: Job = {
      ...input,
      id: old?.id ?? randomUUID(),
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
    };
    this.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO jobs(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
        )
        .run(job.id, JSON.stringify(job));
      if (old && old.stage !== job.stage)
        this.saveEvent({
          jobId: job.id,
          kind: "日志",
          title: `阶段变更：${old.stage} → ${job.stage}`,
          at: "",
          notes: "",
        });
    });
    return job;
  }
  saveEvent(raw: unknown, id?: string): JobEvent {
    const input = eventInput.parse(raw);
    this.checkJob(input.jobId);
    const old = id ? this.find<JobEvent>("job_events", id) : null,
      now = new Date().toISOString();
    const event: JobEvent = {
      ...input,
      id: old?.id ?? randomUUID(),
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
    };
    this.db
      .prepare(
        "INSERT INTO job_events(id,job_id,payload) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET job_id=excluded.job_id,payload=excluded.payload",
      )
      .run(event.id, event.jobId, JSON.stringify(event));
    return event;
  }
  remove(table: "tasks" | "jobs" | "job_events" | "sources", id: string) {
    this.find(table, id);
    this.transaction(() => {
      if (table === "sources")
        for (const j of this.state().jobs.filter((j) => j.sourceId === id))
          this.db.prepare("UPDATE jobs SET payload=? WHERE id=?").run(
            JSON.stringify({
              ...j,
              sourceId: null,
              updatedAt: new Date().toISOString(),
            }),
            j.id,
          );
      this.db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
    });
  }
  settings(raw: unknown) {
    const value = settingsSchema.parse(raw);
    this.db
      .prepare("UPDATE app_settings SET payload=? WHERE id=1")
      .run(JSON.stringify(value));
    return value;
  }
  training(jobId: string) {
    const job = this.find<Job>("jobs", jobId);
    const state = this.state();
    const event = state.events
      .filter(
        (e) =>
          e.jobId === jobId &&
          e.kind === "面试" &&
          new Date(e.at) >= new Date(),
      )
      .sort((a, b) => a.at.localeCompare(b.at))[0];
    return this.saveTask({
      title: `准备 ${job.company} · ${job.title} 面试`,
      module: "面试",
      priority: "P0",
      estimatedMinutes: 60,
      actualMinutes: 0,
      dueDate: event?.at.slice(0, 10) ?? "",
      status: "待办",
      notes: "阅读 JD，整理项目经历与面试回答。题库与练习档案将在阶段 B 实现。",
      jobId,
      archived: false,
    });
  }
  backup(): Backup {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      ...this.state(),
    };
  }
  preview(raw: unknown) {
    const backup = backupSchema.parse(raw),
      current = this.state();
    for (const list of [
      backup.tasks,
      backup.jobs,
      backup.events,
      backup.sources,
    ])
      if (new Set(list.map((x) => x.id)).size !== list.length)
        throw new AppError("备份包含重复 ID");
    const sourceIds = new Set(
      [...current.sources, ...backup.sources].map((s) => s.id),
    );
    if (backup.jobs.some((j) => j.sourceId && !sourceIds.has(j.sourceId)))
      throw new AppError("备份存在无效的来源关联");
    const jobIds = new Set([...current.jobs, ...backup.jobs].map((j) => j.id));
    if (
      backup.tasks.some((t) => t.jobId && !jobIds.has(t.jobId)) ||
      backup.events.some((e) => !jobIds.has(e.jobId))
    )
      throw new AppError("备份存在无效的岗位关联");
    const count = (items: { id: string }[], existing: { id: string }[]) => ({
      new: items.filter((x) => !existing.some((y) => x.id === y.id)).length,
      duplicates: items.filter((x) => existing.some((y) => x.id === y.id))
        .length,
    });
    return {
      sources: count(backup.sources, current.sources),
      jobs: count(backup.jobs, current.jobs),
      tasks: count(backup.tasks, current.tasks),
      events: count(backup.events, current.events),
    };
  }
  import(raw: unknown) {
    const backup = backupSchema.parse(raw);
    const summary = this.preview(backup);
    const current = this.state();
    const wasEmpty =
      current.jobs.length === 0 &&
      current.tasks.length === 0 &&
      current.events.length === 0;
    this.transaction(() => {
      for (const source of backup.sources)
        this.db
          .prepare("INSERT OR IGNORE INTO sources(id,payload) VALUES (?,?)")
          .run(source.id, JSON.stringify(source));
      for (const job of backup.jobs)
        this.db
          .prepare("INSERT OR IGNORE INTO jobs(id,payload) VALUES (?,?)")
          .run(job.id, JSON.stringify(job));
      for (const task of backup.tasks)
        this.db
          .prepare(
            "INSERT OR IGNORE INTO tasks(id,job_id,payload) VALUES (?,?,?)",
          )
          .run(task.id, task.jobId, JSON.stringify(task));
      for (const event of backup.events)
        this.db
          .prepare(
            "INSERT OR IGNORE INTO job_events(id,job_id,payload) VALUES (?,?,?)",
          )
          .run(event.id, event.jobId, JSON.stringify(event));
      // A restore into an empty database also restores the planner settings. Merge never replaces existing settings.
      if (wasEmpty) this.settings(backup.settings);
    });
    return summary;
  }
  saveSource(raw: unknown, id?: string): Source {
    const input = sourceInput.parse(raw),
      old = id ? this.find<Source>("sources", id) : null,
      now = new Date().toISOString();
    const existing = this.state().sources.find(
      (s) => s.url === input.url && s.id !== id,
    );
    if (existing) throw new AppError("此来源链接已保存");
    const source = {
      ...input,
      id: old?.id ?? randomUUID(),
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
      lastImportedAt: old?.lastImportedAt ?? null,
    };
    this.db
      .prepare(
        "INSERT INTO sources(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      )
      .run(source.id, JSON.stringify(source));
    return source;
  }
  previewJobSheet(raw: unknown) {
    const req = jobImportRequest.parse(raw);
    return previewJobs(
      req,
      this.find<Source>("sources", req.sourceId),
      this.state().jobs,
    );
  }
  importJobSheet(raw: unknown) {
    const req = jobImportRequest.parse(raw);
    const source = this.find<Source>("sources", req.sourceId);
    const preview = this.previewJobSheet(req);
    const items = preview.rows.filter(
      (r) => r.action === "新增" || r.action === "更新",
    );
    if (!items.length)
      throw new AppError("没有可导入的有效记录，请检查预览中的错误或重复行");
    this.transaction(() => {
      const now = new Date().toISOString();
      for (const item of items) {
        const old = item.existingId
          ? this.find<Job>("jobs", item.existingId)
          : null;
        const job: Job = {
          ...item.job!,
          id: old?.id ?? randomUUID(),
          createdAt: old?.createdAt ?? now,
          updatedAt: now,
        };
        this.db
          .prepare(
            "INSERT INTO jobs(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
          )
          .run(job.id, JSON.stringify(job));
        if (old && old.stage !== job.stage)
          this.saveEvent({
            jobId: job.id,
            kind: "日志",
            title: `导入阶段变更：${old.stage} → ${job.stage}`,
            at: "",
            notes: "",
          });
        if (!old && source.kind === "投递记录")
          this.saveEvent({
            jobId: job.id,
            kind: "日志",
            title: "导入已有投递记录",
            at: "",
            notes: `来自：${source.name}`,
          });
      }
      this.db
        .prepare("UPDATE sources SET payload=? WHERE id=?")
        .run(
          JSON.stringify({ ...source, updatedAt: now, lastImportedAt: now }),
          source.id,
        );
    });
    return preview.counts;
  }
  close() {
    this.db.close();
  }
}
const globalStore = globalThis as typeof globalThis & { nextstepStore?: Store };
export function getStore() {
  if (!globalStore.nextstepStore) {
    const dir = resolve(
      process.env.NEXTSTEP_DATA_DIR ?? join(process.cwd(), "data"),
    );
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(dir, "uploads"), { recursive: true });
    globalStore.nextstepStore = new Store(join(dir, "nextstep.db"));
  }
  return globalStore.nextstepStore;
}
