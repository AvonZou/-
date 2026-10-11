"use client";
import {
  ArrowRight,
  BriefcaseBusiness,
  Plus,
  ExternalLink,
} from "lucide-react";
import { type State, type Job } from "@/lib/model";
import { dailyRecommendations } from "@/lib/recommendations";
import { Badge } from "./ui";
export default function DailyJobs({
  state,
  onOpen,
  onSources,
  onQueue,
  busy,
}: {
  state: State;
  onOpen: (id: string) => void;
  onSources: () => void;
  onQueue: (job: Job) => void;
  busy: boolean;
}) {
  const recommendations = dailyRecommendations(state.jobs, state.settings);
  const sources = state.sources.filter((s) => s.kind === "岗位信息库");
  return (
    <section className="panel daily-jobs">
      <div className="panel-heading">
        <div>
          <h2>
            <BriefcaseBusiness size={18} />
            每日岗位推荐 <Badge tone="blue">规则推荐</Badge>
          </h2>
          <p>
            按关键词、地区和临近截止日排序已导入的信息库；不代表资格或岗位仍在招已核实。
          </p>
        </div>
        <button className="text-button accent" onClick={onSources}>
          来源与导入 <ArrowRight size={15} />
        </button>
      </div>
      {recommendations.length ? (
        <div className="recommendation-grid">
          {recommendations.map(({ job, reasons }) => {
            const source = state.sources.find((s) => s.id === job.sourceId);
            return (
              <article className="recommendation-card" key={job.id}>
                <div>
                  <strong>{job.company}</strong>
                  <Badge tone="blue">{job.direction || "方向未提供"}</Badge>
                </div>
                <button className="text-button" onClick={() => onOpen(job.id)}>
                  <h3>{job.title}</h3>
                </button>
                <p>
                  {job.location || "地区未提供"} ·{" "}
                  {job.deadline ? `截止 ${job.deadline}` : "截止日期待核实"}
                </p>
                <ul>
                  {reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <div className="recommendation-source">
                  {source?.name ?? "来源已移除"} ·{" "}
                  {source?.lastImportedAt
                    ? `快照 ${new Date(source.lastImportedAt).toLocaleDateString("zh-CN")}`
                    : "导入时间未知"}
                </div>
                <div className="recommendation-actions">
                  <button className="button" onClick={() => onOpen(job.id)}>
                    查看详情
                  </button>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => onQueue(job)}
                  >
                    <Plus size={14} />
                    加入待投递
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="daily-empty">
          <span className="empty-icon">
            <BriefcaseBusiness size={23} />
          </span>
          <div>
            <h3>
              {sources.some((s) => s.lastImportedAt)
                ? "今天没有符合规则的待评估岗位"
                : "导入岗位信息，开启每日推荐"}
            </h3>
            <p>
              {sources.some((s) => s.lastImportedAt)
                ? "岗位可能已加入投递、已过期或资格不符。可更新来源快照并调整推荐偏好。"
                : "目前只支持文档导出文件导入；没有读取到数据时，不会生成虚假推荐。"}
            </p>
          </div>
          <button className="button" onClick={onSources}>
            管理岗位来源
          </button>
        </div>
      )}
    </section>
  );
}
