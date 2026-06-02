# ShardLab Product Intern Challenge — Draft Pack

## Draft 0: What The Assessment Is Really Asking For

This challenge is not asking for the biggest app idea. It is asking for evidence that I can notice one real human moment, understand why it hurts, turn that into a working interaction quickly, and explain my thinking clearly.

The strongest answer should therefore avoid sounding like a generic finance app. The product should feel like it came from observing a specific social situation.

## Draft 1: Painpoint Options Considered

### Option A — Group Trip Organizer Chasing Payments

Specific moment: one friend books the Airbnb, pays for taxis and groceries, then has to collect different amounts from six friends across different payment apps.

Who feels it: the responsible friend who paid first.

Why it is strong: the pain is both practical and emotional. The organizer has to do math, track who paid, explain uneven expenses, and ask without sounding rude.

Prototype fit: add expenses, choose participants, calculate simplified settlements, generate a polite payment message.

Verdict: strongest option.

### Option B — Group Birthday Gift Contribution

Specific moment: one person buys an expensive birthday gift after others agreed to contribute, but several people pay late or forget.

Who feels it: the gift organizer.

Why it is interesting: the person asking for money can feel especially awkward because the purchase was supposed to be generous and celebratory.

Weakness: it happens less often than trips and has fewer expense variations.

Verdict: good backup, but less rich for a prototype.

### Option C — Shared Subscription Among Friends

Specific moment: one friend pays for a shared streaming, cloud, or software subscription and has to collect small recurring amounts.

Who feels it: the account owner.

Why it is interesting: small amounts are easy to ignore, so asking can feel petty.

Weakness: the product becomes more like a recurring reminder tool. The emotional situation is real, but the prototype might feel less distinctive.

Verdict: useful but not the best assessment answer.

### Option D — Roommate Utilities

Specific moment: one roommate pays electricity, water, internet, and maintenance fees every month, then has to split and chase others.

Who feels it: the roommate handling bills.

Why it is interesting: repeated friction can build resentment.

Weakness: many existing apps already solve parts of this. It would need a sharper cultural or relationship angle to stand out.

Verdict: practical, but less original unless scoped very carefully.

## Draft 2: Chosen Direction

Product idea: SoftSettle.

Specific moment: after a weekend trip, the friend who paid first needs to collect uneven amounts from the group.

Core insight: the hard part is not only calculating who owes what. The hard part is asking for money in a way that is clear, fair, and socially comfortable.

Target user: informal group organizers, especially students or young workers who plan trips with friends and use different payment methods.

Prototype promise: turn scattered trip expenses into simplified transfers and copy-ready repayment messages.

## Draft 3: Problem Statement

When friends travel together, one person often pays first because it is faster: they book the stay, pay a deposit, buy groceries, or cover transport. After the trip, that same person has to collect money from everyone.

The problem is not just arithmetic. Some costs only apply to some people, payment happens across different apps, and the organizer may not want to sound demanding. The result is delayed follow-up, undercharging, repeated reminders, or quiet resentment.

SoftSettle focuses on this after-trip settlement moment: the gap between knowing people owe money and feeling comfortable asking for it.

## Draft 4: Submission-Ready One-Page Explanation

# SoftSettle — Making Group Trip Payments Less Awkward

## The Moment I Picked

I focused on a common group trip situation: one friend pays first for shared costs such as Airbnb, groceries, taxis, tickets, or deposits, then later has to ask everyone else to pay their share.

The broken moment is not simply that “splitting costs is annoying.” A more specific version is this: the friend who booked the Airbnb has already taken financial responsibility for the group, but after the trip they now have to calculate uneven amounts, explain why some people are included or excluded from certain costs, and privately remind friends who have not paid yet. The payment request can feel socially uncomfortable, especially when the friendship matters more than the money.

## Who This Is For

SoftSettle is for the informal group organizer: a student, young worker, or friend who often becomes the person responsible for booking and paying first during group plans. For example, an international student in Korea planning a weekend trip with friends may pay for accommodation first because it is faster to reserve. Later, they need to collect money across bank transfer, Toss, KakaoPay, Wise, or cash.

