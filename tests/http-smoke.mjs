import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
for (const path of ["/", "/auth/login", "/auth/signup", "/auth/forgot"]) {
  const response = await fetch(base + path, {
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, path);
  assert.match(await response.text(), /ShopCraft/);
  console.log("PASS", path);
}
for (const path of [
  "/dashboard",
  "/dashboard/new",
  "/dashboard/stores/00000000-0000-4000-8000-000000000000",
]) {
  const response = await fetch(base + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 307, path);
  assert.equal(
    new URL(response.headers.get("location"), base).pathname,
    "/auth/login",
  );
  console.log("PASS protected", path);
}
const callback = await fetch(
  base + "/auth/callback?next=https://evil.example",
  { redirect: "manual" },
);
assert.equal(
  new URL(callback.headers.get("location"), base).pathname,
  "/auth/login",
);
console.log("PASS callback redirect");
const health = await fetch(base + "/api/health", {
  signal: AbortSignal.timeout(30000),
});
assert.equal(health.status, 200);
assert.equal((await health.json()).database, "connected");
console.log("PASS database health");
