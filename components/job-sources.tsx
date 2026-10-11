"use client";
import { useState } from "react";
import {
  Plus,
  ExternalLink,
  Upload,
  Trash2,
  Check,
  Settings2,
} from "lucide-react";
import { type State, type Source, type Settings, stages } from "@/lib/model";
import {
  fieldLabels,
  importFields,
  guessHeader,
  guessMapping,
  type JobImportRequest,
  type ImportRow,
} from "@/lib/job-import";
import type { Sheet } from "@/lib/spreadsheet";
import { Badge, Field, Modal } from "./ui";
async function call(path: string, method = "POST", data?: unknown) {
  const response = await fetch("/api/" + path, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const value = await response.json();
  if (!response.ok) throw Error(value.error ?? "操作失败");
  return value;
}
export default function JobSources({
  state,
  onRefresh,
}: {
  state: State;
  onRefresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<{
      name: string;
      kind: Source["kind"];
      url: string;
    } | null>(null),
    [id, setId] = useState<string>(),
    [sourceId, setSourceId] = useState(""),
    [sheets, setSheets] = useState<Sheet[]>([]),
    [sheetIndex, setSheetIndex] = useState(0),
    [headerIndex, setHeaderIndex] = useState(0),
    [mapping, setMapping] = useState<
      Record<(typeof importFields)[number], number>
    >(guessMapping([])),
    [defaultStage, setDefaultStage] =
      useState<(typeof stages)[number]>("收藏/待评估"),
    [allowUpdates, setAllowUpdates] = useState(false),
    [preview, setPreview] = useState<{
      rows: ImportRow[];
      counts: Record<string, number>;
    } | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [keywords, setKeywords] = useState(
      state.settings.recommendationKeywords.join("、"),
    ),
    [locations, setLocations] = useState(
      state.settings.recommendationLocations.join("、"),
    ),
    [limit, setLimit] = useState(state.settings.dailyRecommendationLimit);
  const source = state.sources.find((s) => s.id === sourceId),
    sheet = sheets[sheetIndex],
    headers = sheet?.rows[headerIndex] ?? [],
    rows = sheet?.rows.slice(headerIndex + 1) ?? [];
  const split = (value: string) =>
    value
      .split(/[,，、;；\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await onRefresh();
      setNotice(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function chooseSource(next: string) {
    setSourceId(next);
    setSheets([]);
    setSheetIndex(0);
    setHeaderIndex(0);
    setMapping(guessMapping([]));
    setAllowUpdates(false);
    setPreview(null);
    const s = state.sources.find((s) => s.id === next);
    setDefaultStage(s?.kind === "投递记录" ? "已投递" : "收藏/待评估");
  }
  function chooseSheet(items: Sheet[], i: number) {
    setSheetIndex(i);
    const h = guessHeader(items[i].rows);
    setHeaderIndex(h);
    setMapping(guessMapping(items[i].rows[h]));
    setPreview(null);
  }
  function request(): JobImportRequest {
    return { sourceId, headers, rows, mapping, defaultStage, allowUpdates };
  }
  return (
    <div className="sources-workspace">
      <div className="panel-heading">
        <div>
          <h2>在线文档与本地导入</h2>
          <p>
            保存来源链接，在腾讯文档 /
            飞书导出表格后导入。当前没有在线自动同步。
          </p>
        </div>
        <button
          className="button"
          disabled={busy}
          onClick={() => {
            setId(undefined);
            setDraft({ name: "", kind: "岗位信息库", url: "" });
            setError("");
          }}
        >
          <Plus size={16} />
          新增来源
        </button>
      </div>
      {error && (
        <div role="alert" className="alert">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="source-notice">
          <Check size={16} />
          {notice}
        </div>
      )}
      <div className="source-cards">
        {state.sources.length ? (
          state.sources.map((s) => (
            <article className="source-card" key={s.id}>
              <div>
                <Badge tone={s.kind === "投递记录" ? "purple" : "blue"}>
                  {s.kind}
                </Badge>
                <strong>{s.name}</strong>
                <p>
                  {s.lastImportedAt
                    ? `上次本地导入：${new Date(s.lastImportedAt).toLocaleString("zh-CN")}`
                    : "尚未导入表格内容"}
                </p>
                <small>只保存了来源入口；导入快照不等于实时同步。</small>
              </div>
              <div className="source-card-actions">
                <a
                  className="button"
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={14} />
                  打开文档
                </a>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => chooseSource(s.id)}
                >
                  导入此来源
                </button>
                <button
                  className="text-button muted"
                  disabled={busy}
                  onClick={() => {
                    setId(s.id);
                    setDraft({ name: s.name, kind: s.kind, url: s.url });
                  }}
                >
                  编辑
                </button>
                <button
                  className="icon-button danger"
                  aria-label={`删除来源 ${s.name}`}
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "删除此来源入口？已导入的岗位和投递记录会保留并解除来源关联。",
                      )
                    )
                      void action(
                        () => call(`sources/${s.id}`, "DELETE"),
                        "来源入口已删除",
                      );
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="quiet-empty">
            添加岗位信息库或投递记录来源，然后选择导出的表格文件。
          </p>
        )}
      </div>
      <section className="source-import">
        <h3>表格导入 · 先预览再保存</h3>
        <p className="rule-note">
          支持 .xlsx / .csv / .tsv，多工作表可选择；最多 10 MB、每次 2000
          条数据、100 列。不会自动访问文档或上传给第三方。
        </p>
        <div className="import-controls">
          <Field label="选择来源">
            <select
              aria-label="表格来源"
              value={sourceId}
              disabled={busy}
              onChange={(e) => chooseSource(e.target.value)}
            >
              <option value="">请选择</option>
              {state.sources.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name} · {s.kind}
                </option>
              ))}
            </select>
          </Field>
          <Field label="选择导出文件">
            <input
              aria-label="选择岗位表格"
              type="file"
              accept=".xlsx,.csv,.tsv"
              disabled={!source || busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                setError("");
                setPreview(null);
                setSheets([]);
                try {
                  const form = new FormData();
                  form.set("file", file);
                  const response = await fetch("/api/sheet-read", {
                    method: "POST",
                    body: form,
                  });
                  const value = await response.json();
                  if (!response.ok) throw Error(value.error ?? "文件读取失败");
                  setSheets(value.sheets);
                  chooseSheet(value.sheets, 0);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "文件读取失败");
                } finally {
                  setBusy(false);
                  e.target.value = "";
                }
              }}
            />
          </Field>
        </div>
        {sheet && (
          <>
            <div className="import-controls">
              <Field label="工作表">
                <select
                  aria-label="选择工作表"
                  value={sheetIndex}
                  onChange={(e) => chooseSheet(sheets, Number(e.target.value))}
                >
                  {sheets.map((s, i) => (
                    <option value={i} key={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="表头位置">
                <select
                  value={headerIndex}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    setHeaderIndex(h);
                    setMapping(guessMapping(sheet.rows[h]));
                    setPreview(null);
                  }}
                >
                  {sheet.rows.slice(0, 20).map((row, i) => (
                    <option value={i} key={i}>
                      第 {i + 1} 行 · {row.slice(0, 3).join(" / ").slice(0, 70)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="缺少阶段时默认值">
                <select
                  value={defaultStage}
                  onChange={(e) => {
                    setDefaultStage(e.target.value as (typeof stages)[number]);
                    setPreview(null);
                  }}
                >
                  {stages.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <details className="mapping-details" open>
              <summary>字段映射 · 共 {rows.length} 行数据</summary>
              <div className="mapping-grid">
                {importFields.map((field) => (
                  <Field
                    label={`${fieldLabels[field]}${field === "company" || field === "title" ? " *" : ""}`}
                    key={field}
                  >
                    <select
                      aria-label={`映射${fieldLabels[field]}`}
                      value={mapping[field]}
                      onChange={(e) => {
                        setMapping({
                          ...mapping,
                          [field]: Number(e.target.value),
                        });
                        setPreview(null);
                      }}
                    >
                      <option value={-1}>不映射</option>
                      {headers.map((h, i) => (
                        <option value={i} key={i}>
                          {h || `第 ${i + 1} 列`}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            </details>
            <label className="checkbox-label update-import">
              <input
                type="checkbox"
                checked={allowUpdates}
                onChange={(e) => {
                  setAllowUpdates(e.target.checked);
                  setPreview(null);
                }}
              />
              允许更新同来源的重复岗位，或将信息库岗位转为已有投递记录（保留未映射或空字段）
            </label>
            <p className="rule-note">
              默认跳过重复；按公司、岗位、地区检查。不会用信息库覆盖投递进度或手动记录。原表其他字段保留在备注中。未识别的阶段或无效日期列为错误，不会悄悄改写。
            </p>
            <button
              className="button primary"
              disabled={busy || !source || !rows.length}
              onClick={() =>
                void action(
                  async () =>
                    setPreview(
                      await call("job-sheet-preview", "POST", request()),
                    ),
                  "预览已生成，尚未写入岗位",
                )
              }
            >
              <Upload size={16} />
              预览导入
            </button>
          </>
        )}
        {preview && (
          <div className="sheet-preview">
            <div className="preview-counts">
              {Object.entries(preview.counts).map(([key, count]) => (
                <Badge
                  tone={
                    key === "错误"
                      ? "orange"
                      : key === "新增"
                        ? "green"
                        : "blue"
                  }
                  key={key}
                >
                  {key} {count} 条
                </Badge>
              ))}
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>数据行</th>
                    <th>动作</th>
                    <th>公司 / 岗位</th>
                    <th>阶段</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 100).map((row) => (
                    <tr key={row.row}>
                      <td>{row.row}</td>
                      <td>{row.action}</td>
                      <td>
                        {row.job?.company} / {row.job?.title}
                      </td>
                      <td>{row.job?.stage ?? "—"}</td>
                      <td>
                        {row.error ||
                          (row.action === "重复" && "已存在，不写入") ||
                          (row.action === "更新" &&
                            "将更新有效的非空映射字段") ||
                          "将保存到本地"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > 100 && (
              <p className="rule-note">
                预览显示前 100 行，汇总与导入覆盖全部 {preview.rows.length} 行。
              </p>
            )}
            <div className="backup-actions">
              <button
                className="button primary"
                disabled={
                  busy || preview.counts["新增"] + preview.counts["更新"] === 0
                }
                onClick={() => {
                  if (
                    confirm(
                      `确认保存 ${preview.counts["新增"]} 条新增、${preview.counts["更新"]} 条更新？${preview.counts["错误"]} 条错误及重复行会跳过。`,
                    )
                  )
                    void action(
                      () => call("job-sheet-import", "POST", request()),
                      "表格已导入本地数据库",
                    ).then((ok) => {
                      if (ok) {
                        setPreview(null);
                        setSheets([]);
                      }
                    });
                }}
              >
                确认导入有效记录
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                取消预览
              </button>
            </div>
          </div>
        )}
      </section>
      <section className="recommendation-settings">
        <h3>
          <Settings2 size={16} />
          每日推荐偏好
        </h3>
        <p className="rule-note">
          每天按截止日和这些偏好重新排序已导入的信息库岗位，排除已投递、已结束、过期与资格不符合的岗位。不联网，不冒充实时推荐。
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(
              () =>
                call("settings", "POST", {
                  ...state.settings,
                  recommendationKeywords: split(keywords),
                  recommendationLocations: split(locations),
                  dailyRecommendationLimit: limit,
                } satisfies Settings),
              "推荐偏好已保存",
            );
          }}
        >
          <div className="import-controls">
            <Field label="关键词（逗号或顿号分隔）">
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="内容、品牌、营销、AI、出海"
              />
            </Field>
            <Field label="地区偏好（可留空）">
              <input
                value={locations}
                onChange={(e) => setLocations(e.target.value)}
                placeholder="上海、北京、深圳"
              />
            </Field>
            <Field label="每日推荐数量">
              <input
                type="number"
                min={1}
                max={20}
                required
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
            </Field>
          </div>
          <button className="button" disabled={busy}>
            保存推荐偏好
          </button>
        </form>
      </section>
      {draft && (
        <Modal
          title={id ? "编辑来源" : "新增表格来源"}
          error={error}
          onClose={() => setDraft(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(
                () =>
                  call(
                    id ? `sources/${id}` : "sources",
                    id ? "PUT" : "POST",
                    draft,
                  ),
                "来源已保存",
              ).then((ok) => {
                if (ok) setDraft(null);
              });
            }}
          >
            <div className="form-grid">
              <Field label="来源名称 *" full>
                <input
                  required
                  maxLength={100}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="来源类型" full>
                <select
                  value={draft.kind}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      kind: e.target.value as Source["kind"],
                    })
                  }
                >
                  <option>岗位信息库</option>
                  <option>投递记录</option>
                </select>
              </Field>
              <Field label="在线文档链接 *" full>
                <input
                  type="url"
                  required
                  value={draft.url}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                  placeholder="https://"
                />
              </Field>
            </div>
            <div className="form-footer">
              <button
                type="button"
                className="button"
                onClick={() => setDraft(null)}
              >
                取消
              </button>
              <button className="button primary" disabled={busy}>
                保存来源
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
