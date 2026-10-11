import { z } from "zod";
import {
  emptyJob,
  jobInput,
  stages,
  date,
  type Job,
  type Source,
} from "./model";
export const importFields = [
  "company",
  "title",
  "direction",
  "location",
  "jd",
  "officialUrl",
  "eligibility",
  "deadline",
  "matchReason",
  "matchScore",
  "resumeVersion",
  "appliedDate",
  "stage",
  "nextFollowUp",
  "notes",
] as const;
export type ImportField = (typeof importFields)[number];
export const fieldLabels: Record<ImportField, string> = {
  company: "公司",
  title: "岗位名称",
  direction: "业务方向",
  location: "地区",
  jd: "JD 正文",
  officialUrl: "官方链接",
  eligibility: "校招资格",
  deadline: "截止日期",
  matchReason: "匹配理由",
  matchScore: "人工匹配分数",
  resumeVersion: "简历版本",
  appliedDate: "投递日期",
  stage: "流程阶段",
  nextFollowUp: "下次跟进",
  notes: "备注",
};
const aliases: Record<ImportField, string[]> = {
  company: ["公司", "公司名称", "企业", "企业名称", "雇主", "company"],
  title: [
    "岗位",
    "岗位名称",
    "职位",
    "职位名称",
    "招聘岗位",
    "投递志愿与顺序",
    "title",
    "position",
  ],
  direction: ["业务方向", "方向", "行业", "岗位类别"],
  location: [
    "地区",
    "城市",
    "工作地点",
    "工作城市",
    "地点",
    "location",
    "base",
  ],
  jd: ["jd", "jd正文", "岗位描述", "职位描述", "岗位职责"],
  officialUrl: [
    "官方链接",
    "投递链接",
    "招聘链接",
    "岗位链接",
    "链接",
    "网址",
    "url",
  ],
  eligibility: ["校招资格", "是否符合校招资格", "资格"],
  deadline: ["截止日期", "截止日", "投递截止时间", "截止时间", "deadline"],
  matchReason: ["匹配理由"],
  matchScore: ["人工匹配分数", "匹配分数", "匹配度"],
  resumeVersion: ["简历版本"],
  appliedDate: ["投递日期", "投递时间", "网申日期", "申请日期"],
  stage: ["流程阶段", "投递状态", "进度", "状态", "阶段", "当前进度"],
  nextFollowUp: ["下次跟进", "下次跟进日期", "跟进日期"],
  notes: ["备注", "记录", "说明"],
};
const norm = (s: string) =>
  s.normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase();
export function guessMapping(headers: string[]) {
  return Object.fromEntries(
    importFields.map((field) => [
      field,
      headers.findIndex((h) => aliases[field].some((a) => norm(a) === norm(h))),
    ]),
  ) as Record<ImportField, number>;
}
export function guessHeader(rows: string[][]) {
  const index = rows.slice(0, 20).findIndex((row) => {
    const m = guessMapping(row);
    return m.company >= 0 && m.title >= 0;
  });
  return index < 0 ? 0 : index;
}
export const jobImportRequest = z
  .object({
    sourceId: z.string().uuid(),
    headers: z.array(z.string().max(200)).min(1).max(100),
    rows: z
      .array(z.array(z.string().max(50000)).max(100))
      .min(1)
      .max(2000),
    mapping: z.record(z.enum(importFields), z.number().int().min(-1).max(99)),
    defaultStage: z.enum(stages),
    allowUpdates: z.boolean(),
  })
  .strict();
