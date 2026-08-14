import { existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDir = path.join(root, "dist", "server");
function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const dataDir = path.resolve(readArg("--data-dir") || process.env.ALEX_AUTO_DATA_DIR || path.join(root, "data"));
const port = readArg("--port") || process.env.ALEX_AUTO_PORT || "3000";
const host = readArg("--host") || process.env.ALEX_AUTO_HOST || "0.0.0.0";
const wranglerCli = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");

if (!existsSync(path.join(serverDir, "index.js"))) {
  console.error("Chýba zostavená aplikácia. Najprv spustite: npm run build");
  process.exit(1);
}

mkdirSync(dataDir, { recursive: true });
mkdirSync(path.join(root, ".wrangler", "logs"), { recursive: true });
mkdirSync(path.join(root, ".wrangler", "config"), { recursive: true });

const wranglerArgs = [
  "dev",
  "--config",
  "wrangler.json",
  "--no-bundle",
  "--ip",
  host,
  "--port",
  port,
  "--persist-to",
  dataDir,
  "--log-level",
  "warn",
  "--show-interactive-dev-session",
  "false",
];
const child = spawn(
  process.execPath,
  [wranglerCli, ...wranglerArgs],
  {
    cwd: serverDir,
    stdio: "inherit",
    env: {
      ...process.env,
      WRANGLER_LOG_PATH: path.join(root, ".wrangler", "logs"),
      XDG_CONFIG_HOME: path.join(root, ".wrangler", "config"),
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
