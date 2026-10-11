import type { Job, Settings } from "./model";
import { sameJob } from "./job-import";
import { todayKey } from "./planner";
export function dailyRecommendations(
  jobs: Job[],
  settings: Settings,
  now = new Date(),
) {
  const today = todayKey(now),
    history = jobs.filter(
      (j) =>
        j.origin === "投递记录" || !["收藏/待评估", "待投递"].includes(j.stage),
    );
  const keywords = settings.recommendationKeywords ?? [
      "内容",
      "品牌",
      "营销",
      "AI",
      "出海",
    ],
    locations = settings.recommendationLocations ?? [];
  return jobs
    .filter(
      (j) =>
        j.origin === "岗位信息库" &&
        !j.archived &&
        j.stage === "收藏/待评估" &&
        j.eligibility !== "不符合" &&
        (!j.deadline || j.deadline >= today) &&
        !history.some((h) => sameJob(j, h)),
    )
    .map((job) => {
      const content = `${job.title} ${job.direction} ${job.jd}`.toLowerCase();
      const matched = keywords.filter(
        (k) => k.trim() && content.includes(k.toLowerCase()),
      );
      const region = locations.filter(
        (k) => k.trim() && job.location.toLowerCase().includes(k.toLowerCase()),
      );
      const days = job.deadline
        ? Math.round(
            (new Date(job.deadline + "T12:00:00").getTime() -
              new Date(today + "T12:00:00").getTime()) /
              86400000,
          )
        : null;
      const reasons = [
        ...(matched.length
          ? [`命中关键词：${matched.join("、")}`]
          : ["来自已导入岗位库"]),
        ...(region.length ? [`地区偏好：${region.join("、")}`] : []),
        ...(days !== null && days <= 7
          ? [`${days === 0 ? "今天" : `${days} 天后`}截止`]
          : []),
        ...(job.eligibility === "符合"
          ? ["来源标记符合校招资格，请核实"]
          : ["校招资格待确认"]),
        ...(!job.deadline ? ["未提供截止日期，请核实"] : []),
      ];
      return {
        job,
        reasons,
        score:
          matched.length * 10 +
          region.length * 8 +
          (days !== null && days <= 7 ? 8 - days : 0) +
          (job.eligibility === "符合" ? 3 : 0),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.job.deadline || "9999").localeCompare(b.job.deadline || "9999") ||
        a.job.id.localeCompare(b.job.id),
    )
    .filter((r, i, all) => all.findIndex((a) => sameJob(a.job, r.job)) === i)
    .slice(0, settings.dailyRecommendationLimit ?? 5);
}
