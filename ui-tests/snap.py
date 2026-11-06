"""
UI harness for the onboarding app.

Serves the app, walks through every screen as each role, and for each one at
desktop and phone size:
  - saves a full-page screenshot
  - records console errors / page crashes
  - flags horizontal scrolling, small tap targets (phone), unlabeled form controls
Also runs tests.html (logic tests).

Usage (from the repo root):
  python ui-tests/snap.py                 # all screens
  python ui-tests/snap.py --only hr       # screens whose name contains "hr"
  python ui-tests/snap.py --out ui-review/shots/round-3

Writes <out>/report.md (read this first) and <out>/report.json.
Exit code 1 if logic tests fail or any page throws an error.
"""

import argparse
import functools
import http.server
import json
import os
import socket
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
VIEWPORTS = {"desktop": (1280, 900), "phone": (375, 812)}
FIXED_DATE = "2026-11-05"  # demo date, so screenshots are stable between rounds


# ---------- screens: each is (name, list of steps) ----------
def viewer(page, pid):
    page.select_option("#viewer-select", pid)


def click(page, sel):
    page.locator(sel).first.click()


def fill(page, name, value):
    page.fill(f"#hire-form [name={name}]", value)


def set_date(page, iso):
    page.fill("#demo-date", iso)
    page.dispatch_event("#demo-date", "change")


def nh_tab(page, tab):
    page.locator(f"[data-action=nh-tab][data-tab={tab}]").first.click()


def open_form(page, form_id):
    click(page, "[data-action=nh-forms]")
    click(page, f"[data-action=nh-form][data-form={form_id}]")


def ff(page, form_id, name, value):
    page.fill(f"#ff-{form_id}-{name}", value)


def submit_form(page):
    click(page, "#nh-form button[type=submit]")


def submit_deposit(page):
    # Demo values only (a published test routing number).
    open_form(page, "deposit")
    ff(page, "deposit", "bank", "Demo Credit Union")
    ff(page, "deposit", "routing", "011000015")
    ff(page, "deposit", "account", "000123456789")
    ff(page, "deposit", "accountConfirm", "000123456789")
    submit_form(page)


def narrow(page, width=320):
    page.set_viewport_size({"width": width, "height": 720})


def mgr_tab(page, tab):
    page.locator(f"[data-action=mgr-tab][data-tab={tab}]").first.click()


def pick_buddy(page, hire, member):
    # From the hire detail page: "Choose buddy" on the "Assign an onboarding buddy" task, then a teammate.
    click(page, f".hire-card[data-hire={hire}] .hc-open")
    click(page, f"[data-action=buddy-pick][data-hire={hire}]")
    click(page, f"#bp-{member}")


def open_note(page, note_id):
    mgr_tab(page, "oneonones")
    click(page, f"[data-action=oo-open][data-note={note_id}]")


def nudges(page):
    mgr_tab(page, "notifications")
    click(page, "#nc-slack")


def hr_tab(page, tab):
    page.locator(f"[data-action=hr-tab][data-tab={tab}]").first.click()


def more_sub(page, sub):
    hr_tab(page, "more")
    click(page, f"[data-action=hr-more][data-sub={sub}]")


# Valid rows, one with a problem in almost every column, and two possible duplicates (Emily is already
# onboarding; Jordan Lee is in the paste twice). Jordan starts the same Monday as Emily (overlapping markers).
BULK_CSV = (
    "name,title,department,manager,start date,work type,job level,role\n"
    "Jordan Lee,Backend Engineer,Engineering,David,2026-11-09,Hybrid,,Backend Engineer\n"
    "\"Rivera, Sam\",Account Executive,Sales,Priya Shah,11/30/2026,Onsite,,Account Executive\n"
    "Pat Doe,Analyst,Finance,Nobody,2026-13-01,,,\n"
    "Emily Chen,Software Engineer,Engineering,David Okafor,2026-11-09,,,\n"
    "Jordan Lee,Data Engineer,Engineering,David,2026-11-30,,,\n"
)


def bulk_paste(page):
    hr_tab(page, "add")
    click(page, "[data-action=add-mode][data-mode=bulk]")
    page.fill("#bulk-text", BULK_CSV)
    click(page, "[data-action=bulk-check]")


def bulk_import(page):
    bulk_paste(page)
    click(page, "[data-action=bulk-import]")


def set_field_date(page, sel, iso):
    page.fill(sel, iso)
    page.dispatch_event(sel, "change")


# Round 4 fix F4: a Saturday start in a paste (still importable, with a "Check" note) next to a Monday start.
BULK_WEEKEND_CSV = (
    "name,title,department,manager,start date\n"
    "Ana Diaz,Engineer,Engineering,David Okafor,2026-11-14\n"
    "Bo Li,Engineer,Engineering,David Okafor,2026-11-16\n"
)


