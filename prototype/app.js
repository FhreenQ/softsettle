const state = {
  view: "loading",
  authMode: "login",
  user: null,
  demoUsers: [],
  demoPassword: "",
  groups: [],
  currentGroupId: null,
  tripName: "",
  currency: "KRW",
  currentUserPersonId: null,
  currentUserRole: "member",
  isAdmin: false,
  people: [],
  expenses: [],
  payments: [],
  selectedSettlementId: "",
  editingExpenseId: null,
  settingsOpen: false,
  lastCopied: false,
  messageChannel: "message",
  sentSettlementKeys: new Set(),
  error: "",
  notice: "",
  prefillEmail: "",
  busy: false
};

const app = document.querySelector("#app");

function formatCurrency(value, currency = "KRW") {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;

  if (currency === "KRW") {
    return `KRW ${Math.round(amount).toLocaleString("en-US")}`;
  }

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  });
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

function icon(name) {
  const icons = {
    plus: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    send: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg>',
    copy: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 8h11v11H8z"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
    check: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m20 6-11 11-5-5"/></svg>',
    settings: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .55V20a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.95 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.55-1H4a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.95a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.55V4a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.05 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.36.38.7.55 1H20a2 2 0 1 1 0 4h-.09c-.17.3-.35.64-.55 1Z"/></svg>',
    message: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/></svg>',
    card: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>',
    receipt: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2Z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',
    lock: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    logout: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
    database: '<svg aria-hidden="true" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
    users: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    trash: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>',
    back: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>'
  };

  return icons[name] || "";
}

async function init() {
  renderLoading();

  if (location.protocol === "file:") {
    state.view = "server-help";
    state.error = "This version uses a SQLite database, so it needs the local Node server.";
    render();
    return;
  }

  try {
    const demo = await api("/api/demo-users");
    state.demoUsers = demo.users || [];
    state.demoPassword = demo.password || "";

    const session = await api("/api/session");
    if (session.authenticated) {
      state.user = session.user;
      await loadGroups();
      state.view = "groups";
    } else {
      state.view = "auth";
    }
    state.error = "";
  } catch (error) {
    state.view = "server-help";
    state.error = error.message;
  }

  render();
}

async function loadGroups() {
  const response = await api("/api/groups");
  state.groups = response.groups || [];
}

function hydrateGroup(data) {
  state.currentGroupId = data.groupId;
  state.tripName = data.tripName || "Untitled group";
  state.currency = data.currency || "KRW";
  state.currentUserPersonId = data.currentUserPersonId || null;
  state.currentUserRole = data.currentUserRole || "member";
  state.isAdmin = Boolean(data.isAdmin);
  state.people = data.people || [];
  state.expenses = data.expenses || [];
  state.payments = data.payments || [];
  state.sentSettlementKeys = new Set(data.sentSettlementKeys || []);

  const settlements = getPersonalSettlements(calculateDirectSettlements(state.people, state.expenses, state.payments));
  if (!settlements.some((settlement) => settlement.id === state.selectedSettlementId)) {
    state.selectedSettlementId = settlements[0]?.id || "";
  }
}

function render() {
  if (state.view === "loading") {
    renderLoading();
    return;
  }

  if (state.view === "server-help") {
    renderServerHelp();
    return;
  }

  if (state.view === "auth") {
    renderAuth();
    return;
  }

  if (state.view === "groups") {
    renderGroups();
    return;
  }

  if (state.view === "pay") {
    renderPayPage();
    return;
  }

  renderWorkspace();
}

function renderLoading() {
  app.innerHTML = `
    <main class="center-shell">
      <div class="loading-card">
        <span class="brand-mark">S</span>
        <div>
          <p class="eyebrow">Loading</p>
          <h1>SoftSettle</h1>
        </div>
      </div>
    </main>
  `;
}

