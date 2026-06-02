import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "prototype");
const dataDir = resolve(__dirname, "data");
const dbPath = resolve(dataDir, "softsettle.sqlite");
const port = Number(process.env.PORT || 4173);
const demoPassword = "password123";

const demoUsers = [
  { name: "Fahreen", email: "fahreen@softsettle.test", paymentApp: "Toss" },
  { name: "Asha", email: "asha@softsettle.test", paymentApp: "KakaoPay" },
  { name: "Mira", email: "mira@softsettle.test", paymentApp: "Wise" },
  { name: "Daniel", email: "daniel@softsettle.test", paymentApp: "Bank transfer" },
  { name: "Nadia", email: "nadia@softsettle.test", paymentApp: "Cash" },
  { name: "Jiho", email: "jiho@softsettle.test", paymentApp: "KakaoPay" },
  { name: "Sofia", email: "sofia@softsettle.test", paymentApp: "Wise" },
  { name: "Minseo", email: "minseo@softsettle.test", paymentApp: "Toss" },
  { name: "Arjun", email: "arjun@softsettle.test", paymentApp: "Bank transfer" },
  { name: "Lina", email: "lina@softsettle.test", paymentApp: "Cash" },
  { name: "Hana", email: "hana@softsettle.test", paymentApp: "KakaoPay" },
  { name: "Omar", email: "omar@softsettle.test", paymentApp: "Wise" },
  { name: "Yuna", email: "yuna@softsettle.test", paymentApp: "Toss" },
  { name: "Kenji", email: "kenji@softsettle.test", paymentApp: "Bank transfer" },
  { name: "Clara", email: "clara@softsettle.test", paymentApp: "Cash" }
];

const seededGroups = [
  {
    name: "Sokcho weekend trip",
    ownerIndex: 0,
    memberIndexes: [0, 1, 2, 3, 4],
    expenses: [
      {
        title: "Airbnb booking",
        amount: 320000,
        payerIndex: 0,
        participantIndexes: [0, 1, 2, 3],
        note: "Booked quickly because the rooms were close to selling out."
      },
      {
        title: "Groceries and breakfast",
        amount: 78000,
        payerIndex: 3,
        participantIndexes: [0, 1, 2, 3, 4],
        note: "Shared food for the apartment."
      },
      {
        title: "Station taxi",
        amount: 36000,
        payerIndex: 1,
        participantIndexes: [0, 1, 2],
        note: "Daniel and Nadia arrived later, so they are excluded."
      }
    ]
  },
  {
    name: "Birthday dinner deposit",
    ownerIndex: 1,
    memberIndexes: [0, 1, 2, 3],
    expenses: [
      {
        title: "Restaurant reservation",
        amount: 120000,
        payerIndex: 1,
        participantIndexes: [0, 1, 2, 3],
        note: "Asha paid the booking deposit first."
      },
      {
        title: "Cake",
        amount: 48000,
        payerIndex: 2,
        participantIndexes: [0, 1, 2, 3],
        note: "Shared surprise cake."
      }
    ]
  },
  {
    name: "Apartment grocery rotation",
    ownerIndex: 2,
    memberIndexes: [0, 2, 4],
    expenses: [
      {
        title: "Weekly groceries",
        amount: 93000,
        payerIndex: 2,
        participantIndexes: [0, 1, 2],
        note: "Shared staples for the apartment."
      },
      {
        title: "Laundry supplies",
        amount: 27000,
        payerIndex: 0,
        participantIndexes: [0, 1, 2],
        note: "Detergent and softener."
      }
    ]
  }
];

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KRW',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trip_members (
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (trip_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    payment_app TEXT NOT NULL,
    paid INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    payer_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS expense_participants (
    expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    share_amount REAL,
    PRIMARY KEY (expense_id, person_id)
  );

  CREATE TABLE IF NOT EXISTS sent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    from_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    to_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    amount_rounded INTEGER NOT NULL,
    tone TEXT NOT NULL,
    message TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settled_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    from_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    to_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    settled_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

migrate();
seedDatabase();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Something went wrong on the prototype server." });
  }
});

