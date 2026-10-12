import { test, expect } from "@playwright/test";
import { emptyJob, emptyTask, applicationStages } from "../../lib/model";
import { todayKey } from "../../lib/planner";

test("极简首页与四字段投递：九流程往返、失败重试、编辑保留资料、导出及删除", async ({
  page,
  request,
}) => {
  const prefix = `极简验收（示例）${Date.now()}`;
  await page.goto("/");
  await expect(page.locator(".core-action")).toHaveCount(4);
  await expect(
    page.locator(
      ".minimal-home .stats-grid, .minimal-home .daily-jobs, .minimal-home .planner",
    ),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "快捷新增", exact: true }).click();
  await page.getByRole("button", { name: "新增投递", exact: true }).click();
  const form = page.getByRole("dialog");
  await expect(form.locator("input,select,textarea")).toHaveCount(4);
  await expect(page.getByLabel("投递日期", { exact: true })).toHaveValue(
    todayKey(),
  );
  await expect(page.getByLabel("当前流程", { exact: true })).toHaveValue(
    "已投递",
  );
  await page.getByLabel("公司 *", { exact: true }).fill(prefix);
  await page.getByLabel("岗位名称 *", { exact: true }).fill("品牌运营");
  await page.getByRole("button", { name: "保存投递", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "求职雷达", exact: true }).click();
  await page.getByLabel("搜索岗位").fill(prefix);
  await expect(page.locator(".application-table th")).toHaveText([
    "公司",
    "岗位",
    "投递日期",
    "当前流程",
  ]);
  const selector = page.getByLabel(`${prefix} · 品牌运营的流程`, {
    exact: true,
  });
  for (const stage of [...applicationStages].reverse()) {
    await selector.selectOption(stage);
    await expect(selector).toHaveValue(stage);
    const state = await (await request.get("/api/state")).json();
    expect(
      state.jobs.find((j: { company: string }) => j.company === prefix).stage,
    ).toBe(stage);
  }
  const state = await (await request.get("/api/state")).json();
  const job = state.jobs.find((j: { company: string }) => j.company === prefix);
  await request.put(`/api/jobs/${job.id}`, {
    data: {
      ...emptyJob,
      company: prefix,
      title: "品牌运营",
      appliedDate: job.appliedDate,
      stage: job.stage,
      jd: "保留原有 JD",
      officialUrl: "https://example.com/preserved",
      notes: "保留历史原文",
    },
  });
  await page
    .getByRole("button", { name: `编辑 ${prefix} 品牌运营`, exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator("input,select,textarea"),
  ).toHaveCount(4);
  await page.getByLabel("岗位名称 *").fill("品牌经理");
  await page.getByRole("button", { name: "保存投递", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const edited = (await (await request.get("/api/state")).json()).jobs.find(
    (j: { id: string }) => j.id === job.id,
  );
  expect(edited.jd).toBe("保留原有 JD");
  expect(edited.officialUrl).toBe("https://example.com/preserved");
  expect(edited.notes).toBe("保留历史原文");
  await page.route("**/api/jobs/*", (route) =>
    route.request().method() === "PATCH"
      ? route.abort("failed")
      : route.continue(),
  );
  const changed = page.getByLabel(`${prefix} · 品牌经理的流程`, {
    exact: true,
  });
  await changed.selectOption("Offer");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(changed).toHaveValue("已投递");
  await page.unroute("**/api/jobs/*");
  await changed.selectOption("HR面");
  await expect(changed).toHaveValue("HR面");
  await page.reload();
  await page.getByRole("button", { name: "求职雷达", exact: true }).click();
  await page.getByLabel("搜索岗位").fill(prefix);
  await expect(
    page.getByLabel(`${prefix} · 品牌经理的流程`, { exact: true }),
  ).toHaveValue("HR面");
  await page.getByLabel("流程筛选").selectOption("Offer");
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await page.getByLabel("流程筛选").selectOption("HR面");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  const csv = await request.get("/api/jobs.csv?format=compact");
  expect((await csv.text()).split("\r\n")[0].replace(/^\uFEFF/, "")).toBe(
    '"公司","岗位","投递日期","当前流程"',
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: `删除 ${prefix} 品牌经理`, exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(0);
  const removed = await (await request.get("/api/state")).json();
  expect(removed.jobs.some((j: { id: string }) => j.id === job.id)).toBeFalsy();
  expect(
    removed.events.some((e: { jobId: string }) => e.jobId === job.id),
  ).toBeFalsy();
});

test("首页最多三项重要任务，完成后刷新持久化，四行动可进入对应模块", async ({
  page,
  request,
}) => {
  const ids: string[] = [];
  const prefix = `首页聚焦（示例）${Date.now()}`;
  try {
    for (let i = 0; i < 4; i++) {
      const res = await request.post("/api/tasks", {
        data: {
          ...emptyTask,
          title: prefix + i,
          priority: "P0",
          dueDate: todayKey(),
        },
      });
      ids.push((await res.json()).id);
    }
    await page.goto("/");
    await expect(page.locator(".focus-row")).toHaveCount(3);
    const title = await page.locator(".focus-title strong").first().innerText();
    await page
      .getByRole("button", { name: `完成 ${title}`, exact: true })
      .click();
    await expect(
      page.locator(".focus-title strong").filter({ hasText: title }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.locator(".focus-title strong").filter({ hasText: title }),
    ).toHaveCount(0);
    for (const [action, heading] of [
      ["练面试", "面试训练室"],
      ["写论文", "论文研究中心"],
      ["学雅思", "IELTS 学习站"],
    ]) {
      await page.getByRole("button", { name: action, exact: false }).click();
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "首页", exact: true }).click();
    }
    await page.getByRole("button", { name: "找岗位", exact: false }).click();
    await expect(page.locator(".daily-jobs")).toBeVisible();
  } finally {
    for (const id of ids) await request.delete(`/api/tasks/${id}`);
  }
});
