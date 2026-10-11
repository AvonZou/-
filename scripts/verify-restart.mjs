import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "nextstep-restart-"));
const url = "http://127.0.0.1:3001";
let child;
async function start() {
  child = spawn(
    process.execPath,
    [
      resolve("node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3001",
    ],
    {
      env: { ...process.env, NEXTSTEP_DATA_DIR: dir },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (v) => (output += v));
  child.stderr.on("data", (v) => (output += v));
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(output);
    try {
      const res = await fetch(url + "/api/state", {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("服务未就绪：" + output);
}
async function stop() {
  if (child && child.exitCode === null) {
    const exited = new Promise((r) => child.once("exit", r));
    child.kill("SIGTERM");
    await exited;
  }
}
try {
  await start();
  const res = await fetch(url + "/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "重启验收（示例）",
      module: "论文",
      priority: "P1",
      estimatedMinutes: 30,
      actualMinutes: 0,
      dueDate: "",
      status: "待办",
      notes: "服务进程重启后应保留",
      jobId: null,
      archived: false,
    }),
  });
  assert.equal(res.status, 200);
  const saved = await res.json();
  await stop();
  await start();
  const state = await (
    await fetch(url + "/api/state", { signal: AbortSignal.timeout(2000) })
  ).json();
  assert.equal(
    state.tasks.find((t) => t.id === saved.id)?.notes,
    "服务进程重启后应保留",
  );
  console.log("PASS: 生产服务停止并重启后，SQLite 记录及 ID 保留。");
} finally {
  await stop();
  rmSync(dir, { recursive: true, force: true });
}
