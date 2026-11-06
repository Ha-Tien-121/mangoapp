# MangoApps Onboarding: prototype

A first version of a new-hire onboarding tool, branded **MangoApps**. Built for Scenario 1 of the MangoApps APM take-home (the scenario customer is BrightPath Technologies).

It gives each new hire **one place** to see what to do, shows them **only what matters right now**, builds their plan **automatically from their department**, and lets **managers and HR see progress** at a glance.

## Run it

No install, no build step. It's plain HTML, CSS and JavaScript.

**Option A: just open it.** Double-click `index.html` (works in Chrome, Edge, Firefox and Safari).

**Option B: local server** (if your browser blocks local files):

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

- Use **"Viewing as"** in the top bar to switch between HR, managers and new hires.
- Use **"Demo date"** to pretend it's a different day and watch the plan move forward.
- **Reset demo data** is in the footer. Data is saved in your browser only (localStorage).
- Logic tests: open `tests.html` (143 checks covering plan generation, the weekend rule, weekend start-date warnings, the focus list, statuses, validation, the first-week agenda and .ics, learning progress, forms, Day-1 readiness, 1:1 notes, goals, notification messages and the outbox, URL routes, the CSV parser and bulk import, role templates, insights and pulse check-ins, edit/remove hire, the compliance matrix, audit trail and CSV export, who-did-it (doneBy), the document library, document links on tasks and old-data migration).

## Who it's for, and the one workflow it covers

**Primary user: the new hire (Emily).** Sarah's request says the goal is "easier for everyone, *especially our new employees*", so the new hire's screen got the most care.

The end-to-end workflow:

1. **Sarah (HR)** adds a new hire: name, title, department, manager, start date.
2. The app **generates a plan**: company-wide tasks plus that department's tasks, with due dates worked out from the start date. Sarah can untick anything that doesn't apply, then creates it.
3. **The new hire** opens the app and sees *"Focus on these first"*: at most 3 tasks. Everything else is folded away.
4. **The manager (David)** sees each new hire's progress, what's overdue, and their own to-dos (e.g. "Assign an onboarding buddy"). They can add a team-specific task to one person's plan.
5. HR sees everyone across the company, who has signed what (Compliance), and the document library.

- **Smarter templates.** A template task can be limited to certain work types (Onsite, Hybrid, Remote) and job levels (e.g. People manager). There are 6 task types (task, read, watch, acknowledge, meeting, form), each with an icon and an optional link the new hire opens with "Open". When HR adds a hire, the preview says why each task is included ("Because: …") and lists the tasks that were skipped. Remote hires get a Day-1 card with a video-call link instead of an office address.
- **New hire tabs (round 4): Today · My plan · Schedule · Learning · Team.** Today is still the calm focus view (at most 3 focus rows). On phones the five tabs fit at 375px; at 320px the tab bar scrolls inside itself.
  - **Team:** a welcome line, the manager card, the **buddy** card ("Your go-to person for any question"), the rest of the team (initials, name, pronouns, title, "Ask me about…") and the HR contact. Until the manager ticks "Assign an onboarding buddy", the page says "Your buddy will be introduced soon". Ticking that task assigns the team's default buddy (`buddyId` on the hire).
  - **Schedule:** the first five working days ("Day 1 · Mon Nov 9"), each as a simple timeline (time, kind with icon and word, title, place, with whom). It merges the Company + department agenda with the plan's Week 1 meeting tasks (default 3:00pm if they have no time; an agenda item linked to a task never shows twice). Before start it opens on Day 1, during Week 1 on today (marked "Today"), and after Week 1 it says "Your first week is done". "Add the week to calendar" downloads one .ics with an event per item.
  - **Learning:** an ordered path (Company basics + department), one plain progress line ("2 of 7 done · about 2 h 10 min left"), "Up next" with Start, and "Mark as done" on every item. The order is suggested, not enforced. Items linked to a plan task finish together. On Today the next item takes a focus slot only if fewer than 3 tasks are showing; otherwise it's a small "Up next in Learning" line.
  - **Pre-boarding forms:** Offer letter e-signature, Personal details, Emergency contact, Tax form (W-4, simplified) and Direct deposit. Each has friendly validation, Save draft, Submit and a read-only "Submitted Nov 5 ✓" view with bank numbers masked (••••6789). Every form shows "Demo only. Don't enter real personal or bank details." Submitting the offer, W-4 or deposit form completes its plan task (c-offer, c-tax, c-deposit); those tasks show a form button instead of a checkbox. Today has a Forms card ("2 of 5 forms done"), and HR sees which forms are in on the hire detail page (masked).