function renderServerHelp() {
  app.innerHTML = `
    <main class="center-shell">
      <section class="auth-card">
        <div class="brand-block">
          <span class="brand-mark">S</span>
          <div>
            <p class="eyebrow">Database mode</p>
            <h1>SoftSettle</h1>
          </div>
        </div>
        <div class="notice error">
          ${escapeHtml(state.error || "The local server is not reachable.")}
        </div>
        <div class="run-box">
          <span>${icon("database")}</span>
          <div>
            <strong>Run the database-backed prototype</strong>
            <code>npm start</code>
            <p>Then open <strong>http://localhost:4173</strong>.</p>
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderAuth() {
  const isRegister = state.authMode === "register";

  app.innerHTML = `
    <main class="center-shell">
      <section class="auth-card">
        <div class="brand-block">
          <span class="brand-mark">S</span>
          <div>
            <p class="eyebrow">SQLite-backed prototype</p>
            <h1>SoftSettle</h1>
          </div>
        </div>
        <div class="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button class="${!isRegister ? "active" : ""}" data-auth-mode="login">Log in</button>
          <button class="${isRegister ? "active" : ""}" data-auth-mode="register">Create account</button>
        </div>
        ${state.notice ? `<div class="notice success">${escapeHtml(state.notice)}</div>` : ""}
        ${state.error ? `<div class="notice error">${escapeHtml(state.error)}</div>` : ""}
        <form id="auth-form" class="auth-form">
          ${
            isRegister
              ? `
                <label>
                  <span>Name</span>
                  <input name="name" autocomplete="name" placeholder="Ahmad Fahreen" required />
                </label>
              `
              : ""
          }
          <label>
            <span>Email</span>
            <input name="email" type="email" autocomplete="email" placeholder="you@example.com" value="${escapeHtml(state.prefillEmail)}" required />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" placeholder="At least 6 characters" required />
          </label>
          <button class="command-button primary" type="submit" ${state.busy ? "disabled" : ""}>
            ${icon("lock")}
            ${state.busy ? "Please wait" : isRegister ? "Save account" : "Log in"}
          </button>
        </form>
        ${renderDemoUsers()}
      </section>
    </main>
  `;

  bindAuthEvents();
}

function renderDemoUsers() {
  if (!state.demoUsers.length) {
    return "";
  }

  return `
    <section class="demo-panel">
      <div class="panel-heading compact-heading">
        <div>
          <p class="eyebrow">Seeded database users</p>
          <h2>Try a real saved account</h2>
        </div>
      </div>
      <p>Password for all demo accounts: <strong>${escapeHtml(state.demoPassword)}</strong></p>
      <div class="demo-user-list">
        ${state.demoUsers
          .map(
            (user) => `
              <button type="button" data-demo-email="${escapeHtml(user.email)}">
                <span class="avatar" aria-hidden="true">${escapeHtml(user.name.slice(0, 1))}</span>
                <span>
                  <strong>${escapeHtml(user.name)}</strong>
                  <small>${escapeHtml(user.email)}</small>
                </span>
              </button>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderGroups() {
  app.innerHTML = `
    ${renderAppHeader("Your groups", "")}
    ${state.notice ? `<div class="notice success">${escapeHtml(state.notice)}</div>` : ""}
    ${state.error ? `<div class="notice error">${escapeHtml(state.error)}</div>` : ""}
    <main class="groups-page">
      <section class="groups-intro">
        <div>
          <p class="eyebrow">Groups you are involved in</p>
          <h1>Choose a group to settle.</h1>
        </div>
        <div class="run-box compact">
          <span>${icon("database")}</span>
          <p>These groups and members come from <strong>data/softsettle.sqlite</strong>.</p>
        </div>
      </section>
      ${renderCreateGroupPanel()}
      <section class="group-grid">
        ${
          state.groups.length
            ? state.groups.map((group) => renderGroupCard(group)).join("")
            : `<div class="empty-state">${icon("users")} No groups found for this account.</div>`
        }
      </section>
    </main>
  `;

  bindGlobalHeaderEvents();
  bindCreateGroupEvents();
  document.querySelectorAll("[data-open-group]").forEach((button) => {
    button.addEventListener("click", async () => {
      const groupId = Number(button.dataset.openGroup);
      await runAction(async () => {
        hydrateGroup(await api(`/api/groups/${groupId}`));
        state.view = "group";
      });
    });
  });

  document.querySelectorAll("[data-delete-group]").forEach((button) => {
    button.addEventListener("click", async () => {
      const groupId = Number(button.dataset.deleteGroup);
      const group = state.groups.find((item) => item.id === groupId);
      if (!window.confirm(`Delete "${group?.name || "this group"}" and all of its expenses?`)) {
        return;
      }

      await runAction(async () => {
        const response = await api(`/api/groups/${groupId}`, { method: "DELETE" });
        state.groups = response.groups || [];
        state.notice = "Group deleted.";
      });
    });
  });
}

function renderCreateGroupPanel() {
  const selectableUsers = state.demoUsers.filter((user) => user.id && user.email !== state.user?.email);

  return `
    <section class="tool-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">New group</p>
          <h2>Create group</h2>
        </div>
      </div>
      <form id="group-form" class="group-form">
        <label>
          <span>Group name</span>
          <input name="name" placeholder="Busan weekend trip" required ${state.busy ? "disabled" : ""} />
        </label>
        <fieldset>
          <legend>Add saved users</legend>
          <div class="chip-grid">
            ${selectableUsers
              .map(
                (user) => `
                  <label class="chip-check">
                    <input type="checkbox" name="memberUserIds" value="${user.id}" ${state.busy ? "disabled" : ""} />
                    <span>${escapeHtml(user.name)}</span>
                  </label>
                `
              )
              .join("")}
          </div>
        </fieldset>
        <button class="command-button primary" type="submit" ${state.busy ? "disabled" : ""}>
          ${icon("plus")}
          Create group
        </button>
      </form>
    </section>
  `;
}

function renderGroupCard(group) {
  const balance = Number(group.currentBalance) || 0;
  const oweAmount = Number(group.oweAmount ?? (balance < 0 ? Math.abs(balance) : 0)) || 0;
  const owedAmount = Number(group.owedAmount ?? (balance > 0 ? balance : 0)) || 0;
  const hasOwe = oweAmount >= 1;
  const hasOwed = owedAmount >= 1;
  const statusMarkup =
    hasOwe && hasOwed
      ? `
        <div class="group-status mixed">
          <strong class="positive">You are owed ${formatCurrency(owedAmount, group.currency)}</strong>
          <strong class="negative">You owe ${formatCurrency(oweAmount, group.currency)}</strong>
        </div>
      `
      : hasOwed
        ? `<strong class="positive">You are owed ${formatCurrency(owedAmount, group.currency)}</strong>`
        : hasOwe
          ? `<strong class="negative">You owe ${formatCurrency(oweAmount, group.currency)}</strong>`
          : `<strong class="positive">You are settled</strong>`;

  return `
    <article class="group-card">
      <div class="group-card-top">
        <span>${icon("users")}</span>
        <div>
          <h2>${escapeHtml(group.name)}</h2>
          <p>${group.memberCount} members · ${group.expenseCount} expenses</p>
        </div>
      </div>
      ${statusMarkup}
      <p class="member-line">${escapeHtml(group.members.slice(0, 5).join(", "))}</p>
      <div class="group-card-actions">
        <button class="command-button primary" type="button" data-open-group="${group.id}">Open group</button>
        ${
          group.isAdmin
            ? `
              <button class="command-button danger" type="button" data-delete-group="${group.id}" ${state.busy ? "disabled" : ""}>
                ${icon("trash")}
                Delete
              </button>
            `
            : ""
        }
      </div>
    </article>
  `;
}

function renderAppHeader(title, backButton = "") {
  return `
    <header class="workspace-header">
      <div class="brand-block">
        <span class="brand-mark">S</span>
        <div>
          <p class="eyebrow">SoftSettle</p>
          <h1>${escapeHtml(title)}</h1>
        </div>
      </div>
      <div class="header-controls">
        ${backButton}
        <div class="user-tools">
          <div>
            <span>Signed in</span>
            <strong>${escapeHtml(state.user?.name || "User")}</strong>
          </div>
          <button class="icon-button secondary" id="logout-button" type="button" aria-label="Log out" title="Log out">
            ${icon("logout")}
          </button>
        </div>
      </div>
    </header>
  `;
}

function renderWorkspace() {
  const settlements = calculateDirectSettlements(state.people, state.expenses, state.payments);
  const personalSettlements = getPersonalSettlements(settlements);

  if (!personalSettlements.some((settlement) => settlement.id === state.selectedSettlementId)) {
    state.selectedSettlementId = personalSettlements[0]?.id || "";
  }

  const selectedSettlement =
    personalSettlements.find((settlement) => settlement.id === state.selectedSettlementId) || personalSettlements[0];
  const selectedMessage = createMessage(selectedSettlement);

  app.innerHTML = `
    <header class="workspace-header">
      <div class="brand-block">
        <span class="brand-mark">S</span>
        <div>
          <p class="eyebrow">Group workspace</p>
          <div class="title-line">
            <h1>${escapeHtml(state.tripName || "Group")}</h1>
            <button class="icon-button secondary title-settings" id="open-settings" type="button" aria-label="Group settings" title="Group settings">
              ${icon("settings")}
            </button>
          </div>
        </div>
      </div>
      <div class="header-controls">
        <button class="command-button secondary" id="back-to-groups" type="button">
          ${icon("back")}
          Groups
        </button>
        <div class="user-tools">
          <div>
            <span>Signed in</span>
            <strong>${escapeHtml(state.user?.name || "User")}</strong>
          </div>
          <button class="icon-button secondary" id="logout-button" type="button" aria-label="Log out" title="Log out">
            ${icon("logout")}
          </button>
        </div>
      </div>
    </header>

    ${state.error ? `<div class="notice error">${escapeHtml(state.error)}</div>` : ""}
    ${state.notice ? `<div class="notice success">${escapeHtml(state.notice)}</div>` : ""}
    ${renderNetSummary(personalSettlements)}

    <main class="workspace-grid">
      <section class="left-stack" aria-label="Expense setup">
        ${renderContextPanel(personalSettlements)}
        ${renderPeoplePanel()}
        ${renderExpenseForm()}
        ${renderExpenseLog()}
      </section>

      <aside class="right-stack" aria-label="Settlement results">
        ${renderSettlementPanel(personalSettlements)}
        ${renderMessagePanel(personalSettlements, selectedSettlement, selectedMessage)}
      </aside>
    </main>
    ${renderSettingsModal()}
  `;

  bindWorkspaceEvents();
}

function renderPayPage() {
  const settlements = calculateDirectSettlements(state.people, state.expenses, state.payments);
  const youOwe = settlements.filter((settlement) => settlement.fromId === state.currentUserPersonId);
  const owedToYou = settlements.filter((settlement) => settlement.toId === state.currentUserPersonId);
  const backButton = `
    <button class="command-button secondary" id="back-to-workspace" type="button">
      ${icon("back")}
      Group
    </button>
  `;

  app.innerHTML = `
    ${renderAppHeader("Pay", backButton)}
    ${state.notice ? `<div class="notice success">${escapeHtml(state.notice)}</div>` : ""}
    ${state.error ? `<div class="notice error">${escapeHtml(state.error)}</div>` : ""}
    <main class="pay-page">
      <section class="pay-hero">
        <div>
          <p class="eyebrow">${escapeHtml(state.tripName)}</p>
          <h1>Settle group payments.</h1>
        </div>
        <div class="run-box compact">
          <span>${icon("card")}</span>
          <p>Choose a person, confirm the payment, and SoftSettle updates the group balance.</p>
        </div>
      </section>
      <section class="pay-grid">
        ${renderPaymentList("You need to pay", youOwe, "Pay now")}
        ${renderPaymentList("People owe you", owedToYou, "Mark received")}
      </section>
    </main>
  `;

  bindPayEvents();
}

function renderPaymentList(title, settlements, actionLabel) {
  return `
    <section class="tool-panel pay-panel">
      <div class="panel-heading">
        <div>
          <h2>${escapeHtml(title)}</h2>
        </div>
      </div>
      <div class="payment-list">
        ${
          settlements.length
            ? settlements
                .map((settlement) => {
                  const otherPerson =
                    settlement.fromId === state.currentUserPersonId
                      ? findPerson(settlement.toId)
                      : findPerson(settlement.fromId);
                  return `
                    <article class="payment-card">
                      <div class="avatar" aria-hidden="true">${escapeHtml((otherPerson?.name || "?").slice(0, 1).toUpperCase())}</div>
                      <div>
                        <strong>${escapeHtml(otherPerson?.name || "Member")}</strong>
                        <span>${escapeHtml(settlement.fromName)} pays ${escapeHtml(settlement.toName)}</span>
                      </div>
                      <strong>${formatCurrency(settlement.amount, state.currency)}</strong>
                      <button class="command-button primary" type="button" data-settle-payment="${settlement.id}" ${state.busy ? "disabled" : ""}>
                        ${icon("check")}
                        ${escapeHtml(actionLabel)}
                      </button>
                      ${renderSettlementBreakdown(settlement)}
                    </article>
                  `;
                })
                .join("")
            : `<p class="empty-state">${icon("check")} Nothing pending here.</p>`
        }
      </div>
    </section>
  `;
}

function renderNetSummary(settlements) {
  const totals = getPersonalDirectionTotals(settlements);
  const isSettled = totals.owe < 1 && totals.owed < 1;
  const hasOwe = totals.owe >= 1;
  const hasOwed = totals.owed >= 1;
  const className = isSettled ? "settled" : hasOwe && hasOwed ? "mixed" : hasOwed ? "positive" : "negative";
  const title = isSettled
    ? "You are settled in this group"
    : hasOwe && hasOwed
      ? "You have open payments in this group"
      : hasOwed
        ? "People owe you in total"
        : "You need to pay in total";
  const amountMarkup =
    hasOwe && hasOwed
      ? `
        <div class="dual-total">
          <span class="positive">To receive <strong>${formatCurrency(totals.owed, state.currency)}</strong></span>
          <span class="negative">To pay <strong>${formatCurrency(totals.owe, state.currency)}</strong></span>
        </div>
      `
      : `<strong>${formatCurrency(isSettled ? 0 : hasOwed ? totals.owed : totals.owe, state.currency)}</strong>`;
  const personalLines = settlements
    .slice(0, 3)
    .map((settlement) =>
      settlement.direction === "owe"
        ? `Pay ${settlement.name} ${formatCurrency(settlement.amount, state.currency)}`
        : `${settlement.name} owes you ${formatCurrency(settlement.amount, state.currency)}`
    );

  return `
    <section class="net-summary ${className}">
      <div>
        <p class="eyebrow">Your group total</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(personalLines.length ? personalLines.join(" · ") : "No pending person-to-person payments.")}</p>
      </div>
      <div class="net-actions">
        ${amountMarkup}
        <button class="command-button primary" id="open-pay-page" type="button" ${!settlements.length || state.busy ? "disabled" : ""}>
          ${icon("card")}
          Pay
        </button>
      </div>
    </section>
  `;
}

function renderContextPanel(settlements) {
  const total = state.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const paymentApps = new Set(state.people.map((person) => person.paymentApp).filter(Boolean)).size;
  const settledTotal = state.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  return `
    <section class="context-panel compact-context">
      <div class="receipt-visual" aria-label="Group receipt snapshot">
        <div class="receipt-top">
          <span>${icon("receipt")}</span>
          <strong>Group snapshot</strong>
        </div>
        <dl>
          <div><dt>Total logged</dt><dd>${formatCurrency(total, state.currency)}</dd></div>
          <div><dt>Open payments</dt><dd>${settlements.length}</dd></div>
          <div><dt>Settled</dt><dd>${formatCurrency(settledTotal, state.currency)}</dd></div>
          <div><dt>Payment apps</dt><dd>${paymentApps}</dd></div>
        </dl>
      </div>
    </section>
  `;
}

function renderPeoplePanel() {
  return `
    <section class="tool-panel">
      <div class="panel-heading">
        <div>
          <h2>MEMBERS</h2>
        </div>
      </div>
      <div class="person-list">
        ${state.people
          .map(
            (person) => `
              <div class="person-row ${person.id === state.currentUserPersonId ? "current-user-row" : ""}">
                <div class="avatar" aria-hidden="true">${escapeHtml(person.name.slice(0, 1).toUpperCase())}</div>
                <div>
                  <strong>${escapeHtml(person.name)}${person.id === state.currentUserPersonId ? " (you)" : ""}</strong>
                  <span>${escapeHtml(person.paymentApp)} · ${person.role === "owner" ? "Admin" : "Member"}</span>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderExpenseForm() {
  const editingExpense = state.editingExpenseId
    ? state.expenses.find((expense) => expense.id === state.editingExpenseId)
    : null;
  const selectedParticipantIds = editingExpense ? editingExpense.participantIds : state.people.map((person) => person.id);
  const hasCustomShares = Boolean(editingExpense?.shares?.some((share) => share.amount !== null && share.amount !== undefined));
  const splitMode = hasCustomShares ? "custom" : "equal";
  const amountValue = editingExpense ? Math.round(editingExpense.amount) : "";
  const shareFor = (personId) => {
    const share = editingExpense?.shares?.find((item) => item.personId === personId);
    return share?.amount === null || share?.amount === undefined ? "" : Math.round(share.amount);
  };
  const participantInputs = state.people
    .map(
      (person) => `
        <label class="chip-check">
          <input
            type="checkbox"
            name="participantIds"
            value="${person.id}"
            data-participant-check="${person.id}"
            ${selectedParticipantIds.includes(person.id) ? "checked" : ""}
            ${state.busy ? "disabled" : ""}
          />
          <span>${escapeHtml(person.name)}</span>
        </label>
      `
    )
    .join("");
  const customShareRows = state.people
    .map(
      (person) => `
        <label class="share-row ${selectedParticipantIds.includes(person.id) ? "is-active" : ""}" data-share-row="${person.id}">
          <span>${escapeHtml(person.name)}</span>
          <input
            name="share-${person.id}"
            inputmode="numeric"
            placeholder="0"
            value="${escapeHtml(shareFor(person.id))}"
            ${state.busy ? "disabled" : ""}
          />
        </label>
      `
    )
    .join("");

  return `
    <section class="tool-panel">
      <div class="panel-heading">
        <div>
          <h2>${editingExpense ? "Edit shared cost" : "Add shared cost"}</h2>
        </div>
      </div>
      <form id="expense-form" class="expense-form">
        <label>
          <span>Expense</span>
          <input name="title" placeholder="Ferry tickets" value="${escapeHtml(editingExpense?.title || "")}" required ${state.busy ? "disabled" : ""} />
        </label>
        <label>
          <span>Amount</span>
          <input name="amount" inputmode="numeric" placeholder="48000" value="${escapeHtml(amountValue)}" required ${state.busy ? "disabled" : ""} />
        </label>
        <label>
          <span>Paid by</span>
          <select name="payerId" ${state.busy ? "disabled" : ""}>
            ${state.people
              .map(
                (person) =>
                  `<option value="${person.id}" ${editingExpense?.payerId === person.id ? "selected" : ""}>${escapeHtml(person.name)}</option>`
              )
              .join("")}
          </select>
        </label>
        <fieldset class="split-options">
          <legend>Division</legend>
          <label>
            <input type="radio" name="splitMode" value="equal" ${splitMode === "equal" ? "checked" : ""} ${state.busy ? "disabled" : ""} />
            <span>Equal split</span>
          </label>
          <label>
            <input type="radio" name="splitMode" value="custom" ${splitMode === "custom" ? "checked" : ""} ${state.busy ? "disabled" : ""} />
            <span>Custom amounts</span>
          </label>
        </fieldset>
        <fieldset>
          <legend>Who should share this cost?</legend>
          <div class="chip-grid">${participantInputs}</div>
        </fieldset>
        <fieldset id="custom-share-box" class="custom-share-box ${splitMode === "custom" ? "is-visible" : ""}">
          <legend>Amount per selected member</legend>
          <div class="share-list">${customShareRows}</div>
        </fieldset>
        <button class="command-button primary" type="submit" ${state.busy || !state.people.length ? "disabled" : ""}>
          ${editingExpense ? icon("check") : icon("plus")}
          ${editingExpense ? "Save expense" : "Add expense"}
        </button>
        ${
          editingExpense
            ? `
              <button class="command-button secondary" id="cancel-expense-edit" type="button" ${state.busy ? "disabled" : ""}>
                Cancel edit
              </button>
            `
            : ""
        }
      </form>
    </section>
  `;
}

function renderExpenseLog() {
  return `
    <section class="tool-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Audit trail</p>
          <h2>Expense log</h2>
        </div>
      </div>
      <div class="expense-list">
        ${state.expenses
          .map((expense) => {
            const payer = findPerson(expense.payerId)?.name || "Unknown";
            const participants = expense.participantIds
              .map((id) => findPerson(id)?.name)
              .filter(Boolean)
              .join(", ");
            const splitLabel = describeExpenseShares(expense);

            return `
              <article class="expense-item">
                <div>
                  <strong>${escapeHtml(expense.title)}</strong>
                  <span>Paid by ${escapeHtml(payer)} · shared by ${escapeHtml(participants)}</span>
                  <p>${escapeHtml(splitLabel)}</p>
                </div>
                <div class="amount-block">
                  <strong>${formatCurrency(expense.amount, state.currency)}</strong>
                  <div class="expense-actions">
                    <button class="text-button" data-edit-expense="${expense.id}" ${state.busy ? "disabled" : ""}>Edit</button>
                    <button class="text-button danger" data-remove-expense="${expense.id}" ${state.busy ? "disabled" : ""}>Remove</button>
                  </div>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderSettlementPanel(settlements) {
  return `
    <section class="tool-panel">
      <div class="panel-heading">
        <div>
          <h2>Personal Summary</h2>
          <p>Only payments involving you are shown.</p>
        </div>
      </div>
      <div class="settlement-list">
        ${
          settlements.length
            ? settlements
                .map(
                  (settlement) => `
                    <article class="settlement-card ${settlement.id === state.selectedSettlementId ? "selected" : ""}" data-select-settlement="${settlement.id}" role="button" tabindex="0" aria-label="${escapeHtml(getSettlementTitle(settlement))}">
                      <span>${escapeHtml(getSettlementTitle(settlement))}</span>
                      <strong>${formatCurrency(settlement.amount, state.currency)}</strong>
                      <small>${escapeHtml(getSettlementStatus(settlement))}</small>
                      ${renderSettlementBreakdown(settlement)}
                    </article>
                  `
                )
                .join("")
            : `<p class="empty-state">${icon("check")} You are settled.</p>`
        }
      </div>
    </section>
  `;
}

function renderMessagePanel(settlements, selectedSettlement, message) {
  const selectedContact = getSettlementContactName(selectedSettlement);

  return `
    <section class="tool-panel">
      <div class="panel-heading">
        <div>
          <h2>Payment request</h2>
        </div>
      </div>
      <div class="message-controls">
        <label>
          <span>Person to message</span>
          <select id="settlement-select" ${settlements.length && !state.busy ? "" : "disabled"}>
            ${settlements
              .map(
                (settlement) => `
                  <option value="${settlement.id}" ${settlement.id === state.selectedSettlementId ? "selected" : ""}>
                    ${escapeHtml(getSettlementContactName(settlement))}
                  </option>
                `
              )
              .join("")}
          </select>
        </label>
      </div>
      <div class="phone-preview" aria-label="Generated payment request">
        <div class="phone-header">
          <span>${selectedSettlement ? escapeHtml(selectedContact) : "Friend"}</span>
          <small>${selectedSettlement ? `${escapeHtml(channelLabel(state.messageChannel))} prototype` : "No message needed"}</small>
        </div>
        <p>${escapeHtml(message)}</p>
      </div>
      <div class="button-row channel-buttons">
        <button class="command-button secondary" id="copy-message" ${selectedSettlement && !state.busy ? "" : "disabled"}>
          ${icon("copy")}
          ${state.lastCopied ? "Copied" : "Copy"}
        </button>
        <button class="command-button primary" id="open-message" ${selectedSettlement && !state.busy ? "" : "disabled"}>
          ${icon("message")}
          Message
        </button>
        <button class="command-button primary kakao-button" id="open-kakao" ${selectedSettlement && !state.busy ? "" : "disabled"}>
          K
          KakaoTalk
        </button>
      </div>
    </section>
  `;
}

function renderSettingsModal() {
  if (!state.settingsOpen) {
    return "";
  }

  const memberUserIds = new Set(state.people.map((person) => person.userId).filter(Boolean));
  const availableUsers = state.demoUsers.filter((user) => user.id && !memberUserIds.has(user.id));

  return `
    <div class="modal-backdrop" role="presentation">
      <section class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="modal-heading">
          <div>
            <p class="eyebrow">Group settings</p>
            <h2 id="settings-title">Manage this group</h2>
          </div>
          <button class="icon-button secondary" id="close-settings" type="button" aria-label="Close settings" title="Close settings">
            X
          </button>
        </div>
        <form id="settings-form" class="settings-form">
          <label>
            <span>Group name</span>
            <input name="tripName" value="${escapeHtml(state.tripName)}" ${state.busy || !state.isAdmin ? "disabled" : ""} />
          </label>
          <label>
            <span>Currency</span>
            <select name="currency" ${state.busy || !state.isAdmin ? "disabled" : ""}>
              ${["KRW", "USD", "MYR", "SGD"]
                .map(
                  (currency) =>
                    `<option value="${currency}" ${state.currency === currency ? "selected" : ""}>${currency}</option>`
                )
                .join("")}
            </select>
          </label>
          <button class="command-button primary" type="submit" ${state.busy || !state.isAdmin ? "disabled" : ""}>
            ${icon("check")}
            Save settings
          </button>
        </form>
        <div class="settings-section">
          <div class="panel-heading compact-heading">
            <div>
              <p class="eyebrow">Saved database users</p>
              <h2>Add member</h2>
            </div>
          </div>
          <form id="settings-add-member-form" class="settings-form">
            <label>
              <span>User</span>
              <select name="userId" ${state.busy || !state.isAdmin || !availableUsers.length ? "disabled" : ""}>
                ${
                  availableUsers.length
                    ? availableUsers
                        .map((user) => `<option value="${user.id}">${escapeHtml(user.name)} · ${escapeHtml(user.email)}</option>`)
                        .join("")
                    : `<option>No saved users available</option>`
                }
              </select>
            </label>
            <button class="command-button secondary" type="submit" ${state.busy || !state.isAdmin || !availableUsers.length ? "disabled" : ""}>
              ${icon("plus")}
              Add to group
            </button>
          </form>
        </div>
        <div class="settings-section">
          <div class="panel-heading compact-heading">
            <div>
              <p class="eyebrow">${state.isAdmin ? "Admin controls" : "Owner-only controls"}</p>
              <h2>Members</h2>
            </div>
          </div>
          <div class="settings-member-list">
            ${state.people
              .map((person) => {
                const isCurrentUser = person.id === state.currentUserPersonId;
                const isOwner = person.role === "owner";
                const canRemove = state.isAdmin && !isCurrentUser && !isOwner;

                return `
                  <div class="settings-member-row">
                    <div>
                      <strong>${escapeHtml(person.name)}${isCurrentUser ? " (you)" : ""}</strong>
                      <span>${escapeHtml(person.paymentApp)} · ${isOwner ? "Admin" : "Member"}</span>
                    </div>
                    <button class="text-button danger" type="button" data-remove-member="${person.id}" ${canRemove && !state.busy ? "" : "disabled"}>
                      Remove
                    </button>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      </section>
    </div>
  `;
}

function bindAuthEvents() {
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authMode = button.dataset.authMode;
      state.error = "";
      state.notice = "";
      render();
    });
  });

  document.querySelectorAll("[data-demo-email]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authMode = "login";
      state.prefillEmail = button.dataset.demoEmail;
      state.error = "";
      state.notice = "Demo account selected. Use the shared demo password.";
      render();
    });
  });

  document.querySelector("#auth-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    if (state.authMode === "register") {
      await runAction(async () => {
        const response = await api("/api/auth/register", {
          method: "POST",
          body: payload
        });
        state.authMode = "login";
        state.prefillEmail = response.email || payload.email || "";
        state.notice = response.message || "Account saved. Please log in.";
      });
      return;
    }

    await runAction(async () => {
      const response = await api("/api/auth/login", {
        method: "POST",
        body: payload
      });
      state.user = response.user;
      state.groups = response.groups || [];
      state.notice = "";
      state.view = "groups";
    });
  });
}

