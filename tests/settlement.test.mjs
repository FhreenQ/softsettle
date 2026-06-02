import assert from "node:assert/strict";
import { calculateBalances, simplifySettlements } from "../prototype/settlement.js";

const people = [
  { id: 1, name: "Fahreen" },
  { id: 2, name: "Asha" },
  { id: 3, name: "Mira" },
  { id: 4, name: "Daniel" }
];

const expenses = [
  { amount: 320000, payerId: 1, participantIds: [1, 2, 3, 4] },
  { amount: 78000, payerId: 4, participantIds: [1, 2, 3, 4] },
  { amount: 36000, payerId: 2, participantIds: [1, 2, 3] }
];

const balances = calculateBalances(people, expenses);

assert.equal(Math.round(balances[1]), 208500);
assert.equal(Math.round(balances[2]), -75500);
assert.equal(Math.round(balances[3]), -111500);
assert.equal(Math.round(balances[4]), -21500);

const settlements = simplifySettlements(people, balances);

assert.deepEqual(
  settlements.map((settlement) => ({
    from: settlement.fromName,
    to: settlement.toName,
    amount: Math.round(settlement.amount)
  })),
  [
    { from: "Mira", to: "Fahreen", amount: 111500 },
    { from: "Asha", to: "Fahreen", amount: 75500 },
    { from: "Daniel", to: "Fahreen", amount: 21500 }
  ]
);

const customBalances = calculateBalances(people, [
  {
    amount: 100000,
    payerId: 1,
    participantIds: [1, 2, 3],
    shares: [
      { personId: 1, amount: 50000 },
      { personId: 2, amount: 30000 },
      { personId: 3, amount: 20000 }
    ]
  }
]);

assert.equal(Math.round(customBalances[1]), 50000);
assert.equal(Math.round(customBalances[2]), -30000);
assert.equal(Math.round(customBalances[3]), -20000);
assert.equal(Math.round(customBalances[4]), 0);

const afterPaymentBalances = calculateBalances(people, expenses, [{ fromId: 3, toId: 1, amount: 111500 }]);

assert.equal(Math.round(afterPaymentBalances[1]), 97000);
assert.equal(Math.round(afterPaymentBalances[2]), -75500);
assert.equal(Math.round(afterPaymentBalances[3]), 0);
assert.equal(Math.round(afterPaymentBalances[4]), -21500);

console.log("settlement tests passed");
