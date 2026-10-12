import { test, expect } from "@playwright/test";
test("来源保存、CSV预览导入、真实推荐及个人投递去重", async ({
  page,
  request,
}) => {
  const prefix = `导入测试（示例）${Date.now()}`;
  const initial = await (await request.get("/api/state")).json();
  for (const job of initial.jobs)
    if (job.company.startsWith("导入测试（示例）"))
      await request.delete(`/api/jobs/${job.id}`);
  for (const source of initial.sources)
    if (source.name.startsWith("导入测试（示例）"))
      await request.delete(`/api/sources/${source.id}`);
  await page.goto("/");
  await page.getByRole("button", { name: "求职雷达", exact: true }).click();
  await page.getByRole("button", { name: "来源与导入", exact: true }).click();
  await page.getByRole("button", { name: "新增来源" }).click();
  await page.getByLabel("来源名称 *").fill(prefix + "信息库");
  await page
    .getByLabel("在线文档链接 *")
    .fill("https://example.com/feed-" + Date.now());
  await page.getByRole("button", { name: "保存来源" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "导入此来源", exact: true }).click();
  const csv = `公司,岗位,地区,截止日期,校招资格,自定义字段\r\n${prefix},AI 出海品牌营销,上海,2027-12-31,符合,保留原始信息\r\n${prefix}旧,过期岗位,北京,2020-01-01,符合,不应推荐`;
  await page.getByLabel("选择岗位表格").setInputFiles({
    name: "test.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.getByLabel("映射公司")).toHaveValue("0");
  await page.getByRole("button", { name: "预览导入", exact: true }).click();
  await expect(page.locator(".preview-counts")).toContainText("新增 2 条");
  const before = await (await request.get("/api/state")).json();
  expect(
    before.jobs.some((j: { company: string }) => j.company === prefix),
  ).toBeFalsy();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "确认导入有效记录" }).click();
  await expect(page.locator(".source-notice")).toContainText("表格已导入");
  await page.getByRole("button", { name: "首页", exact: true }).click();
  await page.getByRole("button", { name: "找岗位", exact: false }).click();
  const card = page.locator(".recommendation-card").filter({ hasText: prefix });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("命中关键词");
  await expect(card).toContainText("快照");
  await page.reload();
  await page.getByRole("button", { name: "找岗位", exact: false }).click();
  await expect(
    page.locator(".recommendation-card").filter({ hasText: prefix }),
  ).toHaveCount(1);
  await page
    .locator(".recommendation-card")
    .filter({ hasText: prefix })
    .getByRole("button", { name: "加入待投递" })
    .click();
  await expect(
    page.locator(".recommendation-card").filter({ hasText: prefix }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "求职雷达", exact: true }).click();
  await page.getByRole("button", { name: "来源与导入", exact: true }).click();
  await page.getByRole("button", { name: "新增来源" }).click();
  await page.getByLabel("来源名称 *").fill(prefix + "投递表");
  await page.getByLabel("来源类型").selectOption("投递记录");
  await page
    .getByLabel("在线文档链接 *")
    .fill("https://example.com/history-" + Date.now());
  await page.getByRole("button", { name: "保存来源" }).click();
  await page
    .locator(".source-card")
    .filter({ hasText: prefix + "投递表" })
    .getByRole("button", { name: "导入此来源" })
    .click();
  await page.getByLabel("选择岗位表格").setInputFiles({
    name: "history.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      `公司,岗位,地区,投递日期,阶段,备注\n${prefix},AI 出海品牌营销,上海,2026-10-10,一面,个人投递示例`,
    ),
  });
  await page.getByLabel("允许更新同来源的重复岗位", { exact: false }).check();
  await page.getByRole("button", { name: "预览导入" }).click();
  await expect(page.locator(".preview-counts")).toContainText("更新 1 条");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "确认导入有效记录" }).click();
  await expect(page.locator(".source-notice")).toContainText("表格已导入");
  await page.getByRole("button", { name: "投递记录", exact: true }).click();
  await page.locator(".extra-filters > summary").click();
  await page.getByLabel("记录类型筛选").selectOption("投递记录");
  await page.getByLabel("搜索岗位").fill(prefix);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(
    page.getByLabel(prefix + " · AI 出海品牌营销的流程", { exact: true }),
  ).toHaveValue("一面");
  const backup = await (await request.get("/api/backup")).json();
  expect(
    backup.sources.some((s: { name: string }) => s.name === prefix + "投递表"),
  ).toBeTruthy();
  expect(
    backup.jobs.find((j: { company: string }) => j.company === prefix).notes,
  ).toContain("个人投递示例");
  for (const job of backup.jobs)
    if (job.company.startsWith(prefix))
      await request.delete(`/api/jobs/${job.id}`);
  for (const source of backup.sources)
    if (source.name.startsWith(prefix))
      await request.delete(`/api/sources/${source.id}`);
});