function bindCreateGroupEvents() {
  document.querySelector("#group-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const memberUserIds = formData.getAll("memberUserIds").map(Number);

    if (!name) {
      return;
    }

    await runAction(async () => {
      const response = await api("/api/groups", {
        method: "POST",
        body: { name, memberUserIds }
      });
      state.groups = response.groups || [];
      state.notice = "Group created. Open it to start adding expenses.";
    });
  });
}

function bindGlobalHeaderEvents() {
  document.querySelector("#logout-button")?.addEventListener("click", async () => {
    await runAction(async () => {
      await api("/api/auth/logout", { method: "POST" });
      state.user = null;
      state.groups = [];
      state.view = "auth";
      state.error = "";
      state.notice = "";
    });
  });
}

function bindWorkspaceEvents() {
  bindGlobalHeaderEvents();

  document.querySelector("#back-to-groups")?.addEventListener("click", async () => {
    await runAction(async () => {
      await loadGroups();
      state.view = "groups";
      state.error = "";
      state.notice = "";
    });
  });

  document.querySelector("#open-settings")?.addEventListener("click", () => {
    state.settingsOpen = true;
    state.error = "";
    render();
  });

  document.querySelector("#open-pay-page")?.addEventListener("click", () => {
    state.view = "pay";
    state.error = "";
    state.notice = "";
    render();
  });

  bindSettingsEvents();
  bindSplitFormEvents();

  document.querySelector("#expense-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") || "").trim();
    const amount = Number(String(formData.get("amount") || "").replace(/[^0-9.]/g, ""));
    const payerId = Number(formData.get("payerId"));
    const participantIds = formData.getAll("participantIds").map(Number);
    const splitMode = String(formData.get("splitMode") || "equal");
    const shares =
      splitMode === "custom"
        ? participantIds.map((personId) => ({
            personId,
            amount: Number(String(formData.get(`share-${personId}`) || "").replace(/[^0-9.]/g, ""))
          }))
        : [];

    if (!title || !amount || !payerId || !participantIds.length) {
      return;
    }

    if (splitMode === "custom") {
      const hasMissingShare = shares.some((share) => !Number.isFinite(share.amount) || share.amount < 0);
      const shareTotal = shares.reduce((sum, share) => sum + share.amount, 0);
      if (hasMissingShare || Math.abs(shareTotal - amount) > 1) {
        state.error = "Custom member amounts must add up to the expense total.";
        render();
        return;
      }
    }

    state.selectedSettlementId = "";
    state.lastCopied = false;
    const editingExpenseId = state.editingExpenseId;
    state.editingExpenseId = null;
    await persistGroup(() =>
      api(
        editingExpenseId
          ? `/api/groups/${state.currentGroupId}/expenses/${editingExpenseId}`
          : `/api/groups/${state.currentGroupId}/expenses`,
        {
          method: editingExpenseId ? "PUT" : "POST",
          body: { title, amount, payerId, participantIds, splitMode, shares }
        }
      )
    );
  });

  document.querySelector("#cancel-expense-edit")?.addEventListener("click", () => {
    state.editingExpenseId = null;
    render();
  });

  document.querySelectorAll("[data-edit-expense]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingExpenseId = Number(button.dataset.editExpense);
      state.error = "";
      render();
      document.querySelector("#expense-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll("[data-remove-expense]").forEach((button) => {
    button.addEventListener("click", async () => {
      const expense = state.expenses.find((item) => item.id === Number(button.dataset.removeExpense));
      if (!window.confirm(`Remove "${expense?.title || "this expense"}"?`)) {
        return;
      }
      state.selectedSettlementId = "";
      state.lastCopied = false;
      if (state.editingExpenseId === Number(button.dataset.removeExpense)) {
        state.editingExpenseId = null;
      }
      await persistGroup(() =>
        api(`/api/groups/${state.currentGroupId}/expenses/${button.dataset.removeExpense}`, {
          method: "DELETE"
        })
      );
    });
  });

  document.querySelectorAll("[data-select-settlement]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.busy) {
        return;
      }
      state.selectedSettlementId = button.dataset.selectSettlement;
      state.lastCopied = false;
      render();
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        button.click();
      }
    });
  });

  document.querySelector("#settlement-select")?.addEventListener("change", (event) => {
    state.selectedSettlementId = event.target.value;
    state.lastCopied = false;
    render();
  });

  document.querySelector("#copy-message")?.addEventListener("click", async () => {
    const settlement = getSelectedSettlement();
    if (!settlement) {
      return;
    }

    const message = createMessage(settlement);
    await copyText(message);
    state.lastCopied = true;
    render();
  });

  document.querySelector("#open-message")?.addEventListener("click", () => sendThroughChannel("message"));
  document.querySelector("#open-kakao")?.addEventListener("click", () => sendThroughChannel("kakao"));
}

