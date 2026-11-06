# Research brief, round 2: conveying information and reminders

Prompted by user feedback: "Create more innovative and user-friendly ways to convey information and reminders (colour theory, data visualizations). Look into the literature or good industry examples."
Written by the research agent from the round-1/final screenshots. The product is branded **MangoApps**.

## Problems in the current screens
- **Too much red on Emily's screen.** On Day 2, all 3 focus tasks are red and a red banner says 3 are overdue. One of them is "Attend Day 1 orientation", an event that has already taken place.
- **The progress numbers look bad early on.** "3/21" with a 14% bar and "0/6" phase counts look like failure even when she's exactly on schedule.
- **"Needs attention" doesn't say who is late.** Marcus is flagged partly because of David's own task. Emily is flagged before she has started. HR's bars have no "expected by today" reference.
- **Two contrast failures.** The "On track" badge #1f8a4c on #e4f5ea is 3.87:1. The brand link #2f6fed on #f6f7f9 is 4.24:1. Both fail AA for small text.

## 1. Key principles
1. **Connection and clarity matter more than completion counts.** Bauer's 4 C's [1][2] → show who meets you and what's next, not "3/21".
2. **Goal-gradient** [3] → measure progress within the current phase, not the whole plan.
3. **Endowed progress** [4] → count work already done for the hire, and say so.
4. **Implementation intentions** [5]: plans with a when and where get done more often (modest effect) → give the time, place and person, and offer "Add to calendar".
5. **Batch reminders** [6][7]. Google's day-before manager email is credited with ~25% faster ramp-up [8] → a weekly digest plus one well-timed nudge.
6. **Calm technology** [9][10] → quiet by default. Escalate only when someone must act.
7. **Alarm fatigue** [11] → red only for "someone must act now".
8. **Position and length beat colour for comparing values** [12]. Hue pops out [13]. Bullet graphs show actual vs target [14].
9. **Never colour alone** [15][16][17] → every status gets an icon shape and a word.

## 2. Proposals
### Emily (new hire)
**E1. Journey strip with a "today" marker.**
- Replaces: the 3-step stepper with "0/6" counts and the "3/21" bar in her greeting card.
- Layout: an inline SVG, 100% wide × 44px. Track line 2px #e3e7ec, divided into segments sized by days (7 / 7 / 21). Labels: "Before Day 1 · Week 1 · Weeks 2–4" (on phone: "Pre · Wk 1 · Wk 2–4").
- Today marker: a 2px #1b2330 line with a pill reading "Today · 4 days to go" (or "Day 2").
- Fill: the current segment is #2f6fed up to today. Past segments are solid #2f6fed with a ✓ in a circle.
- Above the track: progress for the current phase only, counting her own tasks, e.g. "Before Day 1: 3 of 5 of yours done".
- Evidence: [3][12], Workday timeline [18].

