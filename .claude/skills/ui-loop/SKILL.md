---
name: ui-loop
description: Run the critique → improve → test loop on the onboarding app's UI, folding in the user's feedback. Use when the user says /ui-loop, "improve the UI", "critique the UI", "run another round", or gives UI feedback to apply.
---

# UI improvement loop

Two agents work in rounds: **ui-critic** reviews and tests the UI (never edits code), **ui-builder** implements changes. You (the orchestrator) choose what goes into each round, keep the user's feedback first, verify, and log everything.

## Arguments (all optional, any order, plain words are fine)
- A number or "N rounds" → run N rounds (default **1**). Stop early if a round finds no P1/P2 and the inbox is empty.
- `critique` / `critique only` → run the critic, show findings, change nothing.
- `feedback only` → implement the user's feedback, skip the critic's own review (still verify).
- `focus <area>` → e.g. `focus phone`, `focus manager`, `focus hr add`. Pass to the critic as the review focus.
- Any other text → treat as **user feedback** for this round (same as an Inbox item).

## Where feedback comes from (check all, every round)
1. Text passed to the command.
2. `ui-review/feedback.md` → `## Inbox`. The user can edit this at any time, **including while a loop is running**. Re-read it at the start of every round.
3. Messages the user sends in this conversation while the loop runs. Treat each as an Inbox item. If it says stop, pause, or change direction, do that before anything else.
4. `ui-review/feedback.md` → `## Standing preferences`. Rules that apply every round. If the user says "always…", "never…", or "from now on…", add it there.

Inbox tags (optional): `[must]` do it this round · `[idea]` do it if it fits · `[no] <thing>` veto, don't do it and tell the critic to stop raising it · `[question]` answer it in the report and change nothing.

## One round
Let N = next round number (count `## Round` headings in `ui-review/log.md`, plus 1). Folder = `ui-review/shots/round-N`.

1. **Collect feedback.** Read the inbox and standing preferences. Give each inbox item an ID `U1, U2…`. If an item is truly unclear *and* guessing wrong would waste the round, ask the user one short question (AskUserQuestion). Otherwise pick a sensible reading and note it.
2. **Critique** (skip if `feedback only`). Spawn **ui-critic**: round N, output folder `<folder>/before`, any focus area, and the U-items so it can assess them too. It returns findings as text (`F1, F2…`); **you** save them to `ui-review/findings.md` (subagents can't write report files).
2b. **Research** (only when a U-item asks for research, "best practices", "industry examples", or a new design direction that's bigger than a fix). Spawn a general-purpose agent to read the app and screenshots, research the topic on the web, and return a design brief: principles with cited sources, concrete proposals per user (what it replaces, sketch, colours, wording, effort), and a top-5. Save the brief to `ui-review/research-round-N.md`. Turn the chosen proposals into U-item sub-items (U1a, U1b…) for the builder, including the sketch details. If the critic's review would mostly overlap with the redesign, you may skip step 2 for this round. Say so in the log.
3. **Triage**. Build the change list for this round:
   - All U-items (except `[question]` / `[no]`). User feedback always goes in.
   - Then critic findings: all P1s, then P2s, up to **6 F-items** in total, preferring small/medium effort. Drop any F-item that conflicts with a U-item, a standing preference, or a `[no]` veto.
   - If the user's feedback conflicts with an earlier user decision, the newest feedback wins. Mention it.
   - If `critique only`: show the findings table and stop here.
4. **Build.** Spawn **ui-builder** with the numbered change list (full text of each U-item and F-item, including the critic's evidence and suggested fix), the standing preferences, and output folder `<folder>/after`.
5. **Verify.** Spawn **ui-critic** in **verify** mode with the change list, and folder `<folder>/verify`. Save its reply to `ui-review/verify.md`.
   - Any **REGRESSION** or **NOT FIXED** on a U-item → send those items back to **ui-builder** once with the critic's evidence. Verify those items again.
   - Still failing after that → revert just that change if you can do it cleanly, otherwise leave it and flag it clearly. Never loop more than twice on one item.
6. **Log.** Append to `ui-review/log.md`:
   ```
   ## Round N: <date>
   Feedback: U1 <text> → DONE (<what changed>) …
   Critic: F1 [P1] <title> → DONE | SKIPPED (<why>) | DEFERRED …
   Verify: <n fixed>, <n partly>, <regressions>
   Harness: <logic tests>, <automatic problems count>
   Screenshots: ui-review/shots/round-N/after
   Deferred for later: <F-items not taken this round>
   ```
   In `ui-review/feedback.md`, move handled Inbox items to `## Done` with `(round N)` after each. Leave unhandled ones in the Inbox.
7. **Report to the user** (short): what changed this round as plain bullets, anything skipped and why, the readings you chose for ambiguous feedback, and the top deferred findings. Tell them they can add feedback to `ui-review/feedback.md` or just reply. Don't commit unless the user asked.

Between rounds of a multi-round run, re-read the inbox (step 1). New feedback goes into the next round.

## Notes
- Harness: `bash ui-tests/snap.sh [--out folder] [--only text]`. Report is `<folder>/report.md`, screenshots are `<folder>/*.png`.
- Agents run fresh each time. Give them everything they need in the prompt (round number, folders, items, preferences). Don't refer to "the above".
- Keep rounds small enough to review: the user should be able to understand a round's changes in a minute.
- If the harness itself breaks (can't reach a screen after an intended UI change), have ui-builder update `ui-tests/snap.py` rather than dropping the check.
