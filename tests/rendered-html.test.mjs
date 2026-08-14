import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Alex Garage application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html[^>]+lang="sk"/i);
  assert.match(html, /<title>Alex Garage \| Rodinné misie<\/title>/i);
  assert.match(html, /Otváram garáž/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps the family rules wired into the product", async () => {
  const [app, taskRoute, dashboardRoute, hosting, packageJson, compose] = await Promise.all([
    readFile(new URL("../app/FamilyApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tasks/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../docker-compose.yml", import.meta.url), "utf8"),
  ]);

  assert.match(app, /10 bodov od každého rodiča/);
  assert.match(app, /Vyžadovať fotografiu/);
  assert.match(dashboardRoute, /Bezchybný týždeň/);
  assert.match(dashboardRoute, /Rutinný hrdina/);
  assert.match(taskRoute, /task\.creator_id !== parent\.id/);
  assert.match(taskRoute, /proof_required/);
  assert.deepEqual(JSON.parse(hosting), { d1: "DB", r2: "UPLOADS" });
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(compose, /published: "3008"/);
  assert.match(compose, /target: 3000/);
});
