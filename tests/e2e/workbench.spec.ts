import { test, expect } from "@playwright/test";
const sample = `浏览器测试（示例）${Date.now()}`;
test("真实任务与求职流程、备份、筛选和错误态", async ({ page, request }) => {
  const clientErrors: string[] = [];
  page.on("pageerror", (e) => clientErrors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "今天，做重要的事" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "快捷新增", exact: true }).click();
  await page.getByRole("button", { name: "新增求职任务", exact: true }).click();
  await page.getByLabel("任务名称 *").fill(sample + "任务");
  await page.getByLabel("实际专注（分钟）").fill("40");
  await page.getByRole("button", { name: "保存任务" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "任务管理", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: sample + "任务", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "完成 " + sample + "任务", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "重新打开 " + sample + "任务",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "任务管理", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("button", {
      name: "重新打开 " + sample + "任务",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: sample + "任务", exact: true })
    .click();
  await page.getByLabel("任务名称 *").fill(sample + "已编辑");
  await page.getByRole("button", { name: "保存任务" }).click();
  await page.getByLabel("搜索任务").fill("不存在");
  await expect(
    page.getByRole("heading", { name: "这里还没有任务" }),
  ).toBeVisible();
  await page.getByLabel("搜索任务").fill("");
  await page.getByRole("button", { name: "求职雷达", exact: true }).click();
  await page.getByRole("button", { name: "新增投递", exact: true }).click();
  await page.getByLabel("公司 *", { exact: true }).fill(sample + "公司");
  await page.getByLabel("岗位名称 *").fill("品牌营销");
  await expect(
    page.getByRole("dialog").locator("input, select, textarea"),
  ).toHaveCount(4);
  await page.getByRole("button", { name: "保存投递" }).click();
  await page
    .getByRole("button", { name: sample + "公司 品牌营销", exact: true })
    .click();
  await page.getByRole("button", { name: "编辑资料", exact: true }).click();
  await page.getByLabel("业务方向", { exact: true }).fill("AI 出海");
  await page.getByLabel("JD 正文").fill("示例 JD：内容增长与用户洞察");
  await page.getByRole("button", { name: "保存岗位" }).click();
  await page
    .getByRole("button", { name: sample + "公司 品牌营销", exact: true })
    .click();
  await page.getByRole("button", { name: "添加安排 / 日志" }).click();
  await page.getByLabel("标题 *").fill("一面");
  await page.getByLabel("日期与时间").fill("2027-01-10T10:00");
  await page.getByRole("button", { name: "保存记录" }).click();
  await expect(
    page.getByRole("dialog").getByText("一面", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "为此岗位创建面试训练任务" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", {
      name: `准备 ${sample}公司 · 品牌营销 面试`,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page
    .getByLabel(sample + "公司 · 品牌营销的流程", { exact: true })
    .selectOption("已投递");
  await expect(
    page.getByLabel(sample + "公司 · 品牌营销的流程", { exact: true }),
  ).toHaveValue("已投递");
  await page.getByRole("button", { name: "看板", exact: true }).click();
  await page.getByLabel(sample + "公司的看板阶段").selectOption("二面");
  await expect(page.getByLabel(sample + "公司的看板阶段")).toHaveValue("二面");
  await page
    .getByRole("button", { name: sample + "公司 品牌营销", exact: true })
    .click();
  await expect(
    page.getByText("阶段变更：已投递 → 二面", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  const response = await request.get("/api/backup");
  expect(response.ok()).toBeTruthy();
  const backup = await response.json();
  expect(
    backup.jobs.some((j: { company: string }) => j.company === sample + "公司"),
  ).toBeTruthy();
  await page.getByRole("button", { name: "设置与备份", exact: true }).click();
  await page.getByLabel("选择 JSON 备份").setInputFiles({
    name: "test-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByRole("heading", { name: "导入预览" })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "确认合并导入" }).click();
  await expect(page.getByRole("status")).toContainText("备份已导入");
  expect(clientErrors).toEqual([]);
  const invalid = await request.post("/api/tasks", { data: { title: "" } });
  expect(invalid.status()).toBe(400);
  const forbidden = await request.post("/api/settings", {
    headers: { Origin: "https://evil.example" },
    data: {},
  });
  expect(forbidden.status()).toBe(403);
  const csv = await request.get("/api/jobs.csv");
  expect(await csv.text()).toContain("人工匹配分数");
  await page
    .getByRole("button", { name: "任务管理", exact: false })
    .first()
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "删除 " + sample + "已编辑", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: sample + "已编辑", exact: true }),
  ).toHaveCount(0);
});
test("移动端导航、主题和后续模块标记", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "今天，做重要的事" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "切换导航" }).click();
  await page.getByRole("button", { name: "面试训练室" }).click();
  await expect(
    page.getByText("阶段 B · 尚未实现", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "创建面试任务" }).click();
  await expect(page.getByLabel("所属模块")).toHaveValue("面试");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "切换导航" }).click();
  await page.getByRole("button", { name: "切换深浅色主题" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("任务延期归档、规则排程排序和看板拖动", async ({ page, request }) => {
  const state = await (await request.get("/api/state")).json();
  // Only clean generated records in the dedicated E2E database.
  for (const task of state.tasks)
    if (
      task.title.includes("浏览器测试（示例）") ||
      task.title.startsWith("排程测试（示例）")
    )
      await request.delete(`/api/tasks/${task.id}`);
  for (const job of state.jobs)
    if (job.company.includes("浏览器测试（示例）"))
      await request.delete(`/api/jobs/${job.id}`);
  const today = new Date();
  const dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const base = {
    module: "求职",
    priority: "P1",
    estimatedMinutes: 30,
    actualMinutes: 0,
    dueDate,
    status: "待办",
    notes: "",
    jobId: null,
    archived: false,
  };
  const a = await (
    await request.post("/api/tasks", {
      data: { ...base, title: "排程测试（示例）A", priority: "P0" },
    })
  ).json();
  const b = await (
    await request.post("/api/tasks", {
      data: { ...base, title: "排程测试（示例）B" },
    })
  ).json();
  await request.post("/api/settings", {
    data: {
      availableMinutes: 180,
      interviewMode: false,
      scheduleDate: "",
      scheduleOrder: [],
    },
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "任务管理", exact: false })
    .first()
    .click();
  await page.locator(".planner-details > summary").click();
  const rows = page.locator(".schedule-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(a.title);
  await page.getByRole("button", { name: "上移 " + b.title }).click();
  await expect(rows.nth(0)).toContainText(b.title);
  await rows.nth(0).dragTo(rows.nth(1));
  await expect(rows.nth(0)).toContainText(a.title);
  await page.reload();
  await page
    .getByRole("button", { name: "任务管理", exact: false })
    .first()
    .click();
  await page.locator(".planner-details > summary").click();
  await expect(page.locator(".schedule-row").nth(0)).toContainText(a.title);
  await page
    .getByRole("button", { name: "任务管理", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "延期 " + a.title }).click();
  const updated = await (await request.get("/api/state")).json();
  expect(
    updated.tasks.find((t: { id: string }) => t.id === a.id).dueDate,
  ).not.toBe(dueDate);
  await page.getByRole("button", { name: "归档 " + a.title }).click();
  await expect(
    page.getByRole("button", { name: a.title, exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("查看归档").check();
  await expect(
    page.getByRole("button", { name: a.title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "求职雷达", exact: true }).click();
  await page.getByRole("button", { name: "新增投递", exact: true }).click();
  await page
    .getByLabel("公司 *", { exact: true })
    .fill("浏览器测试（示例）拖动");
  await page.getByLabel("岗位名称 *").fill("增长");
  await page.getByRole("button", { name: "保存投递" }).click();
  await page.getByRole("button", { name: "看板", exact: true }).click();
  const card = page
    .locator(".job-card")
    .filter({ hasText: "浏览器测试（示例）拖动" });
  const destination = page.locator(".kanban-column").filter({
    has: page.locator(".kanban-title").filter({ hasText: "待投递" }),
  });
  await card.dragTo(destination);
  await expect(
    destination
      .locator(".job-card")
      .filter({ hasText: "浏览器测试（示例）拖动" }),
  ).toContainText("浏览器测试（示例）拖动");
});

test("保存失败时保留输入并允许重试", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "快捷新增", exact: true }).click();
  await page.getByRole("button", { name: "新增求职任务", exact: true }).click();
  await page.getByLabel("任务名称 *").fill("失败重试（示例）");
  await page.route("**/api/tasks", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "保存任务" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("任务名称 *")).toHaveValue("失败重试（示例）");
  await page.unroute("**/api/tasks");
  await page.getByRole("button", { name: "保存任务" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "任务管理", exact: false })
    .first()
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "删除 失败重试（示例）", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "失败重试（示例）", exact: true }),
  ).toHaveCount(0);
});
