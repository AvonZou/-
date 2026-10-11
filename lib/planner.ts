import type { Task, JobEvent, Settings } from "./model";
export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function plan(
  tasks: Task[],
  events: JobEvent[],
  settings: Settings,
  now = new Date(),
) {
  const today = todayKey(now);
  const urgentJobs = new Set(
    events
      .filter(
        (e) =>
          e.kind === "面试" &&
          new Date(e.at).getTime() >= now.getTime() &&
          new Date(e.at).getTime() - now.getTime() <= 48 * 3600000,
      )
      .map((e) => e.jobId),
  );
  const candidates = tasks.filter((t) => !t.archived && t.status !== "已完成");
  const urgent = (t: Task) =>
    settings.interviewMode &&
    t.module === "面试" &&
    ((t.jobId && urgentJobs.has(t.jobId)) ||
      (t.dueDate &&
        t.dueDate <= todayKey(new Date(now.getTime() + 48 * 3600000))));
  candidates.sort(
    (a, b) =>
      Number(!!urgent(b)) - Number(!!urgent(a)) ||
      a.priority.localeCompare(b.priority) ||
      (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
      a.createdAt.localeCompare(b.createdAt),
  );
  const manual = settings.scheduleDate === today ? settings.scheduleOrder : [];
  if (manual.length)
    candidates.sort(
      (a, b) =>
        (manual.includes(a.id) ? manual.indexOf(a.id) : Infinity) -
        (manual.includes(b.id) ? manual.indexOf(b.id) : Infinity),
    );
  // Reserve one whole thesis task, only when it fits the available budget. No fictional progress.
  const thesis = settings.interviewMode
    ? candidates.find(
        (t) =>
          t.module === "论文" &&
          t.estimatedMinutes <= settings.availableMinutes,
      )
    : undefined;
  let remaining = settings.availableMinutes - (thesis?.estimatedMinutes ?? 0);
  const selected: Task[] = [];
  for (const task of candidates) {
    if (task.id === thesis?.id) continue;
    if (task.estimatedMinutes <= remaining) {
      selected.push(task);
      remaining -= task.estimatedMinutes;
    }
  }
  if (thesis) selected.push(thesis);
  selected.sort((a, b) => candidates.indexOf(a) - candidates.indexOf(b));
  return {
    selected,
    remaining,
    total: settings.availableMinutes - remaining,
    thesisReserved: !!thesis,
    reason: manual.length
      ? "已采用今天的手动顺序；按预计时长选入可完成的任务。"
      : "按面试优先、P0 → P2、截止日排序；超出时间预算的任务留在待办。",
    warning:
      settings.interviewMode && !thesis
        ? "没有可放入预算的论文任务，无法保留论文最低进度。"
        : "",
  };
}
export function weekly(tasks: Task[], now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const completed = tasks.filter(
    (t) =>
      t.completedAt &&
      new Date(t.completedAt) >= start &&
      new Date(t.completedAt) < end,
  );
  return {
    count: completed.length,
    minutes: completed.reduce((n, t) => n + t.actualMinutes, 0),
    byModule: Object.fromEntries(
      ["求职", "面试", "论文", "雅思"].map((m) => [
        m,
        completed
          .filter((t) => t.module === m)
          .reduce((n, t) => n + t.actualMinutes, 0),
      ]),
    ),
  };
}