def edit_emily_to_sales(page):
    click(page, "[data-action=edit-hire][data-hire=emily]")
    page.select_option("#ef-department", "Sales")


SCREENS = {
    "newhire-emily-focus": lambda p: viewer(p, "emily"),
    "newhire-emily-fullplan": lambda p: (viewer(p, "emily"), click(p, "[data-action=nh-tab][data-tab=plan]")),
    "newhire-emily-day2": lambda p: (viewer(p, "emily"), p.fill("#demo-date", "2026-11-10"), p.dispatch_event("#demo-date", "change")),
    "newhire-emily-day-before": lambda p: (viewer(p, "emily"), set_date(p, "2026-11-08")),
    "newhire-emily-day1": lambda p: (viewer(p, "emily"), set_date(p, "2026-11-09")),
    "newhire-emily-event-notyet": lambda p: (
        viewer(p, "emily"), set_date(p, "2026-11-10"), click(p, "[data-action=event-notyet]")),
    # Direct deposit is a form now (round 4): submitting it completes the task.
    "newhire-emily-milestone": lambda p: (
        viewer(p, "emily"), submit_deposit(p), click(p, "[data-action=nh-form-close]"),
        click(p, "input[aria-label=\"Mark 'Read the welcome guide and Day 1 logistics' done\"]")),
    "newhire-tom-nothing-done": lambda p: viewer(p, "tom"),
    "manager-david-team": lambda p: viewer(p, "david"),
    "manager-david-hire-detail": lambda p: (viewer(p, "david"), click(p, ".hire-card[data-hire=marcus] .hc-open")),
    "manager-david-add-task-error": lambda p: (
        viewer(p, "david"), click(p, ".hire-card[data-hire=marcus] .hc-open"),
        click(p, "[data-action=new-task]"), click(p, "#task-form button[type=submit]")),
    "manager-david-day-before-nudge": lambda p: (viewer(p, "david"), set_date(p, "2026-11-08")),
    "manager-david-week-day": lambda p: (
        viewer(p, "david"), click(p, "[data-action=week-day][data-day='2026-11-06']")),
    "manager-omar-empty": lambda p: viewer(p, "omar"),
    "hr-dashboard": lambda p: viewer(p, "sarah"),
    "hr-add-hire-blank-errors": lambda p: (
        viewer(p, "sarah"), click(p, "[data-action=hr-tab][data-tab=add]"), click(p, "#hire-form button[type=submit]")),
    "hr-add-hire-preview": lambda p: (
        viewer(p, "sarah"), click(p, "[data-action=hr-tab][data-tab=add]"),
        fill(p, "name", "Jordan Lee"), fill(p, "title", "Support Specialist"),
        p.select_option("#hire-form [name=department]", "Customer Support"),
        click(p, "#hire-form button[type=submit]")),
    "hr-templates": lambda p: (viewer(p, "sarah"), click(p, "[data-action=hr-tab][data-tab=templates]")),
    # Editing an IT task, so the optional "How the new hire sees it" fields show too.
    "hr-templates-edit": lambda p: (
        viewer(p, "sarah"), click(p, "[data-action=hr-tab][data-tab=templates]"),
        click(p, "[data-action=tpl-edit][data-key=c-laptop]")),
    "hr-templates-add-error": lambda p: (
        viewer(p, "sarah"), click(p, "[data-action=hr-tab][data-tab=templates]"),
        click(p, "[data-action=tpl-add]"), click(p, "#tpl-form button[type=submit]")),
    # A department template after one task is removed: "Edited" marker + "Reset to original".
    "hr-templates-edited": lambda p: (
        viewer(p, "sarah"), click(p, "[data-action=hr-tab][data-tab=templates]"),
        click(p, "[data-action=tpl-pick][data-tpl=Sales]"), click(p, "[data-action=tpl-remove][data-key=s-shadow]")),
    # Duplicate task name: the first Save shows the warning under the title and asks "Save anyway".
    "hr-templates-dup-warning": lambda p: (
        viewer(p, "sarah"), click(p, "[data-action=hr-tab][data-tab=templates]"),
        click(p, "[data-action=tpl-add]"), p.fill("#tpl-title", "Set up direct deposit"),
        click(p, "#tpl-form button[type=submit]")),
    # Banner with the "Remind me tomorrow" + "Got it" pair (the Day-1 reminder, 3 days out).
    "newhire-emily-banner-day1": lambda p: (viewer(p, "emily"), set_date(p, "2026-11-06")),
    # ---- Round 3: smarter templates ----
    # Tom is remote: Day-1 card says "Join from home" with the video-call link, no address.
    "newhire-remote-day-before": lambda p: (viewer(p, "tom"), set_date(p, "2026-11-15")),
    # Marcus's focus list: read / watch / acknowledge icons, "Open" links, "I've read and agree".
    "newhire-marcus-focus-types": lambda p: viewer(p, "marcus"),
    # Add-hire preview for a remote people manager: "Because: …" reasons and the skipped fold (opened).
    "hr-add-hire-preview-remote-manager": lambda p: (
        viewer(p, "sarah"), click(p, "[data-action=hr-tab][data-tab=add]"),
        fill(p, "name", "Robin Diaz"), fill(p, "title", "Engineering Manager"),
        p.select_option("#hire-form [name=department]", "Engineering"),
        p.select_option("#hire-form [name=workType]", "Remote"),
        p.select_option("#hire-form [name=jobLevel]", "People manager"),
        click(p, "#hire-form button[type=submit]"), click(p, ".pv-skipped > summary")),
    # Template editor on a conditional task: Type, Link and "Who gets this task".
    "hr-templates-edit-rules": lambda p: (
        viewer(p, "sarah"), click(p, "[data-action=hr-tab][data-tab=templates]"),
        click(p, "[data-action=tpl-edit][data-key=c-home-desk]"), click(p, "#tpl-jl-1")),
    # Remote hire's detail page as their manager: work type and job level in the header.
    "manager-lena-hire-detail-remote": lambda p: (viewer(p, "lena"), click(p, ".hire-card[data-hire=tom] .hc-open")),
    # ---- Round 4, pass A: new hire Team, Schedule, Learning, Forms ----
    "newhire-emily-team": lambda p: (viewer(p, "emily"), nh_tab(p, "team")),
    # Marcus's manager hasn't picked a buddy yet: "Your buddy will be introduced soon".
    "newhire-marcus-team-no-buddy": lambda p: (viewer(p, "marcus"), nh_tab(p, "team")),
    "newhire-emily-schedule-before": lambda p: (viewer(p, "emily"), nh_tab(p, "schedule")),
    # Wednesday of week 1: today (Day 3) is picked and marked "Today".
    "newhire-emily-schedule-week1": lambda p: (viewer(p, "emily"), set_date(p, "2026-11-11"), nh_tab(p, "schedule")),
    "newhire-emily-schedule-after": lambda p: (viewer(p, "emily"), set_date(p, "2026-11-16"), nh_tab(p, "schedule")),
    # Remote hire's week: video calls, and the remote meet-and-greet task merged in at a default time (Day 2).
    "newhire-tom-schedule-remote-day2": lambda p: (
        viewer(p, "tom"), nh_tab(p, "schedule"), click(p, "[data-action=sched-day][data-day='1']")),
    "newhire-emily-learning": lambda p: (viewer(p, "emily"), nh_tab(p, "learning")),
    # After "Mark as done" on the up-next item: progress line and "Up next" move on.
    "newhire-emily-learning-progress": lambda p: (
        viewer(p, "emily"), nh_tab(p, "learning"), click(p, "[data-action=learn-done][data-item=l-values]")),
    "newhire-emily-forms-list": lambda p: (viewer(p, "emily"), click(p, "[data-action=nh-forms]")),
    "newhire-emily-form-personal-errors": lambda p: (
        viewer(p, "emily"), open_form(p, "personal"), ff(p, "personal", "phone", "555-12"), ff(p, "personal", "zip", "123"), submit_form(p)),
    "newhire-emily-form-emergency-errors": lambda p: (viewer(p, "emily"), open_form(p, "emergency"), submit_form(p)),
    "newhire-tom-form-w4-errors": lambda p: (viewer(p, "tom"), open_form(p, "w4"), ff(p, "w4", "extra", "25.555"), submit_form(p)),
    "newhire-emily-form-deposit-errors": lambda p: (
        viewer(p, "emily"), open_form(p, "deposit"), ff(p, "deposit", "bank", "Demo Credit Union"),
        ff(p, "deposit", "routing", "0110000"), ff(p, "deposit", "account", "12"), submit_form(p)),
    # E-signature: the typed name must match (any capitals) and the box must be ticked.
    "newhire-tom-form-offer-errors": lambda p: (viewer(p, "tom"), open_form(p, "offer"), ff(p, "offer", "signature", "Tom R"), submit_form(p)),
    # Submit direct deposit, then View it: numbers masked (••••6789), the linked task is done.
    "newhire-emily-form-deposit-submitted": lambda p: (
        viewer(p, "emily"), submit_deposit(p), click(p, "[data-action=nh-form][data-form=deposit]")),
    "newhire-emily-form-offer-view": lambda p: (viewer(p, "emily"), open_form(p, "offer")),
    # Today with the Forms card and the next learning item in the third focus slot.
    "newhire-emily-today-forms-card": lambda p: (viewer(p, "emily"), submit_deposit(p), click(p, "[data-action=nh-form-close]")),
    # New tabs at 320px: the tab bar may scroll inside itself, never the page.
    "newhire-emily-tabs-320": lambda p: (narrow(p), viewer(p, "emily")),
    "newhire-emily-schedule-320": lambda p: (narrow(p), viewer(p, "emily"), nh_tab(p, "schedule")),
    "newhire-emily-learning-320": lambda p: (narrow(p), viewer(p, "emily"), nh_tab(p, "learning")),
    "newhire-emily-form-deposit-320": lambda p: (narrow(p), viewer(p, "emily"), open_form(p, "deposit"), submit_form(p)),
    # HR sees which forms are in, with bank numbers masked.
    "hr-hire-detail-forms": lambda p: (
        viewer(p, "sarah"), click(p, "tr[data-action=open-hire][data-hire=marcus]"), click(p, ".hf-view[data-fold$=deposit] > summary")),
    # ---- Round 4, pass B: manager (David) ----
    # B1: Emily starts Monday: "Emily: 2 of 7 ready · starts Mon", owners, Mark done / Book 1:1 / Send a reminder.
    "manager-david-readiness": lambda p: (viewer(p, "david"), mgr_tab(p, "readiness")),
    "manager-omar-readiness-empty": lambda p: (viewer(p, "omar"), mgr_tab(p, "readiness")),
    # Ticking his own items from here: welcome note done, first 1:1 booked (4 of 7).
    "manager-david-readiness-ticked": lambda p: (
        viewer(p, "david"), mgr_tab(p, "readiness"),
        click(p, "[data-action=ready-tick][data-hire=emily]"), click(p, "[data-action=ready-book][data-hire=emily]")),
    # Extra a: the buddy picker (Marcus has no buddy yet), with the suggested teammate marked and Kenji picked.
    "manager-david-buddy-picker": lambda p: (viewer(p, "david"), pick_buddy(p, "marcus", "kenji")),
    # After saving, Marcus's Team tab shows Kenji as his buddy.
    "newhire-marcus-team-buddy-picked": lambda p: (
        viewer(p, "david"), pick_buddy(p, "marcus", "kenji"), click(p, "#buddy-form button[type=submit]"),
        viewer(p, "marcus"), nh_tab(p, "team")),
    # B2: 1:1s list for Marcus (planned 30-day check-in, two past ones).
    "manager-david-1on1s": lambda p: (viewer(p, "david"), mgr_tab(p, "oneonones")),
    # An open note: last point ticked, a new follow-up, and the older follow-up turned into a plan task.
    "manager-david-1on1-note": lambda p: (
        viewer(p, "david"), open_note(p, "oo-marcus-1"), click(p, "#oo-pt-4"),
        p.fill("#fu-form [name=text]", "Pair with Kenji on the payments service"), click(p, "#fu-form button[type=submit]"),
        click(p, "[data-action=fu-plan][data-fu=oo-marcus-1-fu1]"), click(p, "#fu-task-form button[type=submit]")),
    # Starting a new note from a template (Emily, "First 1:1 (Day 1)").
    "manager-david-1on1-start": lambda p: (
        viewer(p, "david"), mgr_tab(p, "oneonones"), click(p, "[data-action=mgr-pick][data-hire=emily]"),
        click(p, "#oo-form button[type=submit]")),
    # B3: Emily's goals after adding two suggested goals with one click each.
    "manager-david-goals-suggested": lambda p: (
        viewer(p, "david"), mgr_tab(p, "goals"), click(p, "[data-action=mgr-pick][data-hire=emily]"),
        click(p, "[data-action=goal-suggest][data-goal=g-e-pr]"), click(p, "[data-action=goal-suggest][data-goal=g-c-meet]")),
    "manager-david-goals-marcus": lambda p: (viewer(p, "david"), mgr_tab(p, "goals")),
    # B4: preferences (Email + Slack), the digest preview in email and chat form.
    "manager-david-nudges": lambda p: (viewer(p, "david"), nudges(p)),
    "manager-david-nudges-day-before": lambda p: (viewer(p, "david"), nudges(p), click(p, "[data-action=pv-kind][data-kind=nudge]")),
    # "Send test": one outbox entry per channel, each marked "Demo — not actually sent".
    "manager-david-nudges-outbox": lambda p: (
        viewer(p, "david"), nudges(p), click(p, "[data-action=send-test]"), click(p, ".ob-body > summary")),
    # "Send a reminder" from readiness: a polite, editable message to IT (demo outbox only).
    "manager-david-remind-dialog": lambda p: (
        viewer(p, "david"), mgr_tab(p, "readiness"), click(p, "[data-action=remind-ready][data-hire=emily][data-item=accounts]")),
    "manager-david-remind-saved": lambda p: (
        viewer(p, "david"), mgr_tab(p, "readiness"), click(p, "[data-action=remind-ready][data-hire=emily][data-item=forms]"),
        click(p, "#remind-form button[type=submit]"), mgr_tab(p, "notifications")),
    # U3: "3 to catch up" on Marcus's card opens his plan filtered to those 3 tasks, with Back to Team.
    "manager-david-drilldown-catchup": lambda p: (viewer(p, "david"), click(p, ".hire-card[data-hire=marcus] [data-show=catchup]")),
    # ...and the browser's Back button returns to Team (the route is in the URL hash).
    "manager-david-drilldown-back": lambda p: (
        viewer(p, "david"), click(p, ".hire-card[data-hire=marcus] [data-show=catchup]"), p.go_back(), p.wait_for_selector(".hire-card")),
    # A readiness item opens that task in the hire's plan.
    "manager-david-drilldown-readiness-item": lambda p: (
        viewer(p, "david"), mgr_tab(p, "readiness"), click(p, ".ri-label[data-hire=emily][data-action=open-hire] >> nth=1")),
    # A digest preview line opens the hire it mentions.
    "manager-david-drilldown-digest-line": lambda p: (viewer(p, "david"), nudges(p), click(p, ".pv-line[data-show=catchup]")),
    # Extra c: the new hire sees goals read-only in My plan (Today keeps 3 focus rows).
    "newhire-marcus-goals-myplan": lambda p: (viewer(p, "marcus"), nh_tab(p, "plan")),
    "newhire-marcus-goal-note": lambda p: (
        viewer(p, "marcus"), nh_tab(p, "plan"), click(p, "[data-action=nh-goal-note] >> nth=0"),
        p.fill(".goal-note-form textarea", "Set up and ran the tests."), click(p, ".goal-note-form button[type=submit]")),
    # Manager tabs at 320px: the tab bar scrolls inside itself, never the page.
    "manager-david-tabs-320": lambda p: (narrow(p), viewer(p, "david")),
    "manager-david-readiness-320": lambda p: (narrow(p), viewer(p, "david"), mgr_tab(p, "readiness")),
    "manager-david-nudges-320": lambda p: (narrow(p), viewer(p, "david"), nudges(p)),
    "manager-david-1on1-note-320": lambda p: (narrow(p), viewer(p, "david"), open_note(p, "oo-marcus-1")),
    # ---- Round 4, pass C1: HR (Sarah) ----
    # Five tabs: Hires · + Add · Templates · Insights · More. The tab bar may scroll inside itself, never the page.
    "hr-tabs-375": lambda p: (narrow(p, 375), viewer(p, "sarah")),
    "hr-tabs-320": lambda p: (narrow(p), viewer(p, "sarah")),
    # "Where everyone is" (round-2 timeline restored in C2, by user request): one row per person; a name opens
    # its pop-up (next to it on desktop, a bottom sheet on phones) with Open plan / Edit. No filters (U2 removed).
    "hr-where-popup": lambda p: (viewer(p, "sarah"), click(p, ".tl-name[data-hires=emily]")),
    "hr-where-popup-320": lambda p: (narrow(p), viewer(p, "sarah"), click(p, ".tl-name[data-hires=marcus]")),
    "hr-where-popup-esc": lambda p: (viewer(p, "sarah"), click(p, ".tl-name[data-hires=tom]"), p.keyboard.press("Escape")),
    # With bulk-imported people too: one row each (no overlap list any more).
    "hr-where-more-people": lambda p: (viewer(p, "sarah"), bulk_import(p), hr_tab(p, "hires"), click(p, ".tl-name[data-hires=emily]")),
    # C1a: Insights; a "past their date" bar opens who; a feeling bar opens comments.
    "hr-insights": lambda p: (viewer(p, "sarah"), hr_tab(p, "insights")),
    "hr-insights-past-who": lambda p: (viewer(p, "sarah"), hr_tab(p, "insights"), click(p, "[data-action=ins-pick][data-chart=past]")),
    "hr-insights-comments": lambda p: (viewer(p, "sarah"), hr_tab(p, "insights"), click(p, "[data-action=ins-pick][data-chart=pulse][data-key=better]")),
    "hr-insights-320": lambda p: (narrow(p), viewer(p, "sarah"), hr_tab(p, "insights")),
    # C1a: the new hire's Day 7 check-in (Marcus is on Day 11), in the one banner slot.
    "newhire-marcus-pulse": lambda p: viewer(p, "marcus"),
    "newhire-marcus-pulse-error": lambda p: (viewer(p, "marcus"), click(p, "#pulse-form button[type=submit]")),
    "newhire-marcus-pulse-sent": lambda p: (
        viewer(p, "marcus"), click(p, "label[for=pulse-okay]"), p.fill("#pulse-comment", "Busy, but the team is great."),
        click(p, "#pulse-form button[type=submit]")),
    # C1b: role templates in the editor, a new role, and the add-hire preview with "From: Backend Engineer".
    "hr-templates-role": lambda p: (
        viewer(p, "sarah"), hr_tab(p, "templates"), click(p, "[data-action=tpl-pick][data-tpl='role:role-backend']"),
        click(p, "[data-action=tpl-edit][data-key=r-be-runbook]")),
    "hr-templates-new-role-error": lambda p: (
        viewer(p, "sarah"), hr_tab(p, "templates"), click(p, "[data-action=tpl-role-new]"), p.fill("#role-name", "Account Executive"),
        p.select_option("#role-dept", "Sales"), click(p, "#role-form button[type=submit]")),
    "hr-add-hire-preview-role": lambda p: (
        viewer(p, "sarah"), hr_tab(p, "add"), fill(p, "name", "Jordan Lee"), fill(p, "title", "Backend Engineer"),
        p.select_option("#hire-form [name=department]", "Engineering"), p.select_option("#hf-role", "role-backend"),
        click(p, "#hire-form button[type=submit]")),
    # F6: a manager from another department is a warning on the add form.
    "hr-add-hire-manager-warning": lambda p: (
        viewer(p, "sarah"), hr_tab(p, "add"), fill(p, "name", "Robin Diaz"), fill(p, "title", "Sales Rep"),
        p.select_option("#hire-form [name=department]", "Sales"), p.select_option("#hf-managerId", "david"),
        click(p, "#hire-form button[type=submit]")),
    # C1c: bulk import with valid, invalid and duplicate rows; then after importing.
    "hr-bulk-preview": lambda p: (viewer(p, "sarah"), bulk_paste(p)),
    "hr-bulk-imported": lambda p: (viewer(p, "sarah"), bulk_import(p)),
    "hr-bulk-320": lambda p: (narrow(p), viewer(p, "sarah"), bulk_paste(p)),
    # U4: edit hire. Department to Sales: the manager must be from Sales (Priya is picked, and says so),
    # David's open tasks move to Priya, and the plan swap is previewed.
    "hr-edit-hire-dept-swap": lambda p: (viewer(p, "sarah"), edit_emily_to_sales(p)),
    "hr-edit-hire-start-date": lambda p: (
        viewer(p, "sarah"), click(p, "[data-action=edit-hire][data-hire=emily]"), p.fill("#ef-startDate", "2026-11-16"),
        p.dispatch_event("#ef-startDate", "change")),
    "hr-edit-hire-manager-error": lambda p: (
        viewer(p, "sarah"), edit_emily_to_sales(p), p.select_option("#ef-managerId", "lena"), click(p, "#edit-form button[type=submit]")),
    "hr-edit-hire-saved": lambda p: (viewer(p, "sarah"), edit_emily_to_sales(p), click(p, "#edit-form button[type=submit]")),
    # ...and Priya's Team view now shows Emily.
    "manager-priya-after-move": lambda p: (viewer(p, "sarah"), edit_emily_to_sales(p), click(p, "#edit-form button[type=submit]"), viewer(p, "priya")),
    # U4: remove: a calm confirm dialog, then the Undo toast (10 seconds).
    "hr-remove-confirm": lambda p: (viewer(p, "sarah"), click(p, "[data-action=delete-hire][data-hire=tom]")),
    "hr-remove-undo-toast": lambda p: (
        viewer(p, "sarah"), click(p, "[data-action=delete-hire][data-hire=tom]"), click(p, "[data-action=remove-confirm]")),
    "hr-remove-undone": lambda p: (
        viewer(p, "sarah"), click(p, "[data-action=delete-hire][data-hire=tom]"), click(p, "[data-action=remove-confirm]"),
        click(p, ".toast-btn")),
    # More: Bulk import, Compliance, Documents (pass C2; offboarding & moves were dropped by the user).
    "hr-more": lambda p: (viewer(p, "sarah"), hr_tab(p, "more")),
    # ---- Round 4, pass C2 ----
    # C2b: the compliance matrix (✓ date / ○ Not yet / —), headline, an audit trail, at desktop, phone and 320.
    "hr-compliance": lambda p: (viewer(p, "sarah"), more_sub(p, "compliance")),
    "hr-compliance-320": lambda p: (narrow(p), viewer(p, "sarah"), more_sub(p, "compliance")),
    "hr-compliance-audit": lambda p: (viewer(p, "sarah"), more_sub(p, "compliance"), click(p, "[data-action=comp-audit][data-key=c-handbook]:visible")),
    "hr-compliance-audit-offer": lambda p: (viewer(p, "sarah"), more_sub(p, "compliance"), click(p, "[data-action=comp-audit][data-key=c-offer]:visible")),
    # The audit trail after Emily acknowledges the handbook herself.
    "hr-compliance-after-ack": lambda p: (
        viewer(p, "emily"), nh_tab(p, "plan"), p.evaluate("document.querySelectorAll('details.phase').forEach((d) => (d.open = true))"),
        click(p, "input[aria-label=\"I've read and agree: 'Read and acknowledge the employee handbook'\"]"),
        viewer(p, "sarah"), more_sub(p, "compliance"), click(p, "[data-action=comp-audit][data-key=c-handbook]:visible")),
    # C2c: documents with search + category filter, the add form with errors, the edit form, remove + Undo.
    "hr-documents": lambda p: (viewer(p, "sarah"), more_sub(p, "documents")),
    "hr-documents-search": lambda p: (
        viewer(p, "sarah"), more_sub(p, "documents"), p.select_option("#doc-cat", "Team guides"), p.fill("#doc-q", "guide")),
    "hr-documents-add-errors": lambda p: (
        viewer(p, "sarah"), more_sub(p, "documents"), click(p, "[data-action=doc-add]"), p.fill("#doc-f-link", "intranet/travel"),
        click(p, "#doc-form button[type=submit]")),
    "hr-documents-edit": lambda p: (viewer(p, "sarah"), more_sub(p, "documents"), click(p, "[data-action=doc-edit][data-doc=doc-handbook]")),
    "hr-documents-removed-undo": lambda p: (viewer(p, "sarah"), more_sub(p, "documents"), click(p, "[data-action=doc-remove][data-doc=doc-401k]")),
    "hr-documents-320": lambda p: (narrow(p), viewer(p, "sarah"), more_sub(p, "documents")),
    # The new hire's Documents section (My plan): only documents for her audience (Engineering, individual contributor).
    "newhire-emily-documents": lambda p: (viewer(p, "emily"), nh_tab(p, "plan"), p.locator("#nh-docs").scroll_into_view_if_needed()),
    "newhire-aisha-documents-manager": lambda p: (viewer(p, "aisha"), nh_tab(p, "plan"), p.locator("#nh-docs").scroll_into_view_if_needed()),
    # Template editor: the Required flag and the document picker (read / acknowledge tasks).
    "hr-templates-required-doc": lambda p: (
        viewer(p, "sarah"), hr_tab(p, "templates"), click(p, "[data-action=tpl-edit][data-key=c-handbook]")),
    "hr-templates-required-doc-320": lambda p: (
        narrow(p), viewer(p, "sarah"), hr_tab(p, "templates"), click(p, "[data-action=tpl-edit][data-key=c-handbook]")),
    "hr-templates-required-chips": lambda p: (viewer(p, "sarah"), hr_tab(p, "templates")),
    # ---- Round 4 fix pass ----
    # F1: on phones the pop-up is a bottom sheet sized to its content over a light backdrop (viewport shots).
    "hr-where-sheet-375": lambda p: (narrow(p, 375), viewer(p, "sarah"), click(p, ".tl-name[data-hires=marcus]")),
    # F2 / F6b: opened from the keyboard (Enter on a focused name); on desktop it sits beside the name.
    "hr-where-popup-keyboard": lambda p: (viewer(p, "sarah"), p.focus(".tl-name[data-hires=marcus]"), p.keyboard.press("Enter")),
    # F7: the timeline at 320px: start/end dates and Today only, names on two lines.
    "hr-where-320": lambda p: (narrow(p), viewer(p, "sarah"), p.locator("#where").scroll_into_view_if_needed()),
    # F4: a weekend start date: a note with "Use Mon, Nov 16" (add form, after the fix, edit form, bulk import).
    "hr-add-hire-weekend": lambda p: (viewer(p, "sarah"), hr_tab(p, "add"), set_field_date(p, "#hf-startDate", "2026-11-14")),
    "hr-add-hire-weekend-fixed": lambda p: (
        viewer(p, "sarah"), hr_tab(p, "add"), set_field_date(p, "#hf-startDate", "2026-11-14"), click(p, "[data-action=use-monday]")),
    "hr-edit-hire-weekend": lambda p: (
        viewer(p, "sarah"), click(p, "[data-action=edit-hire][data-hire=emily]"), set_field_date(p, "#ef-startDate", "2026-11-15")),
    "hr-bulk-weekend": lambda p: (
        viewer(p, "sarah"), hr_tab(p, "add"), click(p, "[data-action=add-mode][data-mode=bulk]"),
        p.fill("#bulk-text", BULK_WEEKEND_CSV), click(p, "[data-action=bulk-check]")),
    # F5: compliance on phones is one card per person; an item opens its audit trail.
    "hr-compliance-cards-375": lambda p: (narrow(p, 375), viewer(p, "sarah"), more_sub(p, "compliance")),
    "hr-compliance-cards-audit": lambda p: (
        viewer(p, "sarah"), more_sub(p, "compliance"), click(p, "[data-action=comp-audit][data-key=c-offer]:visible")),
}