function bindPayEvents() {
  bindGlobalHeaderEvents();

  document.querySelector("#back-to-workspace")?.addEventListener("click", () => {
    state.view = "group";
    state.error = "";
    state.notice = "";
    render();
  });

  document.querySelectorAll("[data-settle-payment]").forEach((button) => {
    button.addEventListener("click", async () => {
      const settlement = getCurrentSettlements().find((item) => item.id === button.dataset.settlePayment);
      if (!settlement) {
        return;
      }

      const isPaying = settlement.fromId === state.currentUserPersonId;
      const question = isPaying
        ? `Are you settling ${formatCurrency(settlement.amount, state.currency)} to ${settlement.toName}?`
        : `Did ${settlement.fromName} settle ${formatCurrency(settlement.amount, state.currency)} with you?`;

      if (!window.confirm(question)) {
        return;
      }

      await runAction(async () => {
        hydrateGroup(
          await api(`/api/groups/${state.currentGroupId}/payments`, {
            method: "POST",
            body: {
              fromId: settlement.fromId,
              toId: settlement.toId,
              amount: settlement.amount
            }
          })
        );
        state.view = "group";
        state.notice = "Payment settled. The group balance has been updated.";
      });
    });
  });
}

function bindSettingsEvents() {
  document.querySelector("#close-settings")?.addEventListener("click", () => {
    state.settingsOpen = false;
    render();
  });

  document.querySelector(".modal-backdrop")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      state.settingsOpen = false;
      render();
    }
  });

  document.querySelector("#settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const tripName = String(formData.get("tripName") || "").trim();
    const currency = String(formData.get("currency") || "KRW").trim();

    if (!tripName) {
      state.error = "Group name is required.";
      render();
      return;
    }

    await persistGroup(() =>
      api(`/api/groups/${state.currentGroupId}`, {
        method: "PUT",
        body: { tripName, currency }
      })
    );
    state.notice = "Group settings saved.";
    render();
  });

  document.querySelector("#settings-add-member-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const userId = Number(formData.get("userId"));

    if (!userId) {
      return;
    }

    await persistGroup(() =>
      api(`/api/groups/${state.currentGroupId}/people`, {
        method: "POST",
        body: { userId }
      })
    );
    state.notice = "Member added from the saved user database.";
    render();
  });

  document.querySelectorAll("[data-remove-member]").forEach((button) => {
    button.addEventListener("click", async () => {
      const person = findPerson(button.dataset.removeMember);
      if (!window.confirm(`Remove ${person?.name || "this member"} from the group?`)) {
        return;
      }

      await persistGroup(() =>
        api(`/api/groups/${state.currentGroupId}/people/${button.dataset.removeMember}`, {
          method: "DELETE"
        })
      );
      state.notice = "Member removed from the group.";
      render();
    });
  });
}

