import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { readSpreadsheet } from "@/lib/spreadsheet";
import { AppError, getStore } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function guard(req: NextRequest) {
  const host = req.headers.get("host")?.split(":")[0];
  if (host !== "127.0.0.1" && host !== "localhost")
    throw new AppError("仅允许本机访问", 403);
  const origin = req.headers.get("origin");
  if (origin && origin !== `http://${req.headers.get("host")}`)
    throw new AppError("拒绝跨站请求", 403);
  if (req.headers.get("sec-fetch-site") === "cross-site")
    throw new AppError("拒绝跨站请求", 403);
}
async function handle(req: NextRequest) {
  try {
    guard(req);
    const path = req.nextUrl.pathname.split("/").slice(2),
      store = getStore(),
      method = req.method;
    if (method === "GET" && path[0] === "state")
      return NextResponse.json(store.state(), {
        headers: { "Cache-Control": "no-store" },
      });
    if (method === "GET" && path[0] === "backup")
      return new NextResponse(JSON.stringify(store.backup(), null, 2), {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": 'attachment; filename="nextstep-backup.json"',
        },
      });
    if (method === "GET" && path[0] === "jobs.csv") {
      const compact = req.nextUrl.searchParams.get("format") === "compact";
      const columns = [
        "company",
        "title",
        "direction",
        "location",
        "jd",
        "officialUrl",
        "eligibility",
        "deadline",
        "matchReason",
        "matchScore",
        "resumeVersion",
        "appliedDate",
        "stage",
        "nextFollowUp",
        "notes",
        "archived",
      ] as const;
      const labels = [
        "公司",
        "岗位",
        "业务方向",
        "地区",
        "JD",
        "官方链接",
        "校招资格",
        "截止日",
        "匹配理由",
        "人工匹配分数",
        "简历版本",
        "投递日期",
        "阶段",
        "下次跟进",
        "备注",
        "归档",
      ];
      const cell = (value: unknown) => {
        let s = String(value ?? "");
        if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      };
      return new NextResponse(
        "\uFEFF" +
          [
            (compact ? ["公司", "岗位", "投递日期", "当前流程"] : labels)
              .map(cell)
              .join(","),
            ...store
              .state()
              .jobs.map((j) =>
                (compact
                  ? (["company", "title", "appliedDate", "stage"] as const)
                  : columns
                )
                  .map((k) => cell(j[k]))
                  .join(","),
              ),
          ].join("\r\n"),
        {
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="nextstep-jobs.csv"',
          },
        },
      );
    }
    const tables = {
      tasks: "tasks",
      jobs: "jobs",
      events: "job_events",
      sources: "sources",
    } as const;
    if (method === "DELETE" && path[0] in tables && path[1]) {
      store.remove(tables[path[0] as keyof typeof tables], path[1]);
      return NextResponse.json({ ok: true });
    }
    if (!["POST", "PUT", "PATCH"].includes(method))
      throw new AppError("接口不存在", 404);
    if (Number(req.headers.get("content-length") ?? 0) > 10 * 1024 * 1024)
      throw new AppError("文件超过 10 MB", 413);
    if (method === "POST" && path[0] === "sheet-read") {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new AppError("请选择表格文件");
      if (file.size > 10 * 1024 * 1024)
        throw new AppError("文件超过 10 MB", 413);
      try {
        return NextResponse.json(
          {
            sheets: await readSpreadsheet(
              Buffer.from(await file.arrayBuffer()),
              file.name,
            ),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch (e) {
        throw new AppError(e instanceof Error ? e.message : "文件无法读取");
      }
    }
    const text = await req.text();
    if (Buffer.byteLength(text) > 10 * 1024 * 1024)
      throw new AppError("文件超过 10 MB", 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("JSON 格式不正确");
    }
    const id = method === "PUT" ? path[1] : undefined;
    if (method === "PATCH") {
      if (path[0] !== "jobs" || !path[1]) throw new AppError("接口不存在", 404);
      return NextResponse.json(store.changeJobStage(body, path[1]));
    }
    if (method === "PUT" && !id) throw new AppError("缺少记录 ID");
    if (path[0] === "tasks") return NextResponse.json(store.saveTask(body, id));
    if (path[0] === "applications")
      return NextResponse.json(store.saveApplication(body, id));
    if (path[0] === "jobs" && path[1] === "training" && method === "POST")
      return NextResponse.json(
        store.training(
          z.object({ jobId: z.string().uuid() }).parse(body).jobId,
        ),
      );
    if (path[0] === "jobs") return NextResponse.json(store.saveJob(body, id));
    if (path[0] === "events")
      return NextResponse.json(store.saveEvent(body, id));
    if (path[0] === "sources")
      return NextResponse.json(store.saveSource(body, id));
    if (path[0] === "job-sheet-preview")
      return NextResponse.json(store.previewJobSheet(body));
    if (path[0] === "job-sheet-import")
      return NextResponse.json(store.importJobSheet(body));
    if (path[0] === "settings") return NextResponse.json(store.settings(body));
    if (path[0] === "import-preview")
      return NextResponse.json(store.preview(body));
    if (path[0] === "import") return NextResponse.json(store.import(body));
    throw new AppError("接口不存在", 404);
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json(
        {
          error: e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("；"),
        },
        { status: 400 },
      );
    if (e instanceof AppError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(
      "NextStep API error",
      e instanceof Error ? e.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "服务暂时无法完成操作，请重试；数据未被覆盖。" },
      { status: 500 },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
