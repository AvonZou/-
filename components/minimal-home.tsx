"use client";
import { useState } from "react";
import {
  BriefcaseBusiness,
  Mic,
  BookOpen,
  Languages,
  ArrowRight,
} from "lucide-react";
import { importantTasks, homeReminders, type Reminder } from "@/lib/home";
import { todayKey } from "@/lib/planner";
import type { State, Task } from "@/lib/model";
export default function MinimalHome({
  state,
  now,
  busy,
  onAction,
  onTask,
  onComplete,
  onReminder,
}: {
  state: State;
  now: Date;
  busy: boolean;
  onAction: (module: "求职" | "面试" | "论文" | "雅思") => void;
  onTask: (task: Task) => void;
  onComplete: (task: Task) => void;
  onReminder: (reminder: Reminder) => void;
}) {
  const [all, setAll] = useState(false);
  const tasks = importantTasks(state, now),
    reminders = homeReminders(state, now);
  return (
    <div className="minimal-home">
      <div className="core-actions" aria-label="四个核心行动">
        {(
          [
            ["求职", "找岗位", "查看机会与投递进度", BriefcaseBusiness],
            ["面试", "练面试", "开始准备面试任务", Mic],
            ["论文", "写论文", "继续下一步研究任务", BookOpen],
            ["雅思", "学雅思", "安排今天的学习任务", Languages],
          ] as const
        ).map(([module, title, hint, Icon]) => (
          <button
            className="core-action"
            key={module}
            onClick={() => onAction(module)}
          >
            <Icon size={22} />
            <strong>{title}</strong>
            <small>{hint}</small>
            <ArrowRight size={16} className="action-arrow" />
          </button>
        ))}
      </div>
      <section className="panel focus-panel">
        <div className="panel-heading">
          <h2>今天最重要的三件事</h2>
          <span className="muted">先做重要的，最多三项</span>
        </div>
        {tasks.length ? (
          <div className="focus-list">
            {tasks.map((t) => (
              <div className="focus-row" key={t.id}>
                <button
                  className="check-box"
                  disabled={busy}
                  aria-label={`完成 ${t.title}`}
                  onClick={() => onComplete(t)}
                />
                <button
                  className="text-button focus-title"
                  onClick={() => onTask(t)}
                >
                  <strong>{t.title}</strong>
                  <small>
                    {t.module} · {t.priority}
                    {t.dueDate
                      ? ` · ${t.dueDate < todayKey(now) ? "已逾期 " : "截止 "}${t.dueDate}`
                      : ""}
                  </small>
                </button>
                <span className="muted">{t.estimatedMinutes} 分钟</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="quiet-empty">
            今天没有待办。使用右上角「快捷新增」安排下一步。
          </p>
        )}
      </section>
      <section className="panel reminder-panel">
        <div className="panel-heading">
          <h2>截止与跟进提醒</h2>
          <span className="muted">逾期及未来 7 天</span>
        </div>
        {reminders.length ? (
          <div className="reminder-list">
            {(all ? reminders : reminders.slice(0, 6)).map((r) => (
              <button
                className="reminder-row text-button"
                key={r.id}
                onClick={() => onReminder(r)}
              >
                <span className="reminder-label">{r.label}</span>
                <strong>{r.title}</strong>
                <small
                  className={
                    r.date.slice(0, 10) < todayKey(now)
                      ? "danger-text"
                      : "muted"
                  }
                >
                  {r.date.replace("T", " ")}
                </small>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        ) : (
          <p className="quiet-empty">暂无临近截止或待跟进事项。</p>
        )}
        {reminders.length > 6 && (
          <button className="text-button accent" onClick={() => setAll(!all)}>
            {all ? "收起提醒" : `查看全部 ${reminders.length} 条提醒`}
          </button>
        )}
      </section>
    </div>
  );
}
