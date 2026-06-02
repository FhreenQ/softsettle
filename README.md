# SoftSettle submission package

This folder contains a working ShardLab Product Intern Challenge draft package.

## Prototype

Run:

```bash
npm start
```

Then open:

`http://localhost:4173`

The prototype is an interactive app with a SQLite-backed login and database. It lets a user register, log in, choose or create a group they are involved in, manage group settings, add saved users, add or edit shared trip expenses, choose who participated in each expense, split costs equally or by custom amounts, view a Personal Summary with expense-name breakdowns, settle payments through a Pay page, and generate a clear copy-ready repayment message.

Seeded demo accounts are created automatically:

- `fahreen@softsettle.test`
- `asha@softsettle.test`
- `mira@softsettle.test`
- `daniel@softsettle.test`
- `nadia@softsettle.test`
- plus 10 extra saved users for testing group member additions

All seeded demo accounts use password `password123`.

The database file is created at:

`data/softsettle.sqlite`

Delete that file whenever you want a fresh local database.

## Drafts

- `docs/submission-drafts.md` contains the full draft pack: concept exploration, chosen direction, one-page explanations, walkthrough script, tool reflection, validation plan, and email draft.
- `docs/one-page-explanation.md` is the clean submission-ready explanation.
- `docs/email-draft.md` is a short email for sending the final links.
- `docs/final-submission.md` is the Notion / Google Doc-ready final submission pack.

## Test

From this folder:

```bash
npm test
```
