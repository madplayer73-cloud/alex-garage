import { ensureSchema, getD1, jsonError, requireSession } from "@/db/runtime";

const tables = ["users", "tasks", "money_requests", "achievements", "rewards"] as const;

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = await requireSession(request, ["parent_mama", "parent_otec"]);
    const db = getD1();
    const entries = await Promise.all(
      tables.map(async (table) => {
        const result = await db.prepare(`SELECT * FROM ${table}`).all();
        return [table, result.results] as const;
      }),
    );
    const createdAt = new Date().toISOString();
    const backup = {
      app: "alex-garage",
      version: "0-beta-v0",
      createdAt,
      createdBy: { id: user.id, name: user.name, role: user.role },
      note: "Testovacia JSON zaloha databazovych dat. Fotografie su ulozene v CasaOS volume alex-garage-data.",
      data: Object.fromEntries(entries),
    };
    const fileDate = createdAt.replace(/[:.]/g, "-");
    return Response.json(backup, {
      headers: {
        "Content-Disposition": `attachment; filename="alex-garage-backup-${fileDate}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
