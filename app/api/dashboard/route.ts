import {
  addDays,
  ensureSchema,
  getD1,
  getSessionUser,
  getWeekStart,
  jsonError,
} from "@/db/runtime";

type FamilyMember = { id: number; role: string; name: string; color: string };
type TaskRow = {
  id: number;
  title: string;
  description: string;
  points: number;
  creator_id: number;
  assignee_id: number;
  week_start: string;
  due_date: string;
  proof_required: number;
  recurring_key: string | null;
  status: string;
  proof_key: string | null;
  completion_note: string;
  reviewer_comment: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  creator_name: string;
  creator_color: string;
};

const badgeCatalog = [
  { key: "first_quest", title: "Prvá misia", description: "Prvá úloha je úspešne schválená.", icon: "⚡" },
  { key: "ten_points", title: "Motor naštartovaný", description: "Získaných prvých 10 bodov.", icon: "🔑" },
  { key: "photo_pro", title: "Foto profík", description: "Tri úlohy potvrdené fotografiou.", icon: "📸" },
  { key: "full_tank", title: "Plná nádrž", description: "Cieľ 10 + 10 bodov splnený.", icon: "⛽" },
  { key: "perfect_week", title: "Bezchybný týždeň", description: "Všetky úlohy boli splnené a schválené.", icon: "💎" },
  { key: "three_week_streak", title: "Nezastaviteľný", description: "Yaris odomknutý tri týždne za sebou.", icon: "🔥" },
  { key: "routine_master", title: "Rutinný hrdina", description: "Rovnaká opakovaná úloha tri týždne po sebe.", icon: "🛡️" },
];

function weekSeries(currentWeek: string, count: number) {
  return Array.from({ length: count }, (_, index) => addDays(currentWeek, -7 * index));
}

