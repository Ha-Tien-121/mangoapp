# UI loop log

Each round of `/ui-loop` adds an entry here: feedback handled, critic findings taken or deferred, verify results.

## Round 1: 2026-11-05
Feedback: none in the inbox.
Critic: 12 findings (P1: 4, P2: 7, P3: 1). Full list in ui-review/findings.md (round 1).
- F1 [P1] Phone header crushed the "Viewing as" picker after a date change → DONE (2-column grid on phone)
- F2 [P1] Templates on phone hid the Who/When columns → DONE (phone table rules scoped to `.table-hires`)
- F3 [P1] New hire saw other people's overdue tasks in red, in manager wording → DONE (new-hire wording via hireTitle/hireDesc, neutral "Expected …" labels, list capped at 3 + "more" link)
- F4 [P1] Overdue rows misaligned, gradient looked glitchy → DONE (solid soft red + left bar; alignment fixed by the orchestrator after verify said PARTLY)
- F8 [P2] Manager hire detail was a 2,500px wall → DONE (only the current phase open, done tasks folded, no duplicates; page 63% shorter on phone; folds remember their state)
- F9 [P2] Phone tap targets too small → DONE (44px hit areas; harness now measures the label hit area)
Verify: 5 fixed, 1 partly → fixed. No regressions.
Harness: logic tests PASS (29), 0 automatic problems.
Workflow fix: subagents can't write report files, so the orchestrator saves findings.md and verify.md.
Screenshots: ui-review/shots/round-1/before, after, verify, final
Deferred for later: F5 add-hire preview rows wrap raggedly on phone (P2), F6 no warning for a manager from another department (P2), F7 hire cards squeeze names (P2), F10 HR tabs cut off on phone (P2), F11 weak keyboard focus (P2), F12 repeated "For <name>" in to-dos (P3), templates "When" column wraps (P3)

## Round 2: 2026-11-05
Steps: research (ui-review/research-round-2.md, 27 sources) → builder passes A (new hire + shared), B (manager + HR), C (templates + cleanup) → critic verify → fix pass. The critic's own review was skipped because the redesign replaced most screens; deferred round-1 items were folded in where they overlapped.
Feedback:
- U1 Innovative, user-friendly information and reminders (research-backed) → DONE. New hire: journey strip with today marker, calm "do this next" for past-date tasks, Day-1 card with Add to calendar (.ics), one snoozable banner, quiet milestones, "Did this happen?" for past meetings. Manager: progress bar with an "expected by today" tick, one status chip, rolling 7-day strip with tap-to-filter, short weekly digest, day-before nudge with a 1:1 .ics. HR: "Where everyone is" timeline, simpler table, KPI filters. New colour-blind-safe status palette with icon + word; contrast fixes.
- U2 "Remind me tomorrow" should clearly be a button → DONE (bordered button with clock icon; hidden when the reminder is about today).
- U3 Edit plan templates → DONE (HR-only; add/edit/remove, timing picker, meeting flag, new-hire wording, duplicate warning with "Save anyway", Undo on remove, Reset to original; edits apply to new plans only).
- U4 Charts too busy → DONE (one question per chart, ≤2 colours, no legends/hatching/per-task marks; timeline shows time only, bars show own tasks only; one-line key for the tick).
- U5 No negative or punishing language → DONE ("1 for you", "3 to catch up", "With IT", "was due Nov 4"; red removed as a status colour; scan for owe/behind/overdue/late/missed/fail/attention = 0 hits).
- Branding renamed BrightPath → MangoApps (between rounds).
Verify: all 5 feedback items landed. The fix pass resolved 11 issues (David's counts now agree, the charts each answer one question, duplicate template warning shown, keyboard focus ring, HR chip contrast, Day 0 validation, Undo, chip/bar agreement, HR tabs fit on phone).
Harness: logic tests PASS (59), 25 screens × 2 viewports, 0 automatic problems.
Screenshots: ui-review/shots/round-2/after-a, after-b, after-c, verify, final
Deferred for later: F5 add-hire preview rows wrap on phone, F6 warn when the manager is from another department, F7 long names on hire cards (from round 1); template drag-to-reorder; "update existing plans" when a template changes.