**E2. Calm "behind" treatment.**
- New-hire late tasks: no row tint. Show a clock icon and amber text #a14a00: "Was due Wed, Nov 4 · do this next".
- At most one banner: background #fff4dc, text #1b2330, "One thing slipped past its date. No problem, it's first on your list."
- Countdown wording on other rows: "Due in 2 days", "Due today" (#2559c9).
- Event tasks (`isEvent`: orientation, 1:1) are never overdue for the new hire. After the date they ask "Did this happen? [Yes] [Not yet]".
- Managers and HR still see these tasks as overdue.
- Evidence: [11][9][10], Todoist reschedule [19].

**E3. Day-1 countdown card with "Add to calendar".**
- Shown: from 7 days before start through Day 1. It replaces the "4 days until…" line.
- Big "4 days" in #2f6fed. Three facts with icons: time "Mon, Nov 9 · 9:30am", place "Front desk, 2nd floor", person "Sarah Kim meets you, then lunch with David" (initials avatars).
- An "Add to calendar (.ics)" button.
- Evidence: [1][5], BambooHR first-day schedule [20].

**E4. Quiet milestone moments.**
- A one-time card when she finishes a phase or reaches Day 1 / Week 1 / Day 30: a ✓ in a circle, #17703f on #e4f5ea, "Before Day 1: done. See you Monday!"
- A "seen" flag is stored. No confetti, streaks or points [3][21].

### David (manager)
**D1. Expected-vs-actual bullet graph.**
- Replaces: plain progress bars on hire cards and hire detail (and the HR table, S2).
- SVG 100% × 12px: track #e3e7ec, bar #2f6fed = done.
- Marker: a 2px × 18px tick #1b2330 at expected = tasks due on or before today.
- Gap between bar and marker hatched #d55e00.
- Caption: "11 done · 14 expected by today · 3 behind", or "On pace ✓".
- Evidence: [14][12].

**D2. Status that says whose action is needed.**
- Replaces "Needs attention" with separate chips:
  - "◆ You owe 1": manager-owned overdue, #b42318 on #fdecea
  - "⏱ 3 behind": the hire's own overdue, #a14a00 on #fff4dc
  - "▢ Waiting on IT": #0d7383
- Before the start date, the hire's own lateness shows only as "behind", never as "needs attention".
- Header: "2 people onboarding · You owe 1 · Marcus has 3 waiting".
- Evidence: Carbon [15], Linear health labels [22].

**D3. Monday digest card and day-before nudge.**
- Dismissible top card, once a week: "This week: 3 things for you · Emily starts Mon · Marcus is 3 behind".
- A 7-day week strip (Mon–Sun) with dots per day: ● his task, ◆ his overdue task. Tapping a day filters his to-dos.
- On the day before a hire starts: "Emily starts tomorrow. 4 things for Day 1…" plus "Add 1:1 to calendar".
- Evidence: [8][6][23][24].

### Sarah (HR)
**S1. Cohort timeline.**
- One row per hire. The x-axis runs from today −14 to +28 days, with a vertical Today line in #1b2330.
- Task marks at their due dates:
  - ● #2f6fed done
  - ○ #5f6b7a outline upcoming
  - ◆ #d55e00 overdue
  - ▢ #0d7383 waiting on IT
- A faint band shows each hire's 4-week window. Tap or hover shows the task name.
- On phone, scroll horizontally with names pinned. Cap at 15 rows; the department filter applies.
- Evidence: [13][25].

**S2. Smarter table.**
- The bullet graph in the Progress column.
- A "Waiting on" column (Hire / Manager / IT / HR counts).
- Default sort: most behind first.
- The KPI tile is clickable as a filter.

### Shared
**X1. Status palette with shapes.** One `statusChip(kind)` helper (palette below).

**X2. Reminder rules.**
- At most 1 banner per screen, in priority order: Day-1 logistics (3 days before start to Day 1) > own overdue > due within 48h > milestone.
- "Remind me tomorrow" (snoozeUntil = demo date + 1) and "Got it" (hidden for that demo date), stored in localStorage.
- Managers get the digest instead of banners.

**X3. .ics generator.** A VCALENDAR/VEVENT string downloaded via Blob and `<a download>`.

## 3. Palette (contrast checked)
| Role | Text / icon | Background | Contrast | Shape + word |
|---|---|---|---|---|
| Brand (buttons, bars) | #2f6fed | white | 4.55 | — |
| Brand text on grey/tint | #2559c9 | #f6f7f9 / #e8f0fe | 5.85 / 5.47 | link |
| Done | #17703f | #e4f5ea | 5.41 | ✓ circle, "Done" |
| Behind (gentle) | #a14a00 | #fff4dc | 5.50 | ⏱, "Do next" / "3 behind" |
| Action needed (mgr/HR only) | #b42318 | #fdecea | 5.75 | ◆ / ⚠, "You owe 1" |
| Not started / upcoming | #5f6b7a | #eef0f3 | 4.75 | ○, "Starts Nov 15" |
| Waiting on IT | #0d7383 | #e6f6f8 | 4.98 | ▢, "Waiting on IT" |
| Manager chip | #7a3fc1 | #f3e8ff | 5.38 | — |
| Chart bar / gap hatch | #2f6fed / #d55e00 | track #e3e7ec | 3.66 / 3.11 | hatch |
| Target marker | #1b2330 | #e3e7ec | 12.7 | tick |

Blue vs vermilion is an Okabe–Ito-safe pair [17]. Don't use #98a2b3 for markers (2.58:1).

## 4. Top 5 to build first
1. D2 + X1: who owes what, plus the palette
2. E2: calm treatment for late tasks
3. D1: bullet graph (reused in S2)
4. E3 + X3: Day-1 card with .ics
5. S1: cohort timeline

## 5. What not to do
- Streaks, points or leaderboards [27]
- Red for "not done yet" [11]
- Nagging on every view [6][7]
- Whole-plan percentages for new hires [3]
- Ring or gauge charts [12][14][21]
- Colour-only status [15][16]
- Overdue events

## 6. Sources
1. Bauer / SHRM Foundation, *Onboarding New Employees: Maximizing Success* (2010). https://studentaffairsdev.uga.edu/wp-content/uploads/2021/08/Onboarding-New-Employees.pdf
2. Bauer et al., "Newcomer adjustment during organizational socialization", JAP (2007). https://pubmed.ncbi.nlm.nih.gov/17484552/
3. Kivetz, Urminsky & Zheng, "The Goal-Gradient Hypothesis Resurrected", JMR (2006). https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf
4. Nunes & Drèze, "The Endowed Progress Effect", JCR (2006). https://econpapers.repec.org/RePEc:oup:jconrs:v:32:y:2006:i:4:p:504-512
5. Gollwitzer & Sheeran, implementation intentions meta-analysis (2006). https://www.socmot.uni-konstanz.de/publications/implementation-intentions-and-goal-achievement-meta-analysis-effects-and-processes
6. Fitz, Kushlev et al., "Batching smartphone notifications", CHB (2019). https://www.scribd.com/document/734197310/10-1016-j-chb-2019-07-016
7. Kushlev, Proulx & Dunn, "Silence Your Phones", CHI 2016. https://www.interruptions.net/literature/Kushlev-CHI16.pdf
8. Bock, *Work Rules!*: Google manager email (secondary). https://risepeople.com/blog/new-employee-productivity/
9. Weiser & Brown, "Designing Calm Technology" (1995). https://en.wikipedia.org/wiki/Calm_technology
10. Amber Case, Principles of Calm Technology. https://www.caseorganic.com/post/principles-of-calm-technology
11. Joint Commission, alarm safety alert (secondary). https://psqh.com/news/joint-commission-alert-medical-device-alarm-safety-in-hospitals
12. Cleveland & McGill, graphical perception (summary). https://flowingdata.com/2010/03/20/graphical-perception-learn-the-fundamentals-first
13. Healey & Enns, preattentive processing. https://www.csc2.ncsu.edu/faculty/healey/download/tvcg.12a.pdf
14. Stephen Few, Bullet Graph Design Specification. https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf
15. IBM Carbon, Status indicator pattern. https://www.carbondesignsystem.com/patterns/status-indicator-pattern
16. GitHub Primer, Color. https://primer.style/foundations/color
17. Okabe & Ito palette. https://siegal.bio.nyu.edu/color-palette/
18. Workday, Onboarding Plans. https://www.workday.com/en-us/products/talent-management/onboarding-plans.html
19. Todoist Help, Upcoming view. https://todoist.com/help/articles/360000031019
20. BambooHR, Enhanced New Hire Packets. https://www.bamboohr.com/product-updates/create-a-more-welcoming-first-day-with-enhanced-new-hire-packets
21. Apple HIG, Activity rings. https://developer.apple.com/design/human-interface-guidelines/activity-rings
22. Linear Docs, project updates. https://linear.app/docs/initiative-and-project-updates
23. Enboarder, tips for hiring managers. https://enboarder.com/blog/onboarding-tips-for-hiring-managers/
24. Microsoft WorkLab, onboarding buddy. https://workplaceinsights.microsoft.com/?p=853
25. Tufte, Sparkline theory and practice. https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/
26. ColorBrewer. https://en.wikipedia.org/wiki/ColorBrewer
27. "Reframing streaks on Duolingo", UX Collective. https://uxdesign.cc/3-reframing-streaks-on-duolingo-5-ideas-for-a-more-healthy-and-flexible-approach-to-language-8fd89545771e

How solid the sources are: Microsoft's buddy data is self-reported. Google's 25% figure is secondary. A 2025 meta-analysis found no Zeigarnik memory advantage, so the brief doesn't rely on "open loops" to motivate people.
