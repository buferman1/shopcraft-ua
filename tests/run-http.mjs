import { spawn } from "node:child_process";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Server startup timeout")),
      30000,
    );
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Ready")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error("Server exited " + code));
    });
    child.once("error", reject);
  });
  await import("./http-smoke.mjs");
} finally {
  child.kill("SIGTERM");
}
