import { z } from "zod";
export const modules = ["求职", "面试", "论文", "雅思"] as const;
export const stages = [
  "收藏/待评估",
  "待投递",
  "已投递",
  "笔试",
  "面试",
  "Offer",
  "未通过/结束",
] as const;
const text = (max = 10000) => z.string().max(max);
export const date = z
  .string()
  .refine(
    (v) =>
      v === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        Number.isFinite(new Date(v + "T00:00:00Z").getTime()) &&
        new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v),
    "请输入有效日期",
  );
const timestamp = z
  .string()
  .refine(
    (v) =>
      v === "" ||
      (/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(v) &&
        Number.isFinite(new Date(v).getTime()) &&
        date.safeParse(v.slice(0, 10)).success),
    "请输入有效时间",
  );
const id = z.string().uuid();
export const taskInput = z
  .object({
    title: text(200).trim().min(1, "请填写任务名称"),
    module: z.enum(modules),
    priority: z.enum(["P0", "P1", "P2"]),
    estimatedMinutes: z.number().int().min(1).max(1440),
    actualMinutes: z.number().int().min(0).max(100000),
    dueDate: date,
    status: z.enum(["待办", "进行中", "已完成"]),
    notes: text(),
    jobId: id.nullable(),
    archived: z.boolean(),
  })
  .strict();
export const jobInput = z
  .object({
    origin: z.enum(["手动", "岗位信息库", "投递记录"]).default("手动"),
    sourceId: id.nullable().default(null),
    sourceRowKey: text(1000).default(""),
    company: text(200).trim().min(1, "请填写公司"),
    title: text(200).trim().min(1, "请填写岗位"),
    direction: text(100),
    location: text(100),
    jd: text(50000),
    officialUrl: text(2000).refine(
      (v) => v === "" || (/^https?:\/\//i.test(v) && URL.canParse(v)),
      "链接必须是 http 或 https",
    ),
    eligibility: z.enum(["待确认", "符合", "不符合"]),
    deadline: date,
    matchReason: text(),
    matchScore: z.number().min(0).max(100).nullable(),
    resumeVersion: text(200),
    appliedDate: date,
    stage: z.enum(stages),
    nextFollowUp: date,
    notes: text(),
    archived: z.boolean(),
  })
  .strict();
export const eventInput = z
  .object({
    jobId: id,
    kind: z.enum(["日志", "面试"]),
    title: text(200).trim().min(1),
    at: timestamp,
    notes: text(),
  })
  .strict()
  .refine((v) => v.kind !== "面试" || v.at !== "", "面试安排需要日期与时间");
const meta = {
  id,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};
export const taskSchema = taskInput.extend({
  ...meta,
  completedAt: z.string().datetime().nullable(),
});
export const jobSchema = jobInput.extend(meta);
export const eventSchema = z
  .object({ ...eventInput.shape, ...meta })
  .refine((v) => v.kind !== "面试" || v.at !== "", "面试安排需要时间");
export const settingsSchema = z
  .object({
    recommendationKeywords: z
      .array(text(100))
      .max(30)
      .default(["内容", "品牌", "营销", "AI", "出海"]),
    recommendationLocations: z.array(text(100)).max(30).default([]),
    dailyRecommendationLimit: z.number().int().min(1).max(20).default(5),
    availableMinutes: z.number().int().min(15).max(1440),
    interviewMode: z.boolean(),
    scheduleDate: date,
    scheduleOrder: z.array(id).max(10000),
  })
  .strict();
export const sourceInput = z
  .object({
    name: text(100).trim().min(1),
    kind: z.enum(["岗位信息库", "投递记录"]),
    url: text(2000).refine(
      (v) => /^https:\/\//i.test(v) && URL.canParse(v),
      "请填写 HTTPS 文档链接",
    ),
  })
  .strict();
export const sourceSchema = sourceInput.extend({
  ...meta,
  lastImportedAt: z.string().datetime().nullable(),
});
export type Source = z.infer<typeof sourceSchema>;
export const backupSchema = z
  .object({
    version: z.literal(1),
    exportedAt: z.string().datetime(),
    sources: z.array(sourceSchema).max(100).default([]),
    tasks: z.array(taskSchema).max(10000),
    jobs: z.array(jobSchema).max(10000),
    events: z.array(eventSchema).max(20000),
    settings: settingsSchema,
  })
  .strict();
export type Task = z.infer<typeof taskSchema>;
export type Job = z.infer<typeof jobSchema>;
export type JobEvent = z.infer<typeof eventSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type State = {
  sources: Source[];
  tasks: Task[];
  jobs: Job[];
  events: JobEvent[];
  settings: Settings;
};
export type Backup = z.infer<typeof backupSchema>;
export const emptyTask: z.infer<typeof taskInput> = {
  title: "",
  module: "求职",
  priority: "P1",
  estimatedMinutes: 30,
  actualMinutes: 0,
  dueDate: "",
  status: "待办",
  notes: "",
  jobId: null,
  archived: false,
};
export const emptyJob: z.infer<typeof jobInput> = {
  origin: "手动",
  sourceId: null,
  sourceRowKey: "",
  company: "",
  title: "",
  direction: "",
  location: "",
  jd: "",
  officialUrl: "",
  eligibility: "待确认",
  deadline: "",
  matchReason: "",
  matchScore: null,
  resumeVersion: "",
  appliedDate: "",
  stage: "收藏/待评估",
  nextFollowUp: "",
  notes: "",
  archived: false,
};
export const defaultSettings: Settings = {
  recommendationKeywords: ["内容", "品牌", "营销", "AI", "出海"],
  recommendationLocations: [],
  dailyRecommendationLimit: 5,
  availableMinutes: 180,
  interviewMode: false,
  scheduleDate: "",
  scheduleOrder: [],
};
