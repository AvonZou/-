import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import ExcelJS from "exceljs";
import { Store } from "../lib/db";
import { guessHeader, guessMapping } from "../lib/job-import";
import { readSpreadsheet } from "../lib/spreadsheet";
import { dailyRecommendations } from "../lib/recommendations";
import { emptyJob, defaultSettings } from "../lib/model";
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), "nextstep-import-"));
  const store = new Store(join(dir, "test.db"));
  return {
    store,
    close() {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
};
test("校招导出列名与投递、测评、简历挂状态映射，原始阶段保留", () => {
  const f = fixture();
  try {
    const source = f.store.saveSource({
      name: "校招模板（示例）",
      kind: "投递记录",
      url: "https://example.com/campus",
    });
    const headers = ["公司", "base", "投递志愿与顺序", "当前进度"];
    const mapping = guessMapping(headers);
    assert.equal(mapping.title, 2);
    assert.equal(mapping.location, 1);
    assert.equal(guessHeader([["说明"], headers]), 1);
    const request = {
      sourceId: source.id,
      headers,
      rows: [
        ["示例甲", "北京", "营销", "投递"],
        ["示例乙", "上海", "品牌", "测评"],
        ["示例丙", "杭州", "运营", "简历挂"],
      ],
      mapping,
      defaultStage: "已投递",
      allowUpdates: false,
    };
    const preview = f.store.previewJobSheet(request);
    assert.deepEqual(preview.counts, { 新增: 3, 更新: 0, 重复: 0, 错误: 0 });
    assert.deepEqual(
      preview.rows.map((r) => r.job?.stage),
      ["已投递", "笔试", "未通过"],
    );
    f.store.importJobSheet(request);
    assert.match(
      f.store.state().jobs.find((j) => j.company === "示例乙")!.notes,
      /当前进度：测评/,
    );
  } finally {
    f.close();
  }
});
test("CSV/TSV/UTF16 支持中文、引号、换行与 Excel 多工作表日期", async () => {
  const csv = await readSpreadsheet(
    Buffer.from(
      '\uFEFF公司,岗位,备注\r\n示例公司,内容营销,"第一行\n第二行,""引用"""',
    ),
    "sample.csv",
  );
  assert.equal(csv[0].rows[1][2], '第一行\n第二行,"引用"');
  const tsv = await readSpreadsheet(
    Buffer.from("公司\t岗位\n示例\t增长"),
    "sample.tsv",
  );
  assert.equal(tsv[0].rows[0].length, 2);
  const utf16 = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from("公司\t岗位\n示例\t营销", "utf16le"),
  ]);
  assert.equal(
    (await readSpreadsheet(utf16, "sample.tsv"))[0].rows[1][1],
    "营销",
  );
  await assert.rejects(readSpreadsheet(Buffer.from('"未闭合'), "x.csv"));
  await assert.rejects(readSpreadsheet(Buffer.from("bad"), "sample.xls"));
  await assert.rejects(readSpreadsheet(Buffer.from(""), "empty.csv"));
  const book = new ExcelJS.Workbook();
  const a = book.addWorksheet("岗位");
  a.addRow(["表格说明（示例）"]);
  a.addRow(["公司", "岗位", "截止日期", "链接"]);
  a.addRow([
    "示例公司",
    "AI 增长",
    new Date("2027-01-10T00:00:00Z"),
    { text: "官网", hyperlink: "https://example.com/job" },
  ]);
  book.addWorksheet("投递").addRow(["公司", "岗位"]);
  const parsed = await readSpreadsheet(
    Buffer.from(await book.xlsx.writeBuffer()),
    "sample.xlsx",
  );
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].rows[2][2], "2027-01-10");
  assert.equal(parsed[0].rows[2][3], "https://example.com/job");
});
test("导入预览不写入、重复检测、非法日期/未知阶段拒绝、原始字段保留", () => {
  const f = fixture();
  try {
    const source = f.store.saveSource({
      name: "测试来源（示例）",
      kind: "投递记录",
      url: "https://example.com/records",
    });
    const headers = [
      "公司名称",
      "职位名称",
      "投递日期",
      "当前进度",
      "自定义信息",
    ];
    const request = {
      sourceId: source.id,
      headers,
      rows: [
        ["示例公司", "内容营销", "2026/10/10", "一面", "待补作品集"],
        ["示例公司", "内容营销", "", "一面", ""],
        ["示例公司2", "增长", "10月10日", "已投递", ""],
        ["示例公司3", "品牌", "", "未知流程", ""],
      ],
      mapping: guessMapping(headers),
      defaultStage: "已投递",
      allowUpdates: false,
    };
    assert.equal(guessHeader([["表格说明"], headers]), 1);
    const preview = f.store.previewJobSheet(request);
    assert.deepEqual(preview.counts, { 新增: 1, 更新: 0, 重复: 1, 错误: 2 });
    assert.equal(f.store.state().jobs.length, 0);
    f.store.importJobSheet(request);
    let state = f.store.state();
    assert.equal(state.jobs[0].origin, "投递记录");
    assert.equal(state.jobs[0].stage, "一面");
    assert.equal(state.jobs[0].appliedDate, "2026-10-10");
    assert.match(state.jobs[0].notes, /自定义信息：待补作品集/);
    assert.equal(state.events.length, 1);
    assert.ok(state.sources[0].lastImportedAt);
    assert.equal(
      f.store.previewJobSheet({ ...request, rows: [request.rows[0]] }).counts[
        "重复"
      ],
      1,
    );
    const updated = {
      ...request,
      rows: [["示例公司", "内容营销", "", "Offer", "新备注"]],
      allowUpdates: true,
    };
    assert.equal(f.store.previewJobSheet(updated).counts["更新"], 1);
    f.store.importJobSheet(updated);
    state = f.store.state();
    assert.equal(state.jobs[0].appliedDate, "2026-10-10");
    assert.equal(state.jobs[0].stage, "Offer");
    assert.match(state.events[0].title, /导入阶段变更/);
    f.store.remove("sources", source.id);
    assert.equal(f.store.state().jobs[0].sourceId, null);
    assert.equal(f.store.state().jobs.length, 1);
  } finally {
    f.close();
  }
});
test("信息库不会覆盖投递记录，显式更新可把候选岗位转为投递记录", () => {
  const f = fixture();
  try {
    const feed = f.store.saveSource({
        name: "信息库（示例）",
        kind: "岗位信息库",
        url: "https://example.com/feed",
      }),
      track = f.store.saveSource({
        name: "投递表（示例）",
        kind: "投递记录",
        url: "https://example.com/track",
      });
    const headers = ["公司", "岗位", "地区"];
    const base = {
      headers,
      rows: [["示例公司", "营销", "上海"]],
      mapping: guessMapping(headers),
      defaultStage: "收藏/待评估",
      allowUpdates: false,
    };
    f.store.importJobSheet({ ...base, sourceId: feed.id });
    const id = f.store.state().jobs[0].id;
    f.store.importJobSheet({
      ...base,
      sourceId: track.id,
      defaultStage: "已投递",
      allowUpdates: true,
    });
    assert.equal(f.store.state().jobs.length, 1);
    assert.equal(f.store.state().jobs[0].id, id);
    assert.equal(f.store.state().jobs[0].origin, "投递记录");
    assert.equal(f.store.state().jobs[0].stage, "已投递");
    assert.equal(
      f.store.previewJobSheet({
        ...base,
        sourceId: feed.id,
        allowUpdates: true,
      }).counts["重复"],
      1,
    );
    const backup = f.store.backup();
    assert.equal(backup.sources.length, 2);
    const other = fixture();
    try {
      other.store.import(backup);
      const restored = other.store.state(),
        original = f.store.state();
      restored.sources.sort((a, b) => a.id.localeCompare(b.id));
      original.sources.sort((a, b) => a.id.localeCompare(b.id));
      assert.deepEqual(restored, original);
    } finally {
      other.close();
    }
  } finally {
    f.close();
  }
});
test("旧数据库迁移保留记录与设置，旧备份向后兼容", () => {
  const dir = mkdtempSync(join(tmpdir(), "nextstep-v1-"));
  const file = join(dir, "old.db");
  const db = new DatabaseSync(file);
  db.exec(
    "CREATE TABLE jobs(id TEXT PRIMARY KEY,payload TEXT NOT NULL);CREATE TABLE tasks(id TEXT PRIMARY KEY,job_id TEXT,payload TEXT NOT NULL);CREATE TABLE job_events(id TEXT PRIMARY KEY,job_id TEXT,payload TEXT NOT NULL);CREATE TABLE app_settings(id INTEGER PRIMARY KEY,payload TEXT NOT NULL);PRAGMA user_version=1;",
  );
  const oldSettings = {
    availableMinutes: 360,
    interviewMode: true,
    scheduleDate: "",
    scheduleOrder: [],
  };
  db.prepare("INSERT INTO app_settings VALUES(1,?)").run(
    JSON.stringify(oldSettings),
  );
  db.close();
  const store = new Store(file);
  try {
    assert.equal(
      (
        store.db.prepare("PRAGMA user_version").get() as {
          user_version: number;
        }
      ).user_version,
      2,
    );
    assert.equal(store.state().settings.availableMinutes, 360);
    assert.deepEqual(
      store.state().settings.recommendationKeywords,
      defaultSettings.recommendationKeywords,
    );
    store.import({
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: [],
      jobs: [],
      events: [],
      settings: oldSettings,
    });
    assert.equal(store.state().sources.length, 0);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("每日推荐基于真实关键词与日期，排除已投递、过期、资格不符与待投递", () => {
  const f = fixture();
  try {
    const feed = f.store.saveSource({
      name: "推荐来源（示例）",
      kind: "岗位信息库",
      url: "https://example.com/jobs",
    });
    const candidate = (title: string, patch: Partial<typeof emptyJob> = {}) =>
      f.store.saveJob({
        ...emptyJob,
        origin: "岗位信息库",
        sourceId: feed.id,
        company: "示例公司",
        title,
        deadline: "2026-10-15",
        ...patch,
      });
    candidate("AI 出海内容营销", { eligibility: "符合" });
    candidate("开发");
    candidate("过期", { deadline: "2026-10-10" });
    candidate("资格不符", { eligibility: "不符合" });
    candidate("已加入", { stage: "待投递" });
    candidate("已投递同名");
    f.store.saveJob({
      ...emptyJob,
      company: "示例公司",
      title: "已投递同名",
      origin: "投递记录",
      stage: "已投递",
    });
    const results = dailyRecommendations(
      f.store.state().jobs,
      defaultSettings,
      new Date("2026-10-11T12:00:00"),
    );
    assert.equal(results.length, 2);
    assert.equal(results[0].job.title, "AI 出海内容营销");
    assert.match(results[0].reasons.join(" "), /命中关键词/);
    assert.equal(
      dailyRecommendations(
        f.store.state().jobs,
        defaultSettings,
        new Date("2026-10-16T12:00:00"),
      ).length,
      0,
    );
  } finally {
    f.close();
  }
});

test("长 JD 保存在正文，避免重复塞入备注导致合法行被拒绝", () => {
  const f = fixture();
  try {
    const source = f.store.saveSource({
      name: "长JD（示例）",
      kind: "岗位信息库",
      url: "https://example.com/long",
    });
    const headers = ["公司", "岗位", "JD", "补充信息"];
    const request = {
      sourceId: source.id,
      headers,
      rows: [["示例公司", "增长", "说明".repeat(15000), "保留"]],
      mapping: guessMapping(headers),
      defaultStage: "收藏/待评估",
      allowUpdates: false,
    };
    assert.equal(f.store.previewJobSheet(request).counts["新增"], 1);
    f.store.importJobSheet(request);
    assert.equal(f.store.state().jobs[0].jd.length, 30000);
    assert.match(f.store.state().jobs[0].notes, /补充信息：保留/);
  } finally {
    f.close();
  }
});
