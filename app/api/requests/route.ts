import {
  addDays,
  ensureSchema,
  getD1,
  getWeekStart,
  jsonError,
  requireSession,
} from "@/db/runtime";

function text(value: unknown, length: number) {
  return typeof value === "string" ? value.trim().slice(0, length) : "";
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const alex = await requireSession(request, ["alex"]);
    const payload = (await request.json()) as Record<string, unknown>;
    const amount = Number(payload.amount);
    const purpose = text(payload.purpose, 140);
    const note = text(payload.note, 500);
    if (!purpose) return Response.json({ error: "Napíšte, na čo peniaze potrebuješ." }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) {
      return Response.json({ error: "Zadajte sumu od 0,01 € do 1 000 €." }, { status: 400 });
    }
    const result = await getD1()
      .prepare("INSERT INTO money_requests (creator_id, amount_cents, purpose, note) VALUES (?, ?, ?, ?)")
      .bind(alex.id, Math.round(amount * 100), purpose, note)
      .run();
    return Response.json({ id: result.meta.last_row_id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const parent = await requireSession(request, ["parent_mama", "parent_otec"]);
    const payload = (await request.json()) as Record<string, unknown>;
    const requestId = Number(payload.requestId);
    const item = await getD1()
      .prepare("SELECT id, status, parent_id FROM money_requests WHERE id = ?")
      .bind(requestId)
      .first<{ id: number; status: string; parent_id: number | null }>();
    if (!item) return Response.json({ error: "Požiadavka sa nenašla." }, { status: 404 });

    const action = text(payload.action, 30);
    if (action === "approve_direct" && item.status === "pending") {
      await getD1()
        .prepare("UPDATE money_requests SET status = 'ready', parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(parent.id, item.id)
        .run();
      return Response.json({ ok: true });
    }
    if (action === "decline" && item.status === "pending") {
      await getD1()
        .prepare("UPDATE money_requests SET status = 'declined', parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(parent.id, item.id)
        .run();
      return Response.json({ ok: true });
    }
    if (action === "paid" && item.status === "ready") {
      if (item.parent_id && item.parent_id !== parent.id) {
        return Response.json({ error: "Vyplatenie potvrdzuje rodič, ktorý požiadavku schválil." }, { status: 403 });
      }
      await getD1()
        .prepare("UPDATE money_requests SET status = 'paid', parent_id = COALESCE(parent_id, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(parent.id, item.id)
        .run();
      return Response.json({ ok: true });
    }
    if (action === "condition" && item.status === "pending") {
      const title = text(payload.title, 120);
      const description = text(payload.description, 500);
      const points = Number(payload.points);
      const dueDate = text(payload.dueDate, 10);
      const weekStart = getWeekStart();
      if (!title) return Response.json({ error: "Napíšte podmienku – úlohu." }, { status: 400 });
      if (!Number.isInteger(points) || points < 1 || points > 5) {
        return Response.json({ error: "Podmienka môže mať 1 až 5 bodov." }, { status: 400 });
      }
      if (dueDate < weekStart || dueDate > addDays(weekStart, 6)) {
        return Response.json({ error: "Termín musí byť v aktuálnom týždni." }, { status: 400 });
      }
      const alex = await getD1().prepare("SELECT id FROM users WHERE role = 'alex'").first<{ id: number }>();
      if (!alex) return Response.json({ error: "Alexov účet sa nenašiel." }, { status: 500 });
      const created = await getD1()
        .prepare(
          `INSERT INTO tasks
            (title, description, points, creator_id, assignee_id, week_start, due_date, proof_required)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(title, description, points, parent.id, alex.id, weekStart, dueDate, payload.proofRequired ? 1 : 0)
        .run();
      await getD1()
        .prepare(
          `UPDATE money_requests SET status = 'conditioned', parent_id = ?, condition_task_id = ?,
            updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(parent.id, created.meta.last_row_id, item.id)
        .run();
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Túto požiadavku už nemožno takto zmeniť." }, { status: 409 });
  } catch (error) {
    return jsonError(error);
  }
}
