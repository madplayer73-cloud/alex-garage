"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";

type FamilyMember = { id: number; role: string; name: string; color: string };
type Task = {
  id: number;
  title: string;
  description: string;
  points: number;
  creator_id: number;
  creator_name: string;
  creator_color: string;
  due_date: string;
  proof_required: number;
  recurring_key: string | null;
  status: "open" | "submitted" | "approved" | "rejected";
  proof_key: string | null;
  completion_note: string;
  reviewer_comment: string;
};
type MoneyRequest = {
  id: number;
  amount_cents: number;
  purpose: string;
  note: string;
  status: "pending" | "conditioned" | "ready" | "paid" | "declined";
  parent_id: number | null;
  parent_name: string | null;
  condition_title: string | null;
  condition_status: string | null;
};
type Badge = {
  key: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlocked_at?: string;
};
type Reward = { reward_week: string; status: "unlocked" | "used"; used_at: string | null };
type Dashboard = {
  user: FamilyMember;
  family: FamilyMember[];
  week: { start: string; end: string; nextStart: string };
  progress: {
    parents: Array<{ id: number; name: string; color: string; points: number; goal: number }>;
    percent: number;
    earned: boolean;
  };
  tasks: Task[];
  requests: MoneyRequest[];
  badges: Badge[];
  rewards: Reward[];
  history: Array<{
    week: string;
    points: Record<string, number>;
    earned: boolean;
    perfect: boolean;
    approvedCount: number;
    taskCount: number;
  }>;
  stats: { totalPoints: number; approvedTasks: number; earnedPastWeeks: number };
};
type Screen = "loading" | "setup" | "login" | "app";
type Tab = "home" | "tasks" | "badges" | "money";
type ModalState =
  | null
  | { type: "menu" }
  | { type: "new-task" }
  | { type: "submit-task"; task: Task }
  | { type: "review-task"; task: Task }
  | { type: "new-request" }
  | { type: "condition"; request: MoneyRequest };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Niečo sa nepodarilo.");
  return data;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("sk-SK", { day: "numeric", month: "short" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function money(cents: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function todayForWeek(end: string) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Bratislava" });
  return today <= end ? today : end;
}

export function FamilyApp() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [users, setUsers] = useState<FamilyMember[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const loadStatus = useCallback(async () => {
    const status = await api<{ configured: boolean; users: FamilyMember[] }>("/api/status");
    setUsers(status.users);
    return status;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api<Dashboard>("/api/dashboard");
      setDashboard(data);
      setScreen("app");
      return data;
    } catch (requestError) {
      if (requestError instanceof Error && requestError.message === "Najprv sa prihláste.") {
        setDashboard(null);
        setScreen("login");
        return null;
      }
      throw requestError;
    }
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("alexGarageTheme") === "dark" ? "dark" : "light";
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;
    void (async () => {
      try {
        const status = await loadStatus();
        if (!status.configured) setScreen("setup");
        else await refresh();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Aplikáciu sa nepodarilo načítať.");
        setScreen("login");
      }
    })();
  }, [loadStatus, refresh]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("alexGarageTheme", next);
  }

  function downloadBackup() {
    window.location.href = "/api/backup";
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      setModal(null);
      await refresh();
      setMessage(success);
      window.setTimeout(() => setMessage(""), 3200);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Akcia sa nepodarila.");
    } finally {
      setBusy(false);
    }
  }

  if (screen === "loading") return <LoadingScreen />;
  if (screen === "setup") {
    return (
      <SetupScreen
        busy={busy}
        error={error}
        onSubmit={async (form) => {
          setBusy(true);
          setError("");
          try {
            await api("/api/setup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(form),
            });
            await loadStatus();
            setScreen("login");
          } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Nastavenie sa nepodarilo.");
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }
  if (screen === "login" || !dashboard) {
    return (
      <LoginScreen
        users={users}
        busy={busy}
        error={error}
        onLogin={async (userId, pin) => {
          setBusy(true);
          setError("");
          try {
            await api("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, pin }),
            });
            await refresh();
          } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Prihlásenie sa nepodarilo.");
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }

  const isAlex = dashboard.user.role === "alex";
  const currentReward = dashboard.rewards.find((reward) => reward.reward_week === dashboard.week.start);

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="hamburger-button" onClick={() => setModal({ type: "menu" })} aria-label="Menu">
          <span /><span /><span />
        </button>
        <button className="brand" onClick={() => setTab("home")} aria-label="Domov">
          <span className="brand-mark">A</span>
          <span><strong>ALEX GARAGE</strong><small>Rodinné misie</small></span>
        </button>
        <span className="beta-pill">BETA V0</span>
        <button
          className="profile-chip"
          onClick={async () => {
            await api("/api/auth/logout", { method: "POST" });
            await loadStatus();
            setScreen("login");
          }}
          title="Odhlásiť sa"
        >
          <span style={{ background: dashboard.user.color }}>{dashboard.user.name.slice(0, 1).toUpperCase()}</span>
          <span>{dashboard.user.name}<small>{isAlex ? "Jazdec" : "Rodič"}</small></span>
          <b>↪</b>
        </button>
      </header>

      <div className="content-wrap">
        {tab === "home" && (
          <HomeTab
            data={dashboard}
            isAlex={isAlex}
            currentReward={currentReward}
            onNewTask={() => setModal({ type: "new-task" })}
            onTask={(task) => setModal({ type: isAlex ? "submit-task" : "review-task", task })}
            onUseReward={() =>
              void run(
                () => api("/api/rewards", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rewardWeek: dashboard.week.start }) }),
                "Jazda na Yarise je označená ako využitá.",
              )
            }
          />
        )}
        {tab === "tasks" && (
          <TasksTab
            data={dashboard}
            isAlex={isAlex}
            onNew={() => setModal({ type: "new-task" })}
            onTask={(task) => setModal({ type: isAlex ? "submit-task" : "review-task", task })}
          />
        )}
        {tab === "badges" && <BadgesTab data={dashboard} />}
        {tab === "money" && (
          <MoneyTab
            data={dashboard}
            isAlex={isAlex}
            busy={busy}
            onNew={() => setModal({ type: "new-request" })}
            onCondition={(item) => setModal({ type: "condition", request: item })}
            onAction={(item, action) =>
              void run(
                () => api("/api/requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: item.id, action }) }),
                action === "paid" ? "Vyplatenie je potvrdené." : action === "decline" ? "Požiadavka bola zamietnutá." : "Požiadavka je schválená.",
              )
            }
          />
        )}
      </div>

      <nav className="bottom-nav" aria-label="Hlavná navigácia">
        {([
          ["home", "⌂", "Garáž"],
          ["tasks", "✓", "Misie"],
          ["badges", "★", "Odznaky"],
          ["money", "€", "Požiadavky"],
        ] as const).map(([key, icon, label]) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            <span>{icon}</span>{label}
            {key === "tasks" && dashboard.tasks.some((task) => task.status === (isAlex ? "open" : "submitted")) && <i />}
          </button>
        ))}
      </nav>

      {message && <div className="toast success">✓ {message}</div>}
      {error && screen === "app" && <div className="toast error">{error}<button onClick={() => setError("")}>×</button></div>}

      {modal?.type === "menu" && (
        <Modal title="Menu" subtitle="Rýchle nastavenia testovacej verzie" onClose={() => setModal(null)}>
          <div className="menu-panel">
            <button className="menu-row" onClick={toggleTheme}>
              <span>{theme === "dark" ? "☀" : "☾"}</span>
              <div><b>{theme === "dark" ? "Light režim" : "Dark režim"}</b><small>Prepne vzhľad aplikácie na tomto zariadení.</small></div>
            </button>
            {!isAlex && (
              <button className="menu-row" onClick={downloadBackup}>
                <span>☁</span>
                <div><b>Stiahnuť testovaciu zálohu</b><small>JSON export úloh, bodov, odznakov a požiadaviek.</small></div>
              </button>
            )}
            <div className="beta-note"><b>BETA verzia V0</b><small>Testujeme pravidlá, fotky a odmeny. Ostrú cloud zálohu napojíme po výbere služby.</small></div>
          </div>
        </Modal>
      )}

      {modal?.type === "new-task" && (
        <Modal title="Nová misia" subtitle="Zadajte Alexovi jasnú úlohu" onClose={() => setModal(null)}>
          <TaskForm weekEnd={dashboard.week.end} busy={busy} onSubmit={(body) => void run(() => api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), "Nová misia je zadaná.")} />
        </Modal>
      )}
      {modal?.type === "submit-task" && (
        <Modal title="Misia splnená?" subtitle={modal.task.title} onClose={() => setModal(null)}>
          <SubmitTaskForm task={modal.task} busy={busy} onSubmit={(form) => void run(() => api("/api/tasks", { method: "PUT", body: form }), "Splnenie čaká na kontrolu rodiča.")} />
        </Modal>
      )}
      {modal?.type === "review-task" && (
        <Modal title="Kontrola misie" subtitle={modal.task.title} onClose={() => setModal(null)}>
          <ReviewTask task={modal.task} canReview={modal.task.creator_id === dashboard.user.id} busy={busy} onAction={(action, comment) => void run(() => api("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: modal.task.id, action, comment }) }), action === "approve" ? `Schválené! Alex získal ${modal.task.points} b.` : "Misia bola vrátená na doplnenie.")} />
        </Modal>
      )}
      {modal?.type === "new-request" && (
        <Modal title="Nová požiadavka" subtitle="Napíš rodičom, čo potrebuješ" onClose={() => setModal(null)}>
          <RequestForm busy={busy} onSubmit={(body) => void run(() => api("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), "Požiadavka bola odoslaná rodičom.")} />
        </Modal>
      )}
      {modal?.type === "condition" && (
        <Modal title="Dohodnúť podmienku" subtitle={`${money(modal.request.amount_cents)} · ${modal.request.purpose}`} onClose={() => setModal(null)}>
          <ConditionForm weekEnd={dashboard.week.end} busy={busy} onSubmit={(body) => void run(() => api("/api/requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, requestId: modal.request.id, action: "condition" }) }), "Podmienka bola pridaná medzi misie.")} />
        </Modal>
      )}
    </main>
  );
}

function LoadingScreen() {
  return <main className="center-screen"><div className="loader-logo">A</div><p>Otváram garáž…</p></main>;
}

function SetupScreen({ busy, error, onSubmit }: { busy: boolean; error: string; onSubmit: (value: { alex: { name: string; pin: string }; mama: { name: string; pin: string }; otec: { name: string; pin: string } }) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      alex: { name: String(form.get("alexName")), pin: String(form.get("alexPin")) },
      mama: { name: String(form.get("mamaName")), pin: String(form.get("mamaPin")) },
      otec: { name: String(form.get("otecName")), pin: String(form.get("otecPin")) },
    });
  }
  return (
    <main className="auth-page">
      <section className="auth-intro"><span className="eyebrow">PRVÉ SPUSTENIE</span><h1>Vitajte v<br /><em>Alex Garage</em></h1><p>Tri súkromné účty. Jedna rodinná hra. Dáta aj fotografie zostávajú u vás doma.</p><div className="mini-road"><span>🏠</span><i /><b>🚗</b></div></section>
      <section className="auth-card setup-card">
        <div><span className="step">1 / 1</span><h2>Nastavte rodinu</h2><p>Každý dostane vlastný číselný PIN.</p></div>
        <form onSubmit={submit}>
          <PersonFields label="Alex" color="#f8c24d" nameKey="alex" defaultName="Alex" />
          <PersonFields label="Mama" color="#dc5f78" nameKey="mama" defaultName="Mama" />
          <PersonFields label="Otec" color="#4f78d6" nameKey="otec" defaultName="Otec" />
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? "Nastavujem…" : "Odomknúť garáž →"}</button>
          <small className="privacy-note">🔒 PIN sa ukladá zabezpečene, nie ako čitateľné číslo.</small>
        </form>
      </section>
    </main>
  );
}

function PersonFields({ label, color, nameKey, defaultName }: { label: string; color: string; nameKey: string; defaultName: string }) {
  return <fieldset className="person-fields"><legend><i style={{ background: color }} />{label}</legend><label>Meno<input name={`${nameKey}Name`} defaultValue={defaultName} maxLength={40} required /></label><label>PIN<input name={`${nameKey}Pin`} type="password" inputMode="numeric" pattern="[0-9]{4,8}" placeholder="4–8 číslic" autoComplete="new-password" required /></label></fieldset>;
}

function LoginScreen({ users, busy, error, onLogin }: { users: FamilyMember[]; busy: boolean; error: string; onLogin: (userId: number, pin: string) => void }) {
  const [selected, setSelected] = useState(users[0]?.id ?? 0);
  const [pin, setPin] = useState("");
  useEffect(() => { if (!selected && users[0]) setSelected(users[0].id); }, [selected, users]);
  return (
    <main className="login-page">
      <section className="login-visual"><span className="brand-mark large">A</span><span className="eyebrow">RODINNÁ VÝZVA</span><h1>Každá misia<br />ťa posúva <em>bližšie.</em></h1><CarProgress percent={72} muted /><div className="demo-progress"><span>14 / 20 BODOV</span><i><b /></i></div></section>
      <section className="login-card"><div><span className="eyebrow dark">VSTUP DO GARÁŽE</span><h2>Kto práve hrá?</h2><p>Vyber svoj profil a zadaj PIN.</p></div><div className="user-grid">{users.map((user) => <button key={user.id} type="button" className={selected === user.id ? "selected" : ""} onClick={() => { setSelected(user.id); setPin(""); }}><span style={{ background: user.color }}>{user.name.slice(0, 1).toUpperCase()}</span><strong>{user.name}</strong><small>{user.role === "alex" ? "Jazdec" : "Rodič"}</small></button>)}</div><form onSubmit={(event) => { event.preventDefault(); onLogin(selected, pin); }}><label className="pin-label">Tvoj PIN<input autoFocus type="password" inputMode="numeric" pattern="[0-9]{4,8}" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="••••" required /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={busy || !selected}>{busy ? "Otváram…" : "Vstúpiť do garáže →"}</button></form></section>
    </main>
  );
}

function HomeTab({ data, isAlex, currentReward, onNewTask, onTask, onUseReward }: { data: Dashboard; isAlex: boolean; currentReward?: Reward; onNewTask: () => void; onTask: (task: Task) => void; onUseReward: () => void }) {
  const attention = data.tasks.filter((task) => isAlex ? task.status === "open" || task.status === "rejected" : task.creator_id === data.user.id && task.status === "submitted");
  const unlockedCount = data.badges.filter((badge) => badge.unlocked).length;
  return <>
    <section className="hero-card">
      <div className="hero-copy"><span className="eyebrow light">TÝŽDEŇ {displayDate(data.week.start).toUpperCase()} — {displayDate(data.week.end).toUpperCase()}</span><h1>{data.progress.earned ? "Yaris je tvoj!" : <>Cesta k <em>Yarisu</em></>}</h1><p>{data.progress.earned ? "Budúci týždeň máš nárok na jazdu. Skvelá práca!" : `Nazbieraj ešte ${Math.max(0, 20 - data.progress.parents.reduce((sum, parent) => sum + Math.min(parent.points, 10), 0))} bodov a odomkneš si auto na budúci týždeň.`}</p></div>
      <div className="car-zone"><CarProgress percent={data.progress.percent} /><span className="percent-badge">{data.progress.percent}%<small>VYPLNENÉ</small></span></div>
      <div className="parent-progress">{data.progress.parents.map((parent) => <div key={parent.id}><div><span><i style={{ background: parent.color }} />{parent.name}</span><b>{parent.points} / 10 b.</b></div><progress max={10} value={Math.min(parent.points, 10)} style={{ accentColor: parent.color }} /></div>)}</div>
      <div className={`unlock-strip ${data.progress.earned ? "won" : ""}`}><span>{data.progress.earned ? "🔓" : "🔒"}</span><div><b>{data.progress.earned ? "ODOMKNUTÉ NA BUDÚCI TÝŽDEŇ" : "ODMENA: ČERVENÝ YARIS"}</b><small>{data.progress.earned ? `Týždeň od ${displayDate(data.week.nextStart)}` : "10 bodov od každého rodiča"}</small></div></div>
    </section>
    {currentReward && <section className={`reward-banner ${currentReward.status}`}><span>{currentReward.status === "used" ? "✓" : "🚗"}</span><div><b>{currentReward.status === "used" ? "Jazda využitá" : "Tento týždeň máš Yaris"}</b><small>{currentReward.status === "used" ? "Odmena je zapísaná v histórii." : "Minulotýždňová výzva bola splnená."}</small></div>{!isAlex && currentReward.status === "unlocked" && <button onClick={onUseReward}>Označiť ako využité</button>}</section>}
    <section className="section-head"><div><span className="eyebrow dark">TERAZ</span><h2>{isAlex ? "Tvoje najbližšie misie" : "Čaká na tvoju kontrolu"}</h2></div>{!isAlex && <button className="small-action" onClick={onNewTask}>＋ Nová misia</button>}</section>
    {attention.length ? <div className="task-grid">{attention.slice(0, 4).map((task) => <TaskCard key={task.id} task={task} user={data.user} isAlex={isAlex} onClick={() => onTask(task)} />)}</div> : <EmptyState icon={isAlex ? "🏁" : "👍"} title={isAlex ? "Všetko je vybavené" : "Nič nečaká na kontrolu"} text={isAlex ? "Nové misie sa tu objavia, keď ich rodičia zadajú." : "Keď Alex odošle splnenie, nájdete ho práve tu."} />}
    <section className="stats-row"><article><span>✓</span><b>{data.stats.approvedTasks}</b><small>splnených misií</small></article><article><span>⚡</span><b>{data.stats.totalPoints}</b><small>bodov celkovo</small></article><article><span>★</span><b>{unlockedCount}</b><small>odznakov</small></article><article><span>🚗</span><b>{data.history.filter((week) => week.earned).length}</b><small>odomknutí Yarisu</small></article></section>
  </>;
}

function TasksTab({ data, isAlex, onNew, onTask }: { data: Dashboard; isAlex: boolean; onNew: () => void; onTask: (task: Task) => void }) {
  const [filter, setFilter] = useState("all");
  const visible = data.tasks.filter((task) => filter === "all" || task.status === filter);
  return <section className="page-section"><div className="page-title"><div><span className="eyebrow dark">TÝŽDENNÝ PLÁN</span><h1>Misie</h1><p>{displayDate(data.week.start)} – {displayDate(data.week.end)} · {data.tasks.length} úloh</p></div>{!isAlex && <button className="primary-button compact" onClick={onNew}>＋ Nová misia</button>}</div><div className="filter-row">{[["all", "Všetky"], ["open", "Čakajú"], ["submitted", "Na kontrolu"], ["approved", "Schválené"]].map(([key, label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}<span>{key === "all" ? data.tasks.length : data.tasks.filter((task) => task.status === key).length}</span></button>)}</div>{visible.length ? <div className="task-list">{visible.map((task) => <TaskCard key={task.id} task={task} user={data.user} isAlex={isAlex} onClick={() => onTask(task)} wide />)}</div> : <EmptyState icon="🗺️" title="Žiadne misie v tejto kategórii" text="Skúste iný filter alebo vytvorte novú misiu." />}</section>;
}

function TaskCard({ task, user, isAlex, onClick, wide = false }: { task: Task; user: FamilyMember; isAlex: boolean; onClick: () => void; wide?: boolean }) {
  const actionable = isAlex ? ["open", "rejected"].includes(task.status) : task.creator_id === user.id && task.status === "submitted";
  const labels = { open: "Čaká", submitted: "Na kontrolu", approved: "Schválené", rejected: "Doplniť" };
  return <article className={`task-card ${wide ? "wide" : ""} status-${task.status}`}><div className="task-top"><span className="status-pill">{labels[task.status]}</span><span className="points">+{task.points} b.</span></div><h3>{task.title}</h3>{task.description && <p>{task.description}</p>}<div className="task-meta"><span><i style={{ background: task.creator_color }}>{task.creator_name.slice(0, 1)}</i>{task.creator_name}</span><span>◷ {displayDate(task.due_date)}</span>{task.proof_required ? <span>📷 Foto</span> : null}{task.recurring_key ? <span>↻ Séria</span> : null}</div>{task.status === "rejected" && task.reviewer_comment && <div className="review-note">↩ {task.reviewer_comment}</div>}{actionable && <button className="card-action" onClick={onClick}>{isAlex ? "Označiť ako splnené →" : "Skontrolovať dôkaz →"}</button>}{!actionable && task.status === "submitted" && !isAlex && <small className="waiting-note">Čaká na kontrolu od {task.creator_name}</small>}</article>;
}

function BadgesTab({ data }: { data: Dashboard }) {
  const unlocked = data.badges.filter((badge) => badge.unlocked).length;
  return <section className="page-section"><div className="page-title"><div><span className="eyebrow dark">ALEXOVE TROFEJE</span><h1>Odznaky</h1><p>{unlocked} z {data.badges.length} odomknutých</p></div><div className="level-ring"><b>{unlocked}</b><span>LEVEL</span></div></div><div className="badge-progress"><div><span>Postup zbierky</span><b>{Math.round((unlocked / data.badges.length) * 100)}%</b></div><progress max={data.badges.length} value={unlocked} /></div><div className="badge-grid">{data.badges.map((badge) => <article key={badge.key} className={badge.unlocked ? "unlocked" : "locked"}><span className="badge-icon">{badge.unlocked ? badge.icon : "?"}</span><div><small>{badge.unlocked ? "ODOMKNUTÉ" : "ZAMKNUTÉ"}</small><h3>{badge.title}</h3><p>{badge.description}</p></div>{badge.unlocked && <i>✓</i>}</article>)}</div><section className="history-card"><span className="eyebrow dark">POSLEDNÉ TÝŽDNE</span><h2>Jazdná séria</h2><div className="week-dots">{data.history.slice(0, 5).reverse().map((week) => <div key={week.week} className={week.earned ? "earned" : week.week === data.week.start ? "current" : ""}><span>{week.earned ? "🚗" : "·"}</span><small>{displayDate(week.week)}</small></div>)}</div></section></section>;
}

function MoneyTab({ data, isAlex, busy, onNew, onCondition, onAction }: { data: Dashboard; isAlex: boolean; busy: boolean; onNew: () => void; onCondition: (item: MoneyRequest) => void; onAction: (item: MoneyRequest, action: string) => void }) {
  const statusLabel: Record<string, string> = { pending: "Čaká na rodiča", conditioned: "Plní sa podmienka", ready: "Pripravené na vyplatenie", paid: "Vyplatené", declined: "Zamietnuté" };
  return <section className="page-section"><div className="page-title"><div><span className="eyebrow dark">DOHODY</span><h1>Požiadavky</h1><p>Peniaze s jasnou dohodou a splnenou misiou.</p></div>{isAlex && <button className="primary-button compact" onClick={onNew}>＋ Nová požiadavka</button>}</div><div className="request-guide"><span>💡</span><p><b>Ako to funguje?</b> Alex napíše, čo potrebuje. Rodič môže požiadavku schváliť alebo k nej pridať misiu. Po jej potvrdení je suma pripravená na vyplatenie.</p></div>{data.requests.length ? <div className="request-list">{data.requests.map((item) => <article key={item.id} className={`request-card ${item.status}`}><div className="request-amount">{money(item.amount_cents)}</div><div className="request-main"><span className="request-status">{statusLabel[item.status]}</span><h3>{item.purpose}</h3>{item.note && <p>{item.note}</p>}{item.condition_title && <div className="condition-link"><span>{item.condition_status === "approved" ? "✓" : "⚡"}</span><div><small>PODMIENKA OD {item.parent_name}</small><b>{item.condition_title}</b></div></div>}</div>{!isAlex && item.status === "pending" && <div className="request-actions"><button onClick={() => onCondition(item)}>Pridať misiu</button><button onClick={() => onAction(item, "approve_direct")}>Schváliť bez podmienky</button><button className="text-danger" onClick={() => onAction(item, "decline")}>Zamietnuť</button></div>}{!isAlex && item.status === "ready" && item.parent_id === data.user.id && <button className="paid-button" disabled={busy} onClick={() => onAction(item, "paid")}>€ Potvrdiť vyplatenie</button>}</article>)}</div> : <EmptyState icon="€" title="Zatiaľ bez požiadaviek" text={isAlex ? "Keď budeš niečo potrebovať, pošli rodičom férovú požiadavku." : "Alexove požiadavky sa zobrazia tu."} />}</section>;
}

function CarProgress({ percent, muted = false }: { percent: number; muted?: boolean }) {
  const value = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={`car-illustration ${muted ? "muted" : ""}`}
      style={{ "--car-progress": `${value}%` } as React.CSSProperties}
    >
      <div className="car-glow" />
      <img className="car-image car-image-base" src="/alex-yaris.png" alt="" aria-hidden="true" />
      <div className="car-image-fill" aria-hidden="true">
        <img className="car-image" src="/alex-yaris.png" alt="" />
      </div>
      <span className="road-shadow" />
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header><div><span className="eyebrow dark">ALEX GARAGE</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button onClick={onClose} aria-label="Zavrieť">×</button></header>{children}</section></div>;
}

function TaskForm({ weekEnd, busy, onSubmit }: { weekEnd: string; busy: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  return <form className="modal-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSubmit({ title: form.get("title"), description: form.get("description"), points: Number(form.get("points")), dueDate: form.get("dueDate"), proofRequired: form.get("proofRequired") === "on", recurring: form.get("recurring") === "on" }); }}><label>Názov misie<input name="title" placeholder="Napr. Vynes smeti" maxLength={120} autoFocus required /></label><label>Krátky popis<textarea name="description" placeholder="Čo presne treba urobiť?" maxLength={500} rows={3} /></label><div className="form-row"><label>Hodnota<select name="points" defaultValue="1"><option value="1">1 bod</option><option value="2">2 body</option><option value="3">3 body</option><option value="4">4 body</option><option value="5">5 bodov</option></select></label><label>Termín<input name="dueDate" type="date" defaultValue={todayForWeek(weekEnd)} max={weekEnd} required /></label></div><label className="check-row"><input name="proofRequired" type="checkbox" /><span>📷</span><div><b>Vyžadovať fotografiu</b><small>Alex musí pridať foto ako dôkaz.</small></div></label><label className="check-row"><input name="recurring" type="checkbox" /><span>↻</span><div><b>Opakovaná misia</b><small>Počíta sa do série, napr. smeti tri týždne za sebou.</small></div></label><button className="primary-button" disabled={busy}>{busy ? "Ukladám…" : "Zadať misiu →"}</button></form>;
}

function SubmitTaskForm({ task, busy, onSubmit }: { task: Task; busy: boolean; onSubmit: (form: FormData) => void }) {
  const [proof, setProof] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function setSelectedProof(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setProof(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
  }

  return (
    <form
      className="modal-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        form.delete("proofCamera");
        form.delete("proofGallery");
        if (proof) form.append("proof", proof, proof.name || `dokaz-${task.id}.jpg`);
        onSubmit(form);
      }}
    >
      <input type="hidden" name="taskId" value={task.id} />
      <div className="mission-value"><span>ODMENA</span><b>+{task.points} {task.points === 1 ? "BOD" : "BODY"}</b></div>
      <label>Správa rodičovi<textarea name="note" placeholder="Čo si urobil? Môžeš pridať krátku poznámku." maxLength={500} rows={3} /></label>
      <div className={`upload-box ${task.proof_required ? "required" : ""}`}>
        <span>📷</span>
        <b>{task.proof_required ? "Pridaj povinnú fotografiu" : "Pridaj fotografiu (voliteľné)"}</b>
        <small>Odfotiť teraz alebo vybrať hotovú fotku z galérie.</small>
        <div className="upload-actions">
          <label>Odfotiť<input name="proofCamera" type="file" accept="image/*" capture="environment" onChange={(event) => setSelectedProof(event.currentTarget.files?.[0] ?? null)} /></label>
          <label>Galéria<input name="proofGallery" type="file" accept="image/*" onChange={(event) => setSelectedProof(event.currentTarget.files?.[0] ?? null)} /></label>
        </div>
        {proof && (
          <div className="proof-preview">
            {previewUrl && <img src={previewUrl} alt="Vybraný dôkaz" />}
            <div><b>Fotka pripojená</b><small>{proof.name || "Nová fotografia"} · {Math.max(1, Math.round(proof.size / 1024))} kB</small></div>
            <button type="button" onClick={() => setSelectedProof(null)}>Odobrať</button>
          </div>
        )}
      </div>
      {task.reviewer_comment && <div className="review-note">Rodič napísal: {task.reviewer_comment}</div>}
      <button className="primary-button" disabled={busy}>{busy ? "Odosielam…" : "Poslať na kontrolu →"}</button>
    </form>
  );
}

function ReviewTask({ task, canReview, busy, onAction }: { task: Task; canReview: boolean; busy: boolean; onAction: (action: string, comment: string) => void }) {
  const [comment, setComment] = useState("");
  if (!canReview) return <div className="locked-review"><span>🔒</span><h3>Túto misiu zadal {task.creator_name}</h3><p>Podľa rodinného pravidla ju musí skontrolovať práve on/ona.</p></div>;
  if (task.status !== "submitted") return <div className="locked-review"><span>{task.status === "approved" ? "✓" : "◷"}</span><h3>{task.status === "approved" ? "Misia je schválená" : "Misia ešte nečaká na kontrolu"}</h3></div>;
  return <div className="review-content"><div className="review-score"><span>HODNOTA MISIE</span><b>+{task.points} b.</b></div>{task.proof_key ? <img className="proof-image" src={`/api/proof?key=${encodeURIComponent(task.proof_key)}`} alt={`Dôkaz k úlohe ${task.title}`} /> : <div className="no-proof">Bez fotografie · pri tejto misii nebola povinná</div>}{task.completion_note && <blockquote>„{task.completion_note}“<small>— Alex</small></blockquote>}<label className="review-comment">Komentár<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Pochvala alebo čo treba doplniť…" maxLength={400} rows={3} /></label><div className="review-actions"><button className="reject-button" disabled={busy} onClick={() => onAction("reject", comment)}>↩ Vrátiť</button><button className="approve-button" disabled={busy} onClick={() => onAction("approve", comment)}>✓ Schváliť +{task.points} b.</button></div></div>;
}

function RequestForm({ busy, onSubmit }: { busy: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  return <form className="modal-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSubmit({ amount: Number(form.get("amount")), purpose: form.get("purpose"), note: form.get("note") }); }}><label>Koľko potrebuješ?<div className="money-input"><input name="amount" type="number" min="0.01" max="1000" step="0.01" placeholder="10.00" autoFocus required /><span>€</span></div></label><label>Na čo?<input name="purpose" placeholder="Napr. knihy do školy" maxLength={140} required /></label><label>Vysvetlenie<textarea name="note" placeholder="Prečo to potrebuješ a dokedy?" maxLength={500} rows={3} /></label><button className="primary-button" disabled={busy}>{busy ? "Odosielam…" : "Poslať rodičom →"}</button></form>;
}

function ConditionForm({ weekEnd, busy, onSubmit }: { weekEnd: string; busy: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  return <form className="modal-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSubmit({ title: form.get("title"), description: form.get("description"), points: Number(form.get("points")), dueDate: form.get("dueDate"), proofRequired: form.get("proofRequired") === "on" }); }}><label>Podmienka – misia<input name="title" placeholder="Napr. Vynes smeti a pozbieraj bazalku" maxLength={120} autoFocus required /></label><label>Podrobnosti<textarea name="description" placeholder="Čo presne má Alex splniť?" maxLength={500} rows={3} /></label><div className="form-row"><label>Body<select name="points" defaultValue="1"><option value="1">1 bod</option><option value="2">2 body</option><option value="3">3 body</option><option value="4">4 body</option><option value="5">5 bodov</option></select></label><label>Termín<input name="dueDate" type="date" defaultValue={todayForWeek(weekEnd)} max={weekEnd} required /></label></div><label className="check-row"><input name="proofRequired" type="checkbox" /><span>📷</span><div><b>Vyžadovať fotografiu</b><small>Doklad o splnení podmienky.</small></div></label><button className="primary-button" disabled={busy}>{busy ? "Ukladám…" : "Potvrdiť dohodu →"}</button></form>;
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div>;
}