function bindSplitFormEvents() {
  const form = document.querySelector("#expense-form");
  const customBox = document.querySelector("#custom-share-box");

  if (!form || !customBox) {
    return;
  }

  const updateCustomRows = () => {
    const splitMode = form.querySelector('input[name="splitMode"]:checked')?.value || "equal";
    const isCustom = splitMode === "custom";
    customBox.classList.toggle("is-visible", isCustom);

    form.querySelectorAll("[data-share-row]").forEach((row) => {
      const personId = row.dataset.shareRow;
      const checked = Boolean(form.querySelector(`[data-participant-check="${personId}"]`)?.checked);
      row.classList.toggle("is-active", checked);
      row.querySelector("input").disabled = !isCustom || !checked || state.busy;
    });
  };

  form.querySelectorAll('input[name="splitMode"], [data-participant-check]').forEach((input) => {
    input.addEventListener("change", updateCustomRows);
  });
  updateCustomRows();
}

async function sendThroughChannel(channel) {
  const settlement = getSelectedSettlement();
  if (!settlement) {
    return;
  }

  state.messageChannel = channel;
  const message = createMessage(settlement);
  await copyText(message);
  await persistGroup(() =>
    api(`/api/groups/${state.currentGroupId}/messages/sent`, {
      method: "POST",
      body: {
        fromId: settlement.fromId,
        toId: settlement.toId,
        amount: settlement.amount,
        message
      }
    })
  );
  state.lastCopied = true;
  state.notice =
    channel === "kakao"
      ? "Prototype: KakaoTalk would open with this payment request pre-filled. The message was copied too."
      : "Prototype: Messages would open with this payment request pre-filled. The message was copied too.";
  render();
}