export type JobImportRequest = z.infer<typeof jobImportRequest>;
export type ImportRow = {
  row: number;
  action: "新增" | "更新" | "重复" | "错误";
  error?: string;
  job?: z.infer<typeof jobInput>;
  existingId?: string;
};
export function sameJob(
  a: Pick<Job, "company" | "title" | "location">,
  b: Pick<Job, "company" | "title" | "location">,
) {
  return (
    norm(a.company) === norm(b.company) &&
    norm(a.title) === norm(b.title) &&
    (!a.location || !b.location || norm(a.location) === norm(b.location))
  );
}
export function rowKey(j: Pick<Job, "company" | "title" | "location">) {
  return [j.company, j.title, j.location].map(norm).join("|");
}
function importedDate(raw: string) {
  if (!raw.trim()) return "";
  const s = raw
    .trim()
    .replace(/[年/.]/g, "-")
    .replace(/月/g, "-")
    .replace(/日/g, "");
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (!m) throw Error(`日期“${raw}”需包含年份（YYYY-MM-DD）`);
  const result = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if (!date.safeParse(result).success) throw Error(`无效日期：${raw}`);
  return result;
}
function importedStage(raw: string, defaultStage: Job["stage"]) {
  if (!raw.trim()) return defaultStage;
  const s = norm(raw);
  if (stages.some((v) => norm(v) === s))
    return stages.find((v) => norm(v) === s)!;
  const groups: Record<Job["stage"], string[]> = {
    "收藏/待评估": ["收藏", "待评估", "未投递"],
    待投递: ["待投", "准备投递"],
    已投递: [
      "投递",
      "已投",
      "网申",
      "已网申",
      "投递成功",
      "简历筛选",
      "简历评估",
      "简历筛选中",
    ],
    笔试: ["待笔试", "笔试中", "笔试完成", "测评"],
    面试: [
      "一面",
      "二面",
      "三面",
      "终面",
      "待面试",
      "面试中",
      "面试完成",
      "hr面",
    ],
    Offer: ["已录用", "录用", "已offer", "已拿offer"],
    "未通过/结束": [
      "未通过",
      "结束",
      "拒绝",
      "淘汰",
      "已拒绝",
      "已挂",
      "挂了",
      "已结束",
      "简历挂",
    ],
  };
  for (const stage of stages) if (groups[stage].includes(s)) return stage;
  throw Error(`未识别流程阶段“${raw}”，请修正原表或取消阶段映射并选择默认阶段`);
}
export function previewJobs(raw: unknown, source: Source, jobs: Job[]) {
  const req = jobImportRequest.parse(raw);
  if (req.sourceId !== source.id) throw Error("来源不一致");
  if (req.mapping.company < 0 || req.mapping.title < 0)
    throw Error("必须映射公司和岗位名称");
  const seen: Pick<Job, "company" | "title" | "location">[] = [];
  const result: ImportRow[] = req.rows.map((row, index) => {
    try {
      const value = (f: ImportField) => row[req.mapping[f]]?.trim() ?? "";
      let draft = {
        ...emptyJob,
        origin: source.kind,
        sourceId: source.id,
        company: value("company"),
        title: value("title"),
        direction: value("direction"),
        location: value("location"),
        jd: value("jd"),
        officialUrl: value("officialUrl"),
        eligibility: (value("eligibility") === "是"
          ? "符合"
          : value("eligibility") === "否"
            ? "不符合"
            : value("eligibility") || "待确认") as Job["eligibility"],
        deadline: importedDate(value("deadline")),
        matchReason: value("matchReason"),
        matchScore: value("matchScore") ? Number(value("matchScore")) : null,
        resumeVersion: value("resumeVersion"),
        appliedDate: importedDate(value("appliedDate")),
        stage: importedStage(value("stage"), req.defaultStage),
        nextFollowUp: importedDate(value("nextFollowUp")),
        notes: value("notes"),
      };
      const original = req.headers
        .map((h, i) =>
          row[i] && i !== req.mapping.jd
            ? `${h || `第${i + 1}列`}：${row[i]}`
            : "",
        )
        .filter(Boolean)
        .join("\n");
      draft.notes = [draft.notes, "【导入原始字段】\n" + original]
        .filter(Boolean)
        .join("\n\n");
      draft.sourceRowKey = rowKey(draft);
      jobInput.parse(draft);
      if (seen.some((j) => sameJob(j, draft)))
        return { row: index + 1, action: "重复", job: draft };
      seen.push(draft);
      const existing = jobs.find((j) => sameJob(j, draft));
      if (existing) {
        // Never overwrite an application with a feed item or silently replace manual records.
        const mayUpdate =
          req.allowUpdates &&
          ((existing.origin === source.kind &&
            existing.sourceId === source.id) ||
            (source.kind === "投递记录" && existing.origin === "岗位信息库"));
        if (!mayUpdate)
          return {
            row: index + 1,
            action: "重复",
            job: draft,
            existingId: existing.id,
          };
        const merged = {
          ...jobInput.parse(
            Object.fromEntries(
              Object.keys(emptyJob).map((k) => [k, existing[k as keyof Job]]),
            ),
          ),
          origin: source.kind,
          sourceId: source.id,
          sourceRowKey: draft.sourceRowKey,
        };
        for (const field of importFields)
          if (req.mapping[field] >= 0 && value(field) !== "")
            Object.assign(merged, { [field]: draft[field] });
        // Preserve manually added notes while recording the latest original fields once.
        const oldNotes = existing.notes.split(/(?:\n\n)?【导入原始字段】\n/)[0];
        merged.notes = [
          value("notes") || oldNotes,
          "【导入原始字段】\n" + original,
        ]
          .filter(Boolean)
          .join("\n\n");
        if (
          source.kind === "投递记录" &&
          existing.origin === "岗位信息库" &&
          !value("stage")
        )
          merged.stage = req.defaultStage;
        return {
          row: index + 1,
          action: "更新",
          job: jobInput.parse(merged),
          existingId: existing.id,
        };
      }
      return { row: index + 1, action: "新增", job: draft };
    } catch (e) {
      return {
        row: index + 1,
        action: "错误",
        error:
          e instanceof z.ZodError
            ? e.issues.map((v) => v.message).join("；")
            : e instanceof Error
              ? e.message
              : "无法解析此行",
      };
    }
  });
  return {
    rows: result,
    counts: Object.fromEntries(
      ["新增", "更新", "重复", "错误"].map((action) => [
        action,
        result.filter((r) => r.action === action).length,
      ]),
    ) as Record<ImportRow["action"], number>,
  };
}
