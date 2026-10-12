"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  ListTodo,
  Mic,
  BookOpen,
  Languages,
  ChartNoAxesCombined,
  Settings2,
  Plus,
  Search,
  ArrowUpRight,
  Check,
  Clock,
  CalendarDays,
  MoreHorizontal,
  Trash2,
  Download,
  Upload,
  Sun,
  Moon,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Target,
  PanelLeftClose,
  RefreshCw,
  CheckCircle2,
  Archive,
  ExternalLink,
} from "lucide-react";
import {
  emptyTask,
  emptyJob,
  modules,
  stages,
  applicationStages,
  defaultSettings,
  type Task,
  type Job,
  type JobEvent,
  type State,
  type Settings,
} from "@/lib/model";
import { plan, todayKey, weekly } from "@/lib/planner";
import { Badge, Empty, Modal, Field } from "./ui";
import JobSources from "./job-sources";
import DailyJobs from "./daily-jobs";
import MinimalHome from "./minimal-home";
import QuickApplication from "./quick-application";

type Page =
  | "首页"
  | "任务管理"
  | "求职雷达"
  | "面试训练室"
  | "论文研究中心"
  | "IELTS 学习站"
  | "成长复盘"
  | "设置与备份";
type DraftTask = typeof emptyTask;
type DraftJob = typeof emptyJob;
const taskBody = (t: Task): DraftTask =>
  Object.fromEntries(
    Object.keys(emptyTask).map((k) => [k, t[k as keyof Task]]),
  ) as DraftTask;
const jobBody = (j: Job): DraftJob =>
  Object.fromEntries(
    Object.keys(emptyJob).map((k) => [k, j[k as keyof Job]]),
  ) as DraftJob;