function channelLabel(channel) {
  return channel === "kakao" ? "KakaoTalk" : "Messages";
}

function renderSettlementBreakdown(settlement) {
  const lines = getSettlementBreakdown(settlement);
  const routeNote = getSettlementRouteNote(settlement, lines);

  if (!lines.length) {
    return "";
  }

  return `
    <div class="settlement-breakdown">
      <small>What this covers</small>
      <ul>
        ${lines
          .map(
            (line) => `
              <li class="${line.amount < 0 ? "offset-line" : ""}">
                <span>${escapeHtml(line.title)}</span>
                <strong>${line.amount < 0 ? "-" : ""}${formatCurrency(Math.abs(line.amount), state.currency)}</strong>
              </li>
            `
          )
          .join("")}
      </ul>
      ${routeNote ? `<p>${escapeHtml(routeNote)}</p>` : ""}
    </div>
  `;
}

function getSettlementBreakdown(settlement) {
  if (!settlement) {
    return [];
  }

  if (settlement.lines?.length) {
    return settlement.lines;
  }

  const directLines = state.expenses
    .filter((expense) => expense.payerId === settlement.toId && expense.participantIds.includes(settlement.fromId))
    .map((expense) => ({
      title: expense.title,
      amount: getExpenseShareForPerson(expense, settlement.fromId),
      payerId: expense.payerId
    }))
    .filter((line) => line.amount > 0);

  if (directLines.length) {
    return withNetAdjustment(directLines, settlement.amount);
  }

  return [{ title: "Net group balance", amount: settlement.amount }];
}

