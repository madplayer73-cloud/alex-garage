import {
  addDays,
  ensureSchema,
  getD1,
  getUploads,
  getWeekStart,
  jsonError,
  normalizeRecurringKey,
  requireSession,
} from "@/db/runtime";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function extensionFor(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/heic" || contentType === "image/heif") return "heic";
  return "jpg";
}

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const parent = await requireSession(request, ["parent_mama", "parent_otec"]);
    const payload = (await request.json()) as Record<string, unknown>;
    const title = cleanText(payload.title, 120);
    const description = cleanText(payload.description, 500);
    const points = Number(payload.points);
    const weekStart = getWeekStart();
    const dueDate = cleanText(payload.dueDate, 10);
    if (!title) return Response.json({ error: "Napíšte názov úlohy." }, { status: 400 });
    if (!Number.isInteger(points) || points < 1 || points > 5) {
      return Response.json({ error: "Úloha môže mať 1 až 5 bodov." }, { status: 400 });
    }
    if (dueDate < weekStart || dueDate > addDays(weekStart, 6)) {
      return Response.json({ error: "Termín musí byť v aktuálnom týždni." }, { status: 400 });
    }
    const alex = await getD1().prepare("SELECT id FROM users WHERE role = 'alex'").first<{ id: number }>();
    if (!alex) return Response.json({ error: "Alexov účet sa nenašiel." }, { status: 500 });
    const recurringKey = payload.recurring ? normalizeRecurringKey(title) : null;
    const result = await getD1()
      .prepare(
        `INSERT INTO tasks
          (title, description, points, creator_id, assignee_id, week_start, due_date, proof_required, recurring_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        title,
        description,
        points,
        parent.id,
        alex.id,
        weekStart,
        dueDate,
        payload.proofRequired ? 1 : 0,
        recurringKey,
      )
      .run();
    return Response.json({ id: result.meta.last_row_id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const alex = await requireSession(request, ["alex"]);
    const form = await request.formData();
    const taskId = Number(form.get("taskId"));
    const note = cleanText(form.get("note"), 500);
    const task = await getD1()
      .prepare("SELECT id, assignee_id, status, proof_required, proof_key FROM tasks WHERE id = ?")
      .bind(taskId)
      .first<{ id: number; assignee_id: number; status: string; proof_required: number; proof_key: string | null }>();
    if (!task || task.assignee_id !== alex.id) return Response.json({ error: "Úloha sa nenašla." }, { status: 404 });
    if (!['open', 'rejected'].includes(task.status)) {
      return Response.json({ error: "Táto úloha už čaká na kontrolu alebo je schválená." }, { status: 409 });
    }

    const fileValue = form.get("proof");
    const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
    if (task.proof_required && !file && !task.proof_key) {
      return Response.json({ error: "Pri tejto úlohe je potrebná fotografia." }, { status: 400 });
    }
    if (file && (!allowedImageTypes.has(file.type) || file.size > 8 * 1024 * 1024)) {
      return Response.json({ error: "Použite fotografiu JPG, PNG, WebP alebo HEIC do 8 MB." }, { status: 400 });
    }

    let proofKey = task.proof_key;
    if (file) {
      proofKey = `proofs/${task.id}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
      await getUploads().put(proofKey, file.stream(), {
        httpMetadata: { contentType: file.type },
        customMetadata: { taskId: String(task.id), uploadedBy: String(alex.id) },
      });
      if (task.proof_key && task.proof_key !== proofKey) await getUploads().delete(task.proof_key);
    }

    await getD1()
      .prepare(
        `UPDATE tasks SET status = 'submitted', proof_key = ?, completion_note = ?,
          reviewer_comment = '', submitted_at = CURRENT_TIMESTAMP, reviewed_at = NULL
         WHERE id = ?`,
      )
      .bind(proofKey, note, task.id)
      .run();
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const parent = await requireSession(request, ["parent_mama", "parent_otec"]);
    const payload = (await request.json()) as { taskId?: number; action?: string; comment?: string };
    const task = await getD1()
      .prepare("SELECT id, creator_id, status FROM tasks WHERE id = ?")
      .bind(payload.taskId)
      .first<{ id: number; creator_id: number; status: string }>();
    if (!task || task.creator_id !== parent.id) {
      return Response.json({ error: "Úlohu môže skontrolovať iba rodič, ktorý ju zadal." }, { status: 403 });
    }
    if (task.status !== "submitted") {
      return Response.json({ error: "Úloha momentálne nečaká na kontrolu." }, { status: 409 });
    }
    const comment = cleanText(payload.comment, 400);
    if (payload.action === "approve") {
      const db = getD1();
      await db.batch([
        db
          .prepare("UPDATE tasks SET status = 'approved', reviewer_comment = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(comment, task.id),
        db
          .prepare("UPDATE money_requests SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE condition_task_id = ? AND status = 'conditioned'")
          .bind(task.id),
      ]);
      return Response.json({ ok: true });
    }
    if (payload.action === "reject") {
      if (!comment) return Response.json({ error: "Napíšte, čo má Alex doplniť." }, { status: 400 });
      await getD1()
        .prepare("UPDATE tasks SET status = 'rejected', reviewer_comment = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(comment, task.id)
        .run();
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Neznáma akcia." }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}
