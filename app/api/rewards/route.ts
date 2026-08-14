import { ensureSchema, getD1, getWeekStart, jsonError, requireSession } from "@/db/runtime";

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    await requireSession(request, ["parent_mama", "parent_otec"]);
    const { rewardWeek } = (await request.json()) as { rewardWeek?: string };
    if (rewardWeek !== getWeekStart()) {
      return Response.json({ error: "Použiť možno iba odmenu aktuálneho týždňa." }, { status: 400 });
    }
    const result = await getD1()
      .prepare("UPDATE rewards SET status = 'used', used_at = CURRENT_TIMESTAMP WHERE reward_week = ? AND status = 'unlocked'")
      .bind(rewardWeek)
      .run();
    if (!result.meta.changes) return Response.json({ error: "Aktívna odmena sa nenašla." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
