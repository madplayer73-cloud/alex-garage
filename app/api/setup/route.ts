import {
  ensureSchema,
  getD1,
  hashPin,
  jsonError,
  randomToken,
  validPin,
} from "@/db/runtime";

type SetupPerson = { name?: string; pin?: string };

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const existing = await getD1().prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
    if ((existing?.count ?? 0) > 0) {
      return Response.json({ error: "Rodina je už nastavená." }, { status: 409 });
    }

    const payload = (await request.json()) as {
      alex?: SetupPerson;
      mama?: SetupPerson;
      otec?: SetupPerson;
    };
    const people = [
      { role: "alex", color: "#f8c24d", value: payload.alex, fallback: "Alex" },
      { role: "parent_mama", color: "#dc5f78", value: payload.mama, fallback: "Mama" },
      { role: "parent_otec", color: "#4f78d6", value: payload.otec, fallback: "Otec" },
    ];

    for (const person of people) {
      if (!person.value?.name?.trim()) {
        return Response.json({ error: `Doplňte meno: ${person.fallback}.` }, { status: 400 });
      }
      if (!validPin(person.value.pin)) {
        return Response.json({ error: `PIN pre ${person.value.name} musí mať 4 až 8 číslic.` }, { status: 400 });
      }
    }

    const db = getD1();
    const statements = await Promise.all(
      people.map(async (person) => {
        const salt = randomToken(18);
        const pinHash = await hashPin(person.value!.pin!, salt);
        return db
          .prepare("INSERT INTO users (role, name, pin_salt, pin_hash, color) VALUES (?, ?, ?, ?, ?)")
          .bind(person.role, person.value!.name!.trim(), salt, pinHash, person.color);
      }),
    );
    await db.batch(statements);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