- **Manager tabs (round 4): Team · Day-1 readiness · 1:1s · Goals · Notifications** (short labels "Day 1" and "Nudges" on phones; the tab bar scrolls inside itself at 320px). Hire detail opens from Team.
  - **Day-1 readiness:** for each of his hires starting in the next 14 days (Day 1 included), a card like "Emily: 2 of 7 ready · starts Mon" with seven checks computed from the plan: laptop shipped, accounts created, tool access, buddy assigned, welcome note sent, first 1:1 booked, forms submitted. Each shows ✓ Ready or ○ Not ready yet plus who has it (IT, You, Emily). His own items can be done right there (Mark done, Choose buddy, Book 1:1); the others have "Send a reminder". Empty state when nobody starts soon.
  - **Buddy picker:** "Assign an onboarding buddy" (on the task and in readiness) opens a dialog listing the hire's team, with the suggested buddy marked. Saving sets the buddy, ticks the task, and the new hire's Team tab shows that person.
  - **1:1s:** four agenda templates (First 1:1, End of week 1, 30-day check-in, 60/90-day review, 4–6 talking points each). Start a note for a date, tick points as covered, keep notes, add follow-ups and turn any follow-up into a task in the hire's plan. Planned and past lists per hire; "Add to calendar" (.ics) for planned ones.
  - **Goals:** 30/60/90-day goals per hire with Not started / In progress / Done (icon + word), one line per horizon ("30 days: 1 of 3 done"), suggested starter goals per department added with one click, and own goals. The new hire sees them read-only in **My plan** (not Today, so Today keeps 3 focus rows) and can add a short progress note.
  - **Notifications (demo):** channels (In-app only / Email / Slack / Teams), weekly digest day and time, day-before nudge on/off, reminders for his to-dos on/off. A preview shows the real email and Slack/Teams message for the digest and the day-before nudge, built from live data in neutral words. "Send test" and "Send a reminder" (polite, pre-filled, editable) only add entries to a **demo outbox**, each labelled "Demo — not actually sent". Nothing is ever sent.
  - **Everything is clickable (U3):** the hire card's name and bar open the plan; status chips and "3 to catch up" open the plan filtered to exactly those tasks; readiness items open the task; digest lines open the hire or task; goal lines open Goals; 1:1 entries open the note. The manager's place is kept in the URL hash (`#/hire/marcus?show=catchup`, `#/1on1s/marcus/<note>`, `#/team?day=…`), so "Back to Team" and the browser's Back button both work.

