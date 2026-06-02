export function formatCurrency(value, currency = "KRW") {
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

export function calculateBalances(people, expenses, payments = []) {
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

    if (!amount || !participantIds.length || !balances.hasOwnProperty(expense.payerId)) {
      return;
    }

    const equalShare = amount / participantIds.length;
    balances[expense.payerId] += amount;

    participantIds.forEach((participantId) => {
      if (balances.hasOwnProperty(participantId)) {
        const customShare = shareMap.get(participantId);
        const share = Number.isFinite(customShare) ? customShare : equalShare;
        balances[participantId] -= share;
      }
    });
  });

  payments.forEach((payment) => {
    const amount = Number(payment.amount) || 0;
    if (amount <= 0 || !balances.hasOwnProperty(payment.fromId) || !balances.hasOwnProperty(payment.toId)) {
      return;
    }

    balances[payment.fromId] += amount;
    balances[payment.toId] -= amount;
  });

  return balances;
}

export function simplifySettlements(people, balances) {
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
        id: `${debtor.id}-${creditor.id}-${settlements.length}`,
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