function withNetAdjustment(lines, targetAmount) {
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const diff = Number(targetAmount || 0) - total;
  const adjustedLines = [...lines];

  if (Math.abs(diff) > 1) {
    adjustedLines.push({
      title: diff < 0 ? "Offset by costs already paid" : "Other netted shared costs",
      amount: diff
    });
  }

  return adjustedLines;
}

function getSettlementRouteNote(settlement, lines) {
  return "";
}

function getExpenseShareForPerson(expense, personId) {
  if (!expense.participantIds.includes(personId)) {
    return 0;
  }

  const share = (expense.shares || []).find((item) => item.personId === personId);
  const customShare = share?.amount === null || share?.amount === undefined ? Number.NaN : Number(share.amount);
  if (Number.isFinite(customShare)) {
    return customShare;
  }

  return Number(expense.amount || 0) / Math.max(expense.participantIds.length, 1);
}

function getSettlementTitle(settlement) {
  if (!settlement) {
    return "No payment needed";
  }

  if (settlement.fromId === state.currentUserPersonId) {
    return `You pay ${settlement.toName}`;
  }

  if (settlement.toId === state.currentUserPersonId) {
    return `${settlement.fromName} pays you`;
  }

  return `${settlement.fromName} pays ${settlement.toName}`;
}