const moduleClass: Record<string, string> = {
  求职: "blue",
  面试: "purple",
  论文: "orange",
  雅思: "green",
};
const nav = [
  { page: "首页", icon: LayoutDashboard },
  { page: "任务管理", icon: ListTodo },
  { page: "求职雷达", icon: BriefcaseBusiness },
  { page: "面试训练室", icon: Mic },
  { page: "论文研究中心", icon: BookOpen },
  { page: "IELTS 学习站", icon: Languages },
  { page: "成长复盘", icon: ChartNoAxesCombined },
  { page: "设置与备份", icon: Settings2 },
] as const;
async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "请求失败");
  return data;
}
export default function Workbench() {
  const [page, setPage] = useState<Page>("首页"),
    [state, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [dark, setDark] = useState(false),
    [mobile, setMobile] = useState(false);
  const [taskDraft, setTaskDraft] = useState<DraftTask | null>(null),
    [taskId, setTaskId] = useState<string>(),
    [jobDraft, setJobDraft] = useState<DraftJob | null>(null),
    [jobId, setJobId] = useState<string>(),
    [detailId, setDetailId] = useState<string>(),
    [eventDraft, setEventDraft] = useState<{
      jobId: string;
      kind: "日志" | "面试";
      title: string;
      at: string;
      notes: string;
    } | null>(null),
    [eventId, setEventId] = useState<string>();
  const [search, setSearch] = useState(""),
    [moduleFilter, setModuleFilter] = useState("全部"),
    [dateFilter, setDateFilter] = useState("全部"),
    [statusFilter, setStatusFilter] = useState("全部"),
    [archiveFilter, setArchiveFilter] = useState(false),
    [direction, setDirection] = useState("全部"),
    [company, setCompany] = useState("全部"),
    [jobOrigin, setJobOrigin] = useState("全部"),
    [view, setView] = useState<
      "table" | "board" | "sources" | "recommendations"
    >("table"),
    [quickAdd, setQuickAdd] = useState(false),
    [quickJob, setQuickJob] = useState<Job | null | undefined>(undefined),
    [quickStage, setQuickStage] = useState<Job["stage"]>("已投递"),
    [backup, setBackup] = useState<unknown>(),
    [preview, setPreview] = useState<Record<
      string,
      { new: number; duplicates: number }
    > | null>(null),
    [tick, setTick] = useState(0);
  const refresh = async () => {
    setState(await api("state"));
  };
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    setDark(localStorage.getItem("nextstep-theme") === "dark");
    const timer = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("nextstep-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function act(fn: () => Promise<unknown>, message = "已保存") {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      setToast(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function navigate(next: Page) {
    setPage(next);
    setSearch("");
    setDateFilter("全部");
    setStatusFilter("全部");
    setModuleFilter("全部");
    setArchiveFilter(false);
    setJobOrigin("全部");
    setCompany("全部");
    setDirection("全部");
    setView("table");
    setMobile(false);
  }
  function newTask(module: (typeof modules)[number] = "求职") {
    setError("");
    setTaskId(undefined);
    setTaskDraft({ ...emptyTask, module, dueDate: todayKey() });
  }
  function editTask(task: Task) {
    setDetailId(undefined);
    setError("");
    setTaskId(task.id);
    setTaskDraft(taskBody(task));
  }
  function newJob() {
    setError("");
    setJobId(undefined);
    setQuickStage("已投递");
    setQuickJob(null);
  }
  function editJob(job: Job) {
    setError("");
    setDetailId(undefined);
    setJobId(job.id);
    setJobDraft(jobBody(job));
  }
  async function updateTask(task: Task, patch: Partial<DraftTask>) {
    await act(() =>
      api(`tasks/${task.id}`, "PUT", { ...taskBody(task), ...patch }),
    );
  }
  async function updateJob(job: Job, patch: Partial<DraftJob>) {
    await act(() =>
      Object.keys(patch).length === 1 && patch.stage
        ? api(`jobs/${job.id}`, "PATCH", patch)
        : api(`jobs/${job.id}`, "PUT", { ...jobBody(job), ...patch }),
    );
  }
  function editApplication(job: Job) {
    setError("");
    setQuickJob(job);
  }
  const stageOptions = (job: Job) =>
    applicationStages.includes(job.stage as (typeof applicationStages)[number])
      ? applicationStages
      : [job.stage, ...applicationStages];
  const now = new Date();
  void tick;
  const today = todayKey(now),
    jobs = state?.jobs ?? [],
    tasks = state?.tasks ?? [],
    events = state?.events ?? [],
    settings = state?.settings ?? defaultSettings;
  const activeTasks = tasks.filter((t) => !t.archived && t.status !== "已完成"),
    activeJobs = jobs.filter((j) => !j.archived),
    stats = weekly(tasks, now),
    schedule = plan(tasks, events, settings, now);
  const boardStages = stages.filter(
    (s) =>
      !["面试", "未通过/结束"].includes(s) || jobs.some((j) => j.stage === s),
  );
  const filteredTasks = tasks
    .filter(
      (t) =>
        t.archived === archiveFilter &&
        (!search ||
          `${t.title} ${t.notes}`
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (moduleFilter === "全部" || t.module === moduleFilter) &&
        (statusFilter === "全部" || t.status === statusFilter) &&
        (dateFilter === "全部" ||
          (dateFilter === "今天" && t.dueDate === today) ||
          (dateFilter === "逾期" &&
            !!t.dueDate &&
            t.dueDate < today &&
            t.status !== "已完成") ||
          (dateFilter === "未来7天" &&
            t.dueDate >= today &&
            t.dueDate <= todayKey(new Date(now.getTime() + 7 * 86400000)))),
    )
    .sort(
      (a, b) =>
        (a.status === "已完成" ? 1 : 0) - (b.status === "已完成" ? 1 : 0) ||
        a.priority.localeCompare(b.priority) ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
    );
  const filteredJobs = jobs.filter(
    (j) =>
      j.archived === archiveFilter &&
      (jobOrigin === "全部" || j.origin === jobOrigin) &&
      (!search ||
        `${j.company} ${j.title} ${j.jd} ${j.notes}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (direction === "全部" || j.direction === direction) &&
      (company === "全部" || j.company === company) &&
      (statusFilter === "全部" || j.stage === statusFilter) &&
      (dateFilter === "全部" ||
        (dateFilter === "今天" && j.appliedDate === today) ||
        (dateFilter === "逾期" &&
          !!j.nextFollowUp &&
          j.nextFollowUp <= today) ||
        (dateFilter === "未来7天" &&
          j.deadline >= today &&
          j.deadline <= todayKey(new Date(now.getTime() + 7 * 86400000)))),
  );
  const detail = jobs.find((j) => j.id === detailId);
  async function saveSettings(patch: Partial<Settings>) {
    await act(
      () => api("settings", "POST", { ...settings, ...patch }),
      "排程偏好已保存",
    );
  }
  function moveSchedule(id: string, target: string) {
    const ids = schedule.selected.map((t) => t.id);
    const from = ids.indexOf(id),
      to = ids.indexOf(target);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    void saveSettings({ scheduleDate: today, scheduleOrder: ids });
  }
  const taskRow = (task: Task, compact = false) => (
    <div
      className={`task-row ${task.status === "已完成" ? "done" : ""}`}
      key={task.id}
    >
      <button
        className={`check-box ${task.status === "已完成" ? "checked" : ""}`}
        disabled={busy}
        aria-label={`${task.status === "已完成" ? "重新打开" : "完成"} ${task.title}`}
        onClick={() =>
          updateTask(task, {
            status: task.status === "已完成" ? "待办" : "已完成",
          })
        }
      >
        {task.status === "已完成" && <Check size={14} />}
      </button>
      <div className="task-text">
        <button
          className="text-button task-title"
          onClick={() => editTask(task)}
        >
          {task.title}
        </button>
        <div className="task-meta">
          <Badge tone={moduleClass[task.module]}>{task.module}</Badge>
          <span>{task.dueDate || "无截止日"}</span>
          {task.dueDate && task.dueDate < today && task.status !== "已完成" && (
            <span className="danger-text">已逾期</span>
          )}
          {task.jobId && (
            <span className="linked">
              ↗ {jobs.find((j) => j.id === task.jobId)?.company}
            </span>
          )}
        </div>
      </div>
      <span className={`priority ${task.priority.toLowerCase()}`}>
        {task.priority}
      </span>
      <span className="duration">
        <Clock size={13} />
        {task.estimatedMinutes} 分钟
      </span>
      {!compact && (
        <>
          <select
            aria-label={`${task.title}的状态`}
            className="inline-select"
            value={task.status}
            disabled={busy}
            onChange={(e) =>
              updateTask(task, { status: e.target.value as Task["status"] })
            }
          >
            {["待办", "进行中", "已完成"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            className="icon-button"
            title="延期一天"
            aria-label={`延期 ${task.title}`}
            disabled={busy}
            onClick={() => {
              const d = new Date((task.dueDate || today) + "T12:00:00");
              d.setDate(d.getDate() + 1);
              void updateTask(task, { dueDate: todayKey(d) });
            }}
          >
            <CalendarDays size={16} />
          </button>
          <button
            className="icon-button"
            title={task.archived ? "取消归档" : "归档"}
            aria-label={`归档 ${task.title}`}
            disabled={busy}
            onClick={() => updateTask(task, { archived: !task.archived })}
          >
            <Archive size={16} />
          </button>
          <button
            className="icon-button danger"
            aria-label={`删除 ${task.title}`}
            disabled={busy}
            onClick={() => {
              if (confirm("永久删除此任务？此操作不可撤销。"))
                void act(() => api(`tasks/${task.id}`, "DELETE"), "任务已删除");
            }}
          >
            <Trash2 size={16} />
          </button>
        </>
      )}
    </div>
  );
  return (
    <div className="shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("首页");
          }}
        >
          <span className="brand-logo">
            <ArrowUpRight size={25} />
          </span>
          <span>
            NextStep <b>OS</b>
            <small>把下一步，变成每一天</small>
          </span>
        </a>
        <div className="nav-caption">个人工作空间</div>
        <nav>
          {nav.map(({ page: p, icon: Icon }, i) => (
            <button
              key={p}
              className={`nav-item ${page === p ? "active" : ""} ${i === 7 ? "settings-nav" : ""}`}
              onClick={() => navigate(p)}
            >
              <Icon size={19} />
              <span>{p}</span>
              {["面试训练室", "论文研究中心", "IELTS 学习站"].includes(p) && (
                <small>待上线</small>
              )}
              {p === "任务管理" && activeTasks.length > 0 && (
                <small className="count">{activeTasks.length}</small>
              )}
            </button>
          ))}
        </nav>
        <p className="privacy-caption">数据保存在当前设备</p>
        <div className="profile">
          <div className="avatar">N</div>
          <div>
            <strong>我的成长空间</strong>
            <small>无需账号 · 离线可用</small>
          </div>
          <button
            className="icon-button"
            aria-label="切换深浅色主题"
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-toggle icon-button"
              aria-label="切换导航"
              onClick={() => setMobile(!mobile)}
            >
              <PanelLeftClose size={20} />
            </button>
            <span>工作空间</span>
            <span>/</span>
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <button
              className="button primary"
              onClick={() => {
                setError("");
                setQuickAdd(true);
              }}
            >
              <Plus size={16} />
              快捷新增
            </button>
            <span className="local-status">
              <span className="live-dot" />
              本地 SQLite
            </span>
            <button
              className="icon-button"
              aria-label="刷新数据"
              disabled={busy}
              onClick={() => act(refresh, "已刷新")}
            >
              <RefreshCw size={16} />
            </button>
            <span className="avatar small">N</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>{page === "首页" ? "今天，做重要的事" : page}</h1>
              <p>
                {page === "首页"
                  ? now.toLocaleDateString("zh-CN", {
                      month: "long",
                      day: "numeric",
                      weekday: "long",
                    })
                  : page === "任务管理"
                    ? "把目标拆成行动，在这里安排、完成与回顾。"
                    : page === "求职雷达"
                      ? "记下投递，直接更新进度。"
                      : page === "设置与备份"
                        ? "你的数据由你掌握，备份一份安心。"
                        : "为下一个阶段，留好空间。"}
              </p>
            </div>
            {page === "任务管理" ? (
              <button className="button primary" onClick={() => newTask()}>
                <Plus size={17} />
                新增任务
              </button>
            ) : page === "求职雷达" ? (
              <button className="button primary" onClick={newJob}>
                <Plus size={17} />
                新增投递
              </button>
            ) : null}
          </div>
          {error && (
            <div role="alert" className="alert">
              <span>{error}</span>
              <button className="text-button" onClick={() => setError("")}>
                关闭
              </button>
            </div>
          )}
          {!state ? (
            <Empty
              title={error ? "暂时无法读取数据" : "正在打开工作台…"}
              description="正在连接本地数据库。"
              action={
                <button className="button" onClick={() => act(refresh)}>
                  重试
                </button>
              }
            />
          ) : (
            <>
              {page === "首页" && (
                <MinimalHome
                  state={state}
                  now={now}
                  busy={busy}
                  onAction={(module) => {
                    if (module === "求职") {
                      navigate("求职雷达");
                      setView("recommendations");
                    } else
                      navigate(
                        module === "面试"
                          ? "面试训练室"
                          : module === "论文"
                            ? "论文研究中心"
                            : "IELTS 学习站",
                      );
                  }}
                  onTask={editTask}
                  onComplete={(t) => void updateTask(t, { status: "已完成" })}
                  onReminder={(r) => {
                    if (r.jobId) {
                      navigate("求职雷达");
                      setDetailId(r.jobId);
                    } else {
                      const task = tasks.find((t) => t.id === r.taskId);
                      if (task) editTask(task);
                    }
                  }}
                />
              )}
              {page === "任务管理" && (
                <>
                  <section className="panel">
                    <div className="filter-bar">
                      <label className="search">
                        <Search size={17} />
                        <input
                          placeholder="搜索任务或备注…"
                          aria-label="搜索任务"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label="模块筛选"
                        value={moduleFilter}
                        onChange={(e) => setModuleFilter(e.target.value)}
                      >
                        {["全部", ...modules].map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                      <select
                        aria-label="任务状态筛选"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        {["全部", "待办", "进行中", "已完成"].map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                      <select
                        aria-label="时间筛选"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                      >
                        {["全部", "今天", "逾期", "未来7天"].map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={archiveFilter}
                          onChange={(e) => setArchiveFilter(e.target.checked)}
                        />
                        查看归档
                      </label>
                    </div>
                    <div className="list-caption">
                      {filteredTasks.length} 项任务{" "}
                      <span>完成后在编辑中记录实际用时，用于本周统计。</span>
                    </div>
                    {filteredTasks.length ? (
                      filteredTasks.map((t) => taskRow(t))
                    ) : (
                      <Empty
                        title="这里还没有任务"
                        description="新增任务，或调整搜索和筛选条件。"
                        action={
                          <button className="button" onClick={() => newTask()}>
                            <Plus size={16} />
                            新增任务
                          </button>
                        }
                      />
                    )}
                  </section>
                  <details className="planner-details">
                    <summary>排程偏好与排序</summary>
                    <section className="panel planner">
                      <div className="panel-heading">
                        <div>
                          <h2>
                            <span className="heading-icon">
                              <Target size={19} />
                            </span>
                            今天的行动计划
                          </h2>
                          <p>不用做完所有事，先做好重要的事。</p>
                        </div>
                        <Badge tone="blue">规则排程</Badge>
                      </div>
                      <div className="planner-controls">
                        <div>
                          <span className="control-label">
                            今天有多少时间？
                          </span>
                          <div className="time-options">
                            {[180, 360, 480].map((n) => (
                              <button
                                className={
                                  settings.availableMinutes === n
                                    ? "selected"
                                    : ""
                                }
                                disabled={busy}
                                key={n}
                                onClick={() =>
                                  saveSettings({ availableMinutes: n })
                                }
                              >
                                {n / 60} 小时
                              </button>
                            ))}
                            <label className="custom-time">
                              <input
                                aria-label="自定义可用分钟"
                                type="number"
                                min="15"
                                max="1440"
                                defaultValue={settings.availableMinutes}
                                key={settings.availableMinutes}
                                onBlur={(e) => {
                                  const n = Number(e.target.value);
                                  if (
                                    n !== settings.availableMinutes &&
                                    n >= 15 &&
                                    n <= 1440
                                  )
                                    void saveSettings({
                                      availableMinutes: Math.round(n),
                                    });
                                }}
                              />
                              分钟
                            </label>
                          </div>
                        </div>
                        <label className="switch-label">
                          <input
                            type="checkbox"
                            checked={settings.interviewMode}
                            disabled={busy}
                            onChange={(e) =>
                              saveSettings({
                                interviewMode: e.target.checked,
                              })
                            }
                          />
                          <span className="switch" />
                          面试优先模式
                        </label>
                      </div>
                      <div className="schedule-summary">
                        <span>
                          {schedule.selected.length} 项任务 · 计划{" "}
                          {schedule.total} 分钟
                        </span>
                        <span>剩余 {schedule.remaining} 分钟</span>
                      </div>
                      <div className="progress-track">
                        <span
                          style={{
                            width: `${(schedule.total / settings.availableMinutes) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="rule-note">
                        {schedule.reason}{" "}
                        {settings.interviewMode &&
                          "未来 48 小时内的面试任务优先，预留一项能放入预算的论文任务。"}
                        {schedule.warning && (
                          <span className="danger-text">
                            {" "}
                            {schedule.warning}
                          </span>
                        )}
                      </p>
                      {settings.scheduleDate === today &&
                        settings.scheduleOrder.length > 0 && (
                          <button
                            className="text-button accent"
                            onClick={() =>
                              saveSettings({
                                scheduleOrder: [],
                                scheduleDate: "",
                              })
                            }
                          >
                            恢复规则排序
                          </button>
                        )}
                      {schedule.selected.length ? (
                        <div className="schedule-list">
                          {schedule.selected.map((t, i) => (
                            <div
                              key={t.id}
                              className="schedule-row"
                              draggable={!busy}
                              onDragStart={(e) => {
                                e.dataTransfer.setData(
                                  "application/x-nextstep-task",
                                  t.id,
                                );
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const id = e.dataTransfer.getData(
                                  "application/x-nextstep-task",
                                );
                                if (id) moveSchedule(id, t.id);
                              }}
                            >
                              <GripVertical size={16} className="grip" />
                              <span className="step-number">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              {taskRow(t, true)}
                              <div className="reorder">
                                <button
                                  className="icon-button"
                                  aria-label={`上移 ${t.title}`}
                                  disabled={busy || i === 0}
                                  onClick={() =>
                                    moveSchedule(
                                      t.id,
                                      schedule.selected[i - 1].id,
                                    )
                                  }
                                >
                                  <ArrowUp size={13} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={`下移 ${t.title}`}
                                  disabled={
                                    busy || i === schedule.selected.length - 1
                                  }
                                  onClick={() =>
                                    moveSchedule(
                                      t.id,
                                      schedule.selected[i + 1].id,
                                    )
                                  }
                                >
                                  <ArrowDown size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty
                          title={
                            activeTasks.length
                              ? "当前预算内没有合适的任务"
                              : "你的下一步，从这里开始"
                          }
                          description={
                            activeTasks.length
                              ? "增加可用时间或调整任务预计时长。"
                              : "添加一个任务，工作台会为你安排今天的行动。"
                          }
                          action={
                            <button
                              className="button"
                              onClick={() => newTask()}
                            >
                              <Plus size={16} />
                              添加第一项任务
                            </button>
                          }
                        />
                      )}
                    </section>
                  </details>
                </>
              )}
              {page === "求职雷达" && (
                <section className="panel jobs-panel minimal-jobs">
                  <div className="jobs-toolbar">
                    <div className="view-toggle">
                      {(
                        [
                          ["table", "投递记录"],
                          ["recommendations", "岗位推荐"],
                          ["board", "看板"],
                          ["sources", "来源与导入"],
                        ] as const
                      ).map(([v, label]) => (
                        <button
                          key={v}
                          className={view === v ? "selected" : ""}
                          onClick={() => setView(v)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <a
                      href="/api/jobs.csv?format=compact"
                      className="button"
                      aria-label="导出全部投递 CSV"
                    >
                      <Download size={15} />
                      导出
                    </a>
                  </div>
                  {view === "sources" ? (
                    <JobSources state={state} onRefresh={refresh} />
                  ) : view === "recommendations" ? (
                    <DailyJobs
                      state={state}
                      busy={busy}
                      onSources={() => setView("sources")}
                      onOpen={setDetailId}
                      onQueue={(j) => void updateJob(j, { stage: "待投递" })}
                    />
                  ) : (
                    <>
                      <div className="filter-bar application-filters">
                        <label className="search">
                          <Search size={17} />
                          <input
                            aria-label="搜索岗位"
                            placeholder="搜索公司或岗位…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </label>
                        <select
                          aria-label="流程筛选"
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                        >
                          <option value="全部">全部流程</option>
                          {boardStages.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                        <details className="extra-filters">
                          <summary>更多筛选</summary>
                          <div className="filter-bar">
                            <select
                              aria-label="公司筛选"
                              value={company}
                              onChange={(e) => setCompany(e.target.value)}
                            >
                              <option value="全部">全部公司</option>
                              {[...new Set(jobs.map((j) => j.company))].map(
                                (c) => (
                                  <option key={c}>{c}</option>
                                ),
                              )}
                            </select>
                            <select
                              aria-label="方向筛选"
                              value={direction}
                              onChange={(e) => setDirection(e.target.value)}
                            >
                              <option value="全部">全部方向</option>
                              {[
                                ...new Set(
                                  jobs.map((j) => j.direction).filter(Boolean),
                                ),
                              ].map((d) => (
                                <option key={d}>{d}</option>
                              ))}
                            </select>
                            <select
                              aria-label="岗位时间筛选"
                              value={dateFilter}
                              onChange={(e) => setDateFilter(e.target.value)}
                            >
                              {["全部", "今天", "逾期", "未来7天"].map((v) => (
                                <option key={v} value={v}>
                                  {v === "全部"
                                    ? "全部日期"
                                    : v === "逾期"
                                      ? "需要跟进"
                                      : v === "今天"
                                        ? "今天投递"
                                        : "7天内截止"}
                                </option>
                              ))}
                            </select>
                            <select
                              aria-label="记录类型筛选"
                              value={jobOrigin}
                              onChange={(e) => setJobOrigin(e.target.value)}
                            >
                              {["全部", "岗位信息库", "投递记录", "手动"].map(
                                (o) => (
                                  <option key={o}>{o}</option>
                                ),
                              )}
                            </select>
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={archiveFilter}
                                onChange={(e) =>
                                  setArchiveFilter(e.target.checked)
                                }
                              />
                              查看归档
                            </label>
                          </div>
                        </details>
                      </div>
                      {view === "table" ? (
                        filteredJobs.length ? (
                          <div className="table-scroll">
                            <table className="application-table">
                              <thead>
                                <tr>
                                  <th>公司</th>
                                  <th>岗位</th>
                                  <th>投递日期</th>
                                  <th>当前流程</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredJobs.map((j) => (
                                  <tr key={j.id}>
                                    <td>
                                      <button
                                        className="text-button application-company"
                                        aria-label={`${j.company} ${j.title}`}
                                        onClick={() => setDetailId(j.id)}
                                      >
                                        {j.company}
                                      </button>
                                    </td>
                                    <td>{j.title}</td>
                                    <td>{j.appliedDate || "—"}</td>
                                    <td>
                                      <div className="application-row-actions">
                                        <select
                                          aria-label={`${j.company} · ${j.title}的流程`}
                                          className="inline-select"
                                          disabled={busy}
                                          value={j.stage}
                                          onChange={(e) =>
                                            void updateJob(j, {
                                              stage: e.target
                                                .value as Job["stage"],
                                            })
                                          }
                                        >
                                          {stageOptions(j).map((s) => (
                                            <option key={s}>{s}</option>
                                          ))}
                                        </select>
                                        <button
                                          className="text-button"
                                          disabled={busy}
                                          aria-label={`编辑 ${j.company} ${j.title}`}
                                          onClick={() => editApplication(j)}
                                        >
                                          编辑
                                        </button>
                                        <button
                                          className="icon-button"
                                          aria-label={`查看 ${j.company} ${j.title}的详情`}
                                          onClick={() => setDetailId(j.id)}
                                          title="详情"
                                        >
                                          <MoreHorizontal size={17} />
                                        </button>
                                        <button
                                          className="icon-button danger"
                                          aria-label={`删除 ${j.company} ${j.title}`}
                                          disabled={busy}
                                          onClick={() => {
                                            if (
                                              confirm(
                                                "删除此投递及其流程日志？关联任务会保留并解除关联。",
                                              )
                                            )
                                              void act(
                                                () =>
                                                  api(`jobs/${j.id}`, "DELETE"),
                                                "投递已删除",
                                              );
                                          }}
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <Empty
                            title="暂无投递记录"
                            description="新增一条投递，或调整搜索和筛选条件。"
                          />
                        )
                      ) : (
                        <>
                          <p className="board-hint">
                            拖动卡片更改阶段，或使用卡片底部的阶段选择器。变更会自动写入流程日志。
                          </p>
                          <div className="kanban">
                            {boardStages.map((s, i) => (
                              <div
                                className="kanban-column"
                                key={s}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const id = e.dataTransfer.getData(
                                    "application/x-nextstep-job",
                                  );
                                  const job = jobs.find((j) => j.id === id);
                                  if (job) void updateJob(job, { stage: s });
                                }}
                              >
                                <div className="kanban-title">
                                  <span className={`stage-dot stage-${i}`} />
                                  {s}
                                  <span>
                                    {
                                      filteredJobs.filter((j) => j.stage === s)
                                        .length
                                    }
                                  </span>
                                </div>
                                {filteredJobs
                                  .filter((j) => j.stage === s)
                                  .map((j) => (
                                    <article
                                      className="job-card"
                                      draggable={!busy}
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData(
                                          "application/x-nextstep-job",
                                          j.id,
                                        );
                                        e.dataTransfer.effectAllowed = "move";
                                      }}
                                      key={j.id}
                                    >
                                      <button
                                        className="text-button"
                                        onClick={() => setDetailId(j.id)}
                                      >
                                        <strong>{j.company}</strong>
                                        <h3>{j.title}</h3>
                                      </button>
                                      <div className="job-card-tags">
                                        <Badge tone="blue">
                                          {j.direction || "未设方向"}
                                        </Badge>
                                        <span>{j.location || "未设地区"}</span>
                                      </div>
                                      <p>
                                        <CalendarDays size={13} />
                                        {j.nextFollowUp
                                          ? `跟进 ${j.nextFollowUp}`
                                          : j.deadline
                                            ? `截止 ${j.deadline}`
                                            : "暂无时间安排"}
                                      </p>
                                      <select
                                        aria-label={`${j.company}的看板阶段`}
                                        disabled={busy}
                                        value={j.stage}
                                        onChange={(e) =>
                                          updateJob(j, {
                                            stage: e.target
                                              .value as Job["stage"],
                                          })
                                        }
                                      >
                                        {stageOptions(j).map((s) => (
                                          <option key={s}>{s}</option>
                                        ))}
                                      </select>
                                    </article>
                                  ))}
                                <button
                                  className="kanban-add"
                                  onClick={() => {
                                    setError("");
                                    setQuickStage(s);
                                    setQuickJob(null);
                                  }}
                                >
                                  <Plus size={15} />
                                  新增岗位
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </section>
              )}
              {page === "成长复盘" && (
                <>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>本周任务回顾</h2>
                      <Badge tone="green">真实任务统计</Badge>
                    </div>
                    <div className="review-summary">
                      <strong>
                        {stats.count}
                        <small>已完成任务</small>
                      </strong>
                      <strong>
                        {stats.minutes}
                        <small>实际专注分钟</small>
                      </strong>
                      <strong>
                        {
                          jobs.filter(
                            (j) =>
                              j.appliedDate >=
                                todayKey(
                                  new Date(
                                    now.getFullYear(),
                                    now.getMonth(),
                                    now.getDate() - ((now.getDay() + 6) % 7),
                                  ),
                                ) && j.appliedDate <= today,
                          ).length
                        }
                        <small>本周投递岗位</small>
                      </strong>
                    </div>
                    {modules.map((m) => (
                      <div className="review-bar" key={m}>
                        <span>{m}</span>
                        <div className={`progress-track ${moduleClass[m]}`}>
                          <span
                            style={{
                              width: `${stats.minutes ? (stats.byModule[m] / stats.minutes) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span>{stats.byModule[m]} 分钟</span>
                      </div>
                    ))}
                    <p className="rule-note">
                      统计本周一至周日完成的任务，以及这些任务手工填写的实际分钟数。详细周复盘档案在阶段
                      C 实现。
                    </p>
                  </section>
                </>
              )}
              {["面试训练室", "论文研究中心", "IELTS 学习站"].includes(
                page,
              ) && (
                <section className="panel future-panel">
                  <Badge tone="purple">
                    {page === "面试训练室" ? "阶段 B" : "阶段 C"} · 尚未实现
                  </Badge>
                  <Empty
                    title={
                      page === "面试训练室"
                        ? "让每次练习，都有积累"
                        : page === "论文研究中心"
                          ? "让研究进度，清晰可见"
                          : "让语言学习，成为日常"
                    }
                    description={
                      page === "面试训练室"
                        ? "后续提供题库、录音与回放、答案版本和复练提醒。当前可以先安排面试任务。"
                        : page === "论文研究中心"
                          ? "后续提供里程碑、研究日志和文献库。当前可以用公共任务管理论文节点。"
                          : "后续提供词汇卡片、口语练习与听读记录。当前可以用公共任务规划学习。"
                    }
                    action={
                      <button
                        className="button primary"
                        onClick={() => {
                          newTask(
                            page === "面试训练室"
                              ? "面试"
                              : page === "论文研究中心"
                                ? "论文"
                                : "雅思",
                          );
                        }}
                      >
                        <Plus size={16} />
                        创建
                        {page === "面试训练室"
                          ? "面试"
                          : page === "论文研究中心"
                            ? "论文"
                            : "雅思"}
                        任务
                      </button>
                    }
                  />
                  <p className="rule-note">
                    未接入 AI、语音转写或外部信息源；当前版本不需要 API 密钥。
                  </p>
                </section>
              )}
              {page === "设置与备份" && (
                <div className="settings-grid">
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>数据备份与恢复</h2>
                      <Download size={18} />
                    </div>
                    <p className="settings-description">
                      JSON
                      备份包含当前阶段的全部任务、岗位、来源、流程日志和排程设置。文件可能含私人信息，请保存到安全的位置，不要提交到
                      GitHub。
                    </p>
                    <div className="backup-actions">
                      <a className="button primary" href="/api/backup">
                        <Download size={16} />
                        导出完整 JSON 备份
                      </a>
                      <a className="button" href="/api/jobs.csv">
                        导出岗位 CSV
                      </a>
                    </div>
                    <hr />
                    <h3>从 JSON 备份导入</h3>
                    <p className="settings-description">
                      先预览，再确认。重复 ID
                      将跳过，现有记录不会被覆盖；导入到空库可完整恢复。最多 10
                      MB。
                    </p>
                    <label className="upload-zone">
                      <Upload size={24} />
                      <strong>选择 NextStep JSON 备份</strong>
                      <span>只在本机处理，不上传到第三方</span>
                      <input
                        aria-label="选择 JSON 备份"
                        type="file"
                        accept=".json,application/json"
                        disabled={busy}
                        onChange={async (e) => {
                          setPreview(null);
                          setBackup(undefined);
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 10 * 1024 * 1024) {
                            setError("文件超过 10 MB");
                            return;
                          }
                          try {
                            const value = JSON.parse(await file.text());
                            const result = await api(
                              "import-preview",
                              "POST",
                              value,
                            );
                            setBackup(value);
                            setPreview(result);
                          } catch (err) {
                            setError(
                              err instanceof Error
                                ? err.message
                                : "备份无法读取",
                            );
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {preview && (
                      <div className="import-preview">
                        <h3>导入预览</h3>
                        {Object.entries(preview).map(([key, value]) => (
                          <p key={key}>
                            {key === "jobs"
                              ? "岗位"
                              : key === "tasks"
                                ? "任务"
                                : key === "sources"
                                  ? "来源"
                                  : "流程记录"}
                            ：新增 {value.new} 条，跳过重复 {value.duplicates}{" "}
                            条
                          </p>
                        ))}
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() => {
                            if (confirm("确认合并导入？现有记录保持不变。"))
                              void act(
                                () => api("import", "POST", backup),
                                "备份已导入",
                              ).then((ok) => {
                                if (ok) {
                                  setPreview(null);
                                  setBackup(undefined);
                                }
                              });
                          }}
                        >
                          确认合并导入
                        </button>
                      </div>
                    )}
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>本地与隐私</h2>
                      <Settings2 size={18} />
                    </div>
                    <div className="privacy-item">
                      <Badge tone="green">离线优先</Badge>
                      <p>数据保存到 data/nextstep.db，默认不连接外部服务。</p>
                    </div>
                    <div className="privacy-item">
                      <Badge tone="blue">仅限本机</Badge>
                      <p>
                        启动脚本监听 127.0.0.1:3000，请不要将服务暴露到公网。
                      </p>
                    </div>
                    <div className="privacy-item">
                      <Badge>主题</Badge>
                      <button className="button" onClick={() => setDark(!dark)}>
                        {dark ? <Sun size={15} /> : <Moon size={15} />}切换为
                        {dark ? "浅色" : "深色"}
                      </button>
                    </div>
                    <p className="rule-note">
                      当前阶段不保存录音或 API 密钥。附件与 AI
                      功能将在后续阶段提供。
                    </p>
                  </section>
                </div>
              )}
            </>
          )}
          <footer className="main-footer">
            <span>
              NextStep OS <span className="footer-dot">·</span>{" "}
              少一点切换，多一点前进
            </span>
            <span>本地工作台 / 阶段 A</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {taskDraft && (
        <Modal
          error={error}
          title={taskId ? "编辑任务" : "新增任务"}
          onClose={() => setTaskDraft(null)}
        >
          <form
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              if (
                await act(() =>
                  api(
                    taskId ? `tasks/${taskId}` : "tasks",
                    taskId ? "PUT" : "POST",
                    taskDraft,
                  ),
                )
              )
                setTaskDraft(null);
            }}
          >
            <div className="form-grid">
              <Field label="任务名称 *" full>
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={taskDraft.title}
                  onChange={(e) =>
                    setTaskDraft({ ...taskDraft, title: e.target.value })
                  }
                  placeholder="下一步，你想完成什么？"
                />
              </Field>
              <Field label="所属模块">
                <select
                  value={taskDraft.module}
                  onChange={(e) =>
                    setTaskDraft({
                      ...taskDraft,
                      module: e.target.value as Task["module"],
                    })
                  }
                >
                  {modules.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="优先级">
                <select
                  value={taskDraft.priority}
                  onChange={(e) =>
                    setTaskDraft({
                      ...taskDraft,
                      priority: e.target.value as Task["priority"],
                    })
                  }
                >
                  {["P0", "P1", "P2"].map((p) => (
                    <option key={p} value={p}>
                      {p} ·{" "}
                      {p === "P0" ? "最重要" : p === "P1" ? "重要" : "常规"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="预计时长（分钟）">
                <input
                  type="number"
                  required
                  min={1}
                  max={1440}
                  value={taskDraft.estimatedMinutes}
                  onChange={(e) =>
                    setTaskDraft({
                      ...taskDraft,
                      estimatedMinutes: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="截止日期">
                <input
                  type="date"
                  value={taskDraft.dueDate}
                  onChange={(e) =>
                    setTaskDraft({ ...taskDraft, dueDate: e.target.value })
                  }
                />
              </Field>
              <Field label="任务状态">
                <select
                  value={taskDraft.status}
                  onChange={(e) =>
                    setTaskDraft({
                      ...taskDraft,
                      status: e.target.value as Task["status"],
                    })
                  }
                >
                  {["待办", "进行中", "已完成"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="实际专注（分钟）">
                <input
                  type="number"
                  required
                  min={0}
                  max={100000}
                  value={taskDraft.actualMinutes}
                  onChange={(e) =>
                    setTaskDraft({
                      ...taskDraft,
                      actualMinutes: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="关联岗位" full>
                <select
                  value={taskDraft.jobId ?? ""}
                  onChange={(e) =>
                    setTaskDraft({
                      ...taskDraft,
                      jobId: e.target.value || null,
                    })
                  }
                >
                  <option value="">不关联</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.company} · {j.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="备注" full>
                <textarea
                  rows={3}
                  maxLength={10000}
                  value={taskDraft.notes}
                  onChange={(e) =>
                    setTaskDraft({ ...taskDraft, notes: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="form-footer">
              <button
                type="button"
                className="button"
                onClick={() => setTaskDraft(null)}
              >
                取消
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "保存中…" : "保存任务"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {quickAdd && (
        <Modal title="快捷新增" onClose={() => setQuickAdd(false)}>
          <div className="quick-add-options">
            <button
              className="button"
              onClick={() => {
                setQuickAdd(false);
                newJob();
              }}
            >
              新增投递
            </button>
            {modules.map((m) => (
              <button
                className="button"
                key={m}
                onClick={() => {
                  setQuickAdd(false);
                  newTask(m);
                }}
              >
                新增{m}任务
              </button>
            ))}
          </div>
        </Modal>
      )}
      {quickJob !== undefined && (
        <QuickApplication
          job={quickJob ?? undefined}
          initialStage={quickStage}
          busy={busy}
          error={error}
          onClose={() => setQuickJob(undefined)}
          onSave={(draft) =>
            act(
              () =>
                api(
                  quickJob ? `applications/${quickJob.id}` : "applications",
                  quickJob ? "PUT" : "POST",
                  draft,
                ),
              "投递已保存",
            )
          }
        />
      )}
      {jobDraft && (
        <Modal
          error={error}
          wide
          title={jobId ? "编辑岗位资料" : "新增岗位资料"}
          onClose={() => setJobDraft(null)}
        >
          <form
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              if (
                await act(() =>
                  api(
                    jobId ? `jobs/${jobId}` : "jobs",
                    jobId ? "PUT" : "POST",
                    jobDraft,
                  ),
                )
              )
                setJobDraft(null);
            }}
          >
            <div className="form-grid">
              <Field label="公司 *">
                <input
                  required
                  maxLength={200}
                  value={jobDraft.company}
                  onChange={(e) =>
                    setJobDraft({ ...jobDraft, company: e.target.value })
                  }
                />
              </Field>
              <Field label="岗位名称 *">
                <input
                  required
                  maxLength={200}
                  value={jobDraft.title}
                  onChange={(e) =>
                    setJobDraft({ ...jobDraft, title: e.target.value })
                  }
                />
              </Field>
              <Field label="业务方向">
                <input
                  maxLength={100}
                  placeholder="如：内容 / 品牌 / AI 出海"
                  value={jobDraft.direction}
                  onChange={(e) =>
                    setJobDraft({ ...jobDraft, direction: e.target.value })
                  }
                />
              </Field>
              <Field label="地区">
                <input
                  maxLength={100}
                  value={jobDraft.location}
                  onChange={(e) =>
                    setJobDraft({ ...jobDraft, location: e.target.value })
                  }
                />
              </Field>
              <Field label="官方链接" full>
                <input
                  type="url"
                  placeholder="https://"
                  value={jobDraft.officialUrl}
                  onChange={(e) =>
                    setJobDraft({ ...jobDraft, officialUrl: e.target.value })
                  }
                />
              </Field>
              <Field label="JD 正文" full>
                <textarea
                  rows={4}
                  maxLength={50000}
                  placeholder="直接粘贴岗位描述；不自动提取或评分。"
                  value={jobDraft.jd}
                  onChange={(e) =>
                    setJobDraft({ ...jobDraft, jd: e.target.value })
                  }
                />
              </Field>
              <Field label="校招资格">
                <select
                  value={jobDraft.eligibility}
                  onChange={(e) =>
                    setJobDraft({
                      ...jobDraft,
                      eligibility: e.target.value as Job["eligibility"],
                    })
                  }
                >
                  {["待确认", "符合", "不符合"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="截止日期">
                <input
                  type="date"
                  value={jobDraft.deadline}
                  onChange={(e) =>
                    setJobDraft({ ...jobDraft, deadline: e.target.value })
                  }
                />
              </Field>
              <Field label="匹配理由" full>
                <textarea
                  rows={2}
                  value={jobDraft.matchReason}
                  onChange={(e) =>
                    setJobDraft({ ...jobDraft, matchReason: e.target.value })
                  }
                />
              </Field>
              <Field label="人工匹配分数（0–100，可留空）">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={jobDraft.matchScore ?? ""}
                  onChange={(e) =>
                    setJobDraft({
                      ...jobDraft,
                      matchScore:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="简历版本">
                <input
                  maxLength={200}
                  placeholder="如：品牌营销 v2"
                  value={jobDraft.resumeVersion}
                  onChange={(e) =>
                    setJobDraft({ ...jobDraft, resumeVersion: e.target.value })
                  }
                />
              </Field>
              <Field label="流程阶段">
                <select
                  value={jobDraft.stage}
                  onChange={(e) =>
                    setJobDraft({
                      ...jobDraft,
                      stage: e.target.value as Job["stage"],
                    })
                  }
                >
                  {stages.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="投递日期">
                <input
                  type="date"
                  value={jobDraft.appliedDate}
                  onChange={(e) =>
                    setJobDraft({ ...jobDraft, appliedDate: e.target.value })
                  }
                />
              </Field>
              <Field label="下次跟进">
                <input
                  type="date"
                  value={jobDraft.nextFollowUp}
                  onChange={(e) =>
                    setJobDraft({ ...jobDraft, nextFollowUp: e.target.value })
                  }
                />
              </Field>
              <Field label="归档状态">
                <select
                  value={String(jobDraft.archived)}
                  onChange={(e) =>
                    setJobDraft({
                      ...jobDraft,
                      archived: e.target.value === "true",
                    })
                  }
                >
                  <option value="false">活跃</option>
                  <option value="true">已归档</option>
                </select>
              </Field>
              <Field label="备注" full>
                <textarea
                  rows={2}
                  value={jobDraft.notes}
                  onChange={(e) =>
                    setJobDraft({ ...jobDraft, notes: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="form-footer">
              <button
                type="button"
                className="button"
                onClick={() => setJobDraft(null)}
              >
                取消
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "保存中…" : "保存岗位"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal
          error={error}
          wide
          title={`${detail.company} · ${detail.title}`}
          onClose={() => setDetailId(undefined)}
        >
          <div className="detail-content">
            <div className="detail-top">
              <Badge tone="blue">{detail.stage}</Badge>
              <span>
                {detail.direction || "未设方向"} /{" "}
                {detail.location || "未设地区"}
              </span>
              <button className="button" onClick={() => editJob(detail)}>
                编辑资料
              </button>
            </div>
            <div className="detail-facts">
              <p>
                校招资格 <strong>{detail.eligibility}</strong>
              </p>
              <p>
                截止日期 <strong>{detail.deadline || "未设置"}</strong>
              </p>
              <p>
                投递日期 <strong>{detail.appliedDate || "未投递"}</strong>
              </p>
              <p>
                下次跟进 <strong>{detail.nextFollowUp || "未设置"}</strong>
              </p>
              <p>
                人工匹配 <strong>{detail.matchScore ?? "未评分"}</strong>
              </p>
              <p>
                简历版本 <strong>{detail.resumeVersion || "未填写"}</strong>
              </p>
            </div>
            {detail.sourceId &&
              state?.sources.find((s) => s.id === detail.sourceId) && (
                <div className="detail-source">
                  <Badge tone="blue">{detail.origin}</Badge>
                  <a
                    className="text-button accent"
                    href={
                      state.sources.find((s) => s.id === detail.sourceId)!.url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    查看原始文档 <ExternalLink size={14} />
                  </a>
                </div>
              )}
            {detail.officialUrl && (
              <a
                className="text-button accent"
                href={detail.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                查看官方岗位 <ExternalLink size={14} />
              </a>
            )}
            <h3>岗位描述 / JD</h3>
            <p className="preserve-text">{detail.jd || "尚未录入岗位描述。"}</p>
            <h3>匹配理由与备注</h3>
            <p className="preserve-text">
              {[detail.matchReason, detail.notes].filter(Boolean).join("\n") ||
                "暂无记录。"}
            </p>
            <div className="panel-heading">
              <h3>面试与流程日志</h3>
              <button
                className="button"
                onClick={() => {
                  setEventId(undefined);
                  setEventDraft({
                    jobId: detail.id,
                    kind: "面试",
                    title: "",
                    at: "",
                    notes: "",
                  });
                  setDetailId(undefined);
                }}
              >
                <Plus size={15} />
                添加安排 / 日志
              </button>
            </div>
            {events
              .filter((e) => e.jobId === detail.id)
              .sort((a, b) =>
                (b.at || b.createdAt).localeCompare(a.at || a.createdAt),
              )
              .map((e) => (
                <div className="event-row" key={e.id}>
                  <Badge tone={e.kind === "面试" ? "purple" : "neutral"}>
                    {e.kind}
                  </Badge>
                  <div>
                    <strong>{e.title}</strong>
                    <small>
                      {e.at.replace("T", " ") ||
                        new Date(e.createdAt).toLocaleString("zh-CN")}
                    </small>
                    <p className="preserve-text">{e.notes}</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setEventId(e.id);
                      setEventDraft({
                        jobId: e.jobId,
                        kind: e.kind,
                        title: e.title,
                        at: e.at,
                        notes: e.notes,
                      });
                      setDetailId(undefined);
                    }}
                  >
                    编辑
                  </button>
                  <button
                    className="icon-button danger"
                    disabled={busy}
                    aria-label={`删除日志 ${e.title}`}
                    onClick={() => {
                      if (confirm("删除此流程记录？"))
                        void act(
                          () => api(`events/${e.id}`, "DELETE"),
                          "流程记录已删除",
                        );
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            {!events.some((e) => e.jobId === detail.id) && (
              <p className="quiet-empty">尚无面试安排或流程日志。</p>
            )}
            <h3>关联任务</h3>
            {tasks
              .filter((t) => t.jobId === detail.id)
              .map((t) => taskRow(t, true))}
            <div className="detail-actions">
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  act(
                    () => api("jobs/training", "POST", { jobId: detail.id }),
                    "面试训练任务已创建",
                  )
                }
              >
                <Plus size={16} />
                为此岗位创建面试训练任务
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  updateJob(detail, { archived: !detail.archived })
                }
              >
                <Archive size={16} />
                {detail.archived ? "取消归档" : "归档岗位"}
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "永久删除此岗位及其流程日志？关联任务会保留并解除岗位关联。",
                    )
                  )
                    void act(
                      () => api(`jobs/${detail.id}`, "DELETE"),
                      "岗位已删除",
                    ).then((ok) => {
                      if (ok) setDetailId(undefined);
                    });
                }}
              >
                <Trash2 size={16} />
                删除
              </button>
            </div>
            <p className="rule-note">
              题库、历史练习与最佳答案关联将在阶段 B 实现。
            </p>
          </div>
        </Modal>
      )}
      {eventDraft && (
        <Modal
          error={error}
          title={eventId ? "编辑流程记录" : "添加面试 / 流程记录"}
          onClose={() => setEventDraft(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await act(() =>
                  api(
                    eventId ? `events/${eventId}` : "events",
                    eventId ? "PUT" : "POST",
                    eventDraft,
                  ),
                )
              ) {
                setDetailId(eventDraft.jobId);
                setEventDraft(null);
              }
            }}
          >
            <div className="form-grid">
              <Field label="记录类型">
                <select
                  value={eventDraft.kind}
                  onChange={(e) =>
                    setEventDraft({
                      ...eventDraft,
                      kind: e.target.value as "日志" | "面试",
                    })
                  }
                >
                  <option>面试</option>
                  <option>日志</option>
                </select>
              </Field>
              <Field label="日期与时间">
                <input
                  type="datetime-local"
                  required={eventDraft.kind === "面试"}
                  value={eventDraft.at}
                  onChange={(e) =>
                    setEventDraft({ ...eventDraft, at: e.target.value })
                  }
                />
              </Field>
              <Field label="标题 *" full>
                <input
                  required
                  maxLength={200}
                  placeholder="如：一面 / 已完成笔试"
                  value={eventDraft.title}
                  onChange={(e) =>
                    setEventDraft({ ...eventDraft, title: e.target.value })
                  }
                />
              </Field>
              <Field label="备注" full>
                <textarea
                  rows={4}
                  value={eventDraft.notes}
                  onChange={(e) =>
                    setEventDraft({ ...eventDraft, notes: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="form-footer">
              <button
                type="button"
                className="button"
                onClick={() => setEventDraft(null)}
              >
                取消
              </button>
              <button className="button primary" disabled={busy}>
                保存记录
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