# Screens shot at the viewport only (not full page), so a fixed bottom sheet shows where the user sees it.
VIEWPORT_SHOTS = {"hr-where-popup-320", "hr-where-sheet-375"}

# ---------- in-page checks ----------
CHECKS_JS = """
(isPhone) => {
  const out = { overflowX: false, smallTargets: [], unlabeled: [] };
  out.overflowX = document.documentElement.scrollWidth > window.innerWidth + 1;
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const desc = (el) => (el.tagName.toLowerCase() + ' "' + ((el.getAttribute('aria-label') || el.innerText || el.name || el.value || '').trim().slice(0, 40)) + '"');
  if (isPhone) {
    for (const el of document.querySelectorAll('button, a, input, select, summary')) {
      if (!visible(el)) continue;
      // An input's real hit area includes its <label> (wrapping, or label[for]).
      let hit = el;
      if (el.tagName === 'INPUT') {
        const lab = el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`));
        if (lab && visible(lab)) hit = lab;
      }
      const r = hit.getBoundingClientRect();
      if (r.height < 32 || r.width < 32) out.smallTargets.push(desc(el) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (!visible(el) || el.type === 'hidden') continue;
    const labelled = el.getAttribute('aria-label') || el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`));
    if (!labelled) out.unlabeled.push(desc(el));
  }
  out.smallTargets = [...new Set(out.smallTargets)].slice(0, 15);
  return out;
}
"""


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def serve(port):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    handler = functools.partial(Quiet, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="ui-review/shots/latest")
    ap.add_argument("--only", default="", help="only screens whose name contains this text")
    args = ap.parse_args()
    out = (ROOT / args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.png"):
        old.unlink()

    port = free_port()
    httpd = serve(port)
    base = f"http://127.0.0.1:{port}"
    report = {"screens": [], "logic_tests": None, "out": str(out)}
    had_errors = False

    with sync_playwright() as pw:
        browser = pw.chromium.launch()

        # Logic tests
        page = browser.new_page()
        page.goto(f"{base}/tests.html")
        title = page.title()
        fails = page.locator(".fail").all_inner_texts()
        report["logic_tests"] = {"title": title, "failures": fails}
        page.close()

        for name, steps in SCREENS.items():
            if args.only and args.only not in name:
                continue
            for vp, (w, h) in VIEWPORTS.items():
                ctx = browser.new_context(viewport={"width": w, "height": h}, is_mobile=(vp == "phone"), has_touch=(vp == "phone"))
                page = ctx.new_page()
                errors = []
                page.on("console", lambda m, e=errors: e.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda ex, e=errors: e.append(f"pageerror: {ex}"))
                page.on("dialog", lambda d: d.dismiss())
                # Fresh seed data + fixed demo date for every screen
                page.goto(base + "/index.html")
                page.evaluate("localStorage.clear()")
                page.reload()
                page.fill("#demo-date", FIXED_DATE)
                page.dispatch_event("#demo-date", "change")
                page.evaluate("document.activeElement && document.activeElement.blur()")
                step_error = None
                try:
                    steps(page)
                    page.wait_for_timeout(150)
                except Exception as ex:  # a broken selector usually means the UI changed
                    step_error = f"could not reach screen: {str(ex).splitlines()[0]}"
                checks = page.evaluate(CHECKS_JS, vp == "phone")
                shot = out / f"{name}--{vp}.png"
                page.screenshot(path=str(shot), full_page=name not in VIEWPORT_SHOTS)
                entry = {"screen": name, "viewport": vp, "screenshot": str(shot.relative_to(ROOT)).replace("\\", "/"),
                         "errors": errors, "step_error": step_error, **checks}
                if errors or step_error:
                    had_errors = True
                report["screens"].append(entry)
                ctx.close()
        browser.close()
    httpd.shutdown()

    # Write reports
    (out / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    lt = report["logic_tests"]
    lines = ["# UI harness report", "", f"Logic tests: **{lt['title']}**"]
    lines += [f"- FAIL: {f}" for f in lt["failures"]]
    lines += ["", "| Screen | Viewport | Problems | Screenshot |", "|---|---|---|---|"]
    for s in report["screens"]:
        probs = []
        if s["step_error"]: probs.append(s["step_error"])
        if s["errors"]: probs.append(f"{len(s['errors'])} JS error(s): " + "; ".join(s["errors"][:2]))
        if s["overflowX"]: probs.append("horizontal scroll")
        if s["smallTargets"]: probs.append(f"{len(s['smallTargets'])} small tap target(s): " + ", ".join(s["smallTargets"][:4]))
        if s["unlabeled"]: probs.append("unlabeled: " + ", ".join(s["unlabeled"][:3]))
        lines.append(f"| {s['screen']} | {s['viewport']} | {'; '.join(probs) or 'ok'} | {s['screenshot']} |")
    (out / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    if lt["failures"] or not lt["title"].startswith("PASS"):
        had_errors = True
    sys.exit(1 if had_errors else 0)


if __name__ == "__main__":
    main()