function getSettlementStatus(settlement) {
  if (state.sentSettlementKeys.has(settlement.id)) {
    return "Message sent";
  }

  return settlement.fromId === state.currentUserPersonId ? "Ready to pay" : "Ready to ask";
}

function getSettlementContactName(settlement) {
  if (!settlement) {
    return "Friend";
  }

  return settlement.fromId === state.currentUserPersonId ? settlement.toName : settlement.fromName;
}

function describeExpenseShares(expense) {
  const shareMap = new Map(
    (expense.shares || []).map((share) => [
      share.personId,
      share.amount === null || share.amount === undefined ? Number.NaN : Number(share.amount)
    ])
  );
  const hasCustomShares = expense.participantIds.every((personId) => Number.isFinite(shareMap.get(personId)));

  if (!hasCustomShares) {
    const share = Number(expense.amount || 0) / Math.max(expense.participantIds.length, 1);
    return `Equal split · ${formatCurrency(share, state.currency)} each`;
  }

  return expense.participantIds
    .map((personId) => {
      const person = findPerson(personId);
      return `${person?.name || "Member"} ${formatCurrency(shareMap.get(personId), state.currency)}`;
    })
    .join(" · ");
}

function createMessage(settlement) {
  if (!settlement) {
    return "Everyone is settled. No reminder needed.";
  }

  const amount = formatCurrency(settlement.amount, state.currency);
  const receiver = findPerson(settlement.toId);
  const paymentApp = receiver?.paymentApp || "your preferred payment app";

  if (settlement.fromId === state.currentUserPersonId) {
    return `Hi ${settlement.toName}, SoftSettle shows I should send you ${amount} for ${state.tripName}. I am sending it through ${paymentApp}; please confirm when you receive it.`;
  }

  return `Hi ${settlement.fromName}, I finished organizing the ${state.tripName} expenses. Your remaining share is ${amount} to ${settlement.toName} through ${paymentApp}. Sending it clearly here so it is easier for everyone.`;
}

function getSelectedSettlement() {
  const settlements = getCurrentSettlements();
  return settlements.find((settlement) => settlement.id === state.selectedSettlementId) || settlements[0];
}

function getCurrentSettlements() {
  return calculateDirectSettlements(state.people, state.expenses, state.payments);
}

function getPersonalSettlements(settlements) {
  return settlements
    .filter((settlement) => settlement.fromId === state.currentUserPersonId || settlement.toId === state.currentUserPersonId)
    .map((settlement) => {
      const direction = settlement.fromId === state.currentUserPersonId ? "owe" : "owed";
      const name = direction === "owe" ? settlement.toName : settlement.fromName;
      return { ...settlement, direction, name };
    });
}

function getPersonalDirectionTotals(settlements) {
  return settlements.reduce(
    (totals, settlement) => {
      if (settlement.direction === "owe") {
        totals.owe += Number(settlement.amount) || 0;
      } else if (settlement.direction === "owed") {
        totals.owed += Number(settlement.amount) || 0;
      }
      return totals;
    },
    { owe: 0, owed: 0 }
  );
}

function findPerson(id) {
  return state.people.find((person) => person.id === Number(id));
}

async function persistGroup(requestFactory) {
  await runAction(async () => {
    hydrateGroup(await requestFactory());
  });
}

async function runAction(action) {
  state.busy = true;
  state.error = "";
  render();

  try {
    await action();
    state.error = "";
  } catch (error) {
    state.error = error.message;
  } finally {
    state.busy = false;
    render();
  }
}

async function api(path, options = {}) {
  const headers = {
    ...(options.headers || {})
  };
  const fetchOptions = {
    method: options.method || "GET",
    credentials: "same-origin",
    headers
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, fetchOptions);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

function settlementKey(fromId, toId, amount) {
  return `${fromId}-${toId}-${Math.round(Number(amount) || 0)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the textarea fallback for local and non-HTTPS previews.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

init();
