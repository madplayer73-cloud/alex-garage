import {
  ensureSchema,
  getD1,
  hashPin,
  jsonError,
  randomToken,
  sessionCookie,
  validPin,
} from "@/db/runtime";

type LoginRow = {
  id: number;
  role: string;
  name: string;
  pin_salt: string;
  pin_hash: string;
};

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const { userId, pin } = (await request.json()) as { userId?: number; pin?: string };
    if (!Number.isInteger(userId) || !validPin(pin)) {
      return Response.json({ error: "Vyberte účet a zadajte PIN." }, { status: 400 });
    }
    const row = await getD1()
      .prepare("SELECT id, role, name, pin_salt, pin_hash FROM users WHERE id = ?")
      .bind(userId)
      .first<LoginRow>();
    if (!row || (await hashPin(pin!, row.pin_salt)) !== row.pin_hash) {
      return Response.json({ error: "Nesprávny PIN." }, { status: 401 });
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const db = getD1();
    await db.batch([
      db.prepare("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP"),
      db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").bind(token, row.id, expiresAt),
    ]);
    return Response.json(
      { user: { id: row.id, role: row.role, name: row.name } },
      { headers: { "Set-Cookie": sessionCookie(token) } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
