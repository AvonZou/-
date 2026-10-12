import { todayKey } from "./planner";
import type { State, Task, Job } from "./model";

const closed = (j: Job) =>
  ["Offer", "未通过", "主动放弃", "未通过/结束"].includes(j.stage);
export function importantTasks(state: State, now = new Date()): Task[] {
  const today = todayKey(now);
  const soon = todayKey(new Date(now.getTime() + 48 * 3600000));
  const interviews = new Set(
    state.events
      .filter(
        (e) =>
          e.kind === "面试" &&
          new Date(e.at) >= now &&
          new Date(e.at).getTime() <= now.getTime() + 48 * 3600000,
      )
      .map((e) => e.jobId),
  );
  const urgent = (t: Task) =>
    state.settings.interviewMode &&
    t.module === "面试" &&
    ((t.jobId && interviews.has(t.jobId)) || (t.dueDate && t.dueDate <= soon));
  const order =
    state.settings.scheduleDate === today ? state.settings.scheduleOrder : [];
  return state.tasks
    .filter(
      (t) =>
        !t.archived &&
        t.status !== "已完成" &&
        (!t.dueDate || t.dueDate <= today || urgent(t)),
    )
    .sort(
      (a, b) =>
        (order.includes(a.id) ? order.indexOf(a.id) : Infinity) -
          (order.includes(b.id) ? order.indexOf(b.id) : Infinity) ||
        Number(!!urgent(b)) - Number(!!urgent(a)) ||
        a.priority.localeCompare(b.priority) ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
        a.createdAt.localeCompare(b.createdAt),
    )
    .slice(0, 3);
}
export type Reminder = {
  id: string;
  title: string;
  date: string;
  label: string;
  jobId?: string;
  taskId?: string;
};
export function homeReminders(state: State, now = new Date()): Reminder[] {
  const end = todayKey(new Date(now.getTime() + 7 * 86400000));
  const reminders: Reminder[] = [];
  for (const t of state.tasks)
    if (!t.archived && t.status !== "已完成" && t.dueDate && t.dueDate <= end)
      reminders.push({
        id: `task-${t.id}`,
        title: t.title,
        date: t.dueDate,
        label: "任务截止",
        taskId: t.id,
      });
  for (const j of state.jobs)
    if (!j.archived && !closed(j)) {
      if (j.deadline && j.deadline <= end)
        reminders.push({
          id: `deadline-${j.id}`,
          title: `${j.company} · ${j.title}`,
          date: j.deadline,
          label: "投递截止",
          jobId: j.id,
        });
      if (j.nextFollowUp && j.nextFollowUp <= end)
        reminders.push({
          id: `follow-${j.id}`,
          title: `${j.company} · ${j.title}`,
          date: j.nextFollowUp,
          label: "待跟进",
          jobId: j.id,
        });
    }
  for (const e of state.events)
    if (
      e.kind === "面试" &&
      new Date(e.at) >= now &&
      e.at.slice(0, 10) <= end &&
      state.jobs.some((j) => j.id === e.jobId && !j.archived && !closed(j))
    )
      reminders.push({
        id: `event-${e.id}`,
        title: `${state.jobs.find((j) => j.id === e.jobId)!.company} · ${e.title}`,
        date: e.at,
        label: "面试安排",
        jobId: e.jobId,
      });
  return reminders.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
}
