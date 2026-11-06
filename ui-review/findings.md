# UI findings: round 1
Screens reviewed: ui-review/shots/round-1/before (12 screens × desktop + phone), plus probes in ui-review/tmp/
Harness: logic tests PASS (28). No JS errors, horizontal scroll or unlabeled inputs. Small tap targets on every phone screen.

## F1 [P1] Phone header crushes the "Viewing as" picker after the demo date is changed
- Screen: newhire-emily-day2 phone
- Evidence: `#viewer-select` shrinks to 65px because "Back to real date" takes a third flex slot in `.controls`.
- Fix: phone `.controls{display:grid;grid-template-columns:1fr 1fr}`, `.controls .link{grid-column:1/-1;justify-self:end}`.
- Effort: S

## F2 [P1] Plan templates on phone hide the WHO and WHEN columns
- Screen: hr-templates phone
- Evidence: the phone rule `.table td:nth-child(2),(3){display:none}` was meant for the hires table but also hits the templates table.
- Fix: add `table-hires` to the HR hires table and scope the phone `.table` rules to it.
- Effort: S

## F3 [P1] The new hire sees other people's lateness in red, in copy written for managers
- Screen: newhire-emily-day2, newhire-emily-fullplan
- Evidence: "Being handled for you" rows show red "Overdue" for David's and IT's tasks (9 red blocks on the first screen). Manager-voice copy like "Hold first 1:1 with your new hire". The list runs to 5–7 rows.
- Fix: in `taskRow()`, for a new-hire viewer on tasks owned by someone else, use neutral styling and an "Expected <date>" label. Cap the list at 3 with "+N more". Add optional `hireTitle`/`hireDesc` in data.js for non-new-hire tasks.
- Effort: M

## F4 [P1] Overdue rows are misaligned in compact lists, and the pink fade looks like a glitch
- Screen: manager-david-team, newhire-emily-day2, manager-david-hire-detail, hr-dashboard
- Evidence: `.tasks-compact .task{padding:8px 0}` overrides the overdue padding while the negative margin stays (checkbox at x=191 vs 201). On phone, the text hits the card edge. The gradient cuts off at x≈710.
- Fix: `.tasks .task.is-overdue`, `background:var(--bad-soft); box-shadow:inset 3px 0 0 var(--bad)`.
- Effort: S

## F5 [P2] Add-hire preview on phone: checkboxes get orphaned and the sticky bar is 105px tall
- Fix: give preview labels a grid layout (18px 1fr) with the title, chips and date in a wrapping span. Keep the sticky buttons on one row on phone and rename the button to "Back".
- Effort: S

## F6 [P2] HR can assign a manager from another department with no warning
- Fix: warn in validateHire when manager.department !== department. Optionally list the department's managers first.
- Effort: S

## F7 [P2] Hire cards squeeze the name; the hero badge stretches into a full-width banner on phone
- Fix: move the badge off `.hc-top`, use grid minmax(300px), `.hero-progress .badge{align-self:flex-start}`, "4 to-dos for you".
- Effort: S

## F8 [P2] Manager hire detail is a 2,500px wall (all phases open, overdue items listed twice)
- Fix: open only the current phase, fold done tasks behind "N done ▸", and optionally leave out tasks already shown in the Overdue box.
- Effort: M

## F9 [P2] Phone tap targets are too small
- Evidence: checkboxes 22px, preview checkboxes 18px, link buttons and summaries about 19–22px tall.
- Fix: phone `.check input` 28px inside a 44px hit area, padding on `.back/.link/summary`, preview inputs 24px.
- Effort: S

## F10 [P2] HR tabs are cut off on phone and the list rows are ragged
- Fix: shorter tab labels and padding, a fixed right column, and "dept · manager" as a muted line instead of hiding it.
- Effort: S

## F11 [P2] Keyboard focus is nearly invisible on table rows and hire cards
- Fix: `:focus-visible` outlines on rows and cards, plus a global `:focus-visible`.
- Effort: S

## F12 [P3] To-do lists repeat "For <name>" on every task and show a redundant "You" chip
- Fix: group by hire in `todoList()` with `hideOwner:true`, and drop the owner chip when doneBy is you.
- Effort: S