This person is not a professional event manager. They are just the responsible friend. Their pain is functional, but also emotional: they do not want to look demanding, petty, or rude when asking for money.

## What People Do Today

Today, people usually use a mix of notes, calculators, group chat messages, spreadsheets, screenshots, and payment app histories. These workarounds fail because the information is scattered. More importantly, they do not solve the social discomfort. Even when the math is correct, the organizer still has to decide how to phrase the reminder and whether it is okay to follow up.

The emotional cost is quiet but real: the organizer may feel anxious, guilty, or frustrated. They may delay asking, undercharge people, or absorb part of the cost to avoid tension.

## How The Prototype Helps

SoftSettle helps the organizer move from messy shared expenses to a clear and socially safer settlement flow.

The user can log in, open or create a group they are involved in, add friends, add or edit expenses, choose who participated in each cost, and see a simplified transfer result. Instead of everyone paying everyone, the prototype reduces the group balance into the smallest practical set of payments. It also includes a payment request step that generates one clear copy-ready message.

This matters because the product does not only calculate the answer. It helps the organizer communicate the answer in a way that protects the relationship.

## Tools Used

I used ChatGPT/Codex to structure the product thinking, challenge the painpoint, and build a working HTML/CSS/JavaScript prototype. AI made it easy to move quickly from a written problem to a functional interaction. The harder part was narrowing the product so it did not become a generic expense tracker. The most important design decision was to focus on the emotional moment of asking for repayment, not just the math.

## What I Would Test First

The first thing I would test is whether organizers actually feel relief from the message-generation step. I would ask 5-8 people who recently planned a trip, meal, or group purchase to enter a real example into the prototype. Then I would observe whether they trust the calculated settlement, whether they copy or edit the suggested message, and whether they feel more comfortable sending the request.

The key validation question is: does SoftSettle make people more willing to ask for money fairly and earlier, without feeling socially awkward?

## Draft 5: Shorter One-Page Explanation

# SoftSettle

I picked the moment after a group trip when one friend has paid first and now has to collect money from everyone else. A specific example is a weekend trip where one person booked the Airbnb, another bought groceries, and some transport costs only applied to part of the group. After the trip, the organizer has to calculate uneven shares, remember who already paid, and message friends who still owe money.

The user is the informal group organizer: usually a student or young worker who becomes the responsible friend in group plans. They are not trying to manage finances professionally. They just want to avoid losing money or damaging the mood of the friendship. Today, they usually use notes, calculators, screenshots, spreadsheets, and group chats. The workaround can solve the math, but it does not solve the awkwardness of asking.

The emotional cost is important. The organizer may worry about sounding petty, rude, or too direct. Because of that, they may delay sending reminders, undercharge friends, or absorb small costs quietly.

SoftSettle is a working prototype for this exact moment. The user can log in, choose a group, add friends, add shared expenses, choose who participated in each cost, and see simplified transfers. The prototype also generates a copy-ready repayment message. This is the key product decision: SoftSettle is not only an expense calculator; it helps the responsible friend communicate clearly while protecting the relationship.

I used ChatGPT/Codex to explore the painpoint, narrow the scope, and build the prototype with HTML, CSS, and JavaScript. The easy part was quickly turning the idea into interactive UI. The hard part was resisting the temptation to build a generic bill-splitting app and instead focusing on one emotionally specific flow.

The first thing I would test is whether the message step actually reduces discomfort. I would ask 5-8 people who recently organized a trip or group purchase to enter a real expense example. I would watch whether they trust the settlement, whether they copy or edit the generated message, and whether they say they would send it sooner than writing the request themselves.

## Draft 6: Prototype Walkthrough Script

SoftSettle is an interactive prototype for the friend who paid first during a group trip and now needs to collect money without making the relationship awkward.

The prototype starts with a sample weekend trip. On the left, the organizer can add friends and choose each friend’s preferred payment method. They can also mark people as paid or waiting, which reflects the follow-up stress after the trip.

Next, the organizer adds shared expenses. For each expense, they choose who paid and who should be included. This is important because real group costs are not always equal. For example, someone may skip a taxi ride or arrive late.

On the right, SoftSettle calculates everyone’s balance and simplifies the settlement into the smallest practical set of transfers. This keeps the request clear instead of making everyone pay everyone.

