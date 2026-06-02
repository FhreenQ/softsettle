# SoftSettle - Making Group Trip Payments Less Awkward

## The Moment I Picked

I focused on the moment after a group trip when several friends have paid for different shared costs, but one person still has to make the settlement clear. A specific example is a weekend trip where one friend paid for dinner, another paid for car rental, and another covered lunch on the second day. After the trip, each traveler needs to know who they personally owe, what the amount is for, and how to settle without making the friendship feel awkward.

The broken moment is not simply "splitting costs is annoying." The sharper painpoint is this: group travelers often trust each other socially, but the money details become scattered across receipts, chats, memory, and different payment apps. When someone asks for repayment, they may sound petty even when the request is fair.

## Who This Is For

SoftSettle is for informal group travelers, especially students or young workers who plan trips with friends and regularly share meals, transport, accommodation, tickets, or groceries. The main user is not a finance expert or event manager. They are just the responsible friend who wants the group to settle fairly without damaging the mood.

The emotional cost matters. People may delay asking, undercharge, over-explain, or quietly absorb costs because they do not want to create tension.

## What People Do Today

Today, people usually use a mix of group chats, notes, screenshots, calculators, spreadsheets, receipts, and payment app histories. These workarounds fail because the information is fragmented. They also do not answer the most important traveler question clearly: "Why do I owe this amount, and who exactly do I pay?"

## How The Prototype Helps

SoftSettle is a working prototype that turns scattered trip costs into a personal settlement flow.

The user can create an account, log in, open groups from a real SQLite database, add saved users, manage group settings, add shared expenses, choose who participated in each expense, and split costs equally or by custom amounts. The audit trail keeps the original expense names visible.

The key feature is Personal Summary. Instead of showing every transfer in the group, it only shows payments involving the logged-in user. Each card explains what the money covers using the actual expense names, such as "Shared dinner," "Makan malam," or "Car rental." If two people owe each other in opposite directions, SoftSettle nets the amount into one clear statement. The Pay page then lets the user confirm that settlement and updates the group balance.

The prototype also includes a payment request flow for Messages/KakaoTalk as a prototype interaction. This addresses the social side of the problem, not only the calculation.

## Tools Used

I used ChatGPT/Codex to help explore the painpoint, challenge the scope, write the reasoning, and build the prototype with HTML, CSS, JavaScript, Node.js, and SQLite. AI made it fast to turn a product idea into an interactive app. The harder part was avoiding a generic Splitwise-style clone. I had to keep narrowing the product around one specific user need: making group-trip repayment understandable and less awkward.

## What I Would Test First

At this stage, I am not claiming SoftSettle has already solved the problem. I would test whether the painpoint is acute enough and whether this prototype reduces the confusion or awkwardness.

I would interview 8-12 people who recently traveled in a group and ask them to reconstruct their last shared-cost situation using their chat history, receipts, and payment app records. Then I would ask them to enter the same situation into SoftSettle while thinking aloud.

The first validation questions would be:

- Do users understand who they personally need to pay?
- Do they trust the "What this covers" breakdown?
- Does the Pay flow make settlement feel easier than their current workaround?
- Would the message request make them ask earlier or with less discomfort?

The strongest success signal would not be "the calculator works." It would be users saying, "I understand this amount and I would actually send this."