function hasThreeConsecutiveWeeks(weeks: string[]) {
  const unique = [...new Set(weeks)].sort();
  let streak = 1;
  for (let index = 1; index < unique.length; index += 1) {
    streak = unique[index] === addDays(unique[index - 1], 7) ? streak + 1 : 1;
    if (streak >= 3) return true;
  }
  return false;
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "Najprv sa prihláste." }, { status: 401 });

    const db = getD1();
    const currentWeek = getWeekStart();
    const weeks = weekSeries(currentWeek, 6);
    const oldestWeek = weeks.at(-1)!;
    const nextWeek = addDays(currentWeek, 7);

    const [familyResult, tasksResult, requestsResult, totals] = await Promise.all([
      db.prepare("SELECT id, role, name, color FROM users ORDER BY CASE role WHEN 'alex' THEN 1 WHEN 'parent_mama' THEN 2 ELSE 3 END").all<FamilyMember>(),
      db
        .prepare(
          `SELECT t.*, u.name AS creator_name, u.color AS creator_color
           FROM tasks t JOIN users u ON u.id = t.creator_id
           WHERE t.week_start >= ?
           ORDER BY t.week_start DESC, t.due_date ASC, t.created_at DESC`,
        )
        .bind(oldestWeek)
        .all<TaskRow>(),
      db
        .prepare(
          `SELECT r.*, p.name AS parent_name, t.title AS condition_title, t.status AS condition_status
           FROM money_requests r
           LEFT JOIN users p ON p.id = r.parent_id
           LEFT JOIN tasks t ON t.id = r.condition_task_id
           ORDER BY CASE r.status WHEN 'pending' THEN 1 WHEN 'conditioned' THEN 2 WHEN 'ready' THEN 3 ELSE 4 END,
                    r.created_at DESC`,
        )
        .all(),
      db
        .prepare(
          `SELECT COUNT(*) AS approved_count,
                  COALESCE(SUM(points), 0) AS total_points,
                  COALESCE(SUM(CASE WHEN proof_key IS NOT NULL THEN 1 ELSE 0 END), 0) AS photo_count
           FROM tasks WHERE status = 'approved'`,
        )
        .first<{ approved_count: number; total_points: number; photo_count: number }>(),
    ]);

    const family = familyResult.results as unknown as FamilyMember[];
    const tasks = tasksResult.results as unknown as TaskRow[];
    const alex = family.find((member) => member.role === "alex");
    const parents = family.filter((member) => member.role.startsWith("parent_"));
    if (!alex || parents.length !== 2) {
      return Response.json({ error: "Rodinné účty nie sú správne nastavené." }, { status: 500 });
    }

    const history = weeks.map((week) => {
      const weekTasks = tasks.filter((task) => task.week_start === week);
      const points = Object.fromEntries(
        parents.map((parent) => [
          parent.id,
          weekTasks
            .filter((task) => task.creator_id === parent.id && task.status === "approved")
            .reduce((sum, task) => sum + task.points, 0),
        ]),
      );
      const earned = parents.every((parent) => Math.min(points[parent.id] ?? 0, 10) >= 10);
      const perfect =
        earned && weekTasks.length > 0 && weekTasks.every((task) => task.status === "approved");
      return {
        week,
        points,
        earned,
        perfect,
        approvedCount: weekTasks.filter((task) => task.status === "approved").length,
        taskCount: weekTasks.length,
      };
    });

    const currentProgress = parents.map((parent) => ({
      id: parent.id,
      name: parent.name,
      color: parent.color,
      points: history[0].points[parent.id] ?? 0,
      goal: 10,
    }));
    const cappedTotal = currentProgress.reduce((sum, parent) => sum + Math.min(parent.points, 10), 0);
    const percent = Math.round((cappedTotal / 20) * 100);

    if (history[0].earned) {
      await db
        .prepare("INSERT OR IGNORE INTO rewards (earned_from_week, reward_week, status) VALUES (?, ?, 'unlocked')")
        .bind(currentWeek, nextWeek)
        .run();
    }

    const approvedTasks = tasks.filter((task) => task.status === "approved");
    const totalPoints = totals?.total_points ?? 0;
    const photoCount = totals?.photo_count ?? 0;
    const earnedPastWeeks = history.slice(1).filter((item) => item.earned);
    const threeWeekStreak = history.slice(0, 3).length === 3 && history.slice(0, 3).every((item) => item.earned);
    const routineGroups = new Map<string, TaskRow[]>();
    approvedTasks
      .filter((task) => task.recurring_key)
      .forEach((task) => routineGroups.set(task.recurring_key!, [...(routineGroups.get(task.recurring_key!) ?? []), task]));
    const routineWinner = [...routineGroups.values()].find((items) => hasThreeConsecutiveWeeks(items.map((item) => item.week_start)));

    const candidates = [
      approvedTasks.length >= 1 && badgeCatalog[0],
      totalPoints >= 10 && badgeCatalog[1],
      photoCount >= 3 && badgeCatalog[2],
      history.some((item) => item.earned) && badgeCatalog[3],
      history.slice(1).some((item) => item.perfect) && badgeCatalog[4],
      threeWeekStreak && badgeCatalog[5],
      routineWinner && {
        ...badgeCatalog[6],
        description: `Tri týždne po sebe splnené: ${routineWinner[0].title}.`,
      },
    ].filter(Boolean) as typeof badgeCatalog;

    if (candidates.length) {
      await db.batch(
        candidates.map((badge) =>
          db
            .prepare("INSERT OR IGNORE INTO achievements (user_id, badge_key, title, description, icon) VALUES (?, ?, ?, ?, ?)")
            .bind(alex.id, badge.key, badge.title, badge.description, badge.icon),
        ),
      );
    }

    const [achievementResult, rewardResult] = await Promise.all([
      db.prepare("SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC").bind(alex.id).all(),
      db.prepare("SELECT * FROM rewards WHERE reward_week IN (?, ?) ORDER BY reward_week").bind(currentWeek, nextWeek).all(),
    ]);
    const unlocked = achievementResult.results as Array<Record<string, unknown>>;
    const badges = badgeCatalog.map((badge) => {
      const match = unlocked.find((item) => item.badge_key === badge.key);
      return match ? { ...badge, ...match, unlocked: true } : { ...badge, unlocked: false };
    });

    return Response.json({
      user,
      family,
      week: { start: currentWeek, end: addDays(currentWeek, 6), nextStart: nextWeek },
      progress: { parents: currentProgress, percent, earned: history[0].earned },
      tasks: tasks.filter((task) => task.week_start === currentWeek),
      requests: requestsResult.results,
      badges,
      rewards: rewardResult.results,
      history,
      stats: { totalPoints, approvedTasks: totals?.approved_count ?? 0, earnedPastWeeks: earnedPastWeeks.length },
    });
  } catch (error) {
    return jsonError(error);
  }
}
