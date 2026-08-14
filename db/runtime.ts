import { env } from "cloudflare:workers";

export type FamilyRole = "alex" | "parent_mama" | "parent_otec";

export type SessionUser = {
  id: number;
  role: FamilyRole;
  name: string;
  color: string;
};

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    pin_salt TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    points INTEGER NOT NULL DEFAULT 1 CHECK(points BETWEEN 1 AND 5),
    creator_id INTEGER NOT NULL REFERENCES users(id),
    assignee_id INTEGER NOT NULL REFERENCES users(id),
    week_start TEXT NOT NULL,
    due_date TEXT NOT NULL,
    proof_required INTEGER NOT NULL DEFAULT 0,
    recurring_key TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    proof_key TEXT,
    completion_note TEXT NOT NULL DEFAULT '',
    reviewer_comment TEXT NOT NULL DEFAULT '',
    submitted_at TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS money_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL REFERENCES users(id),
    amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
    purpose TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    parent_id INTEGER REFERENCES users(id),
    condition_task_id INTEGER REFERENCES tasks(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    badge_key TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, badge_key)
  )`,
  `CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    earned_from_week TEXT NOT NULL,
    reward_week TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'unlocked',
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_week_creator_status ON tasks(week_start, creator_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_requests_status ON money_requests(status)`,
  `CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id, unlocked_at)`,
];

let schemaReady: Promise<void> | null = null;

export function getD1() {
  if (!env.DB) throw new Error("Databáza DB nie je dostupná.");
  return env.DB;
}

export function getUploads() {
  if (!env.UPLOADS) throw new Error("Úložisko fotografií nie je dostupné.");
  return env.UPLOADS;
}

export async function ensureSchema() {
  if (!schemaReady) {
    const db = getD1();
    schemaReady = db
      .batch(schemaStatements.map((statement) => db.prepare(statement)))
      .then(async () => {
        await db.prepare("PRAGMA optimize").run();
      })
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

export function getWeekStart(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const localDate = new Date(Date.UTC(year, month - 1, day));
  const weekday = localDate.getUTCDay() || 7;
  localDate.setUTCDate(localDate.getUTCDate() - weekday + 1);
  return localDate.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function normalizeRecurringKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomToken(size = 32) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(size)));
}

export async function hashPin(pin: string, salt: string) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const result = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: 120_000,
    },
    material,
    256,
  );
  return bytesToBase64Url(new Uint8Array(result));
}

export function validPin(pin: unknown) {
  return typeof pin === "string" && /^\d{4,8}$/.test(pin);
}

export function sessionCookie(token: string, maxAge = 60 * 60 * 24 * 30) {
  return `alex_auto_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  await ensureSchema();
  const token = readCookie(request, "alex_auto_session");
  if (!token) return null;
  const row = await getD1()
    .prepare(
      `SELECT u.id, u.role, u.name, u.color
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP`,
    )
    .bind(token)
    .first<SessionUser>();
  return row ?? null;
}

export async function requireSession(request: Request, roles?: FamilyRole[]) {
  const user = await getSessionUser(request);
  if (!user) throw new Response(JSON.stringify({ error: "Najprv sa prihláste." }), { status: 401 });
  if (roles && !roles.includes(user.role)) {
    throw new Response(JSON.stringify({ error: "Na túto akciu nemáte oprávnenie." }), { status: 403 });
  }
  return user;
}

export function jsonError(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Nastala neočakávaná chyba.";
  return Response.json({ error: message }, { status: 500 });
}
