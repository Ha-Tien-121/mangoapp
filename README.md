# MangoApps Onboarding: prototype

A first version of a new-hire onboarding tool, branded **MangoApps**, for growing companies that hire new people every month. Built for Scenario 1 of the MangoApps Associate PM take-home.

It gives each new hire **one place** to see what to do, shows them **only what matters right now**, builds their plan **automatically from their department and role**, and lets **managers and HR see progress** at a glance.

Plain HTML, CSS and JavaScript. No install, no build step, no backend. All data is mock data saved in your browser.

## Contents

1. [Overview](#1-overview)
2. [Quick start](#2-quick-start)
3. [Features by role](#3-features-by-role)
   - [New hire](#31-new-hire-emily)
   - [Manager](#32-manager-david)
   - [HR](#33-hr-sarah)
4. [Product decisions](#4-product-decisions)
5. [Technical implementation](#5-technical-implementation)
6. [Testing and quality](#6-testing-and-quality)
7. [Project layout](#7-project-layout)
8. [What I left out, and questions for Sarah](#8-what-i-left-out-and-questions-for-sarah)
9. [Data and privacy](#9-data-and-privacy)

---

## 1. Overview

### The problem

In many growing companies, onboarding lives in emails, documents and spreadsheets. Steps get missed, and managers aren't sure whether everything has been done. Sarah (HR Manager) wants one tool that makes onboarding "easier for everyone, *especially our new employees*".

### Who it's for

| Person | Role in the demo | What they need |
|---|---|---|
| **Emily Chen** | New hire, Software Engineer (primary user) | Know in 5 seconds what to do next. Not 40 things on Day 1. |
| **David Okafor** | Engineering Manager | See who needs help and what he has to do, without chasing anyone. |
| **Sarah Kim** | HR Manager | Set up a plan quickly, hard to get wrong, and see everyone at once. |

**The new hire comes first.** Sarah's brief names new employees as the main goal, so Emily's screens got the most care. Manager and HR screens exist to make her plan happen.

### The one end-to-end workflow

1. **Sarah (HR)** adds a new hire: name, title, department, manager, start date, work type, job level and an optional role.
2. The app **generates a plan**: Company tasks + department tasks + role tasks, filtered by work type and job level, with due dates worked out from the start date. Sarah sees why each task is included, can untick anything, then creates the plan.
3. **The new hire** opens the app and sees *"Focus on these first"*: at most 3 tasks. Everything else is folded away or one tab over.
4. **The manager (David)** sees each hire's progress, his own to-dos for the next 7 days, a Day-1 readiness checklist, 1:1 notes and 30/60/90-day goals. He can add a one-off task to one person's plan.
5. **HR** sees everyone across the company, edits plan templates, and tracks who has signed what (Compliance) and which documents each person gets.

---

## 2. Quick start

### Run it

**Option A: open the file.** Double-click `index.html`. Works in Chrome, Edge, Firefox and Safari.

**Option B: local server** (if your browser blocks local files):

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

**Logic tests:** open `tests.html` in the same way. The page title reads `PASS (143)` when every test passes.

### Demo controls

| Control | Where | What it does |
|---|---|---|
| **Viewing as** | Top bar | Switches the signed-in person. Grouped as HR (Sarah), Managers (David, Priya, Lena, Omar) and New hires (everyone onboarding). Stands in for real sign-in. |
| **Demo date** | Top bar | Pretends today is another date, so you can watch a plan move forward. The field turns amber while a demo date is set, and a **Back to real date** link appears. |
| **Reset demo data** | Footer | Asks to confirm, then restores the seed data and default templates. |

Data is saved in `localStorage` in this browser only. Two open tabs stay in sync (for example the manager in one and the new hire in another).

### Seed data

Seed hires always start on a Monday, counted from the week you first open the app (`startWeek` in `OB.SEED_HIRES`). With the harness date, **Thu Nov 5, 2026**:

| Hire | Department | Manager | Starts | Stage on Nov 5 | Notes |
|---|---|---|---|---|---|
| Emily Chen | Engineering | David | Mon Nov 9 | In 4 days | Onsite. Buddy already picked (Nina). 2 of 5 forms done. |
| Marcus Johnson | Engineering | David | Mon Oct 26 | Day 11 | Hybrid. Backend Engineer role. 3 to catch up. Day 7 check-in open. Seeded 1:1 notes and goals. |
| Aisha Patel | Sales | Priya | Mon Oct 19 | Day 18 | Onsite, People manager. Answered her Day 7 check-in. |
| Tom Rivera | Marketing | Lena | Mon Nov 16 | In 11 days | Remote. Nothing done yet. |

Omar (Customer Support) has no hires, so he shows the manager empty states. Insights also uses 9 finished hires from earlier months.

On another day the dates move, but the stages stay the same.

### 5-minute guided demo

**1. Emily, new hire (about 90 seconds).** She's selected by default.
- **Today** shows "4 days until your first day", the Day-1 card (date, time, place, who meets her, **Add to calendar**) and one calm banner: "One thing is past its date. No problem, it's first on your list."
- **Focus on these first** has 2 tasks plus "Up next in Learning". "Set up direct deposit" has a **Fill in form** button instead of a checkbox.
- Click **Fill in form**. Type the demo values (any bank name, a 9-digit routing number, an account number twice). Click **Submit**. The task is done and the Forms card reads "3 of 5 forms done".
- Open **Schedule** (Day 1 opens first; click Day 2), **Learning** (the ordered path), **Team** (manager, buddy Nina, the rest of the team) and **My plan** (all phases, goals, Documents for you).

**2. Move time (20 seconds).** Set **Demo date** to Tue Nov 10. Today now says "Day 2 at MangoApps" and the focus list moves to Week 1 tasks. Set it back.

**3. David, manager (about 90 seconds).** Viewing as → David Okafor.
- **Team**: the "Next 7 days" banner, the 7-day to-do strip, and a card per hire. Click **3 to catch up** on Marcus's card to open only those tasks. Click **Back to Team**, or use the browser's Back button.
- **Day-1 readiness**: "Emily: 2 of 7 ready · starts Mon". Click **Book 1:1**. Click **Send a reminder** on an IT item, edit it, **Save to demo outbox**.
- **1:1s**: pick Marcus, open a past note, tick a point, add a follow-up, then **+ Add to Marcus's plan**.
- **Goals**: pick Emily, click **+ Add** on a suggested goal.
- **Notifications**: change a channel, switch the preview between digest and day-before nudge, click **Send test**. Everything lands in the demo outbox.

**4. Sarah, HR (about 90 seconds).** Viewing as → Sarah Kim.
- **New hires**: the 3 KPI numbers, then **Where everyone is**. Click a name to open its pop-up.
- In the table, click **Edit** on Emily. Change the department to Sales: Priya is picked as manager and the **What changes** list shows the plan swap and "David's N open tasks move to Priya." Cancel, or save to try it.
- **+ Add new hire**: fill the form, pick role Backend Engineer, click **Preview plan**. Role tasks show "From: Backend Engineer". Click **Create plan**.
- **Bulk import**: **Download sample CSV**, paste it, **Check rows**, **Import**.
- **Insights**: click a bar under "Which tasks most often go past their date?" to see who it affected.
- **Remove** a hire, then **Undo** on the toast.
- **More → Compliance**: "1 of 4 people have everything signed". Click a column header for its audit trail. **Export CSV**.
- **More → Documents**: search "handbook", edit one, remove one and Undo.
- **Plan templates**: edit "Read and acknowledge the employee handbook" to see Required and the document picker.

**5. Marcus, new hire (20 seconds).** Viewing as → Marcus. The Day 7 check-in ("How's your first week going?") sits in the banner slot.

**6. Priya or Omar (10 seconds).** If you moved Emily to Sales or imported Mia Park (Customer Support), they now show on that manager's Team.

---

## 3. Features by role

Status words always come with an icon. Red is used only for form errors, never for a person's status.

### 3.1 New hire (Emily)

Five tabs: **Today · My plan · Schedule · Learning · Team**. Forms open from Today. On phones the tab bar fits at 375px and scrolls inside itself at 320px. The current tab has `aria-current="page"`.

#### Today

The calm home screen. From top to bottom:

| Part | What it shows | How it behaves |
|---|---|---|
| **One banner** (at most) | The single most useful reminder. Priority: Day-1 logistics (3 days before to Day 1) → pulse check-in (Day 7 / Day 30) → own tasks past their date → tasks due within 2 days → a quiet milestone. | **Remind me tomorrow** hides that kind until the next day. **Got it** hides that exact reminder for good, so new content can still show. No snooze button when the banner is about today. Milestones show once. |
| **Hero** | "Hi Emily", her title and department, and a greeting: "4 days until your first day", "Today is your first day. Welcome!", "Day 6 at MangoApps", or "Your onboarding period is over" after Day 28. | From 7 days before start to Day 1, it shows the **Day-1 card** instead. |
| **Day-1 card** | A big countdown ("4 days" / "Tomorrow" / "Today"), date and time, place and address, who meets her (Sarah from HR, then lunch with her manager), and **Add to calendar** (.ics). | Remote hires get "Join from home · Video call" with the call link, no address. Customer Support starts at 8:30 instead of 9:30. |
| **Journey strip** | "Before Day 1: 2 of 4 done", a grey track with three phases (Before · Week 1 · Weeks 2–4) and a Today marker ("Today · 4 days to go", "Day 6"). | A phase gets a soft fill and a ✓ once its dates have passed or all her own tasks in it are done. No date-proportional fill. |
| **Focus on these first** | At most 3 of her own open tasks from the current phase (or earlier), plus anything due in the next 2 days. Soonest first, so past-date tasks lead. | Past-date tasks say "Was due Nov 4 · do this next", not "overdue". A meeting whose date passed asks **Did this happen?** with Yes / Not yet. "Not yet" says "We'll check again tomorrow." |
| **Up next in Learning** | The next learning item. | Takes a focus row only if fewer than 3 tasks show. Otherwise it's one small line. |
| **Forms card** | "2 of 5 forms done · next: Direct deposit" and **Open forms**. | Once all 5 are in, one quiet line: "All 5 pre-boarding forms are done." |
| **Being handled for you** | Up to 3 tasks other people are doing for her (IT, manager, HR), in her words: "Your laptop is shipped to your home address", "Expected Fri, Nov 6". | No lateness wording at all. "+N more in your plan" when there are more. |
| **Recently done** | Folded list of the last 5 done tasks. | |
| **Questions?** | Manager, buddy (if picked) and Sarah in HR. | Link to **Meet your whole team**. |

**Empty and edge states**

- Nothing due now: **Coming up next** with a head-start list ("Nothing is due right now").
- Nothing at all for her: "You're all caught up."
- Everything done: "Onboarding complete. You've finished every task in your plan."
- "+ N more for this stage. See your plan" when the focus list is cut at 3.

**Who can tick what.** She can only tick her own tasks. Tasks other people own show a read-only circle ("Only IT can complete this"). Tasks linked to a form show a form button instead of a checkbox. Acknowledge tasks read "I've read and agree".

#### My plan

- "Everything in your onboarding plan (N tasks)."
- **Your 30/60/90-day goals** (read-only): grouped "30 days: 1 of 3 done", each with a status (Not started / In progress / Done, icon + word). She can **Add a progress note** (up to 280 characters). With no goals yet: "You'll set these with David in your first weeks."
- **The three phases** as folding sections: Before Day 1, Week 1 (Day 1–7), Weeks 2–4 (Day 8–28). The current phase is marked **Now**; future phases start folded. Each row shows a type icon, due wording, an **Open** link if it has one, and a "From: Engineering" chip for non-Company tasks.
- **Documents for you** at the end (see [Documents](#documents-for-you)).

Goals and documents live here, not on Today, so Today keeps its 3-row focus rule.

#### Schedule

"Your first week": the first five working days (the start date, then the next four weekdays).

- A day picker: "Day 1 · Mon Nov 9" … "Day 5". Today is marked **Today**.
- Each day is a simple timeline: start and end time, kind (Meeting / Focus time / Social / Training, icon + word), title, place and who it's with ("Nina Alvarez (your buddy)").
- The list merges the Company agenda, the department's agenda and the plan's Week 1 meeting tasks. A meeting task without a time goes at 3:00pm (30 minutes, stacked if several). An agenda item linked to a plan task never shows twice, and shows "✓ Done" when the task is.
- Day 1's welcome and lunch follow the Day-1 card times (so Support starts at 8:30).
- Remote hires see "Video call" places and "Video coffee with your manager" instead of lunch.
- Before start it opens on Day 1; during Week 1 on today; after Week 1: "Your first week is done" with a link to the plan.
- **Add the week to calendar** downloads one `.ics` file with an event per item.
- Empty day: "Nothing scheduled. Time to settle in."

#### Learning

- An ordered path: Company basics (Welcome, Values, Security training, Tools tour) then the department's items.
- One line of progress: "1 of 7 done · about 2 h 20 min left", or "All 7 done".
- **Up next** marks the first item not done (an item in progress comes first). **Start** / **Continue** opens its link in a new tab and marks it in progress. Every open item has **Mark as done**; done items have **Undo**.
- The order is a suggestion, not enforced.
- Items linked to a plan task finish together ("Also ticks off 'Read the architecture overview' in your plan"). Unticking the task puts the item back.

#### Pre-boarding forms

Opened from the Forms card on Today, or from a form button on a task row.

| Form | Fields | Completes plan task |
|---|---|---|
| Offer letter e-signature | Typed full name, "I've read the offer summary and accept it" | `c-offer` |
| Personal details | Preferred name, pronouns (optional), mobile, street, city, ZIP | none |
| Emergency contact | Name, relationship, phone | none |
| Tax form (W-4, simplified) | Filing status, extra withholding (optional) | `c-tax` |
| Direct deposit | Bank name, routing number, account number, account number again | `c-deposit` |

- Every form shows: **"Demo only.** Don't enter real personal or bank details. Anything you type stays in this browser."
- **Friendly validation** under each field, plus a summary ("2 fields need a change") that is announced and focused. Examples: "Routing numbers are 9 digits. This one has 7.", "ZIP codes are 5 digits, like 94107.", "The two account numbers don't match."
- The signature must match her name as on the offer (capital letters and extra spaces don't matter). The offer form shows "Your offer at a glance".
- **Save draft** keeps what she typed. **Submit** (or **Sign offer**) validates, saves and completes the linked task.
- Submitted forms are read-only: "Submitted Nov 5 ✓", with bank numbers masked (••••6789; screen readers hear "ending in 6789"). To change something: "Ask Sarah Kim in HR."
- Number fields are password fields with `autocomplete="off"`, so a browser never fills in real details.
- A task done before forms existed (older saves) counts as submitted: "completed before forms moved into the app, so no details are stored here."

#### Pulse check-ins

- **Day 7** ("How's your first week going?") and **Day 30** ("How's your first month going?"), each open for a week.
- Three answers: Great / Okay / Could be better, plus an optional comment (up to 300 characters).
- It uses the one banner slot, never a focus row.
- Shown until answered or **Not now**, then never again ("This check-in won't come back").
- The card says: "HR sees answers grouped with everyone else's, never with your name."

#### Team

- "Welcome to Engineering, Emily! Here are the 5 people you'll work with most."
- **Manager card** and **buddy card** ("Your go-to person for any question, big or small"), with initials, name, pronouns, title and "Ask me about…".
- Until the manager picks a buddy: "Your buddy will be introduced soon. David is choosing someone from the team."
- **The rest of the team** as a grid (the buddy isn't repeated) and **Your HR contact**.

#### Documents for you

At the end of **My plan**: only the documents for everyone, her department and her job level, grouped by category, each opening in a new tab. Nothing shows if no documents match.

### 3.2 Manager (David)

Five tabs: **Team · Day-1 readiness · 1:1s · Goals · Notifications** (short labels "Day 1" and "Nudges" on phones). The hire detail page opens from Team. Every place is kept in the URL hash, so **Back to Team** and the browser's Back button both work.

#### Team

- **Header line:** "2 people onboarding · N to-dos for you · Marcus has 3 to catch up". Each part is a link. Parts already in the banner aren't repeated.
- **One banner:**
  - Usually **Next 7 days**: "N to-dos for you · Emily starts Monday" (or the started hire with the most to catch up). **Got it** hides it until next Monday.
  - **The day before one of his hires starts**, a Day-1 nudge replaces it: "Emily starts tomorrow. 4 things for Day 1" (welcome time and place, introduce to the team, book a recurring 1:1, check the buddy is set), with **Add 1:1 to calendar** (.ics). He can turn this off in Notifications.
- **Your to-dos, next 7 days:** a strip of 7 days (Today + 6), one number per day. Anything past its date counts on today. Tap a day to filter the list (kept in the URL as `#/team?day=…`); tap again or **clear** to see all 7. To-dos for the same hire share one "For Marcus" heading. Items after the 7 days sit under a folded **Later**.
- **People onboarding:** one card per hire, with a one-line key for the progress bar. Each card has:
  - name and title (opens the plan)
  - one status chip, as a button that opens exactly those tasks
  - "Day 11 · started Mon, Oct 26" or "Starts Mon, Nov 9 · in 4 days"
  - the progress bar (opens the plan) and "N of M done"
  - a muted "N to catch up" line when the chip is about someone else
  - "Goals · 30 days: 1 of 3 done" (opens Goals)
- **Empty state:** "No one is onboarding on your team right now. When HR adds a new hire who reports to you, they'll show up here."

#### Drill-downs

Clicks open the most specific place:

| Click | Opens | URL |
|---|---|---|
| Name or bar on a card | The hire's plan | `#/hire/marcus` |
| "3 to catch up" | The plan, filtered to her own tasks past their date | `#/hire/marcus?show=catchup` |
| "1 for you" | His tasks past their date | `#/hire/emily?show=foryou` |
| "With IT" | IT and HR tasks past their date | `#/hire/emily?show=waiting` |
| A readiness item or digest line | That one task, highlighted | `#/hire/emily?task=<id>` |
| A 1:1 entry | The note | `#/1on1s/marcus/<noteId>` |

A filtered view says "Showing 3 to catch up for Marcus" with **Show the whole plan**. When everything in it is done: "Nothing here any more."

#### Hire detail

Shared by managers and HR.

- **Header:** name, title, department, manager, day line, "Hybrid · Individual contributor · Role: Backend Engineer · Buddy: Nina Alvarez" (or "Buddy: not picked yet"), all status chips (as buttons) and the progress bar.
- **Phase stepper:** each phase with "done/total" (for example "Week 1 3/9"), the current one highlighted.
- **Manager only:** a card with goals per horizon and the next 1:1, each a link to its tab.
- **HR only:** the hire's pre-boarding forms (see [HR hire detail](#hr-hire-detail)).
- **Past their date:** a gentle amber card listing open tasks past their date, with **Send a reminder** on other people's tasks (his own hires only).
- **Full plan:** each phase folds. The current phase is open, done tasks fold into "N done", and tasks already listed above say "2 past their date (shown above)". Folds remember their state.
- **Actions:** **+ Add a task** (his own hires, or HR), **See what Emily sees** (switches Viewing as to her), and for HR **Edit hire** and **Remove**.

#### Custom tasks

"+ Add a task" opens an inline form: task name, who does it (the hire, the manager, IT or HR), due date and optional details.

- Name is required, up to 120 characters.
- Due date must be within 30 days before start and Day 28.
- The task shows "Added by manager" as its source. It can be removed (with a confirm).
- Custom tasks always survive a department or template change.

#### Day-1 readiness

For each of his hires starting in the next 14 days (Day 1 included), soonest first:

- A card: "Emily: 2 of 7 ready · starts Mon", "Software Engineer · Day 1 is Mon, Nov 9", a small meter and **Open plan**.
- Seven checks computed from the plan:

| Check | Owner | Ready when |
|---|---|---|
| Laptop shipped | IT | `c-laptop` done |
| Email and Slack accounts created | IT | `c-accounts` done |
| Tool access set up | IT | the department's `*-access` task done |
| Buddy assigned | You | a buddy is set |
| Welcome note sent | You | `c-note` done |
| First 1:1 booked | You | a "First 1:1" note exists, or `c-1on1` done |
| Forms submitted | Emily | all 5 forms in ("2 of 5 forms") |

- Each item shows **✓ Ready** or **○ Not ready yet** and who has it. The label opens the task (or the 1:1 note).
- A check whose task isn't in the plan is left out, so the count stays honest.
- His own items have actions right there: **Choose buddy** / **Change**, **Mark done**, **Book 1:1** (books the first 1:1 on Day 1, 30 minutes after lunch ends) and **Add to calendar** once booked.
- Other people's items have **Send a reminder**.
- **Empty state:** "Nobody is starting in the next 14 days", with **See your team**.

#### Buddy picker

**Choose buddy** (on the "Assign an onboarding buddy" task and in readiness) opens a dialog listing the hire's team, with the suggested buddy marked **Suggested**. Saving sets the buddy, ticks the task, and the new hire's Team tab shows that person. Ticking the task while no buddy is set also opens the picker. Unticking it clears the buddy.

The dialog traps Tab, closes on Esc, and returns focus to the button that opened it.

#### 1:1s

- A person picker (when he has 2 or more hires).
- **Start a 1:1 note:** pick one of four agenda templates (First 1:1 (Day 1), End of week 1, 30-day check-in, 60/90-day review; 4 to 6 talking points each). The date is suggested from the template and moved to a weekday; a passed date becomes the next weekday from today. Date must be within 30 days before start and 4 months after.
- **Planned** and **Past** lists: "Fri Oct 30 · 3:00pm · 5 of 5 points covered".
- **A note:** "Planned" or "Held", talking points to tick, free notes (saved when you click or tab away), and **Add to calendar** (.ics) for planned ones.
- **Follow-ups:** add one (up to 160 characters), then **+ Add to Marcus's plan** turns it into a task (who does it, due date; same rules as custom tasks). It then shows "In Marcus's plan" with **Open task**.
- **Empty states:** "Nothing planned with Marcus yet. Start one above." and "No past 1:1s with Marcus yet."

#### Goals

- One card per horizon (first 30, 60, 90 days) with "30 days: 1 of 3 done".
- Each goal has a status picker (Not started / In progress / Done, icon + word), the hire's own note if any, and **Remove** (with a confirm).
- **Suggested starter goals** for the department, each added with one click (once). When all are used: "All the suggestions are in Emily's goals."
- **Add your own goal:** horizon, goal (up to 120 characters), optional details.
- The new hire sees goals read-only in My plan and can add a progress note.

#### Notifications (demo)

- **Preferences** (saved as you change them):
  - Channels: In-app only / Email / Slack / Teams. "In-app only" stands alone; ticking another channel turns it off; unticking everything falls back to in-app.
  - Weekly digest day (Mon–Fri) and time.
  - Day-before nudge on/off.
  - Reminders for his own to-dos on/off.
- **Preview** of the weekly digest or the day-before nudge, built from live data, as an email and as a Slack or Teams message. Each line in the in-app version opens what it mentions. With nobody starting soon: "there's no day-before nudge to preview".
- **Send test** adds one entry per chosen channel to the **demo outbox**.
- **Send a reminder** (from readiness or a task) opens a polite, pre-filled, editable message: "Hi IT team, A quick check on 'Laptop shipped' for Emily Chen, who starts Mon…". **Save to demo outbox**.
- **Demo outbox:** newest first, last 40 kept, each labelled **Demo — not actually sent**. **Clear outbox** removes his entries. Nothing ever leaves the browser.

### 3.3 HR (Sarah)

Five tabs: **New hires · + Add new hire · Plan templates · Insights · More** (short labels "Hires", "+ Add", "Templates" on phones; the tab bar scrolls inside itself at 320px). HR's place is kept in the URL hash: `#/hr/hires`, `#/hr/add`, `#/hr/add/bulk`, `#/hr/templates`, `#/hr/insights`, `#/hr/more/compliance`, `#/hr/more/documents`, `#/hr/hire/emily`, `#/hr/hire/emily/edit`. The browser's Back button works.

#### New hires

**KPI numbers** (plain numbers, each with an icon when not zero):

| KPI | Counts hires who… |
|---|---|
| Manager to-dos | have a manager task past its date |
| Hires catching up | have their own tasks past their date |
| Starting soon | start in the next 14 days |

**Where everyone is** (the timeline):

- Above it, plain counts per phase: Before Day 1 · Week 1 · Weeks 2–4.
- One row per person (up to 15, "Showing the first 15 of N"): a grey bar for their plan window (a week before start to the end of Week 4), filled blue up to Today (time elapsed, not tasks done), one Today line across all rows, date ticks, and one status chip.
- Each name is a button. Click, tap, Enter or Space opens a small **pop-up** (not hover or focus, so Tab is one stop per person). It shows name and title, department and manager, start date and phase ("Week 1 · Day 3", "Before Day 1 · starts in 4 days"), status (icon + word), "6 of 15 done · next: …" (the same own-tasks count as the table), and **Open plan** and **Edit**.
- On desktop the pop-up sits beside the name, over the bars, so the other names stay usable. On phones it is a bottom sheet (at most 70% of the screen, scrolling inside) over a light backdrop.
- Esc, the backdrop, or clicking outside closes it, and focus returns to the name. Only one is open at a time.
- Under 400px the date row keeps Today and the start and end dates and hides any label too close to another. Names wrap to two lines.

**The table:**

- Sorted by most tasks past their date, then soonest start.
- Columns: Name (and title), Team (department and manager), Start ("Nov 9 · Mon · in 4d" / "day 11" / "done"), Progress (bar and "N of M done", plus a muted "N to catch up" when the chip is about someone else), Status (one chip, plus "With IT" when relevant), and **Edit** / **Remove**.
- The whole row opens the plan (click, or Enter when focused).
- Empty state: "No new hires yet" with **+ Add new hire**.

**HR & IT to-dos this week:** HR and IT tasks due in the next 7 days (or already past), grouped by hire. HR can tick them. Empty: "No HR or IT tasks due in the next 7 days."

#### HR hire detail

The shared [hire detail](#hire-detail) page, plus a **Pre-boarding forms** card: "2 of 5 submitted. Bank numbers are masked. Demo data only." Each form shows its status, and submitted ones have **View details** (masked). HR can tick HR and IT tasks, add custom tasks, edit and remove. The back link says "All new hires", or "Back to Compliance" when opened from there.

#### Edit hire

Opened from **Edit hire** on the detail page, **Edit** on a table row, or **Edit** in the timeline pop-up.

- Fields: name, title, department, manager, start date, work type, job level, role.
- A live **What changes** list:
  - Manager: "David's N open tasks move to Priya. David's Team view no longer shows Emily."
  - Plan: "N open tasks come out and N go in", with **Comes out** and **Goes in** lists ("From: Sales"). Done tasks and tasks added by hand stay.
  - Start date: "Start date moves from Mon, Nov 9 to Mon, Nov 16. N open tasks get new due dates."
  - Buddy: changes to the new team's default if the task was done, or is picked again by the new manager.
- **The manager must manage the new department.** Changing the department picks that department's manager and says so. Saving with a manager from another department is an error ("Pick a manager in Sales. David Okafor manages Engineering."). On the add form it's only a warning.
- A weekend start date gets the same calm note and **Use Mon** button as the add form.
- Tasks HR left out when the plan was made stay out. 1:1 notes and goals stay with the hire.

#### Remove and Undo

**Remove** opens a calm dialog: "Remove Emily Chen's onboarding plan? Emily and the plan leave every list, including David's Team view." **Remove plan** or **Keep it**. Then a toast offers **Undo** for 10 seconds, with keyboard focus on Undo. Undo puts the hire back in the same place and focuses the restored row. If the removed hire was the "Viewing as" person, it falls back to Sarah.

#### + Add new hire

Two modes: **One person** and **Bulk import**.

**One person:**

- Fields: full name, job title, department, manager, start date (defaults to 14 days from today), work type, job level, role (None, or a role in that department; disabled until a department is picked).
- Picking a department suggests its manager and clears a role from another department.
- **Preview plan** validates first:

| Check | Result |
|---|---|
| Blank name, title, department, manager, start date | Error |
| Name or title over 80 characters | Error |
| Invalid date | Error ("That isn't a valid date.") |
| Start more than 4 weeks ago | Error (the plan would already be over) |
| Start more than a year away | Error ("Check the year.") |
| Start in the past, or within 10 days | Warning (past-due tasks move to today) |
| Start on a Saturday or Sunday | Warning with **Use Mon, Nov 16** (one click) |
| Manager from another department | Warning |
| Same name as someone onboarding | Warning (two people can share a name) |
| Role from another department | Error |

- **Generated plan for Jordan:** the tasks per phase, each with a checkbox, type icon, owner, "From: Engineering" or "From: Backend Engineer", due date, and "Because: Remote" for rule-based tasks. A folded line lists tasks a rule left out ("2 tasks skipped (not relevant to this role)", each with "Only: Onsite or Hybrid").
- **Create plan with N tasks** (disabled with "Keep at least one task in the plan" if all are unticked) or **Back to edit**. Creating opens the new hire's plan with a toast: "Plan created for Jordan Lee. David Okafor can now see it."

**Bulk import:**

- Paste CSV, or **Choose a .csv file** (read in the browser only), or **Download sample CSV**.
- Columns: name, title, department, manager, start date, work type, job level, role. The first five are required. Column names can be in any case, with spaces or underscores, and common aliases work ("full name", "dept", "reports to", "first day").
- Managers match by name or first name. Dates can be `2026-11-23` or `11/23/2026`. Work type, job level and role can be blank (defaults: Onsite, Individual contributor, no role).
- **Check rows** shows every row with:
  - **✓ Ready** (with any warnings, and a "Check:" note for a weekend start, which still imports)
  - **○ Needs a fix** with reasons in plain words ("'Enginering' isn't a department. Use Engineering, Sales, Marketing, Customer Support.")
  - **Possible duplicate** (already onboarding, or twice in the paste), skipped unless **Import anyway** is ticked
- A summary line: "4 rows: 2 ready, 1 needs a fix, 1 possible duplicate (skipped unless you tick 'Import anyway')".
- **Import N hires** builds each plan exactly like adding one person, then shows who was imported and how many rows were skipped.
- A missing header: "The first row needs column names. Missing: manager, start date."

#### Plan templates

- A note: **"Changes apply to new hires you add from now on.** People already onboarding keep their current plan."
- "Every plan = Company tasks + the person's department tasks + their role tasks, if they have a role."
- **Template picker:** Company, Engineering, Sales, Marketing, Customer Support, then **Roles** (seeded: Backend Engineer, Account Executive, Support Specialist) and **+ New role**. Edited templates show an **Edited** marker.
- **Tasks grouped by phase**, each with type icon, title, description, timing ("5 days before start" / "Day 3"), owner chip, a rule chip ("Only: People managers · Remote"), a **Required** or **Compliance** chip, a "Doc: Employee handbook" chip, and **Edit** / **Remove**.
- **The task form:**

| Field | Notes |
|---|---|
| Task name | Required, up to 120 characters. A duplicate name warns and the button becomes **Save anyway**. |
| Description | Optional, up to 240 characters. |
| Who does it | New hire, Manager, IT or HR. |
| When | A number plus "days before start" or "day of the job". Live hint: "Shows as: Day 3 · Week 1". Range: 30 days before start to Day 28. "Day 0" is an error. |
| Type | Task, Read, Watch, Acknowledge ("I've read and agree"), Meeting, Form. Each has an icon. |
| Link | Optional, must be a full `http(s)://` address. Shows as an **Open** link. |
| Document | Read and acknowledge tasks only: pick from the library. The task's Open link then uses the document's link. |
| Required | "Track it on the Compliance page". Acknowledge tasks are always tracked. |
| Who gets this task | Work type and job level checkboxes with a live summary. Leaving a group unticked means everyone in it. |
| How the new hire sees it | Only for tasks other people do: a title and description in the new hire's words. |

- **Remove** offers **Undo** on the toast (valid until the next template action). The Company template must keep at least one task. Removing a department's or role's last task asks to confirm.
- **Reset to original** (Company and departments) restores the default tasks after a confirm.
- **Roles:** **+ New role** asks for a name and a department (names must be unique within a department). A new role starts empty. **Remove role** asks to confirm; hires with that role keep their plan and their role is cleared.
- Only HR can edit templates.

#### Insights

"Based on 13 people: everyone onboarding now and people who finished." It counts the active hires plus 9 finished hires from earlier months (`state.archive`). Finished hires never show in the active lists, a manager's Team or Viewing as.

- **KPIs:** finished onboarding, days to finish Week 1 on average, check-in answers.
- **How long does Week 1 take?** One sentence ("New hires finish their Week 1 tasks in N days on average") and a plain bar per department.
- **Which tasks most often go past their date?** The top 5 ("done after its date, or still open with its date passed"). Select one to see who it affected, with **Open** for people onboarding now.
- **How do new hires feel?** Great / Okay / Could be better. Select one to read its comments, without names or dates, and only once there are at least 3 answers ("Comments show once there are at least 3 answers, so no one can be picked out").
- Each chart answers one question, in one colour.
- Empty states for each chart, and "No onboarding data yet."

#### More → Compliance

- Compliance items are **acknowledge tasks** plus tasks marked **Required** (seeded: offer letter, I-9/W-4, security training, harassment training; the handbook and the support escalation policy are acknowledge tasks).
- **Headline:** "1 of 4 people have everything signed."
- **Matrix:** people (rows) by items (columns). Each cell is **✓ Nov 3** (done, with date), **○ Not yet** or **—** (not in that person's plan). Each cell has a full sentence for screen readers: "Emily Chen, Read and acknowledge the employee handbook: acknowledged Thu, Nov 5". Each row shows **All signed** or "N not yet". Each column header shows "3 of 4".
- **Audit trail:** select a column header for who completed it and when, newest first ("Emily Chen acknowledged it", "Sarah Kim marked it done for Pat"), plus who hasn't yet ("Not yet: Tom Rivera (planned Fri, Nov 6)").
- **Export CSV** downloads the matrix plus the full audit log, made in the browser.
- **On phones** (under 640px): one card per person instead of the wide matrix. Each item reads "✓ Oct 9 · Sign offer letter…", "○ Not yet · …" or "— Not in plan · …", and each item name opens its audit trail.
- Completion dates are never shown later than the (demo) today.
- Covers people onboarding now only, not the finished hires.

#### More → Documents

- 12 seeded documents across **Policies, Benefits, IT & security** and **Team guides**. Each has a title, description, placeholder link, audience (Everyone, a department, or a job level) and an updated date.
- **Search** (every word must match, any case, over title, description, category and audience) and a **category filter**. Results update as you type. "No documents match" with **Clear search**.
- **Add, edit and remove inline.** Title must be unique, link must be `http(s)`. "Linked from 1 template task" shows where a document is used.
- **Remove** offers **Undo**. Tasks linked to a removed document fall back to their own link.
- New hires see the matching documents under My plan.

More also links to **Bulk import**.

---

## 4. Product decisions

### The two people who seem to disagree

| | Wants | How the prototype handles it |
|---|---|---|
| **David** (Eng Manager) | Different checklists per department, not one-size-fits-all | Plans are **layered**: Company + department + role, filtered by work type and job level. Engineering gets GitHub, dev environment, first PR; Sales gets Salesforce, demo certification. Managers can **add one-off tasks** to one person. |
| **Emily** (New hire) | Not 40 things on Day 1, just tell me what to focus on | Her home screen shows **at most 3 tasks** from the current phase, past-date first. Other people's tasks sit in "Being handled for you". Future phases are folded. The full plan is one tab away. |

They don't really conflict. David is talking about **what's in** the plan; Emily about **how much she sees at once**. A department plan can be as detailed as David wants, because the new hire only ever sees the next few items.

### Assumptions

- **Phases** are Before Day 1, Week 1 (Days 1–7) and Weeks 2–4 (Days 8–28). "First few weeks" means 4 weeks.
- **Each task has one owner**: the new hire, the manager, IT or HR. Only the owner can tick it (HR also covers IT, since there's no IT user). Nobody ticks a task for the new hire, so progress shows what she actually did.
- **The plan comes from department, role, work type and job level, not job title.** Sarah says "role or department". Department and the optional role set the list; work type and job level switch individual tasks on or off. A role belongs to one department.
- **"Automatically create plans" means templates plus a review step**, not AI. HR sees the plan and can remove tasks before saving. Fully automatic creation (for example from the HRIS when an offer is signed) is a later step.
- **Late plans aren't punished.** If HR adds someone 2 days before they start, tasks that would already be past their date become due that day. Otherwise the new hire would start with a warning that's HR's fault, not hers.
- **Template edits apply to new plans only, and only HR can edit templates.** A plan is a copy made when the hire is added. Rule changes also apply to new plans only. Edited templates are saved with the rest of the demo data; Reset demo data restores the defaults.
- **Editing a hire changes their plan now** (unlike template edits). Open template tasks that no longer apply are swapped; done and hand-added tasks stay; tasks HR left out stay out. Open manager tasks follow the hire to the new manager; 1:1 notes and goals stay with the hire.
- **Work types and job levels are fixed lists** in `js/data.js`. HR can't add new ones in this version.
- **Seed hires always start on a Monday**, whatever day the demo is opened.
- **Teams, the first-week agenda, learning paths and forms are mock data** (`OB.TEAMS`, `OB.AGENDA`, `OB.LEARNING`, `OB.FORMS`). Learning and document links are placeholders (example.com).
- **The buddy** is picked by the manager from the hire's team, with the team's default suggested.
- **Pre-boarding forms are mocks.** The W-4 is a two-field simplification and the I-9 stays an in-person check on Day 1. Personal details and emergency contact have no plan task; they only count on the Forms card. Submitted forms can't be edited in the app.
- **Pulse answers are anonymous in aggregate.** They're stored on the hire in this demo, but HR only sees counts and comments grouped by answer, without names or dates, and comments only with 3 or more answers.
- **Compliance covers people onboarding now.** Acknowledge tasks are always compliance items; "Required" is an extra flag. An acknowledgement is the new hire ticking "I've read and agree"; it isn't a legal e-signature.
- **Documents are links, not files.** No upload or versioning.
- **Notifications are a demo.** Preferences, previews and the outbox live in localStorage. No real email, Slack or Teams calls.
- **No real logins.** "Viewing as" stands in for sign-in.

### Wording principles

The copy is neutral, supportive and action-oriented. It says what's next, never who failed.

- No "owe", "behind", "overdue", "late", "failed", "missed" or "attention" in visible copy. `OB.bannedWords` (in `js/manager.js`) finds them, and tests check the digest, nudge and reminder messages with it.
- Instead: "1 for you", "3 to catch up", "With IT", "Was due Nov 4 · do this next", "Expected soon", "Past their date".
- The new hire never sees lateness on other people's tasks.
- A past meeting asks "Did this happen?" instead of calling it overdue.
- Red is only for form errors. "Past their date" uses a gentle amber card.

### Status rules

For managers and HR, the status says **whose move is next**. One definition, `OB.hireStats` in `js/plan.js`, in this priority order:

| Status | Chip | When |
|---|---|---|
| Complete | ✓ Complete | Every task done |
| Action | → "1 for you" (manager) / "1 for manager" (HR) | A manager task is past its date. A calm blue arrow, not red. |
| Catching up | ◷ "3 to catch up" | The new hire's own tasks are past their date (meetings don't count). Before Day 1, this is the most it can show. |
| Waiting | ▢ "With IT" / "With HR" / "With IT & HR" | Only IT or HR tasks are past their date |
| Upcoming | ○ "Starts Nov 9" | Before Day 1, nothing pending |
| On track | ✓ On track | Started, nothing past its date |

Cards and table rows show one chip (the most urgent). The detail page shows all of them.

**Progress bars and "N to catch up" use one definition** (`OB.ownProgress`): the bar counts only the new hire's own tasks, not meetings. The blue fill is how many of her tasks dated before today are done; the small tick is how many were dated before today ("where they'd be by today"). The gap between fill and tick is exactly the "N to catch up" number. The caption is always "N of M done" on the same scale. A one-line key above the cards and the table explains the tick.

**The manager's week** uses one definition too (`OB.rollingWeek`): today plus 6 days, anything past its date counts on today. The strip, the list under it, the digest and the header all read it, so their numbers always agree.

### Phases

| Phase | Day offsets | Label | Hint |
|---|---|---|---|
| `before` | below 0 | Before Day 1 | Paperwork and setup so Day 1 is smooth |
| `week1` | 0 to 6 | Week 1 | Get settled, meet people, get access working |
| `month1` | 7 and up (max 27) | Weeks 2–4 | Start contributing and set goals |

A task's phase comes from its template offset (`OB.phaseForOffset`), not its due date after weekend moves.

### Weekend rules

- **Due dates:** a template offset from a Monday start can land on a weekend. A weekend date before Day 1 moves to the **Friday before**; on or after Day 1 it moves to the **Monday after** (`OB.weekdayDue`). This applies in plans, the add-hire preview and when a start date changes.
- **Start dates:** a Saturday or Sunday start is allowed but gets a calm note: "Nov 14 is a Saturday. Most people start on a Monday: use Mon, Nov 16?" with a one-click **Use Mon, Nov 16** on the add and edit forms (`OB.weekendStart`). In bulk import the row still imports with a "Check:" note.
- **First week:** the Schedule uses the first five working days, skipping weekends.
- **1:1 dates** move to the next weekday.

---

## 5. Technical implementation

### Architecture

- **No build step, no dependencies, no network calls.** Open `index.html` and it runs.
- **Scripts load in order** with plain `<script>` tags. Each file adds to one global namespace, `window.OB`:

```
js/data.js → js/plan.js → js/newhire.js → js/manager.js → js/hr.js → js/hr2.js → js/store.js → js/app.js
```

- **Pure logic is separate from the UI.** Every file except `store.js` and `app.js` has no DOM access, so `tests.html` loads them and tests them directly.

| File | Owns | Key functions |
|---|---|---|
| `js/data.js` | Mock data and fixed lists | `OB.TEMPLATES`, `OB.ROLE_TEMPLATES`, `OB.PEOPLE`, `OB.TEAMS`, `OB.AGENDA`, `OB.LEARNING`, `OB.FORMS`, `OB.SEED_HIRES`, `OB.ARCHIVED_HIRES`, `OB.DOCUMENTS`, `OB.DAY1`, `OB.PHASES`, `OB.TASK_TYPES` |
| `js/plan.js` | Dates, plan generation, status, focus list, validation, templates, banners, .ics | `buildPlan`, `previewPlan`, `templateTasksFor`, `taskApplies`, `weekdayDue`, `hireStats`, `ownProgress`, `rollingWeek`, `focusTasks`, `canComplete`, `validateHire`, `validateCustomTask`, `mergeTemplates`, `validateTemplateTask`, `pickBanner`, `journeyModel`, `buildIcs`, `migrateState` |
| `js/newhire.js` | Team and buddy, first week, learning, forms | `teamView`, `firstWeekAgenda`, `weekState`, `agendaEvents`, `learningModel`, `setLearningStatus`, `validateForm`, `submitForm`, `formsSummary`, `maskNumber`, `migrateHireExtras` |
| `js/manager.js` | Readiness, 1:1s, goals, notifications, manager routes | `readinessFor`, `chooseBuddy`, `newOneOnOne`, `followUpToTask`, `addSuggestedGoal`, `goalHorizons`, `cleanNotifyPrefs`, `buildDigest`, `buildNudge`, `reminderDraft`, `addToOutbox`, `bannedWords`, `parseRoute`, `buildRoute`, `filterTasks`, `migrateManagerHire`, `migrateManagerState` |
| `js/hr.js` | Roles, add/bulk import, CSV parser, HR routes, timeline pop-up, pulses, insights, edit/remove hire | `makeHire`, `parseCsv`, `mapHeader`, `bulkPreview`, `bulkImport`, `parseHrRoute`, `phaseLine`, `pulseDue`, `answerPulse`, `insights`, `seedArchive`, `validateHireEdit`, `planHireEdit`, `applyHireEdit`, `removeHire`, `restoreHire`, `migrateHrState` |
| `js/hr2.js` | Compliance and the document library | `complianceMatrix`, `cellWords`, `auditTrail`, `csvCell`, `complianceCsv`, `migrateDoneBy`, `docsFor`, `searchDocs`, `validateDoc`, `taskLinkFor`, `migrateC2State` |
| `js/store.js` | localStorage, seed state, cross-tab sync | `OB.store.load`, `save`, `reset`, `onExternalChange` |
| `js/app.js` | All rendering and events | `render`, `renderNewHire`, `renderToday`, `renderManager`, `renderDetail`, `renderHR`, `renderHireTable`, `renderTemplates`, `renderCompliance`, `toggleTask`, `switchViewer`, `nav`, `hrNav` |

### State shape (localStorage)

One key, **`mangoapps-onboarding-v1`**, holds the whole app state as JSON. UI-only state (open tab, drafts, folds, the toast) lives in a `ui` object in `app.js` and isn't saved.

```js
{
  version: 1,
  viewerId: "emily",            // who "Viewing as" is
  demoToday: null,              // "YYYY-MM-DD" or null for the real date
  hires: [Hire],                // everyone onboarding now
  reminders: { hide: { key: "YYYY-MM-DD" }, seen: { key: "first shown date" } },  // banner snooze / Got it / milestones
  templates: { Company: [...], Sales: [...] },  // only the templates HR changed (empty = all defaults)
  roles: [{ id, name, department, tasks: [TemplateTask] }],
  archive: [Hire & { archived: true, archivedAt }],  // finished hires, Insights only
  documents: [{ id, title, category, desc, link, audience: { kind: "everyone" | "department" | "level", value }, updated }],
  notify: { [managerId]: { channels, digestDay, digestTime, dayBefore, todoReminders } },
  outbox: [{ id, date, time, kind, channel, to, toRole, subject, body, fromId, hireId, taskId, label: "Demo — not actually sent", demo: true }]
}
```

**Hire:**

```js
{
  id, name, title, department, workType, jobLevel, role /* role id or null */, managerId, startDate,
  tasks: [Task],
  buddyId,                                   // teammate id or null
  learning: { [itemId]: { status: "inprogress" | "done", at } },
  forms: { [formId]: { status: "draft" | "submitted", data, savedAt, submittedAt } },
  oneOnOnes: [{ id, hireId, managerId, templateId, title, date, time, points: [{ text, done }], notes, followUps: [{ id, text, taskId }], createdAt }],
  goals: [{ id, horizon: 30 | 60 | 90, title, desc, status: "todo" | "doing" | "done", note, suggestedId, createdAt, updatedAt }],
  pulses: { d7?: { answer, comment, at } | { dismissed: true, at }, d30?: ... }
}
```

**Task:**

| Field | Meaning |
|---|---|
| `id` | Unique id (`OB.newId`) |
| `key` | The template key it came from (`c-offer`), or null for custom tasks |
| `source`, `sourceKind` | "Company", a department, a role name (`sourceKind: "role"`), "Added by manager" or "1:1 follow-up" |
| `title`, `desc` | Owner-facing wording |
| `hireTitle`, `hireDesc` | The new hire's wording for tasks other people do |
| `owner` | `newhire` \| `manager` \| `it` \| `hr` |
| `dayOffset`, `dueDate`, `phase` | Offset from start, the computed date, and `before` \| `week1` \| `month1` |
| `type`, `isEvent` | `task` \| `read` \| `watch` \| `acknowledge` \| `meeting` \| `form`; `isEvent` is kept equal to `type === "meeting"` |
| `link` | A valid http(s) link or null |
| `appliesTo` | `{ workTypes?, jobLevels? }` (only when restricted) |
| `required`, `docId` | Compliance flag; library document |
| `done`, `doneAt`, `doneBy` | Completion, date and who did it (a person id) |
| `custom`, `addedBy`, `fromOneOnOne` | Custom tasks and 1:1 follow-ups |
| `notYetOn` | The day the new hire said "Not yet" to a past meeting |

**Template task** (in `OB.TEMPLATES`, `state.templates` and role tasks): `key`, `title`, `desc`, `owner`, `dayOffset`, and optionally `type`, `link`, `appliesTo`, `hireTitle`, `hireDesc`, `required`, `docId`. `OB.cleanTemplateTask` drops anything malformed.

**Who did it (`doneBy`).** Every way a task gets done records who did it: ticking it (new hire, manager or HR), submitting a form, finishing a linked learning item, or choosing a buddy. This feeds the audit trail.

### Plan generation

`OB.buildPlan(hire, startDate, skipKeys, createdOn, templates)` in `js/plan.js`:

1. **Pick templates** (`templateTasksFor`): Company tasks + the department's tasks + the role's tasks (only if the role belongs to that department). Templates are HR's edited copies merged over the defaults (`mergeTemplates`); roles come from `state.roles`. Each task is tagged with its source.
2. **Filter**: drop keys HR unticked (`skipKeys`), then drop tasks whose rules don't match (`taskApplies`). A rule matches when every list it sets (work types, job levels) includes the hire's value. An empty list, or one with every value ticked, means no restriction.
3. **Due dates** (`makeTask`): `startDate + dayOffset`. The phase comes from the offset.
4. **Weekday rule** (`weekdayDue`): a weekend date moves to the Friday before (before Day 1) or the Monday after.
5. **Late-add rule**: if the plan is created after a task's due date (`createdOn`), the due date becomes the creation day.

`OB.previewPlan` runs the same steps for the add-hire preview, and also returns the skipped tasks with "Only: …" and a "Because: …" reason for rule-based tasks. `OB.makeHire` (single add and bulk import) calls `buildPlan` and adds empty `buddyId`, `learning`, `forms`, `oneOnOnes`, `goals` and `pulses`.

`OB.planHireEdit` reuses the same pieces for edits. It keeps done and custom tasks, removes open template tasks that no longer apply, adds new ones that weren't in the old profile (so tasks HR skipped stay out), and recomputes open due dates when the start date changes (weekday rule, never before today).

### Status and progress

- `OB.hireStats(hire, today)` returns totals, overdue tasks, `dayN` (days since start), the status (see [Status rules](#status-rules)), counts per owner, per-phase counts and `own` (from `ownProgress`).
- `OB.ownProgress(hire, today)` returns `{ total, done, expected, doneExpected, toCatchUp }` for the new hire's own non-meeting tasks. `toCatchUp = expected - doneExpected`. The "N to catch up" chip, the bar, the manager drill-down and the digest all use it.
- `OB.rollingWeek(items, today, 7)` returns the 7 days, the items in the window (past-due ones on today) and `later`.
- `OB.focusTasks(hire, today, 3)` returns the new hire's open tasks in the current or earlier phase, or due within 2 days, sorted by offset. If there are none it returns the next few upcoming ones with `upcoming: true`.
- `OB.canComplete(role, task)` decides who can tick what.

### Rendering

- **String templates.** Each screen is a function that returns an HTML string (`renderToday`, `renderManagerTeam`, `renderCompliance`…). `render()` builds the header, the role's main view, the footer, the toast and any dialog, and sets `#app.innerHTML`.
- **Re-render on change.** Actions change `state` (or `ui`), then call `commit()` (save to localStorage, then `render()`), or just `render()` for UI-only changes.
- **Every user string goes through `esc()`**, which escapes `& < > " '`.
- **Event delegation.** Four listeners on `#app` handle everything: `click` (finds the closest `[data-action]` and switches on it, through `managerClick`, `hrClick` and a main `switch`), `change` (checkboxes via `data-toggle`, selects, form fields), `input` (keeps typing in drafts across re-renders) and `submit`. A `toggle` listener remembers which `<details>` folds are open (`data-fold`). A `keydown` listener handles Enter on table rows, Esc, and the dialog focus trap.
- **Focus restore.** Before replacing the DOM, `render()` remembers the focused control (by `data-toggle`, `data-preview`, id, or a `data-action` + `data-tab`/`data-day`/… selector) and focuses the same control afterwards. Dialogs focus their first control when they open and return focus to the opener when they close. After Undo, focus goes to the restored row.
- **Small partial updates** where a full re-render would lose the cursor: the documents search results, the template form's live hints, the weekend start-date hint, and the timeline pop-up (added to the DOM directly).

### Routing

- **Manager** (`OB.parseRoute` / `OB.buildRoute` in `js/manager.js`): `#/team[?day=YYYY-MM-DD]`, `#/hire/<id>[?show=catchup|foryou|waiting][&task=<id>]`, `#/readiness`, `#/1on1s[/<hireId>[/<noteId>]]`, `#/goals[/<hireId>]`, `#/nudges`.
- **HR** (`OB.parseHrRoute` / `OB.buildHrRoute` in `js/hr.js`): `#/hr/hires`, `#/hr/add[/bulk]`, `#/hr/templates`, `#/hr/insights`, `#/hr/more[/compliance|documents]`, `#/hr/hire/<id>[/edit]`. A query string (from the removed filter bar) is ignored.
- Ids must match `^[A-Za-z0-9_-]{1,80}$`; anything else falls back to the default page.
- `nav()` and `hrNav()` push a hash; a `hashchange` listener applies the route, so the browser's Back and Forward work. Opening a link with a route on page load lands there.
- The new hire's tabs aren't in the URL. Switching "Viewing as" clears the hash.

### Migration of old saved state

`OB.store.load()` reads the saved state if it has `version: 1` and a `hires` array; otherwise (or if storage is blocked or corrupt) it uses the seed. It then calls `OB.migrateState(s)`, which fills in everything added since the first version:

| Step | Function | Adds or fixes |
|---|---|---|
| Round 3 | `migrateState` | Hire `workType` / `jobLevel` (defaults: Onsite, Individual contributor); task `type`, `isEvent` and `link` from the default template with the same key |
| Round 4 A | `migrateHireExtras` | `buddyId` (the team default if the buddy task is done), `learning`, `forms` (malformed records dropped) |
| Round 4 B | `migrateManagerHire`, `migrateManagerState` | `oneOnOnes`, `goals` (cleaned), `notify` (cleaned prefs), `outbox` (relabelled "Demo — not actually sent") |
| Round 4 C1 | `migrateHrState`, `migrateHrHire` | `role` (null if unknown), `pulses` (cleaned), `roles` (seed roles), `archive` (seeded finished hires); a saved `hrFilter` from the removed filter bar is dropped |
| Round 4 C2 | `migrateC2State`, `migrateDoneBy` | `required` / `docId` on plan tasks (from the default templates by key), `documents` (seed library), and a missing `doneBy` |

A done task saved without `doneBy` gets **its owner**: the new hire, the manager, or Sarah in HR for HR and IT tasks (the same rule as the seed data). "Unknown" shows only for ids the app can't name. A malformed `templates` value falls back to the defaults.

### Calendar files (.ics)

`OB.buildIcs(eventOrList)` in `js/plan.js` builds a minimal RFC 5545 file:

- `VCALENDAR` with `PRODID:-//MangoApps//Onboarding//EN`, one `VEVENT` per event.
- Floating local times (`DTSTART:20261109T093000`, no time zone), a `UID`, `DTSTAMP`, `SUMMARY`, `LOCATION`, `DESCRIPTION`.
- Text escaping for `\`, `,`, `;` and line breaks; lines folded at 75 characters; CRLF line endings.

Used for: the Day-1 card (`mangoapps-day-1.ics`; for remote hires the LOCATION is the call link), the whole first week (`mangoapps-first-week.ics`, one event per agenda item via `OB.agendaEvents`), the manager's Day-1 1:1 from the nudge, and any planned 1:1 note (`OB.oneOnOneEvent`). Files download through a Blob URL; nothing is uploaded.

### CSV import and export

**Parser** (`OB.parseCsv` in `js/hr.js`): a small RFC 4180-style parser. It handles quoted fields, commas and line breaks inside quotes, `""` for a quote, CRLF / LF / CR line ends, a leading byte-order mark, blank lines and rows of only commas. Each record keeps the line it starts on, so errors say "row 3".

**Header mapping** (`OB.mapHeader`): matches column names ignoring case, spaces and underscores, with aliases. Missing required columns give one plain error.

**Row checks** (`OB.bulkPreview`): every row goes through `OB.validateHire` (the same rules as the add form), with friendlier messages for unknown departments, managers, dates, work types, job levels and roles, plus duplicate detection. `OB.bulkCounts` and `OB.bulkImport` decide which rows import.

**Export** (`OB.complianceCsv` in `js/hr2.js`): the compliance matrix, a blank line, then the audit log, with CRLF line ends. `OB.csvCell` quotes a cell that holds a comma, quote or line break, and **guards against formula injection**: a value starting with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading `'`, so spreadsheets don't run it as a formula.

### Accessibility

- **Labels everywhere.** Every input, select and textarea has a `<label>` or `aria-label`; the harness flags any that don't.
- **Status is never colour alone.** Each status is an icon + a word (✓ Complete, ○ Not yet, → 1 for you). The progress bar, plain chart bars and the journey strip have `role="img"` with a full sentence; clickable bars have a full `aria-label`. Compliance cells have a full sentence each.
- **Tabs are page links**: plain buttons with `aria-current="page"` on the current one, in all three roles.
- **Focus:** a 3px focus ring (`:focus-visible`), focus kept across re-renders, focus moved to the first field with an error, dialogs that trap Tab and close on Esc, and focus returned after dialogs, pop-ups and Undo.
- **Live regions:** toasts, banners, the weekend hint, the "What changes" summary and search counts use `role="status"`; form error summaries use `role="alert"`.
- **Screen-reader text** (`.sr-only`) where the visual is short: "ending in 6789", "(opens in a new tab)", "to", "Where:".
- **Tap targets:** 44px hit areas for checkboxes, banner buttons and key controls on phones; the harness flags anything under 32px.
- **Contrast:** colour tokens were tuned for WCAG AA (contrast ratios noted next to each token in `css/styles.css`).
- **Phones:** layouts change under 640px (bottom sheet, compliance cards, two-column preview rows); no horizontal page scroll; tab bars scroll inside themselves at 320px.

### Styling

`css/styles.css` is one file. Colours, radius and shadow are CSS variables on `:root` (`--brand`, `--ink`, `--muted`, the status palette `--st-done`, `--st-behind`, `--st-action`, `--st-upcoming`, `--st-waiting`, and chart colours). Icons are small inline SVGs in `app.js` that inherit the text colour. Breakpoints are 640px, 480px, 400px and 360px. There is no dark mode.

### Security notes

- **HTML escaping:** all user and data strings go through `esc()` before they reach `innerHTML`.
- **Links:** `OB.isValidLink` accepts only `http://` or `https://` URLs with a host, no spaces, up to 500 characters. `javascript:`, `mailto:` and bare `www.` addresses are rejected. External links open with `target="_blank" rel="noopener"`.
- **Ids from the URL** must match a strict pattern before they're used.
- **No network calls.** There is no `fetch`, no XHR and no backend. Notifications only write to the demo outbox. CSV files are read with `FileReader` in the browser.
- **Demo masking:** bank numbers are stored as digits but always shown masked (••••6789, always 4 dots), to the new hire and to HR. Form inputs use `autocomplete="off"`, and sensitive ones are password fields. Every form warns not to enter real details.
- **CSV export** guards against formula injection (see above).
- This is still a prototype: localStorage is readable by anyone with access to the browser, and "Viewing as" is not authentication.

### Multi-tab sync

`OB.store.onExternalChange` listens for the browser's `storage` event on the app's key. When another tab saves, this tab reloads the state and re-renders, closing a detail page or dialog whose hire no longer exists.

---

## 6. Testing and quality

### Logic tests: `tests.html`

- **How to run:** open `tests.html` in a browser (directly or through `python -m http.server`). The page lists every test with ✓ or ✗ and a summary; the title is `PASS (143)` or `FAIL (n)`.
- **How it works:** it loads the same pure modules as the app (`data.js`, `plan.js`, `newhire.js`, `manager.js`, `hr.js`, `hr2.js`; not `store.js` or `app.js`). Tests are declared with `test(name, fn)` and use two helpers, `eq` (JSON equality) and `ok`. Most use a fixed date, Thu Nov 5, 2026.
- **143 tests** cover:
  - dates and phases (month ends, a DST change, invalid dates)
  - plan generation, skipped tasks, the late-add rule, new-hire wording
  - the focus list, statuses, the progress bar and catch-up count, the rolling week, neutral status labels, permissions
  - validation of hires and custom tasks
  - meetings, countdown wording, the journey strip, banners and milestones
  - editable templates, rules (`taskApplies`), task types, links, the timing picker
  - Day 1 logistics (onsite and remote), .ics files (single and multi-event, escaping)
  - first-week agenda, learning, the 5 forms (validation, masking, drafts, linked tasks)
  - buddy assignment and the picker, seed data
  - Day-1 readiness, 1:1 notes and follow-ups, goals
  - notification preferences, digest and nudge messages, reminder drafts, the demo outbox label
  - manager and HR URL routes, drill-down filters
  - the weekend rule and weekend start dates
  - the CSV parser, header mapping, bulk import (validation, duplicates, same plans as single add)
  - role templates, edit and remove hire with Undo
  - pulse check-ins and insights (including hiding comments for small groups)
  - the compliance matrix, audit trail, CSV export (escaping and the formula guard), `doneBy`
  - the document library (audience, search, validation, document links on tasks)
  - migration of older saves for every step
  - completion dates never shown after the demo date

### UI harness: Playwright (`ui-tests/`)

- **Setup (once):**

  ```bash
  python -m pip install playwright
  python -m playwright install chromium
  ```

- **Run** from the repo root:

  ```bash
  bash ui-tests/snap.sh                          # all screens
  bash ui-tests/snap.sh --only hr                # screens whose name contains "hr"
  bash ui-tests/snap.sh --out ui-review/shots/round-5
  ```

  `snap.sh` finds a Python that has Playwright (`python3`, `python`, `py`, or an Anaconda/Miniconda install) and runs `ui-tests/snap.py`.

- **What it does:**
  1. Serves the repo on a free local port (Python's `http.server`).
  2. Opens `tests.html` and records the logic test result.
  3. Walks through **129 scripted screens** (every role, tab, dialog, error state and edge case: new hire Day 1 and Day 2, empty manager, add-hire errors, bulk import with bad rows, edit Emily into Sales, the timeline pop-up at 320px, and more). Each screen runs at **desktop (1280×900)** and **phone (375×812, touch)**, so 258 rows.
  4. Each screen starts from fresh seed data with the demo date fixed at **2026-11-05**, so screenshots are stable between runs. Native confirm dialogs are dismissed.
  5. On each screen it saves a full-page screenshot and checks for console errors and page crashes, horizontal scrolling, tap targets under 32px (phone), and form controls without a label.
- **Output:** `<out>/report.md` (a table: screen, viewport, problems or "ok", screenshot path), `<out>/report.json` and `<out>/<screen>--<viewport>.png`. Default folder: `ui-review/shots/latest`.
- **Exit code** 1 if logic tests fail, a page throws, or a screen can't be reached.
- **Last result (round 4):** logic tests PASS (143), 258/258 rows ok, 0 automatic problems.

### AI critic and builder workflow (Claude Code)

The repo includes an agent workflow that critiques, improves and re-tests the UI.

| Piece | File | Job |
|---|---|---|
| `ui-critic` agent | `.claude/agents/ui-critic.md` | Runs the harness, looks at every screenshot (desktop and phone) as Emily, David and Sarah, probes edge cases, and returns ranked findings (P1 broken, P2 worse, P3 polish; at most 12). In **verify** mode it marks each change FIXED / PARTLY / NOT FIXED / REGRESSION. It never edits app code. |
| `ui-builder` agent | `.claude/agents/ui-builder.md` | Implements exactly the listed changes, keeps `esc()`, `data-action` delegation and CSS variables, adds tests for logic changes, updates the harness when a flow changes, and reruns it. Never commits. |
| `/ui-loop` command | `.claude/skills/ui-loop/SKILL.md` | Orchestrates one or more rounds: collect feedback → critique → (optional research) → triage (all user items, then up to 6 critic items) → build → verify (one retry) → log. |

**Usage:** `/ui-loop`, `/ui-loop 3 rounds`, `/ui-loop critique only`, `/ui-loop feedback only`, `/ui-loop focus phone`, `/ui-loop make the overdue colour less alarming`.

**Feedback** goes in `ui-review/feedback.md` (an **Inbox**, plus **Standing preferences** that apply every round, such as "at most 3 focus tasks" and the banned words), or straight into the chat. User feedback always beats the critic.

**`ui-review/` is local only** (it's in `.gitignore`). It holds `log.md`, `feedback.md`, `findings.md`, `verify.md`, research briefs, plans and screenshots per round (`ui-review/shots/round-N/`).

**Round history** (from `ui-review/log.md`):

| Round | Date | What happened | Harness |
|---|---|---|---|
| 1 | Nov 5 | Critic found 12 issues. Fixed 6: phone header, templates on phone, the new hire seeing others' overdue tasks in red, overdue row alignment, a 2,500px manager detail page (63% shorter on phone), 44px tap targets. | 29 tests PASS, 0 problems |
| 2 | Nov 5 | Research brief (27 sources), then a redesign: journey strip, Day-1 card and .ics, one banner, milestones, progress bar with an "expected by today" tick, rolling 7-day strip, digest and nudge, the "Where everyone is" timeline, editable templates, simpler charts, no punishing words, a colour-blind-safe status palette. Rebranded as MangoApps. | 59 tests PASS, 25 screens, 0 problems |
| 3 | Nov 5 | Smarter templates: work type and job level rules, 6 task types with icons and links, "I've read and agree", remote Day 1, "Because:" reasons and skipped tasks in the preview. | 74 tests PASS, 46/46 rows ok |
| 4 | Nov 6 | New hire (Team, Schedule, Learning, Forms), manager (readiness, 1:1s, goals, notifications, drill-downs, buddy picker), HR (roles, bulk import, insights, pulses, edit/remove, compliance, documents). The HR filter bar was built then removed, and offboarding/moves dropped, at the user's request. Fixes: phone bottom sheet, weekend start warning, compliance cards on phone, tabs with `aria-current`, focus after Undo. | 143 tests PASS, 258/258 rows ok, 0 problems |

---

## 7. Project layout

```
index.html                    Page shell: loads the stylesheet and the 8 scripts in order
tests.html                    In-browser logic tests (143) for the pure modules
css/styles.css                All styles: tokens on :root, components, phone breakpoints
js/data.js                    Mock data: templates, roles, people, teams, agenda, learning, forms, seed and archived hires, documents
js/plan.js                    Pure logic: dates, plan generation, weekday rule, status, progress, focus list, validation, templates, banners, .ics
js/newhire.js                 Pure logic: team and buddy, first-week schedule, learning path, pre-boarding forms
js/manager.js                 Pure logic: Day-1 readiness, 1:1s, goals, notifications and outbox, manager URL routes
js/hr.js                      Pure logic: roles, add and bulk import (CSV parser), HR routes, timeline pop-up, pulses, insights, edit/remove hire
js/hr2.js                     Pure logic: compliance matrix, audit trail, CSV export, doneBy, document library
js/store.js                   localStorage load/save/reset, seed state, cross-tab sync
js/app.js                     UI: rendering, event delegation, routing, dialogs, downloads
ui-tests/snap.py              Playwright harness: 129 screens × 2 viewports, screenshots and automatic checks
ui-tests/snap.sh              Finds a Python with Playwright and runs snap.py
.claude/agents/ui-critic.md   Agent that reviews and tests the UI (never edits code)
.claude/agents/ui-builder.md  Agent that implements a list of UI changes
.claude/skills/ui-loop/SKILL.md  The /ui-loop command: critique → build → verify → log
ui-review/                    Local only (git-ignored): feedback, findings, log and screenshots per round
LICENSE                       MIT
.gitignore                    Ignores ui-review/ and Python caches
```

---

## 8. What I left out, and questions for Sarah

### What I left out (and why)

- **The HR filter bar.** Built in round 4, then removed at the user's request: no Status / Department / Start date filters, chips or filter sentence on Hires, Insights or Compliance. Charts and the timeline still open things (who a task affected, a pulse answer's comments, a person's pop-up) but never filter. An old saved filter is dropped on load.
- **Offboarding and team / role moves.** Dropped at the user's request: no offboarding or move plans, no plan kinds and no "Offboarding & moves" page.
- **Real accounts, permissions and a database.** Everything is in localStorage. "Viewing as" stands in for sign-in.
- **Real notification delivery.** Managers can set preferences, preview the digest and nudge, and "send" tests and reminders, but they only go to a demo outbox. This is the obvious next step for "managers aren't sure whether everything has been completed", but it needs a backend.
- **Integrations** with the HRIS, IT ticketing, or MangoApps itself.
- **Updating existing plans when a template changes.** Template edits apply to new plans only.
- **Reordering template tasks by hand, and template version history.** Tasks are ordered by timing. There is Undo for a removed task and "Reset to original" per template, but no history.
- **Custom fields and rule types.** Rules only use work type and job level. No location rules (office or country) and no multi-company setup.
- **Task dependencies** ("can't do X until IT does Y").
- **Legally binding e-signatures.** The offer signature is a typed-name mock; acknowledgements are a checkbox.
- **Document uploads and versions**, and per-task audiences. Documents are links with one audience each.
- **An IT or Facilities view.** HR ticks IT tasks.
- **A team view for managers with many hires**, or picking several buddies.

### Questions I'd ask Sarah next

1. Who owns the department templates: HR, or each department's manager? (Decides who gets edit rights.)
2. Do IT and Facilities need their own view, or is "HR marks IT tasks done" fine for now?
3. How should managers hear about things that need them: email, Slack/Teams, or a weekly digest? Which one do they actually read?
4. Is "first few weeks" 30 days, or do some departments (for example Sales ramp) need 60–90?
5. Which tasks are legally required (I-9 within 3 days, state training), and do they need hard deadlines and a formal audit trail?
6. Do new hires have a company login before Day 1, or do pre-start tasks need to work from a personal email link?
7. When a template changes, should people already onboarding get the change?

---

## 9. Data and privacy

- **All data is mock data.** The people, teams, templates, documents and finished hires are made up. Links point to placeholder `example.com` addresses.
- **Everything stays in this browser.** State is saved in `localStorage` under `mangoapps-onboarding-v1`. Nothing is sent anywhere: no backend, no analytics, no network calls. **Reset demo data** clears it.
- **The pre-boarding forms are demo-only.** Every form says "Demo only. Don't enter real personal or bank details. Anything you type stays in this browser." Bank numbers are masked when shown, inputs don't autofill, and the W-4 is a two-field simplification.
- **Notifications are never sent.** Tests and reminders only go to the demo outbox, each marked "Demo — not actually sent".
- **Downloads** (.ics calendar files, the sample CSV, the compliance CSV) are made in the browser.
- **Pulse answers** are shown to HR only in aggregate, without names or dates, and comments only once there are at least 3 answers.

---

MIT License. See `LICENSE`.
