import { execFile } from "node:child_process";
const url = "http://127.0.0.1:3000";
for (let i = 0; i < 60; i++) {
  try {
    const response = await fetch(url + "/api/state", {
      signal: AbortSignal.timeout(1500),
    });
    if (response.ok()) {
      const state = await response.json();
      if (Array.isArray(state.tasks) && Array.isArray(state.jobs)) {
        if (process.platform === "win32")
          execFile("cmd.exe", ["/c", "start", "", url]);
        break;
      }
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