- **Tabs are page links** (plain buttons with `aria-current="page"` on the current one, in all three roles). After Undo on a removed hire or document, focus goes to the restored row.
- **HR tabs (round 4): Hires · + Add · Templates · Insights · More** (More holds Bulk import, Compliance and Documents). The tab bar scrolls inside itself at 320px. HR's place is kept in the URL hash (`#/hr/insights`, `#/hr/hire/emily/edit`, `#/hr/add/bulk`, `#/hr/more/compliance`), so the browser's Back button works. The three KPI numbers on Hires (manager to-dos, hires catching up, starting soon) are plain numbers.
  - **Where everyone is (round-2 design, restored in pass C2 by user request, with U5 kept):** one row per person with a grey bar for their plan window (a week before start to the end of Week 4), filled blue up to Today, one Today line across all rows, date ticks, and a status chip. Above it, plain counts per phase (Before Day 1 · Week 1 · Weeks 2–4). Each name is a button that opens a small pop-up on click, tap, Enter or Space (not on hover or focus, so Tab is one stop per person). On desktop it sits beside the name, over the bars, so the names stay usable; on phones it is a bottom sheet sized to its content (at most 70% of the screen, scrolling inside) over a light backdrop. It shows name, title, department and manager, start date and phase ("Week 1 · Day 3"), status (icon + word), the same own-tasks count as the table row ("6 of 15 done · next: …"), and **Open plan** and **Edit**. Esc, the backdrop or clicking outside closes it and focus goes back to the name; only one is open at a time. Under 400px the date row shows only the start/end dates and Today (any label too close to another is hidden) and names wrap to two lines.
  - **Edit hire and remove (U4):** "Edit hire" on the hire detail page, "Edit"/"Remove" on every table row and Edit in the pop-up. The form has name, title, department, manager, start date, work type, job level and role, with a live **What changes** list: "David's 4 open tasks move to Priya. David's Team view no longer shows Emily."; for a department (or role, work type, job level) change, open template tasks that no longer apply come out and the new ones go in (listed with "From: Sales"), while done tasks and tasks added by hand stay; a new start date recomputes the open due dates. The manager must manage the new department: changing the department picks that department's manager and says so, and a manager from another department is an error on save (on the add form it's a warning, the old F6). Remove asks in a calm dialog ("Remove Emily Chen's onboarding plan?") and then offers **Undo** on a 10-second toast; removed hires disappear from every view, and "Viewing as" falls back to HR if needed.
  - **Insights (C1a):** three plain KPIs (finished onboarding, days to finish Week 1 on average, check-in answers) and three charts, each one question with a one-number sentence and one colour: *How long does Week 1 take?* (a plain bar per department), *Which tasks most often go past their date?* (top 5; select one to see who it affected, with Open for people onboarding now) and *How do new hires feel?* (Great / Okay / Could be better; select one to read its comments, without names or dates, and only once there are at least 3 answers). It counts people onboarding now plus 9 finished hires from earlier months (`OB.ARCHIVED_HIRES`, kept in `state.archive`, never in the active lists, a manager's Team or "Viewing as").
  - **Pulse check-ins (C1a):** on Day 7 ("How's your first week going?") and Day 30 ("How's your first month going?") the new hire gets one question with three answers and an optional comment. It uses the one banner slot (never a focus row, so Today keeps 3 focus rows), shows until answered or "Not now", and then never again.
  - **Role templates (C1b):** besides Company and department templates, HR has **roles** (seeded: Backend Engineer, Account Executive, Support Specialist), each belonging to one department, edited in the same editor ("+ New role", "Remove role"). A hire has a role (or None) on the add form, the edit form and the bulk CSV; their plan = Company + department + role tasks, then the work type / job level rules. The add-hire preview shows "From: Backend Engineer" on role tasks.
  - **Bulk import (C1c):** + Add → Bulk import (also in More). Paste CSV or choose a .csv file (read in the browser only), or download a sample. A small tested parser handles quotes, commas and line breaks inside quotes, `""`, CRLF and blank lines; column names can be in any case. "Check rows" shows every row with ✓ Ready, ○ Needs a fix (reasons in plain words, by row number) or Possible duplicate (already onboarding, or twice in the paste; skipped unless "Import anyway" is ticked). Importing builds each plan exactly like adding one person.
  - **Compliance (C2b):** More → Compliance. Compliance items are acknowledge tasks plus tasks marked **Required** in the plan templates (seeded: offer letter, I-9/W-4, security training, harassment training; the handbook and the support escalation policy are acknowledge tasks). A matrix shows everyone onboarding (rows) by item (columns): **✓ Nov 3** done with its date, **○ Not yet**, or **—** not in that person's plan, each cell with a full sentence for screen readers ("Emily Chen, Read and acknowledge the employee handbook: acknowledged Thu, Nov 5"). The headline reads "1 of 4 people have everything signed"; each row has "All signed" or "N not yet". Select an item's header for its **audit trail**: who completed it and when, newest first ("Emily Chen acknowledged it", "Sarah Kim marked it done for Pat"), plus who hasn't yet. **Export CSV** downloads the matrix plus the full audit log (made in the browser; cells are quoted when needed, and a leading = + - @ gets a ' so spreadsheets don't run it as a formula). On phones (under 640px) it is one card per person instead: name, department, "All signed" / "N not yet", then each item as "✓ Oct 9 · Sign offer letter…", "○ Not yet · …" or "— Not in plan · …" (words in the labels); each item name opens its audit trail. Completion dates are never shown later than the (demo) today.
  - **Documents (C2c):** More → Documents. 12 seeded documents across Policies, Benefits, IT & security and Team guides, each with a title, description, placeholder link, audience (Everyone, a department, or a job level) and an updated date. Search (every word, any case, over title, description, category and audience) and a category filter; the results update as you type. Add, edit and remove inline like template tasks; remove offers **Undo**. New hires see **Documents for you** at the end of **My plan** (only everyone's, their department's and their job level's), so Today keeps its 3 focus rows.
  - **Template editor (C2b/C2c):** each task has a **Required** checkbox ("track it on the Compliance page"), and read / acknowledge tasks can pick a **Document** from the library instead of a raw link; the task's Open then uses the document's link (if the document is removed, the task's own link is used again). The list shows "Required" / "Compliance" and "Doc: …" chips.
  - **Who ticked it (doneBy):** every way a task gets done records who did it: ticking it (new hire, manager, HR), submitting a form, finishing a learning item, choosing a buddy (the manager). This feeds the audit trail.
- **Weekend due dates (round 4):** template offsets from a Monday start can land on a weekend. A weekend date moves to the Friday before when it's before Day 1, and to the Monday after otherwise (`OB.weekdayDue`), in plans, the add-hire preview and when a start date changes. A **start date** on a Saturday or Sunday is allowed but gets a calm note ("Nov 14 is a Saturday. Most people start on a Monday: use Mon, Nov 16?") with a one-click **Use Mon, Nov 16** in the add and edit forms; in bulk import the row still imports, with a "Check:" note.

## The two people who seem to disagree

| | Wants | How the prototype handles it |
|---|---|---|
| **David** (Eng Manager) | Different checklists per department, not one-size-fits-all | Plans are **layered**: *Company* tasks + *Department* tasks (Engineering gets GitHub/dev-env/first PR; Sales gets Salesforce/demo cert, etc.). Managers can also **add extra tasks** for one person. |
| **Emily** (New hire) | Not 40 things on Day 1; just tell me what to focus on | The new hire's home screen shows **max 3 tasks** from the current phase, overdue first. Other people's tasks (IT, manager) are in a separate "Being handled for you" list. Future phases are collapsed. The full plan is one tab away if she wants it. |

They don't actually conflict: David is talking about **what's in** the plan, Emily about **how much she sees at once**. Department plans can be as detailed as David wants because the new hire only ever sees the next few items.

## Assumptions I made

- **Phases** are *Before Day 1*, *Week 1* (days 1–7) and *Weeks 2–4* (days 8–28). "First few weeks" = 4 weeks.
- **Tasks have one owner**: the new hire, their manager, IT or HR. Only the owner can tick a task off (HR also covers IT tasks in this version, since there's no IT user). Nobody can tick a task off on the new hire's behalf, so progress reflects what they actually did.
- **The plan is generated from department, role, work type and job level, not job title.** Sarah says "role or department". Department and the optional role template set the task list; work type and job level switch individual tasks on or off. A role belongs to one department.
- **"Automatically create plans" means templates + a review step**, not AI. HR sees the generated plan and can remove tasks before saving. Fully automatic creation (e.g. from the HRIS when an offer is signed) is a later step.
- **Late plans aren't punished.** If HR adds someone 2 days before they start, tasks that would already be overdue become due today instead. Otherwise a new hire would start with a red "Needs attention" badge that's HR's fault, not theirs.
- **Status rules** (for managers/HR): the status says whose move is next, in neutral words. In priority order: *N for you* / *N for manager* (a manager task is past its date: a calm blue arrow chip; red is only used for form errors); *N to catch up* (the new hire's own tasks are past their date; meetings don't count, and before Day 1 this is the most it can show); *With IT* / *With HR* (only IT/HR tasks are past their date); *Starts <date>* (before Day 1, nothing pending); *On track*; *Complete*. Cards and table rows show one chip; the hire's detail page shows all of them. **Progress bars and "N to catch up" use one definition** (`OB.ownProgress` in `js/plan.js`): the bar counts only the new hire's own tasks (not meetings); the blue fill is how many of their tasks dated before today are done, and the small tick is how many were dated before today ("where they'd be by today", explained by a one-line key above the cards and the table). The gap between fill and tick is exactly the "N to catch up" number; when a card or row's chip is about someone else ("1 for you"), a muted "N to catch up" line sits under the bar. The caption is always "N of M done" on the same scale. The manager's week strip, the list under it, the digest and the header all count the same rolling 7 days (`OB.rollingWeek`: today + 6 days, anything past its date counts on today; later items sit under a quiet "Later" fold).
- **Template edits apply to new plans only, and only HR can edit templates.** A hire's plan is a copy made when they're added, so editing a template never changes the plan of someone already onboarding (the Plan templates tab says so). Managers still add one-off tasks to one person's plan. Edited templates are saved in the browser alongside the rest of the demo data; "Reset demo data" restores the defaults from `js/data.js`.
- **Work types and job levels are fixed lists** (set in `js/data.js`); HR can't add new ones in this version.
- **Template rules apply to new plans only.** Changing who a task applies to doesn't add or remove it from plans already created.
- Mock data only, no real logins. A role switcher stands in for sign-in.

- **Pre-boarding forms are mocks.** Nothing is sent anywhere; values sit in localStorage like the rest of the demo. The W-4 is a two-field simplification and the I-9 stays an in-person check on Day 1. Personal details and emergency contact have no plan task; they only count on the Forms card. Submitted forms can't be edited in the app ("Ask Sarah in HR"). Tasks done before forms existed (older saves) count as submitted, with no stored details.
- **Teams, the first-week agenda and learning paths are mock data** in `js/data.js` (`OB.TEAMS`, `OB.AGENDA`, `OB.LEARNING`, `OB.FORMS`). The buddy is the team's default when the manager ticks the buddy task; picking a different person is a later step. Learning links are placeholders (example.com).
- **Older saved data still loads:** hires get `buddyId`, `learning` and `forms` defaults (`OB.migrateHireExtras`), plus `oneOnOnes` and `goals` (`OB.migrateManagerHire`), plus `role` and `pulses` (`OB.migrateHrHire`); the saved state gets `notify` (preferences per manager) and `outbox` (`OB.migrateManagerState`), plus `roles` and `archive` (the seeded finished hires) (`OB.migrateHrState`), plus `documents` and, on plan tasks, `required` / `docId` from the default templates by key and a missing `doneBy` (`OB.migrateC2State`). A done task saved without `doneBy` gets **its owner** (the new hire, the manager, or Sarah in HR for HR and IT tasks), the same rule as the seed data; "Unknown" shows only for ids the app can't name. A saved `hrFilter` from the removed filter bar is dropped.
- **Editing a hire changes their plan now** (unlike template edits): open template tasks that no longer apply are swapped, done and hand-added tasks always stay, and tasks HR left out when the plan was made stay out. Open manager tasks follow the hire to the new manager; 1:1 notes and goals stay with the hire.
- **Pulse answers are anonymous in aggregate.** They're stored on the hire in this demo, but HR only ever sees counts and comments grouped by answer, without names or dates, and comments only when there are at least 3 answers.
- **Seed hires always start on a Monday** (`startWeek` in `OB.SEED_HIRES`, `OB.seedStartDate`), whatever day the demo is opened. With the harness date (Thu Nov 5, 2026): Emily Mon Nov 9, Marcus Mon Oct 26, Aisha Mon Oct 19, Tom Mon Nov 16.
- **Compliance covers people onboarding now** (not the finished hires kept for Insights), and everyone (no filter). Acknowledge tasks are always compliance items; "Required" is an extra flag. An acknowledgement is the new hire ticking "I've read and agree"; it isn't a legal e-signature.
- **Documents are links, not files.** The library stores titles, placeholder links and audiences; there's no upload or versioning.
- **Notifications are a demo.** Preferences, previews and the outbox live in localStorage; there are no real email, Slack or Teams calls.

## Edge cases handled

- Empty states: manager with no new hires, new hire with nothing due ("You're all caught up"), onboarding complete, no documents matching a search, no new hires at all.
- Bad input when adding a hire: blank fields, invalid dates, start date more than 4 weeks ago (blocked) or over a year away (blocked), start date very soon/in the past (warning), **duplicate name** (warning, since two people can share a name).
- Custom tasks: required title, due date must fall inside the plan window.
- All user-entered text is HTML-escaped (tested with `<b>` in a task name).
- Two browser tabs stay in sync (e.g. manager in one, new hire in another).
- Works on a phone-sized screen. New hires will likely check this on their phone before Day 1.

## What I left out (and why)

- **Reordering template tasks by hand, and template history.** HR can add, edit and remove template tasks (Plan templates tab), but tasks are always ordered by their timing, and there is no audit trail or undo beyond "Reset to original" per template.
- **Real notification delivery.** The manager can set preferences, preview the digest and nudge, and "send" tests and reminders, but they only go to a demo outbox. This is the obvious next thing for "managers aren't sure whether everything has been completed", but it needs a backend.
- **Real accounts, permissions and a database.** Everything is in localStorage.
- Task dependencies ("can't do X until IT does Y"), file attachments, legally binding e-signatures (the offer signature is a typed-name mock).
- **Custom fields and rule types** (rules only use work type and job level), **location-based rules** (e.g. by office or country), and **multi-company/workspace setup**.
- **Integrations** with the HRIS, IT ticketing, or MangoApps itself.
- **Offboarding and team / role changes (C2a).** Dropped at the user's request in pass C2: there are no offboarding or move plans, no plan kinds and no "Offboarding & moves" page.
- **The HR filter bar (U2).** Removed at the user's request in pass C2: no Status / Department / Start date filters, chips or filter sentence on Hires, Insights or Compliance. Charts and the timeline still open things (who a task affected, a pulse answer's comments, a person's pop-up) but never filter.
- **Editing the document audience per task, and document uploads.** Documents are links with one audience each.

## Questions I'd ask Sarah next

1. Who owns the department templates: HR, or each department's manager? (Decides who gets edit rights.)
2. Do IT and Facilities need their own view, or is "HR marks IT tasks done" fine for now?
3. How should managers hear that something is overdue: email, Slack/Teams, or a weekly digest?
4. Is "first few weeks" 30 days, or do some departments (e.g. Sales ramp) need 60–90?
5. Are there legally required tasks (I-9 within 3 days, state training) that need hard deadlines and an audit trail?
6. Do new hires have a company login before Day 1, or do pre-start tasks need to work from a personal email link?

## UI improvement loop (Claude Code)

The repo includes an agent workflow that critiques, improves and re-tests the UI:

- **`ui-critic`** agent (`.claude/agents/ui-critic.md`): screenshots every screen at desktop and phone size, reviews them as Emily, David and Sarah, probes edge cases, and writes ranked findings. It never edits code.
- **`ui-builder`** agent (`.claude/agents/ui-builder.md`): implements the chosen changes and keeps the tests passing.
- **`/ui-loop`** command (`.claude/skills/ui-loop/SKILL.md`): runs critique → triage → build → verify → log. Examples: `/ui-loop`, `/ui-loop 3 rounds`, `/ui-loop critique only`, `/ui-loop focus phone`, `/ui-loop make the overdue colour less alarming`.
- **Your feedback** goes in `ui-review/feedback.md` (Inbox, or "Standing preferences" for rules that always apply), or just reply in chat. Your feedback always beats the critic's.
- **History**: `ui-review/log.md`. Screenshots per round: `ui-review/shots/round-N/`.

Harness on its own: `bash ui-tests/snap.sh`. One-time setup: `pip install playwright && python -m playwright install chromium`.

## Project layout

```
index.html        page shell
css/styles.css    styles (responsive)
js/data.js        mock people, departments and plan templates
js/plan.js        pure logic: plan generation, focus list, status, validation, .ics
js/newhire.js     pure logic for the new hire's Team, Schedule, Learning and Forms (round 4)
js/manager.js     pure logic for manager readiness, 1:1s, goals, nudges/outbox and URL-hash routes (round 4)
js/hr.js          pure logic for HR: routes, the timeline pop-up's phase line, insights, pulse check-ins, roles, CSV bulk import, edit/remove hire (round 4)
js/hr2.js         pure logic for HR part 2: compliance matrix, audit trail, CSV export, doneBy, the document library (round 4, pass C2)
js/store.js       localStorage persistence + seed data
js/app.js         UI rendering and events
tests.html        in-browser tests for js/plan.js
```

## Suggested demo path (2–5 min)

1. **Emily (new hire)**: "4 days until your first day", two focus tasks, overdue one on top. Tick it off. Show "Being handled for you" and the collapsed full plan.
2. Change **Demo date** to her second day: the focus list moves to Week 1 tasks.
3. **David (manager)**: two hires. Click "3 to catch up" on Marcus's card to open just those tasks, then Back. Open **Day-1 readiness** ("Emily: 2 of 7 ready · starts Mon"), choose a buddy, book the first 1:1, send IT a reminder (demo outbox). Show a 1:1 note, add suggested goals, and the **Notifications** preview + "Send test".
4. **Sarah (HR)**: open a name in **Where everyone is**, then **Edit** Emily into Sales to show the plan swap and "David's open tasks move to Priya". **+ Add** with a role ("From: Backend Engineer"), then **Bulk import** the sample. **Insights**: select a task bar to see who it affected. Remove a hire and Undo. **More → Compliance**: "1 of 4 people have everything signed"; open the handbook's audit trail and Export CSV. **More → Documents**: search "handbook", edit one, remove one and Undo. In **Plan templates**, edit the handbook task to see Required and the document picker.
5. **Marcus (new hire, Day 11)**: the Day 7 check-in card.
6. Switch to **Priya / Omar** to show the new hire appears on their team.
