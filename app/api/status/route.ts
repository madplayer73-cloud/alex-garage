import { ensureSchema, getD1, jsonError } from "@/db/runtime";

export async function GET() {
  try {
    await ensureSchema();
    const users = await getD1()
      .prepare("SELECT id, role, name, color FROM users ORDER BY CASE role WHEN 'alex' THEN 1 WHEN 'parent_mama' THEN 2 ELSE 3 END")
      .all();
    return Response.json({ configured: users.results.length === 3, users: users.results });
  } catch (error) {
    return jsonError(error);
  }
}