server.listen(port, () => {
  console.log(`SoftSettle running at http://localhost:${port}`);
  console.log(`SQLite database: ${dbPath}`);
});

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/demo-users") {
    sendJson(res, 200, {
      password: demoPassword,
      users: demoUsers.map(({ name, email, paymentApp }) => {
        const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
        return { id: user?.id || null, name, email, paymentApp };
      })
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    await register(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    await login(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const session = getSession(req);
    if (session) {
      db.prepare("DELETE FROM sessions WHERE token = ?").run(session.token);
    }
    setSessionCookie(res, "", new Date(0));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/session") {
    const session = getSession(req);
    sendJson(res, 200, session ? { authenticated: true, user: publicUser(session.user) } : { authenticated: false });
    return;
  }

  const session = getSession(req);
  if (!session) {
    sendJson(res, 401, { error: "Please log in to use SoftSettle." });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/groups") {
    sendJson(res, 200, { groups: getGroups(session.user.id) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/groups") {
    const body = await readJson(req);
    const name = cleanText(body.name, 80) || "Untitled group";
    const memberUserIds = Array.isArray(body.memberUserIds) ? body.memberUserIds.map(Number) : [];
    const groupId = createUserGroup(session.user.id, name, memberUserIds);
    sendJson(res, 200, { groups: getGroups(session.user.id), group: getGroupState(session.user.id, groupId) });
    return;
  }

  const groupStateMatch = url.pathname.match(/^\/api\/groups\/(\d+)$/);
  if (req.method === "GET" && groupStateMatch) {
    const trip = requireGroup(session.user.id, Number(groupStateMatch[1]));
    if (!trip) {
      sendJson(res, 404, { error: "Group not found for this account." });
      return;
    }
    sendJson(res, 200, getGroupState(session.user.id, trip.id));
    return;
  }

  if (req.method === "PUT" && groupStateMatch) {
    const trip = requireGroup(session.user.id, Number(groupStateMatch[1]));
    if (!trip) {
      sendJson(res, 404, { error: "Group not found for this account." });
      return;
    }
    if (!isTripOwner(session.user.id, trip.id)) {
      sendJson(res, 403, { error: "Only the group admin can change settings." });
      return;
    }
    const body = await readJson(req);
    const name = cleanText(body.tripName, 80) || "Untitled group";
    const currency = cleanText(body.currency, 8) || "KRW";
    db.prepare("UPDATE trips SET name = ?, currency = ? WHERE id = ?").run(name, currency, trip.id);
    sendJson(res, 200, getGroupState(session.user.id, trip.id));
    return;
  }

  const groupPeopleMatch = url.pathname.match(/^\/api\/groups\/(\d+)\/people$/);
  if (req.method === "POST" && groupPeopleMatch) {
    const trip = requireGroup(session.user.id, Number(groupPeopleMatch[1]));
    if (!trip) {
      sendJson(res, 404, { error: "Group not found for this account." });
      return;
    }
    if (!isTripOwner(session.user.id, trip.id)) {
      sendJson(res, 403, { error: "Only the group admin can add members." });
      return;
    }

    const body = await readJson(req);
    const memberUserId = Number(body.userId);
    const name = cleanText(body.name, 60);
    const paymentApp = cleanText(body.paymentApp, 40) || "Bank transfer";

    if (memberUserId) {
      const member = db.prepare("SELECT * FROM users WHERE id = ?").get(memberUserId);
      if (!member) {
        sendJson(res, 404, { error: "Saved user not found." });
        return;
      }

      const existing = db.prepare("SELECT id FROM people WHERE trip_id = ? AND user_id = ?").get(trip.id, member.id);
      if (existing) {
        sendJson(res, 409, { error: "That user is already in this group." });
        return;
      }

      db.exec("BEGIN");
      try {
        db.prepare("INSERT OR IGNORE INTO trip_members (trip_id, user_id, role) VALUES (?, ?, 'member')").run(
          trip.id,
          member.id
        );
        db.prepare("INSERT INTO people (trip_id, user_id, name, payment_app, paid) VALUES (?, ?, ?, ?, 0)").run(
          trip.id,
          member.id,
          member.name,
          paymentAppForUser(member)
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }

      sendJson(res, 200, getGroupState(session.user.id, trip.id));
      return;
    }

    if (!name) {
      sendJson(res, 400, { error: "Add a friend name first." });
      return;
    }

    db.prepare("INSERT INTO people (trip_id, name, payment_app, paid) VALUES (?, ?, ?, 0)").run(
      trip.id,
      name,
      paymentApp
    );
    sendJson(res, 200, getGroupState(session.user.id, trip.id));
    return;
  }

  const groupPersonMatch = url.pathname.match(/^\/api\/groups\/(\d+)\/people\/(\d+)$/);
  if (req.method === "DELETE" && groupPersonMatch) {
    const trip = requireGroup(session.user.id, Number(groupPersonMatch[1]));
    const personId = Number(groupPersonMatch[2]);
    const person = trip ? getTripPerson(trip.id, personId) : null;

    if (!person) {
      sendJson(res, 404, { error: "Member not found in this group." });
      return;
    }

    if (!isTripOwner(session.user.id, trip.id)) {
      sendJson(res, 403, { error: "Only the group admin can remove members." });
      return;
    }

    if (person.user_id === session.user.id) {
      sendJson(res, 400, { error: "You cannot remove yourself from the group." });
      return;
    }

    if (isOwnerPerson(trip.id, person)) {
      sendJson(res, 400, { error: "The group admin cannot be removed." });
      return;
    }

    if (hasExpenseReferences(personId)) {
      sendJson(res, 400, { error: "This member is part of existing expenses. Remove or edit those expenses first." });
      return;
    }

    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM people WHERE id = ? AND trip_id = ?").run(personId, trip.id);
      if (person.user_id) {
        db.prepare("DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?").run(trip.id, person.user_id);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    sendJson(res, 200, getGroupState(session.user.id, trip.id));
    return;
  }

  const expensesMatch = url.pathname.match(/^\/api\/groups\/(\d+)\/expenses$/);
  if (req.method === "POST" && expensesMatch) {
    const trip = requireGroup(session.user.id, Number(expensesMatch[1]));
    if (!trip) {
      sendJson(res, 404, { error: "Group not found for this account." });
      return;
    }

    const expenseInput = parseExpenseInput(await readJson(req));

    if (expenseInput.error) {
      sendJson(res, 400, { error: expenseInput.error });
      return;
    }

    if (
      !getTripPerson(trip.id, expenseInput.payerId) ||
      expenseInput.participantIds.some((id) => !getTripPerson(trip.id, id))
    ) {
      sendJson(res, 400, { error: "Expense includes a person outside this group." });
      return;
    }

    db.exec("BEGIN");
    try {
      const result = db
        .prepare("INSERT INTO expenses (trip_id, title, amount, payer_id, note) VALUES (?, ?, ?, ?, ?)")
        .run(trip.id, expenseInput.title, expenseInput.amount, expenseInput.payerId, "");
      const expenseId = Number(result.lastInsertRowid);
      const participantInsert = db.prepare(
        "INSERT INTO expense_participants (expense_id, person_id, share_amount) VALUES (?, ?, ?)"
      );
      expenseInput.participantIds.forEach((personId) =>
        participantInsert.run(expenseId, personId, expenseInput.shareAmounts.get(personId) ?? null)
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    sendJson(res, 200, getGroupState(session.user.id, trip.id));
    return;
  }

  const expenseMatch = url.pathname.match(/^\/api\/groups\/(\d+)\/expenses\/(\d+)$/);
  if (req.method === "PUT" && expenseMatch) {
    const trip = requireGroup(session.user.id, Number(expenseMatch[1]));
    const expenseId = Number(expenseMatch[2]);
    const expense = trip
      ? db.prepare("SELECT id FROM expenses WHERE id = ? AND trip_id = ?").get(expenseId, trip.id)
      : null;

    if (!expense) {
      sendJson(res, 404, { error: "Expense not found in this group." });
      return;
    }

    const expenseInput = parseExpenseInput(await readJson(req));

    if (expenseInput.error) {
      sendJson(res, 400, { error: expenseInput.error });
      return;
    }

    if (
      !getTripPerson(trip.id, expenseInput.payerId) ||
      expenseInput.participantIds.some((id) => !getTripPerson(trip.id, id))
    ) {
      sendJson(res, 400, { error: "Expense includes a person outside this group." });
      return;
    }

    db.exec("BEGIN");
    try {
      db.prepare("UPDATE expenses SET title = ?, amount = ?, payer_id = ?, note = ? WHERE id = ?").run(
        expenseInput.title,
        expenseInput.amount,
        expenseInput.payerId,
        "",
        expenseId
      );
      db.prepare("DELETE FROM expense_participants WHERE expense_id = ?").run(expenseId);
      const participantInsert = db.prepare(
        "INSERT INTO expense_participants (expense_id, person_id, share_amount) VALUES (?, ?, ?)"
      );
      expenseInput.participantIds.forEach((personId) =>
        participantInsert.run(expenseId, personId, expenseInput.shareAmounts.get(personId) ?? null)
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    sendJson(res, 200, getGroupState(session.user.id, trip.id));
    return;
  }

  if (req.method === "DELETE" && expenseMatch) {
    const trip = requireGroup(session.user.id, Number(expenseMatch[1]));
    const expenseId = Number(expenseMatch[2]);
    const expense = trip
      ? db.prepare("SELECT id FROM expenses WHERE id = ? AND trip_id = ?").get(expenseId, trip.id)
      : null;

    if (!expense) {
      sendJson(res, 404, { error: "Expense not found in this group." });
      return;
    }

    db.prepare("DELETE FROM expenses WHERE id = ?").run(expenseId);
    sendJson(res, 200, getGroupState(session.user.id, trip.id));
    return;
  }

  const paymentsMatch = url.pathname.match(/^\/api\/groups\/(\d+)\/payments$/);
  if (req.method === "POST" && paymentsMatch) {
    const trip = requireGroup(session.user.id, Number(paymentsMatch[1]));
    if (!trip) {
      sendJson(res, 404, { error: "Group not found for this account." });
      return;
    }

    const body = await readJson(req);
    const fromId = Number(body.fromId);
    const toId = Number(body.toId);
    const amount = Number(body.amount);
    const fromPerson = getTripPerson(trip.id, fromId);
    const toPerson = getTripPerson(trip.id, toId);

    if (!fromPerson || !toPerson || !Number.isFinite(amount) || amount <= 0) {
      sendJson(res, 400, { error: "Choose a valid settlement to pay." });
      return;
    }

    const groupState = getGroupState(session.user.id, trip.id);
    const currentPersonId = groupState.currentUserPersonId;
    if (!isTripOwner(session.user.id, trip.id) && currentPersonId !== fromId && currentPersonId !== toId) {
      sendJson(res, 403, { error: "You can only settle payments involving your account." });
      return;
    }

    const settlement = calculateDirectSettlements(groupState.people, groupState.expenses, groupState.payments).find(
      (item) => item.fromId === fromId && item.toId === toId
    );

    if (!settlement) {
      sendJson(res, 400, { error: "That payment is already settled." });
      return;
    }

    const settledAmount = Math.min(amount, settlement.amount);
    db.exec("BEGIN");
    try {
      const paymentInsert = db.prepare(
        "INSERT INTO settled_payments (trip_id, from_id, to_id, amount, settled_by_user_id) VALUES (?, ?, ?, ?, ?)"
      );
      paymentInsert.run(trip.id, fromId, toId, settledAmount, session.user.id);
      getOffsetTotals(settlement).forEach((offset) => {
        paymentInsert.run(trip.id, offset.fromId, offset.toId, offset.amount, session.user.id);
      });
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    sendJson(res, 200, getGroupState(session.user.id, trip.id));
    return;
  }

  const sentMatch = url.pathname.match(/^\/api\/groups\/(\d+)\/messages\/sent$/);
  if (req.method === "POST" && sentMatch) {
    const trip = requireGroup(session.user.id, Number(sentMatch[1]));
    if (!trip) {
      sendJson(res, 404, { error: "Group not found for this account." });
      return;
    }

    const body = await readJson(req);
    const fromId = Number(body.fromId);
    const toId = Number(body.toId);
    const amount = Math.round(Number(body.amount) || 0);
    const message = cleanText(body.message, 500);

    if (!fromId || !toId || !amount || !message || !getTripPerson(trip.id, fromId) || !getTripPerson(trip.id, toId)) {
      sendJson(res, 400, { error: "Could not save that reminder." });
      return;
    }

    db.prepare(
      "INSERT INTO sent_messages (trip_id, from_id, to_id, amount_rounded, tone, message) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(trip.id, fromId, toId, amount, "standard", message);
    sendJson(res, 200, getGroupState(session.user.id, trip.id));
    return;
  }

  sendJson(res, 404, { error: "API route not found." });
}

async function register(req, res) {
  const body = await readJson(req);
  const name = cleanText(body.name, 80);
  const email = cleanEmail(body.email);
  const password = String(body.password || "");

  if (!name || !email || password.length < 6) {
    sendJson(res, 400, { error: "Use a name, valid email, and password with at least 6 characters." });
    return;
  }

  const passwordRecord = hashPassword(password);

  try {
    const result = db.prepare(
      "INSERT INTO users (name, email, password_hash, password_salt) VALUES (?, ?, ?, ?)"
    ).run(name, email, passwordRecord.hash, passwordRecord.salt);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(result.lastInsertRowid));
    seedStarterGroup(user.id);
    setSessionCookie(res, "", new Date(0));
    sendJson(res, 200, {
      registered: true,
      email: user.email,
      message: "Account saved. Please log in with the email and password you just created."
    });
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      sendJson(res, 409, { error: "That email already has a SoftSettle account." });
      return;
    }
    throw error;
  }
}

async function login(req, res) {
  const body = await readJson(req);
  const email = cleanEmail(body.email);
  const password = String(body.password || "");
  const user = email ? db.prepare("SELECT * FROM users WHERE email = ?").get(email) : null;

  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    sendJson(res, 401, { error: "Email or password is incorrect." });
    return;
  }

  ensureUserHasGroup(user.id);
  createSession(res, user);
  sendJson(res, 200, { user: publicUser(user), groups: getGroups(user.id) });
}

function getGroups(userId) {
  return db
    .prepare(
      `SELECT trips.id, trips.name, trips.currency, trips.created_at AS createdAt
       FROM trips
       JOIN trip_members ON trip_members.trip_id = trips.id
       WHERE trip_members.user_id = ?
       ORDER BY trips.created_at DESC, trips.id DESC`
    )
    .all(userId)
    .map((group) => {
      const state = getGroupState(userId, group.id);
      const currentBalance = getCurrentUserBalance(state);
      return {
        id: group.id,
        name: group.name,
        currency: group.currency,
        memberCount: state.people.length,
        expenseCount: state.expenses.length,
        members: state.people.map((person) => person.name),
        currentBalance
      };
    });
}

function getGroupState(userId, tripId) {
  const trip = db.prepare("SELECT * FROM trips WHERE id = ?").get(tripId);
  const people = db
    .prepare(
      `SELECT people.id,
              people.user_id AS userId,
              people.name,
              people.payment_app AS paymentApp,
              people.paid,
              COALESCE(trip_members.role, 'guest') AS role
       FROM people
       LEFT JOIN trip_members
         ON trip_members.trip_id = people.trip_id
        AND trip_members.user_id = people.user_id
       WHERE people.trip_id = ?
       ORDER BY people.id`
    )
    .all(tripId)
    .map((person) => ({ ...person, paid: Boolean(person.paid) }));
  const expenses = db
    .prepare("SELECT id, title, amount, payer_id AS payerId, note FROM expenses WHERE trip_id = ? ORDER BY id")
    .all(tripId)
    .map((expense) => {
      const shares = db
        .prepare(
          "SELECT person_id AS personId, share_amount AS amount FROM expense_participants WHERE expense_id = ? ORDER BY person_id"
        )
        .all(expense.id)
        .map((row) => ({
          personId: row.personId,
          amount: row.amount === null || row.amount === undefined ? null : Number(row.amount)
        }));

      return {
        ...expense,
        participantIds: shares.map((row) => row.personId),
        shares
      };
    });
  const sentSettlementKeys = db
    .prepare("SELECT from_id, to_id, amount_rounded FROM sent_messages WHERE trip_id = ?")
    .all(tripId)
    .map((row) => settlementKey(row.from_id, row.to_id, row.amount_rounded));
  const payments = db
    .prepare(
      `SELECT id,
              from_id AS fromId,
              to_id AS toId,
              amount,
              settled_by_user_id AS settledByUserId,
              settled_at AS settledAt
       FROM settled_payments
       WHERE trip_id = ?
       ORDER BY id`
    )
    .all(tripId)
    .map((payment) => ({ ...payment, amount: Number(payment.amount) }));
  const currentUserPerson = people.find((person) => person.userId === userId) || null;
  const currentUserMembership = db
    .prepare("SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?")
    .get(tripId, userId);

  return {
    groupId: trip.id,
    tripName: trip.name,
    currency: trip.currency,
    currentUserPersonId: currentUserPerson?.id || null,
    currentUserRole: currentUserMembership?.role || (trip.user_id === userId ? "owner" : "member"),
    isAdmin: isTripOwner(userId, tripId),
    people,
    expenses,
    payments,
    sentSettlementKeys
  };
}

function getCurrentUserBalance(groupState) {
  if (!groupState.currentUserPersonId) {
    return 0;
  }
  const balances = calculateBalances(groupState.people, groupState.expenses, groupState.payments);
  return balances[groupState.currentUserPersonId] || 0;
}

function calculateBalances(people, expenses, payments = []) {
  const balances = Object.fromEntries(people.map((person) => [person.id, 0]));

  expenses.forEach((expense) => {
    const amount = Number(expense.amount) || 0;
    const participantIds = expense.participantIds || [];
    const shareMap = new Map(
      (expense.shares || []).map((share) => [
        share.personId,
        share.amount === null || share.amount === undefined ? Number.NaN : Number(share.amount)
      ])
    );

    if (!amount || !participantIds.length || !Object.prototype.hasOwnProperty.call(balances, expense.payerId)) {
      return;
    }

    const equalShare = amount / participantIds.length;
    balances[expense.payerId] += amount;
    participantIds.forEach((participantId) => {
      if (Object.prototype.hasOwnProperty.call(balances, participantId)) {
        const customShare = shareMap.get(participantId);
        const share = Number.isFinite(customShare) ? customShare : equalShare;
        balances[participantId] -= share;
      }
    });
  });

  payments.forEach((payment) => {
    const amount = Number(payment.amount) || 0;
    if (
      amount <= 0 ||
      !Object.prototype.hasOwnProperty.call(balances, payment.fromId) ||
      !Object.prototype.hasOwnProperty.call(balances, payment.toId)
    ) {
      return;
    }

    balances[payment.fromId] += amount;
    balances[payment.toId] -= amount;
  });

  return balances;
}

function simplifySettlements(people, balances) {
  const debtors = people
    .map((person) => ({ ...person, balance: balances[person.id] || 0 }))
    .filter((person) => person.balance < -0.5)
    .sort((a, b) => a.balance - b.balance);

  const creditors = people
    .map((person) => ({ ...person, balance: balances[person.id] || 0 }))
    .filter((person) => person.balance > 0.5)
    .sort((a, b) => b.balance - a.balance);

  const settlements = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

    if (amount > 0.5) {
      settlements.push({
        id: settlementKey(debtor.id, creditor.id, amount),
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount
      });
    }

    debtor.balance += amount;
    creditor.balance -= amount;

    if (Math.abs(debtor.balance) <= 0.5) {
      debtorIndex += 1;
    }

    if (Math.abs(creditor.balance) <= 0.5) {
      creditorIndex += 1;
    }
  }

  return settlements;
}

function calculateDirectSettlements(people, expenses, payments = []) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const ledger = new Map();

  const getRecord = (fromId, toId) => {
    const key = `${fromId}-${toId}`;
    if (!ledger.has(key)) {
      ledger.set(key, {
        id: "",
        fromId,
        fromName: peopleById.get(fromId)?.name || "Member",
        toId,
        toName: peopleById.get(toId)?.name || "Member",
        amount: 0,
        lines: []
      });
    }
    return ledger.get(key);
  };

  expenses.forEach((expense) => {
    (expense.participantIds || []).forEach((participantId) => {
      if (participantId === expense.payerId) {
        return;
      }

      const share = getExpenseShareForPerson(expense, participantId);
      if (share <= 0) {
        return;
      }

      const record = getRecord(participantId, expense.payerId);
      record.amount += share;
      record.lines.push({
        title: expense.title,
        amount: share,
        payerId: expense.payerId
      });
    });
  });

  payments.forEach((payment) => {
    const record = ledger.get(`${payment.fromId}-${payment.toId}`);
    let remaining = Number(payment.amount) || 0;

    if (!record || remaining <= 0) {
      return;
    }

    record.lines.forEach((line) => {
      if (remaining <= 0) {
        return;
      }

      const paidAmount = Math.min(line.amount, remaining);
      line.amount -= paidAmount;
      remaining -= paidAmount;
    });
    record.lines = record.lines.filter((line) => line.amount > 0.5);
    record.amount = record.lines.reduce((sum, line) => sum + line.amount, 0);
  });

  const directRecords = [...ledger.values()]
    .filter((record) => record.amount > 0.5)
    .map((record) => ({
      ...record,
      id: settlementKey(record.fromId, record.toId, record.amount)
    }));

  return netOppositeSettlements(directRecords, peopleById);
}

function netOppositeSettlements(records, peopleById) {
  const byPair = new Map();

  records.forEach((record) => {
    const pairKey = [record.fromId, record.toId].sort((a, b) => a - b).join("-");
    if (!byPair.has(pairKey)) {
      byPair.set(pairKey, []);
    }
    byPair.get(pairKey).push(record);
  });

  const netted = [];
  byPair.forEach((pairRecords) => {
    if (pairRecords.length === 1) {
      netted.push(pairRecords[0]);
      return;
    }

    const [first, second] = pairRecords;
    const winner = first.amount >= second.amount ? first : second;
    const offset = first.amount >= second.amount ? second : first;
    const netAmount = winner.amount - offset.amount;

    if (netAmount <= 0.5) {
      return;
    }

    netted.push({
      id: settlementKey(winner.fromId, winner.toId, netAmount),
      fromId: winner.fromId,
      fromName: peopleById.get(winner.fromId)?.name || winner.fromName,
      toId: winner.toId,
      toName: peopleById.get(winner.toId)?.name || winner.toName,
      amount: netAmount,
      lines: [
        ...winner.lines,
        ...offset.lines.map((line) => ({
          ...line,
          title: `Offset from ${line.title}`,
          amount: -line.amount
        }))
      ]
    });
  });

  return netted;
}

function getOffsetTotals(settlement) {
  const totals = new Map();

  (settlement.lines || [])
    .filter((line) => line.amount < -0.5 && line.payerId)
    .forEach((line) => {
      const fromId = settlement.toId;
      const toId = line.payerId;
      const key = `${fromId}-${toId}`;
      totals.set(key, {
        fromId,
        toId,
        amount: (totals.get(key)?.amount || 0) + Math.abs(line.amount)
      });
    });

  return [...totals.values()];
}

function getExpenseShareForPerson(expense, personId) {
  if (!(expense.participantIds || []).includes(personId)) {
    return 0;
  }

  const share = (expense.shares || []).find((item) => item.personId === personId);
  const customShare = share?.amount === null || share?.amount === undefined ? Number.NaN : Number(share.amount);

  if (Number.isFinite(customShare)) {
    return customShare;
  }

  return Number(expense.amount || 0) / Math.max((expense.participantIds || []).length, 1);
}

function parseExpenseInput(body) {
  const title = cleanText(body.title, 80);
  const amount = Number(body.amount);
  const payerId = Number(body.payerId);
  const participantIds = [
    ...new Set((Array.isArray(body.participantIds) ? body.participantIds : []).map(Number).filter(Boolean))
  ];
  const splitMode = body.splitMode === "custom" ? "custom" : "equal";
  const shareAmounts = new Map();

  if (!title || !Number.isFinite(amount) || amount <= 0 || !payerId || !participantIds.length) {
    return { error: "Expense, amount, payer, and participants are required." };
  }

  if (splitMode === "custom") {
    const shares = Array.isArray(body.shares) ? body.shares : [];
    participantIds.forEach((personId) => {
      const match = shares.find((share) => Number(share.personId) === personId);
      const shareAmount = Number(match?.amount);
      if (Number.isFinite(shareAmount) && shareAmount >= 0) {
        shareAmounts.set(personId, shareAmount);
      }
    });

    if (shareAmounts.size !== participantIds.length) {
      return { error: "Enter a custom amount for every selected member." };
    }

    const totalShares = [...shareAmounts.values()].reduce((sum, value) => sum + value, 0);
    if (Math.abs(totalShares - amount) > 1) {
      return { error: "Custom member amounts must add up to the expense total." };
    }
  }

  return {
    title,
    amount,
    payerId,
    participantIds,
    splitMode,
    shareAmounts,
    error: ""
  };
}

function requireGroup(userId, tripId) {
  const trip = db
    .prepare(
      `SELECT trips.*
       FROM trips
       JOIN trip_members ON trip_members.trip_id = trips.id
       WHERE trips.id = ? AND trip_members.user_id = ?`
    )
    .get(tripId, userId);

  if (trip) {
    return trip;
  }

  const legacyTrip = db.prepare("SELECT * FROM trips WHERE id = ? AND user_id = ?").get(tripId, userId);
  if (legacyTrip) {
    db.prepare("INSERT OR IGNORE INTO trip_members (trip_id, user_id, role) VALUES (?, ?, 'owner')").run(
      tripId,
      userId
    );
    return legacyTrip;
  }

  return null;
}

function seedDatabase() {
  const users = seedDemoUsers();
  seededGroups.forEach((group) => {
    const owner = users[group.ownerIndex];
    const existing = db.prepare("SELECT id FROM trips WHERE user_id = ? AND name = ?").get(owner.id, group.name);
    if (existing) {
      return;
    }

    const members = group.memberIndexes.map((index) => users[index]);
    createSeedGroup({
      owner,
      members,
      name: group.name,
      expenses: group.expenses
    });
  });
  syncLegacyMemberships();
}

function seedDemoUsers() {
  return demoUsers.map((demoUser) => {
    const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(demoUser.email);
    if (existing) {
      return existing;
    }

    const passwordRecord = hashPassword(demoPassword);
    const result = db
      .prepare("INSERT INTO users (name, email, password_hash, password_salt) VALUES (?, ?, ?, ?)")
      .run(demoUser.name, demoUser.email, passwordRecord.hash, passwordRecord.salt);
    return db.prepare("SELECT * FROM users WHERE id = ?").get(Number(result.lastInsertRowid));
  });
}

function seedStarterGroup(userId) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  const existing = db.prepare("SELECT id FROM trips WHERE user_id = ? AND name = ?").get(userId, "My first group");

  if (existing) {
    return;
  }

  const fakeMembers = demoUsers
    .slice(0, 4)
    .map((demoUser) => db.prepare("SELECT * FROM users WHERE email = ?").get(demoUser.email));

  createSeedGroup({
    owner: user,
    members: [user, ...fakeMembers],
    name: "My first group",
    expenses: [
      {
        title: "Shared dinner",
        amount: 85000,
        payerIndex: 0,
        participantIndexes: [0, 1, 2, 3, 4],
        note: "Starter group created after account registration."
      }
    ]
  });
}

function ensureUserHasGroup(userId) {
  const count = db.prepare("SELECT COUNT(*) AS count FROM trip_members WHERE user_id = ?").get(userId).count;
  if (!count) {
    seedStarterGroup(userId);
  }
}

function createUserGroup(ownerUserId, name, memberUserIds) {
  const owner = db.prepare("SELECT * FROM users WHERE id = ?").get(ownerUserId);
  const uniqueIds = [...new Set([ownerUserId, ...memberUserIds.filter((id) => Number.isInteger(id) && id > 0)])];
  const members = uniqueIds
    .map((id) => db.prepare("SELECT * FROM users WHERE id = ?").get(id))
    .filter(Boolean);

  db.exec("BEGIN");
  try {
    const tripId = Number(
      db.prepare("INSERT INTO trips (user_id, name, currency) VALUES (?, ?, 'KRW')").run(owner.id, name)
        .lastInsertRowid
    );
    const memberInsert = db.prepare("INSERT OR IGNORE INTO trip_members (trip_id, user_id, role) VALUES (?, ?, ?)");
    const personInsert = db.prepare(
      "INSERT INTO people (trip_id, user_id, name, payment_app, paid) VALUES (?, ?, ?, ?, ?)"
    );

    members.forEach((member) => {
      memberInsert.run(tripId, member.id, member.id === owner.id ? "owner" : "member");
      personInsert.run(tripId, member.id, member.name, paymentAppForUser(member), member.id === owner.id ? 1 : 0);
    });

    db.exec("COMMIT");
    return tripId;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function createSeedGroup({ owner, members, name, expenses }) {
  db.exec("BEGIN");
  try {
    const tripId = Number(
      db.prepare("INSERT INTO trips (user_id, name, currency) VALUES (?, ?, 'KRW')").run(owner.id, name)
        .lastInsertRowid
    );
    const memberInsert = db.prepare("INSERT OR IGNORE INTO trip_members (trip_id, user_id, role) VALUES (?, ?, ?)");
    const personInsert = db.prepare(
      "INSERT INTO people (trip_id, user_id, name, payment_app, paid) VALUES (?, ?, ?, ?, ?)"
    );
    const personIds = members.map((member, index) => {
      memberInsert.run(tripId, member.id, member.id === owner.id ? "owner" : "member");
      const paymentApp = demoUsers.find((demoUser) => demoUser.email === member.email)?.paymentApp || "Bank transfer";
      return Number(personInsert.run(tripId, member.id, member.name, paymentApp, index === 0 ? 1 : 0).lastInsertRowid);
    });

    const expenseInsert = db.prepare(
      "INSERT INTO expenses (trip_id, title, amount, payer_id, note) VALUES (?, ?, ?, ?, ?)"
    );
    const participantInsert = db.prepare("INSERT INTO expense_participants (expense_id, person_id) VALUES (?, ?)");

    expenses.forEach((expense) => {
      const expenseId = Number(
        expenseInsert
          .run(tripId, expense.title, expense.amount, personIds[expense.payerIndex], expense.note)
          .lastInsertRowid
      );
      expense.participantIndexes.forEach((index) => participantInsert.run(expenseId, personIds[index]));
    });

    db.exec("COMMIT");
    return tripId;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function paymentAppForUser(user) {
  return demoUsers.find((demoUser) => demoUser.email === user.email)?.paymentApp || "Bank transfer";
}

function syncLegacyMemberships() {
  db.prepare("SELECT id, user_id FROM trips").all().forEach((trip) => {
    db.prepare("INSERT OR IGNORE INTO trip_members (trip_id, user_id, role) VALUES (?, ?, 'owner')").run(
      trip.id,
      trip.user_id
    );
  });
}

function migrate() {
  if (!hasColumn("people", "user_id")) {
    db.prepare("ALTER TABLE people ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL").run();
  }

  if (!hasColumn("expense_participants", "share_amount")) {
    db.prepare("ALTER TABLE expense_participants ADD COLUMN share_amount REAL").run();
  }
}

function hasColumn(tableName, columnName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().some((column) => column.name === columnName);
}

function getTripPerson(tripId, personId) {
  return db.prepare("SELECT * FROM people WHERE id = ? AND trip_id = ?").get(personId, tripId);
}

function isTripOwner(userId, tripId) {
  const membership = db
    .prepare("SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?")
    .get(tripId, userId);
  const trip = db.prepare("SELECT user_id FROM trips WHERE id = ?").get(tripId);
  return membership?.role === "owner" || trip?.user_id === userId;
}

function isOwnerPerson(tripId, person) {
  if (!person?.user_id) {
    return false;
  }
  return isTripOwner(person.user_id, tripId);
}

function hasExpenseReferences(personId) {
  const paidCount = db.prepare("SELECT COUNT(*) AS count FROM expenses WHERE payer_id = ?").get(personId).count;
  const sharedCount = db
    .prepare("SELECT COUNT(*) AS count FROM expense_participants WHERE person_id = ?")
    .get(personId).count;
  return paidCount > 0 || sharedCount > 0;
}

function createSession(res, user) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    token,
    user.id,
    expiresAt.toISOString()
  );
  setSessionCookie(res, token, expiresAt);
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies.softsettle_session;

  if (!token) {
    return null;
  }

  const row = db
    .prepare(
      `SELECT sessions.token, sessions.expires_at, users.*
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?`
    )
    .get(token);

  if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }

  return { token, user: row };
}

function setSessionCookie(res, token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  res.setHeader(
    "Set-Cookie",
    `softsettle_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function serveStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = normalize(resolve(publicDir, `.${pathname}`));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": "no-store"
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const [key, ...value] = cookie.split("=");
        return [key, decodeURIComponent(value.join("="))];
      })
  );
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanEmail(value) {
  const email = cleanText(value, 120).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function settlementKey(fromId, toId, amount) {
  return `${fromId}-${toId}-${Math.round(Number(amount) || 0)}`;
}

function contentType(filePath) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml; charset=utf-8"
  };
  return types[extname(filePath).toLowerCase()] || "application/octet-stream";
}