The final step addresses the emotional painpoint. The user selects a person who owes money, and SoftSettle generates a copy-ready message that includes the amount, recipient, trip name, and payment method. The organizer can copy it or mark it as sent.

The prototype is intentionally narrow. It is not trying to be a full personal finance app. It focuses on one broken moment: the responsible friend needs to be fair about money without creating social tension.

## Draft 7: Video Recording Script

Hi, this is my ShardLab Product Intern Challenge prototype, SoftSettle.

I chose the moment after a group trip when one friend has paid first and now has to collect money from everyone else. What interested me is that the pain is not only calculation. It is also the awkwardness of asking friends for money.

Here is the prototype. I can add a friend, choose their payment method, and mark whether they have paid. Then I can add a shared expense, enter the amount, choose who paid, and select who should share that specific cost. This matters because not every expense applies to everyone.

As I add expenses, SoftSettle updates the settlement on the right. It simplifies the balances into clear transfers, so the organizer does not need to explain a messy calculation.

The most important part is this message step. I can choose a person who owes money, and the prototype generates a message that the organizer can copy or mark as sent.

My hypothesis is that this reduces the emotional friction around repayment. The first thing I would test is whether real organizers would actually copy or edit this message, and whether it makes them more likely to ask for repayment earlier.

## Draft 8: Tools Reflection

I used ChatGPT/Codex as a thinking and building partner. First, I used it to explore possible shared-cost moments and compare which ones had the clearest user, workaround, and emotional cost. Then I used it to build a functional prototype with plain HTML, CSS, and JavaScript.

What was easy: AI helped me move fast from concept to working UI. It was especially useful for generating the settlement calculation, message variants, and a clean structure for the one-page explanation.

What was hard: the first AI-generated direction could easily become too broad, like a generic Splitwise clone. I had to keep challenging the scope and bring it back to the assessment prompt: one specific broken moment, one specific user, and one clear emotional tension.

What I changed from the first draft: I made the prototype less about “tracking expenses” and more about the organizer’s end-to-end flow: enter uneven costs, understand the simplified settlement, and communicate the ask without social discomfort.

## Draft 9: Validation Plan

I would start with a lightweight qualitative test, not a large survey.

Recruit 5-8 people who recently organized a trip, meal, group gift, or shared purchase.

Ask each person to bring one real situation where they paid first or had to chase someone.

Have them enter that situation into the prototype while thinking aloud.

Observe four things:

1. Do they understand how to enter uneven expenses?
2. Do they trust the simplified settlement?
3. Do they copy or edit the generated message?
4. Do they say this would make them ask earlier or feel less awkward?

Success signal: users do not just say the calculator is useful. They specifically say the generated message makes the repayment conversation easier.

Failure signal: users care only about exact calculation and ignore the message. That would mean SoftSettle should either become a more powerful expense calculator or find a sharper communication workflow.

## Draft 10: Submission Format Recommendation

Best submission format: Notion or Google Doc with two links at the top.

Top of page:

- Prototype link
- 1-page explanation
- Optional 2-minute walkthrough video

Why this format works: it is easy for evaluators to open, and it lets the working prototype be the main artifact rather than burying it in a long document.

## Draft 11: Submission Email

Subject: ShardLab Product Intern Challenge Submission — Ahmad Fahreen Qusyairi

Dear Josh and ShardLab team,

I hope you are doing well.

Thank you for the Product Intern Challenge. I have completed my submission.

Prototype link: [insert deployed prototype link or screen recording link]

1-page explanation: [insert Google Doc / Notion / PDF link]

My concept is called SoftSettle. It focuses on the moment where one friend pays first for a group trip and later has to collect money from everyone without making the relationship feel awkward.

Thank you for your time and consideration.

Best regards,  
Ahmad Fahreen Qusyairi

## Final Submission Checklist

- Working prototype responds to input.
- Prototype lets evaluator add people.
- Prototype lets evaluator add expenses.
- Prototype calculates settlements.
- Prototype includes the social/emotional feature, not just math.
- One-page explanation includes the moment, user, workaround, emotional cost, prototype, tools, and validation plan.
- Submission email includes prototype link and explanation link.
