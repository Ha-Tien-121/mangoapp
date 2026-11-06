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
- Logic tests: open `tests.html` (28 checks covering plan generation, the focus list, statuses, and input validation).

## Who it's for, and the one workflow it covers

**Primary user: the new hire (Emily).** Sarah's request says the goal is "easier for everyone, *especially our new employees*", so the new hire's screen got the most care.

The end-to-end workflow:

1. **Sarah (HR)** adds a new hire: name, title, department, manager, start date.
2. The app **generates a plan**: company-wide tasks plus that department's tasks, with due dates worked out from the start date. Sarah can untick anything that doesn't apply, then creates it.
3. **The new hire** opens the app and sees *"Focus on these first"*: at most 3 tasks. Everything else is folded away.
4. **The manager (David)** sees each new hire's progress, what's overdue, and their own to-dos (e.g. "Assign an onboarding buddy"). They can add a team-specific task to one person's plan.
5. HR sees everyone across the company, filterable by department and status.

## The two people who seem to disagree

| | Wants | How the prototype handles it |
|---|---|---|
| **David** (Eng Manager) | Different checklists per department, not one-size-fits-all | Plans are **layered**: *Company* tasks + *Department* tasks (Engineering gets GitHub/dev-env/first PR; Sales gets Salesforce/demo cert, etc.). Managers can also **add extra tasks** for one person. |
| **Emily** (New hire) | Not 40 things on Day 1; just tell me what to focus on | The new hire's home screen shows **max 3 tasks** from the current phase, overdue first. Other people's tasks (IT, manager) are in a separate "Being handled for you" list. Future phases are collapsed. The full plan is one tab away if she wants it. |

They don't actually conflict: David is talking about **what's in** the plan, Emily about **how much she sees at once**. Department plans can be as detailed as David wants because the new hire only ever sees the next few items.

## Assumptions I made

- **Phases** are *Before Day 1*, *Week 1* (days 1–7) and *Weeks 2–4* (days 8–28). "First few weeks" = 4 weeks.
- **Tasks have one owner**: the new hire, their manager, IT or HR. Only the owner can tick a task off (HR also covers IT tasks in this version, since there's no IT user). Nobody can tick a task off on the new hire's behalf, so progress reflects what they actually did.
- **The plan is generated from department, not role.** Sarah says "role or department". Department is a cleaner first cut with ~150 people; role-level templates are a next step.
- **"Automatically create plans" means templates + a review step**, not AI. HR sees the generated plan and can remove tasks before saving. Fully automatic creation (e.g. from the HRIS when an offer is signed) is a later step.
- **Late plans aren't punished.** If HR adds someone 2 days before they start, tasks that would already be overdue become due today instead. Otherwise a new hire would start with a red "Needs attention" badge that's HR's fault, not theirs.
- **Status rules** (for managers/HR): the status says whose move is next, in neutral words. In priority order: *N for you* / *N for manager* (a manager task is past its date: a calm blue arrow chip; red is only used for form errors); *N to catch up* (the new hire's own tasks are past their date; meetings don't count, and before Day 1 this is the most it can show); *With IT* / *With HR* (only IT/HR tasks are past their date); *Starts <date>* (before Day 1, nothing pending); *On track*; *Complete*. Cards and table rows show one chip; the hire's detail page shows all of them. **Progress bars and "N to catch up" use one definition** (`OB.ownProgress` in `js/plan.js`): the bar counts only the new hire's own tasks (not meetings); the blue fill is how many of their tasks dated before today are done, and the small tick is how many were dated before today ("where they'd be by today", explained by a one-line key above the cards and the table). The gap between fill and tick is exactly the "N to catch up" number; when a card or row's chip is about someone else ("1 for you"), a muted "N to catch up" line sits under the bar. The caption is always "N of M done" on the same scale. The manager's week strip, the list under it, the digest and the header all count the same rolling 7 days (`OB.rollingWeek`: today + 6 days, anything past its date counts on today; later items sit under a quiet "Later" fold).
- **Template edits apply to new plans only, and only HR can edit templates.** A hire's plan is a copy made when they're added, so editing a template never changes the plan of someone already onboarding (the Plan templates tab says so). Managers still add one-off tasks to one person's plan. Edited templates are saved in the browser alongside the rest of the demo data; "Reset demo data" restores the defaults from `js/data.js`.
- Mock data only, no real logins. A role switcher stands in for sign-in.

## Edge cases handled

- Empty states: manager with no new hires, new hire with nothing due ("You're all caught up"), onboarding complete, HR filters with no matches, no new hires at all.
- Bad input when adding a hire: blank fields, invalid dates, start date more than 4 weeks ago (blocked) or over a year away (blocked), start date very soon/in the past (warning), **duplicate name** (warning, since two people can share a name).
- Custom tasks: required title, due date must fall inside the plan window.
- All user-entered text is HTML-escaped (tested with `<b>` in a task name).
- Two browser tabs stay in sync (e.g. manager in one, new hire in another).
- Works on a phone-sized screen. New hires will likely check this on their phone before Day 1.

## What I left out (and why)

- **Reordering template tasks by hand, and template history.** HR can add, edit and remove template tasks (Plan templates tab), but tasks are always ordered by their timing, and there is no audit trail or undo beyond "Reset to original" per template.
- **Notifications and reminders** (email/Slack nudges for overdue tasks). This is the obvious next thing for "managers aren't sure whether everything has been completed", but it needs a backend.
- **Real accounts, permissions and a database.** Everything is in localStorage.
- **Role-level templates**, task dependencies ("can't do X until IT does Y"), attachments/links to documents, e-signatures.
- **Integrations** with the HRIS, IT ticketing, or MangoApps itself.

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
js/plan.js        pure logic: plan generation, focus list, status, validation
js/store.js       localStorage persistence + seed data
js/app.js         UI rendering and events
tests.html        in-browser tests for js/plan.js
```

## Suggested demo path (2–5 min)

1. **Emily (new hire)**: "4 days until your first day", two focus tasks, overdue one on top. Tick it off. Show "Being handled for you" and the collapsed full plan.
2. Change **Demo date** to her second day: the focus list moves to Week 1 tasks.
3. **David (manager)**: two hires, Marcus "Needs attention" with 4 overdue. Open Marcus, show the overdue box, add a custom task.
4. **Sarah (HR)**: dashboard, then **Add new hire** → Sales or Support → show generated plan, untick a task, create. Try a blank name / old start date to show validation.
5. Switch to **Priya / Omar** to show the new hire appears on their team.
