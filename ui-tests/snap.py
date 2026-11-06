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


SCREENS = {
    "newhire-emily-focus": lambda p: viewer(p, "emily"),
    "newhire-emily-fullplan": lambda p: (viewer(p, "emily"), click(p, "[data-action=nh-tab][data-tab=plan]")),
    "newhire-emily-day2": lambda p: (viewer(p, "emily"), p.fill("#demo-date", "2026-11-10"), p.dispatch_event("#demo-date", "change")),
    "newhire-emily-day-before": lambda p: (viewer(p, "emily"), set_date(p, "2026-11-08")),
    "newhire-emily-day1": lambda p: (viewer(p, "emily"), set_date(p, "2026-11-09")),
    "newhire-emily-event-notyet": lambda p: (
        viewer(p, "emily"), set_date(p, "2026-11-10"), click(p, "[data-action=event-notyet]")),
    "newhire-emily-milestone": lambda p: (
        viewer(p, "emily"),
        click(p, "input[aria-label=\"Mark 'Set up direct deposit' done\"]"),
        click(p, "input[aria-label=\"Mark 'Read the welcome guide and Day 1 logistics' done\"]")),
    "newhire-tom-nothing-done": lambda p: viewer(p, "tom"),
    "manager-david-team": lambda p: viewer(p, "david"),
    "manager-david-hire-detail": lambda p: (viewer(p, "david"), click(p, "[data-action=open-hire][data-hire=marcus]")),
    "manager-david-add-task-error": lambda p: (
        viewer(p, "david"), click(p, "[data-action=open-hire][data-hire=marcus]"),
        click(p, "[data-action=new-task]"), click(p, "#task-form button[type=submit]")),
    "manager-david-day-before-nudge": lambda p: (viewer(p, "david"), set_date(p, "2026-11-08")),
    "manager-david-week-day": lambda p: (
        viewer(p, "david"), click(p, "[data-action=week-day][data-day='2026-11-06']")),
    "manager-omar-empty": lambda p: viewer(p, "omar"),
    "hr-dashboard": lambda p: viewer(p, "sarah"),
    "hr-kpi-filter": lambda p: (viewer(p, "sarah"), click(p, ".stat[data-action=hr-kpi][data-kpi=behind]")),
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
}

# ---------- in-page checks ----------
CHECKS_JS = """
(isPhone) => {
  const out = { overflowX: false, smallTargets: [], unlabeled: [] };
  out.overflowX = document.documentElement.scrollWidth > window.innerWidth + 1;
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const desc = (el) => (el.tagName.toLowerCase() + ' "' + ((el.getAttribute('aria-label') || el.innerText || el.name || el.value || '').trim().slice(0, 40)) + '"');
  if (isPhone) {
    for (const el of document.querySelectorAll('button, a, input, select, summary, [role=tab]')) {
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
                page.screenshot(path=str(shot), full_page=True)
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
