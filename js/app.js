// UI rendering and event handling. Plain JS, re-renders #app on each change.
(function () {
  let state = OB.store.load();
  // UI-only state (not saved)
  const ui = {
    hrTab: "hires", // hires | add | templates
    detailId: null, // hire being viewed by manager/HR
    nhTab: "focus", // focus | plan
    hrFilterDept: "all",
    hrFilterStatus: "all",
    hrKpi: "all", // KPI tile used as a filter: all | owe | behind | soon
    weekDay: null, // manager week strip: selected day (YYYY-MM-DD) or null
    draft: null, // add-hire form
    draftErrors: {},
    draftWarnings: [],
    preview: null, // generated plan preview for the add-hire form
    taskForm: null, // custom task form on detail page
    taskErrors: {},
    toast: null,
    folds: {}, // open/closed state of folded sections on the hire detail page
    tplName: "Company", // HR "Plan templates": which template is shown
    tplEdit: null, // { name, key (null = new task), draft } while a template task form is open
    tplErrors: {},
    toastAct: null, // optional button on the toast: { label, action }
    undo: null, // { name, list, title }: the template before the last removal, while its Undo toast shows
  };

  // ---------- helpers ----------
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const today = () => state.demoToday || OB.todayISO();
  // Plan templates as HR has edited them (defaults in OB.TEMPLATES). Used for every new plan.
  const templates = () => OB.mergeTemplates(OB.TEMPLATES, state.templates);

  function person(id) {
    return OB.PEOPLE.find((p) => p.id === id) || state.hires.find((h) => h.id === id) || null;
  }
  function personName(id) {
    const p = person(id);
    return p ? p.name : "Someone";
  }
  function viewer() {
    const p = OB.PEOPLE.find((x) => x.id === state.viewerId);
    if (p) return p;
    const h = state.hires.find((x) => x.id === state.viewerId);
    if (h) return { ...h, role: "newhire" };
    return OB.PEOPLE[0];
  }
  function hireById(id) {
    return state.hires.find((h) => h.id === id);
  }
  function firstName(n) {
    return n.split(" ")[0];
  }
  function initials(n) {
    return n
      .split(" ")
      .map((x) => x[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function commit() {
    OB.store.save(state);
    render();
  }

  // act (optional): { label, action } adds one button to the toast (e.g. Undo). Toasts with a button stay longer.
  function toast(msg, act) {
    ui.toast = msg;
    ui.toastAct = act || null;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      ui.toast = null;
      ui.toastAct = null;
      ui.undo = null; // Undo is only offered while its toast is showing.
      render();
    }, act ? 8000 : 2600);
  }
  function clearUndo() {
    if (!ui.undo) return;
    ui.undo = null;
    if (ui.toastAct) {
      ui.toast = null;
      ui.toastAct = null;
    }
  }

  function dueLabel(t) {
    const td = today();
    if (t.done) return `Done ${t.doneAt ? OB.prettyDate(t.doneAt) : ""}`;
    const d = OB.diffDays(t.dueDate, td);
    if (d < 0) return `Was due ${OB.prettyDate(t.dueDate)}`;
    if (d === 0) return "Due today";
    if (d === 1) return "Due tomorrow";
    return `Due ${OB.prettyDate(t.dueDate)}`;
  }

  function dayLabel(hire) {
    const n = OB.diffDays(today(), hire.startDate);
    if (n < -1) return `Starts ${OB.prettyDate(hire.startDate)} · in ${-n} days`;
    if (n === -1) return `Starts tomorrow, ${OB.prettyDate(hire.startDate)}`;
    if (n === 0) return "Starts today";
    if (n > 27) return `Started ${OB.prettyDate(hire.startDate)} · onboarding period over`;
    return `Day ${n + 1} · started ${OB.prettyDate(hire.startDate)}`;
  }

  function ownerLabel(t, hire, viewerRole) {
    if (t.owner === "newhire") return viewerRole === "newhire" ? "You" : firstName(hire.name);
    if (t.owner === "manager") return viewerRole === "manager" ? "You" : `${firstName(personName(hire.managerId))} (manager)`;
    return OB.OWNERS[t.owner];
  }

  // ---------- icons + status chips (X1) ----------
  // Small inline SVG icons; they inherit the text colour. Decorative: the word next to them carries the meaning.
  const svg = (body, cls) =>
    `<svg class="ico ${cls || ""}" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">${body}</svg>`;
  const S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const ICON = {
    done: svg(`<circle cx="8" cy="8" r="6.6" ${S}/><path d="M5 8.3l2 2 4-4.2" ${S} stroke-width="1.8"/>`),
    behind: svg(`<circle cx="8" cy="8" r="6.6" ${S}/><path d="M8 4.6V8l2.4 1.6" ${S}/>`),
    // "Your move": a calm arrow, not an alarm shape.
    action: svg(`<path d="M2.6 8h9.6M8.6 4.2L12.4 8l-3.8 3.8" ${S} stroke-width="1.8"/>`),
    clock: svg(`<circle cx="8" cy="8" r="6.6" ${S}/><path d="M8 4.6V8l2.4 1.6" ${S}/>`),
    upcoming: svg(`<circle cx="8" cy="8" r="6" ${S}/>`),
    waiting: svg(`<rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2" ${S}/>`),
    calendar: svg(`<rect x="2" y="3" width="12" height="11" rx="2" ${S}/><path d="M2 6.5h12M5.5 1.6v2.8M10.5 1.6v2.8" ${S}/>`),
    pin: svg(`<path d="M8 14.4s4.6-4.4 4.6-7.9a4.6 4.6 0 0 0-9.2 0c0 3.5 4.6 7.9 4.6 7.9z" ${S}/><circle cx="8" cy="6.4" r="1.7" ${S}/>`),
    bell: svg(`<path d="M4 11.5V7.2a4 4 0 0 1 8 0v4.3l1.2 1.3H2.8zM6.6 14.2a1.5 1.5 0 0 0 2.8 0" ${S}/>`),
  };

  // statusChip("done" | "behind" | "action" | "upcoming" | "waiting", "Word"): shape + word, never colour alone.
  function statusChip(kind, text) {
    return `<span class="schip schip-${kind}">${ICON[kind] || ""}<span>${esc(text)}</span></span>`;
  }

  // "Nov 9"
  const shortDate = (s) => OB.parseDate(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  // "Mon"
  const weekdayShort = (s) => OB.parseDate(s).toLocaleDateString(undefined, { weekday: "short" });
  // "Monday"
  const weekdayLong = (s) => OB.parseDate(s).toLocaleDateString(undefined, { weekday: "long" });

  // ---------- whose action is needed (D2) ----------
  // Chips for a hire, most urgent first. Wording is neutral and says what's next, never who failed.
  // viewerRole decides "1 for you" (manager) vs "1 for manager" (HR).
  function statusItems(h, s, viewerRole) {
    if (s.status === "complete") return [["done", "Complete"]];
    const out = [];
    if (s.youOwe) out.push(["action", `${s.youOwe} ${viewerRole === "manager" ? "for you" : "for manager"}`]);
    if (s.behind) out.push(["behind", `${s.behind} to catch up`]);
    if (s.waitingIt || s.waitingHr) out.push(["waiting", `With ${[s.waitingIt && "IT", s.waitingHr && "HR"].filter(Boolean).join(" & ")}`]);
    if (!out.length) out.push(s.status === "upcoming" ? ["upcoming", `Starts ${shortDate(h.startDate)}`] : ["done", "On track"]);
    return out;
  }
  const statusChipList = (h, s, viewerRole) => statusItems(h, s, viewerRole).map(([k, t]) => statusChip(k, t));
  const statusChips = (h, s, viewerRole) => `<div class="chips">${statusChipList(h, s, viewerRole).join("")}</div>`;

  // The single most important chip (action > behind > waiting > on pace), for cards and table rows.
  const primaryChip = (h, s, viewerRole) => statusChipList(h, s, viewerRole)[0];
  const primaryWord = (h, s, viewerRole) => statusItems(h, s, viewerRole)[0][1];

  // ---------- progress vs schedule (D1, simplified) ----------
  // One question: "is this person keeping up with their own tasks?" Scale = the new hire's own tasks (no meetings).
  // Blue fill = their tasks due before today that are done; dark tick = how many were due before today
  // ("where they'd be by today"). The gap between fill and tick is exactly the "N to catch up" chip
  // (OB.ownProgress; s.behind === s.own.toCatchUp). Caption is always "N of M done" on the same scale.
  function bulletGraph(s, opts) {
    const o = opts || {};
    const b = s.own;
    const T = Math.max(b.total, 1);
    const p = (n) => `${((Math.min(n, T) / T) * 100).toFixed(2)}%`;
    const fill = b.done === b.total ? b.total : b.doneExpected;
    const cap = `${b.done} of ${b.total} done`;
    const label = `${o.name ? `${o.name}'s own tasks: ` : ""}${b.done} of ${b.total} done, ${b.expected} expected by today${s.behind ? `, ${s.behind} to catch up` : ""}.`;
    return `
      <div class="bullet" role="img" aria-label="${esc(label)}">
        <svg class="bullet-svg" width="100%" height="14" aria-hidden="true" focusable="false">
          <rect class="bg-track" x="0" y="3" width="100%" height="8" rx="4"/>
          ${fill ? `<rect class="bg-done" x="0" y="3" width="${p(fill)}" height="8" rx="4"/>` : ""}
          ${b.expected && b.done < b.total ? `<svg x="${p(b.expected)}" y="0" overflow="visible"><rect class="bg-target" x="-1" y="0" width="2" height="14" rx="1"/></svg>` : ""}
        </svg>
        ${o.noText ? "" : `<span class="bullet-cap" aria-hidden="true">${esc(cap)}</span>`}
      </div>`;
  }
  // The one-line key for the tick, shown once above cards / the table (F3).
  const bulletKey = () =>
    `<p class="bullet-key"><svg width="6" height="14" aria-hidden="true" focusable="false"><rect class="bg-target" x="2" y="0" width="2" height="14" rx="1"/></svg>
      = where they'd be by today · bars count the new hire's own tasks</p>`;
  // When the card/row chip is about someone else ("1 for you"), say what the bar's gap is, in the same words.
  const catchUpNote = (h, s, viewerRole) =>
    s.behind && statusItems(h, s, viewerRole)[0][0] !== "behind" ? `<div class="muted small wait-note">${ICON.behind} ${s.behind} to catch up</div>` : "";

  // ---------- header ----------
  function renderHeader() {
    const v = viewer();
    const opt = (id, label) => `<option value="${esc(id)}" ${state.viewerId === id ? "selected" : ""}>${esc(label)}</option>`;
    const hr = OB.PEOPLE.filter((p) => p.role === "hr");
    const mgrs = OB.PEOPLE.filter((p) => p.role === "manager");
    const isDemoDate = !!state.demoToday;
    return `
      <header class="topbar">
        <div class="brand"><span class="logo" aria-hidden="true">MA</span><div><strong>MangoApps</strong><span class="sub">Onboarding</span></div></div>
        <div class="controls">
          <label class="ctl">
            <span>Viewing as</span>
            <select id="viewer-select" aria-label="Switch user">
              <optgroup label="HR">${hr.map((p) => opt(p.id, `${p.name} · ${p.title}`)).join("")}</optgroup>
              <optgroup label="Managers">${mgrs.map((p) => opt(p.id, `${p.name} · ${p.title}`)).join("")}</optgroup>
              <optgroup label="New hires">${state.hires.map((h) => opt(h.id, `${h.name} · ${h.title}`)).join("")}</optgroup>
            </select>
          </label>
          <label class="ctl ${isDemoDate ? "ctl-warn" : ""}" title="Pretend today is a different date to see how the plan changes over time">
            <span>Demo date</span>
            <input type="date" id="demo-date" value="${today()}" aria-label="Demo date" />
          </label>
          ${isDemoDate ? `<button class="link" data-action="real-date">Back to real date</button>` : ""}
        </div>
      </header>
      <div class="whoami">Signed in as <strong>${esc(v.name)}</strong> · ${esc(v.role === "newhire" ? "New hire" : v.title)}</div>`;
  }

  // ---------- task rows ----------
  function taskRow(t, hire, viewerRole, opts) {
    const o = opts || {};
    const can = OB.canComplete(viewerRole, t);
    // The new hire sees other people's tasks in their own words, without lateness alarms.
    const td = today();
    const hireView = viewerRole === "newhire" && t.owner !== "newhire";
    // The new hire's own late tasks get a calm "do this next" instead of red (E2). Managers/HR still see overdue.
    const ownView = viewerRole === "newhire" && t.owner === "newhire";
    const overdue = viewerRole !== "newhire" && OB.isOverdue(t, td);
    const title = hireView && t.hireTitle ? t.hireTitle : t.title;
    const desc = hireView && t.hireDesc ? t.hireDesc : t.desc;
    let due = dueLabel(t);
    if (hireView && !t.done) due = t.dueDate < td ? "Expected soon" : `Expected ${OB.prettyDate(t.dueDate)}`;
    const who = ownerLabel(t, hire, viewerRole);
    const doneBy = t.done && t.doneBy ? ` by ${esc(t.doneBy === state.viewerId ? "you" : personName(t.doneBy))}` : "";
    const cbId = `cb-${t.id}`;
    let dueHtml = `<span class="due ${overdue ? "due-over" : ""}">${esc(due)}${doneBy}</span>`;
    if (ownView && !t.done) {
      if (OB.isEventPending(t, td)) {
        dueHtml =
          t.notYetOn === td
            ? `<span class="due">${ICON.upcoming} Not yet. We'll check again tomorrow.</span>`
            : `<span class="ask"><span class="ask-q">Did this happen?</span>
                <button class="btn btn-xs" data-action="event-yes" data-hire="${esc(hire.id)}" data-task="${esc(t.id)}" aria-label="Yes, '${esc(title)}' happened">Yes</button>
                <button class="btn btn-xs" data-action="event-notyet" data-hire="${esc(hire.id)}" data-task="${esc(t.id)}" aria-label="Not yet: '${esc(title)}'">Not yet</button></span>`;
      } else if (OB.isOverdue(t, td)) {
        dueHtml = `<span class="due due-behind">${ICON.behind} Was due ${esc(OB.prettyDate(t.dueDate))} · do this next</span>`;
      } else {
        const c = OB.countdownLabel(t.dueDate, td);
        const near = OB.diffDays(t.dueDate, td) <= 1;
        dueHtml = `<span class="due ${near ? "due-near" : ""}">${esc(c)}</span>`;
      }
    }
    return `
      <li class="task ${t.done ? "is-done" : ""} ${overdue ? "is-overdue" : ""} ${o.big ? "task-big" : ""}">
        <${can ? `label for="${cbId}"` : "div"} class="check">
          ${
            can
              ? `<input type="checkbox" id="${cbId}" data-toggle="${esc(t.id)}" data-hire="${esc(hire.id)}" ${t.done ? "checked" : ""} aria-label="Mark '${esc(title)}' ${t.done ? "not done" : "done"}" />`
              : `<span class="check-ro ${t.done ? "on" : ""}" title="${t.done ? "Done" : `Only ${esc(who)} can complete this`}" aria-hidden="true"></span>`
          }
        </${can ? "label" : "div"}>
        <div class="task-body">
          <label ${can ? `for="${cbId}"` : ""} class="task-title">${esc(title)}</label>
          ${desc && !o.compact ? `<p class="task-desc">${esc(desc)}</p>` : ""}
          <div class="task-meta">
            ${dueHtml}
            ${o.hideOwner ? "" : `<span class="chip chip-${t.owner}">${esc(who)}</span>`}
            ${o.showSource && t.source !== "Company" ? `<span class="chip chip-src">${esc(t.source)}</span>` : ""}
            ${t.custom && o.canRemove ? `<button class="link danger" data-action="remove-task" data-hire="${esc(hire.id)}" data-task="${esc(t.id)}">Remove</button>` : ""}
          </div>
        </div>
      </li>`;
  }

  function phaseSections(hire, viewerRole, opts) {
    const o = opts || {};
    const cur = OB.currentPhase(hire.startDate, today());
    return OB.PHASES.map((p) => {
      const tasks = OB.sortTasks(hire.tasks.filter((t) => t.phase === p.id));
      const done = tasks.filter((t) => t.done).length;
      const isCur = p.id === cur;
      const isFuture = OB.PHASE_ORDER[p.id] > OB.PHASE_ORDER[cur];
      const foldKey = `${hire.id}:${p.id}`;
      const remembered = (k, dflt) => (o.currentOnly && k in ui.folds ? ui.folds[k] : dflt);
      const open = remembered(foldKey, o.currentOnly ? isCur : o.allOpen || !isFuture);
      let list;
      if (!tasks.length) list = `<p class="empty-sm">No tasks in this phase.</p>`;
      else if (o.currentOnly) {
        // Manager/HR detail: overdue items are already listed above, and done items fold away.
        const shownAbove = tasks.filter((t) => o.skipIds && o.skipIds.has(t.id));
        const openTasks = tasks.filter((t) => !t.done && !shownAbove.includes(t));
        const doneTasks = tasks.filter((t) => t.done);
        list = `
          ${shownAbove.length ? `<p class="empty-sm phase-note">${shownAbove.length} past ${shownAbove.length === 1 ? "its" : "their"} date (shown above)</p>` : ""}
          ${openTasks.length ? `<ul class="tasks">${openTasks.map((t) => taskRow(t, hire, viewerRole, o)).join("")}</ul>` : !shownAbove.length ? `<p class="empty-sm">Nothing left to do in this phase.</p>` : ""}
          ${
            doneTasks.length
              ? `<details class="done-fold" data-fold="${esc(foldKey)}:done" ${remembered(`${foldKey}:done`, false) ? "open" : ""}><summary>${doneTasks.length} done</summary><ul class="tasks">${doneTasks.map((t) => taskRow(t, hire, viewerRole, o)).join("")}</ul></details>`
              : ""
          }`;
      } else list = `<ul class="tasks">${tasks.map((t) => taskRow(t, hire, viewerRole, o)).join("")}</ul>`;
      return `
        <details class="phase ${isCur ? "phase-current" : ""}" ${o.currentOnly ? `data-fold="${esc(foldKey)}"` : ""} ${open ? "open" : ""}>
          <summary>
            <span class="phase-name">${esc(p.label)}${isCur ? ` <span class="now-pill">Now</span>` : ""}</span>
            <span class="phase-count">${done}/${tasks.length} done</span>
          </summary>
          <p class="phase-hint">${esc(p.hint)}</p>
          ${list}
        </details>`;
    }).join("");
  }

  function phaseStepper(hire, stats) {
    return `<ol class="stepper">${OB.PHASES.map((p) => {
      const b = stats.byPhase[p.id];
      const isCur = p.id === stats.phase;
      const complete = b.total > 0 && b.done === b.total;
      return `<li class="${isCur ? "cur" : ""} ${complete ? "complete" : ""}"><span class="dot" aria-hidden="true"></span><span class="lbl">${esc(p.label)}</span><span class="cnt">${b.done}/${b.total}</span></li>`;
    }).join("")}</ol>`;
  }

  // ---------- NEW HIRE: journey strip (E1) ----------
  function journeyStrip(hire) {
    const td = today();
    const j = OB.journeyModel(hire.startDate, td, OB.ownPhasesDone(hire));
    const prog = OB.myPhaseProgress(hire, td);
    const pct = (f) => `${(f * 100).toFixed(2)}%`;
    const x = j.todayFrac;
    const edge = x < 0.22 ? "start" : x > 0.78 ? "end" : "mid";
    // Finished phases get a soft filled segment and a ✓ by the label. Nothing else is filled (F2).
    const segs = j.segments
      .map((s) => {
        const fill = s.finished ? `<rect x="${pct(s.from)}" y="14" width="${pct(s.width)}" height="6" rx="3" class="j-done"/>` : "";
        const lx = pct(s.from);
        const tick = s.finished ? " ✓" : "";
        return `${fill}
          <text x="${lx}" dx="2" y="40" class="j-lbl j-long ${s.state === "current" ? "j-cur" : ""}">${esc(s.label + tick)}</text>
          <text x="${lx}" dx="2" y="40" class="j-lbl j-short ${s.state === "current" ? "j-cur" : ""}">${esc(s.short + tick)}</text>`;
      })
      .join("");
    // White gaps between segments so the three phases read as separate pieces.
    const gaps = j.segments
      .slice(1)
      .map((s) => `<svg x="${pct(s.from)}" y="12" overflow="visible"><rect x="-1.5" width="3" height="10" class="j-gap"/></svg>`)
      .join("");
    const states = j.segments
      .map((s) => `${s.label}${s.finished && s.state === "current" ? " (now, done)" : s.finished ? " (done)" : s.state === "current" ? " (now)" : ""}`)
      .join(", ");
    const summary = `Where you are in your first weeks: ${states}. ${j.pill.replace("·", "-")}.`;
    return `
      <section class="card journey">
        <p class="journey-head"><strong>${esc(prog.label)}:</strong> ${prog.done} of ${prog.total} done</p>
        <div class="journey-strip" role="img" aria-label="${esc(summary)}">
          <div class="journey-pill pill-${edge}" style="left:${pct(x)}" aria-hidden="true">${esc(j.pill)}</div>
          <svg class="journey-svg" width="100%" height="46" aria-hidden="true" focusable="false">
            <rect x="0" y="14" width="100%" height="6" rx="3" class="j-track"/>
            ${segs}
            ${gaps}
            <line x1="${pct(x)}" x2="${pct(x)}" y1="0" y2="26" class="j-today"/>
          </svg>
        </div>
      </section>`;
  }

  // ---------- NEW HIRE: Day-1 card (E3) ----------
  function day1Window(hire) {
    const n = OB.diffDays(today(), hire.startDate);
    return n >= -7 && n <= 0;
  }
  function day1Details(hire) {
    const d = OB.day1For(hire.department);
    const greeter = person(d.greeterId);
    const mgr = person(hire.managerId);
    return { ...d, greeter, mgr };
  }
  function day1Card(hire) {
    const n = OB.diffDays(today(), hire.startDate);
    const d = day1Details(hire);
    const big = n === 0 ? "Today" : n === -1 ? "Tomorrow" : `${-n} days`;
    const sub = n === 0 ? "is your first day. Welcome!" : n === -1 ? "is your first day" : "until your first day";
    const greeterName = d.greeter ? d.greeter.name : "Someone from HR";
    return `
      <div class="day1">
        <div class="day1-count"><span class="day1-num">${esc(big)}</span><span class="day1-sub">${esc(sub)}</span></div>
        <ul class="day1-facts">
          <li><span class="fact-ico">${ICON.calendar}</span><div><strong>${esc(OB.prettyDate(hire.startDate))} · ${esc(OB.fmtTime(d.time))}</strong><span class="muted">Orientation, then lunch</span></div></li>
          <li><span class="fact-ico">${ICON.pin}</span><div><strong>${esc(d.place)}</strong><span class="muted">${esc(d.address)}</span></div></li>
          <li><span class="fact-avatars" aria-hidden="true">${d.greeter ? `<span class="avatar sm">${initials(d.greeter.name)}</span>` : ""}${d.mgr ? `<span class="avatar sm">${initials(d.mgr.name)}</span>` : ""}</span>
            <div><strong>${esc(greeterName)} (HR) meets you</strong><span class="muted">${d.mgr ? `then lunch with ${esc(firstName(d.mgr.name))}, your manager` : "and shows you around"}</span></div></li>
        </ul>
        <button class="btn day1-cal" data-action="add-cal" data-hire="${esc(hire.id)}">${ICON.calendar} Add to calendar</button>
      </div>`;
  }

  function icsStamp() {
    return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  }
  function downloadIcs(ics, filename, msg) {
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(msg);
  }

  function downloadDay1Ics(hire) {
    const d = day1Details(hire);
    const now = icsStamp();
    const who = d.greeter ? `${d.greeter.name} (HR) meets you` : "HR meets you";
    const ics = OB.buildIcs({
      uid: `day1-${hire.id}-${hire.startDate}@mangoapps.onboarding`,
      date: hire.startDate,
      start: d.time,
      end: d.end,
      summary: "First day at MangoApps",
      location: `${d.place}, ${d.address}`,
      description: `${who} at ${OB.fmtTime(d.time)}${d.mgr ? `, then lunch with ${d.mgr.name}` : ""}. Bring ${d.bring}.`,
      stamp: now,
    });
    downloadIcs(ics, "mangoapps-day-1.ics", "Calendar file downloaded. Open it to add Day 1 to your calendar.");
  }

  // Manager's first 1:1 on Day 1: 30 minutes in the afternoon, half an hour after the Day-1 lunch ends.
  function addMinutes(hhmm, m) {
    const [h, mm] = hhmm.split(":").map(Number);
    const t = h * 60 + mm + m;
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }
  function oneOnOneSlot(hire) {
    const d = OB.day1For(hire.department);
    const start = addMinutes(d.end, 30);
    return { start, end: addMinutes(start, 30) };
  }
  function download1on1Ics(hire) {
    const slot = oneOnOneSlot(hire);
    const mgr = person(hire.managerId);
    const ics = OB.buildIcs({
      uid: `1on1-${hire.id}-${hire.startDate}@mangoapps.onboarding`,
      date: hire.startDate,
      start: slot.start,
      end: slot.end,
      summary: `1:1 with ${hire.name}`,
      location: "Your desk or a quiet room",
      description: `First 1:1 with ${hire.name}${mgr ? ` and ${mgr.name}` : ""}: the role, the team, and what the first month looks like. Make it a recurring weekly 1:1.`,
      stamp: icsStamp(),
    });
    downloadIcs(ics, `mangoapps-1on1-${firstName(hire.name).toLowerCase()}.ics`, `Calendar file downloaded. Open it to add the 1:1 with ${firstName(hire.name)}.`);
  }

  // ---------- NEW HIRE: one banner at a time (X2, E2, E4) ----------
  function reminders() {
    if (!state.reminders) state.reminders = { hide: {}, seen: {} };
    state.reminders.hide = state.reminders.hide || {};
    state.reminders.seen = state.reminders.seen || {};
    return state.reminders;
  }
  function bannerFor(hire) {
    const td = today();
    const b = OB.pickBanner(hire, td, reminders());
    if (!b) return "";
    let tone, icon, title, sub = "";
    if (b.kind === "day1") {
      const d = day1Details(hire);
      tone = "info";
      icon = ICON.bell;
      title = b.dayN === 0 ? "Today's the day." : b.dayN === -1 ? "Day 1 is tomorrow." : `Day 1 is in ${-b.dayN} days.`;
      title += ` Bring ${d.bring}.`;
      sub = `Time, place and who meets you are in the card below.`;
    } else if (b.kind === "overdue") {
      const n = b.tasks.length;
      tone = "behind";
      icon = ICON.behind;
      title = n === 1 ? "One thing is past its date. No problem, it's first on your list." : `${n} things are past their dates. No problem, they're first on your list.`;
    } else if (b.kind === "due48") {
      const t = b.tasks[0];
      tone = "info";
      icon = ICON.bell;
      title =
        b.tasks.length === 1
          ? `“${t.title}” is ${OB.countdownLabel(t.dueDate, td).replace(/^Due /, "due ")}.`
          : `${b.tasks.length} of your tasks are due in the next 2 days.`;
    } else {
      tone = "done";
      icon = ICON.done;
      title = b.milestone.title;
      sub = b.milestone.next;
      // Shown once: remember the day it first appeared.
      const seen = reminders().seen;
      const k = `${hire.id}:milestone:${b.milestone.id}`;
      if (!seen[k]) {
        seen[k] = td;
        OB.store.save(state);
      }
    }
    // No "Remind me tomorrow" when the banner is about today (Day 1 on Day 1, or tasks all due today) (F6).
    const aboutToday = (b.kind === "day1" && b.dayN === 0) || (b.kind === "due48" && b.tasks.every((t) => t.dueDate === td));
    const snooze =
      b.kind === "milestone" || aboutToday
        ? ""
        : `<button class="btn btn-sm btn-banner" data-action="banner-snooze" data-key="${esc(b.kindKey)}">${ICON.clock} Remind me tomorrow</button>`;
    return `
      <div class="banner banner-${tone}" role="status">
        <span class="banner-ico">${icon}</span>
        <div class="banner-body"><p class="banner-title">${esc(title)}</p>${sub ? `<p class="banner-sub">${esc(sub)}</p>` : ""}</div>
        <div class="banner-actions btn-pair" role="group" aria-label="Reminder options">${snooze}<button class="btn btn-sm btn-banner primary" data-action="banner-ok" data-key="${esc(b.key)}">Got it</button></div>
      </div>`;
  }

  // ---------- NEW HIRE VIEW ----------
  function renderNewHire(hire) {
    const td = today();
    const stats = OB.hireStats(hire, td);
    const focus = OB.focusTasks(hire, td, 3);
    const mgr = person(hire.managerId);
    const curOrder = OB.PHASE_ORDER[stats.phase];
    const waiting = OB.sortTasks(
      hire.tasks.filter((t) => t.owner !== "newhire" && !t.done && (OB.PHASE_ORDER[t.phase] <= curOrder || t.dueDate <= OB.addDays(td, 3)))
    );
    const recentDone = hire.tasks
      .filter((t) => t.done)
      .sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""))
      .slice(0, 5);

    let greeting;
    if (stats.dayN < 0) greeting = `${-stats.dayN} day${stats.dayN === -1 ? "" : "s"} until your first day`;
    else if (stats.dayN === 0) greeting = "Today is your first day. Welcome!";
    else if (stats.dayN > 27) greeting = "Your onboarding period is over";
    else greeting = `Day ${stats.dayN + 1} at MangoApps`;

    const tabs = `
      <div class="tabs" role="tablist">
        <button role="tab" aria-selected="${ui.nhTab === "focus"}" class="${ui.nhTab === "focus" ? "on" : ""}" data-action="nh-tab" data-tab="focus">What to do now</button>
        <button role="tab" aria-selected="${ui.nhTab === "plan"}" class="${ui.nhTab === "plan" ? "on" : ""}" data-action="nh-tab" data-tab="plan">Full plan (${hire.tasks.length})</button>
      </div>`;

    let body;
    if (ui.nhTab === "plan") {
      body = `<p class="muted">Everything in your onboarding plan. Later phases are folded away until you need them.</p>${phaseSections(hire, "newhire", { showSource: true })}`;
    } else {
      let focusHtml;
      if (stats.status === "complete") {
        focusHtml = `<div class="empty"><div class="empty-icon" aria-hidden="true">✓</div><h3>Onboarding complete</h3><p>You've finished every task in your plan. Nice work!</p></div>`;
      } else if (!focus.tasks.length) {
        focusHtml = `<div class="empty"><div class="empty-icon" aria-hidden="true">✓</div><h3>You're all caught up</h3><p>Nothing for you to do right now. ${waiting.length ? "A few things are with other people, listed below." : ""}</p></div>`;
      } else {
        focusHtml = `
          <h2 class="section-title">${focus.upcoming ? "Coming up next" : "Focus on these first"}</h2>
          ${focus.upcoming ? `<p class="muted">Nothing is due right now. Here's what's next, if you want a head start.</p>` : ""}
          <ul class="tasks">${focus.tasks.map((t) => taskRow(t, hire, "newhire", { big: true, hideOwner: true })).join("")}</ul>
          ${focus.more > 0 ? `<p class="more">+ ${focus.more} more for this stage. <button class="link" data-action="nh-tab" data-tab="plan">See full plan</button></p>` : ""}`;
      }
      body = `
        <section class="card focus">${focusHtml}</section>
        ${
          waiting.length
            ? `<section class="card">
                <h2 class="section-title">Being handled for you</h2>
                <p class="muted">Other people are taking care of these. Nothing for you to do.</p>
                <ul class="tasks tasks-compact">${waiting.slice(0, 3).map((t) => taskRow(t, hire, "newhire", { compact: true })).join("")}</ul>
                ${waiting.length > 3 ? `<p class="more"><button class="link" data-action="nh-tab" data-tab="plan">+${waiting.length - 3} more in your full plan</button></p>` : ""}
              </section>`
            : ""
        }
        ${
          recentDone.length
            ? `<details class="card plain"><summary><h2 class="section-title inline">Recently done (${stats.done})</h2></summary>
                <ul class="tasks tasks-compact">${recentDone.map((t) => taskRow(t, hire, "newhire", { compact: true })).join("")}</ul></details>`
            : ""
        }`;
    }

    return `
      <main class="wrap">
        ${bannerFor(hire)}
        <section class="hero hero-nh">
          <div>
            <p class="eyebrow">${esc(hire.title)} · ${esc(hire.department)}</p>
            <h1>Hi ${esc(firstName(hire.name))}</h1>
            <p class="lead">${
              !day1Window(hire)
                ? esc(greeting)
                : stats.dayN === 0
                  ? "Welcome to MangoApps! Here's what to expect today."
                  : `Your first day is ${esc(OB.prettyDate(hire.startDate))}. Here's what to expect.`
            }</p>
          </div>
          ${day1Window(hire) ? day1Card(hire) : ""}
        </section>
        ${journeyStrip(hire)}
        ${tabs}
        ${body}
        <section class="card contacts">
          <h2 class="section-title">Questions?</h2>
          <div class="contact-row">
            ${mgr ? `<div class="contact"><span class="avatar">${initials(mgr.name)}</span><div><strong>${esc(mgr.name)}</strong><span class="muted">Your manager</span></div></div>` : ""}
            <div class="contact"><span class="avatar">SK</span><div><strong>Sarah Kim</strong><span class="muted">HR · paperwork, benefits, policies</span></div></div>
          </div>
        </section>
      </main>`;
  }

  // ---------- MANAGER VIEW ----------
  function hireCard(h, viewerRole) {
    const s = OB.hireStats(h, today());
    return `
      <button class="hire-card" data-action="open-hire" data-hire="${esc(h.id)}">
        <div class="hc-top">
          <span class="avatar">${initials(h.name)}</span>
          <div class="hc-name"><strong>${esc(h.name)}</strong><span class="muted">${esc(h.title)}</span></div>
        </div>
        <div class="chips">${primaryChip(h, s, viewerRole)}</div>
        <div class="muted small">${esc(dayLabel(h))}</div>
        ${bulletGraph(s, { name: h.name })}
        ${catchUpNote(h, s, viewerRole)}
      </button>`;
  }

  // Consecutive to-dos for the same hire share one "For <name>" heading.
  // hideOwner: the list is already "your" to-dos, so the "You" chip is left out.
  function todoItems(items, viewerRole, opts) {
    const o = opts || {};
    const groups = [];
    for (const { t, h } of items) {
      const last = groups[groups.length - 1];
      if (last && last.h.id === h.id) last.ts.push(t);
      else groups.push({ h, ts: [t] });
    }
    return `<ul class="tasks">${groups
      .map(
        ({ h, ts }) => `
          <li class="todo-group">
            <div class="todo-for">For <button class="link" data-action="open-hire" data-hire="${esc(h.id)}">${esc(h.name)}</button></div>
            <ul class="tasks tasks-compact">${ts.map((t) => taskRow(t, h, viewerRole, { compact: true, hideOwner: o.hideOwner })).join("")}</ul>
          </li>`
      )
      .join("")}</ul>`;
  }

  function todoList(items, viewerRole, title, emptyMsg, opts) {
    if (!items.length) return `<section class="card"><h2 class="section-title">${esc(title)}</h2><p class="empty-sm">${esc(emptyMsg)}</p></section>`;
    return `
      <section class="card">
        <h2 class="section-title">${esc(title)}</h2>
        ${todoItems(items, viewerRole, opts)}
      </section>`;
  }

  // ---------- MANAGER: weekly digest, day-before nudge (D3) ----------
  function isHidden(key) {
    const until = reminders().hide[key];
    return !!until && today() < until;
  }

  function managerDigest(v, mine, statsOf, week) {
    const td = today();
    // The day before one of his hires starts, a Day-1 nudge replaces the digest.
    const starting = mine.find((h) => OB.diffDays(h.startDate, td) === 1 && !isHidden(`${v.id}:nudge:${h.id}`));
    if (starting) {
      const d = OB.day1For(starting.department);
      const name = firstName(starting.name);
      const buddy = starting.tasks.find((t) => t.key === "c-buddy");
      const slot = oneOnOneSlot(starting);
      return `
        <section class="banner banner-info nudge" aria-label="Day 1 reminder">
          <span class="banner-ico">${ICON.calendar}</span>
          <div class="banner-body">
            <p class="banner-title">${esc(name)} starts tomorrow. 4 things for Day 1:</p>
            <ol class="nudge-list">
              <li>Welcome ${esc(name)} at ${esc(OB.fmtTime(d.time))} · ${esc(d.place)}</li>
              <li>Introduce ${esc(name)} to the team</li>
              <li>Book a recurring 1:1 <span class="muted">(first one ${esc(OB.fmtTime(slot.start))}, after lunch)</span></li>
              <li>Check the buddy is set${buddy && buddy.done ? ` <span class="cap-ok">✓ done</span>` : ""}</li>
            </ol>
          </div>
          <div class="banner-actions btn-pair">
            <button class="btn btn-sm btn-banner" data-action="add-1on1" data-hire="${esc(starting.id)}">${ICON.calendar} Add 1:1 to calendar</button>
            <button class="btn btn-sm btn-banner primary" data-action="nudge-ok" data-key="${esc(`${v.id}:nudge:${starting.id}`)}">Got it</button>
          </div>
        </section>`;
    }
    const key = `${v.id}:digest`;
    if (isHidden(key)) return "";
    // Same number as the strip total and the list under it (OB.rollingWeek).
    const forYou = week.total;
    // Two facts at most: your to-dos, then who starts soonest (or, if nobody starts this week,
    // the started hire with the most to catch up). Hires who haven't started get no catch-up line.
    const parts = [forYou ? `${forYou} to-do${forYou === 1 ? "" : "s"} for you` : "nothing due from you"];
    const next = mine.find((h) => OB.diffDays(h.startDate, td) >= 0 && OB.diffDays(h.startDate, td) <= 6);
    if (next) {
      const n = OB.diffDays(next.startDate, td);
      parts.push(`${firstName(next.name)} starts ${n === 0 ? "today" : n === 1 ? "tomorrow" : n <= 6 ? weekdayLong(next.startDate) : shortDate(next.startDate)}`);
    } else {
      const c = mine.filter((h) => statsOf(h).dayN >= 0 && statsOf(h).behind).sort((a, b) => statsOf(b).behind - statsOf(a).behind)[0];
      if (c) parts.push(`${firstName(c.name)} has ${statsOf(c).behind} to catch up`);
    }
    return `
      <section class="banner banner-info digest" aria-label="Next 7 days">
        <span class="banner-ico">${ICON.bell}</span>
        <div class="banner-body"><p class="banner-title">Next 7 days: ${esc(parts.join(" · "))}</p></div>
        <div class="banner-actions btn-pair"><button class="btn btn-sm btn-banner primary" data-action="digest-ok" data-key="${esc(key)}">Got it</button></div>
      </section>`;
  }

  // Rolling 7 days (today + the next 6): each day shows one number, the manager's to-dos on that day
  // (anything past its date counts on today). The strip, the list under it, the digest and the header all
  // read the same OB.rollingWeek result, so their numbers always agree (F1). Later items sit under a quiet,
  // folded "Later" line with no count. Tap a day to filter the list; tap again (or "clear") to see all 7 days.
  function weekCard(week) {
    const td = today();
    const days = week.days.map((d) => d.date);
    const sel = ui.weekDay && days.includes(ui.weekDay) ? ui.weekDay : null;
    const strip = week.days
      .map(({ date: d, items }) => {
        const n = items.length;
        const words = n ? `${n} to-do${n === 1 ? "" : "s"}` : "nothing due";
        return `<button class="wk-day ${d === td ? "today" : ""} ${d === sel ? "on" : ""}" data-action="week-day" data-day="${d}"
            aria-pressed="${d === sel}" aria-label="${esc(`${OB.prettyDate(d)}${d === td ? " (today)" : ""}: ${words}`)}">
            <span class="wk-name">${d === td ? "Today" : esc(weekdayShort(d))}</span>
            <span class="wk-count">${n || ""}</span></button>`;
      })
      .join("");
    const items = sel ? week.days.find((d) => d.date === sel).items : week.items;
    const list = items.length
      ? todoItems(items, "manager", { hideOwner: true })
      : `<p class="empty-sm">${sel ? `Nothing due from you on ${esc(weekdayShort(sel))}.` : "Nothing due from you in the next 7 days."}</p>`;
    const later =
      !sel && week.later.length
        ? `<details class="wk-later" data-fold="wk-later" ${ui.folds["wk-later"] ? "open" : ""}><summary>Later</summary>${todoItems(week.later, "manager", { hideOwner: true })}</details>`
        : "";
    return `
      <section class="card week">
        <h2 class="section-title">Your to-dos, next 7 days</h2>
        <div class="wk-strip" role="group" aria-label="Today and the next 6 days. Tap a day to see its to-dos.">${strip}</div>
        ${sel ? `<p class="wk-showing">Showing ${esc(OB.prettyDate(sel))} · <button class="link link-pad" data-action="week-day" data-day="">clear</button></p>` : ""}
        ${list}
        ${later}
      </section>`;
  }

  function renderManager(v) {
    if (ui.detailId && hireById(ui.detailId)) return renderDetail(hireById(ui.detailId), v);
    const td = today();
    const mine = state.hires.filter((h) => h.managerId === v.id).sort((a, b) => a.startDate.localeCompare(b.startDate));
    const statsMap = new Map(mine.map((h) => [h.id, OB.hireStats(h, td)]));
    const statsOf = (h) => statsMap.get(h.id);
    const todos = [];
    for (const h of mine) for (const t of h.tasks) if (t.owner === "manager" && !t.done) todos.push({ t, h });
    todos.sort((a, b) => a.t.dueDate.localeCompare(b.t.dueDate));
    const week = OB.rollingWeek(todos, td);
    const forYou = week.total;
    // Catch-up counts only for hires who have started.
    const catchUp = mine.filter((h) => statsOf(h).dayN >= 0 && statsOf(h).behind).map((h) => `${firstName(h.name)} has ${statsOf(h).behind} to catch up`);
    const top = mine.length ? managerDigest(v, mine, statsOf, week) : "";
    // While the digest is showing, the header doesn't repeat what it says.
    const digestShown = top.includes("banner-info digest");
    const lead = mine.length
      ? [
          `${mine.length} ${mine.length === 1 ? "person" : "people"} onboarding`,
          forYou && !digestShown ? `<strong class="lead-owe">${forYou} to-do${forYou === 1 ? "" : "s"} for you</strong>` : "",
          ...catchUp.filter((x) => !(digestShown && top.includes(esc(x)))).map(esc),
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

    return `
      <main class="wrap">
        <section class="page-head">
          <h1>Your new hires</h1>
          <p class="lead">${lead}</p>
        </section>
        ${
          mine.length
            ? `${top}
               ${weekCard(week)}
               <h2 class="section-title grid-title">People onboarding</h2>
               ${bulletKey()}
               <div class="grid">${mine.map((h) => hireCard(h, "manager")).join("")}</div>`
            : `<div class="card empty"><div class="empty-icon" aria-hidden="true">👋</div><h3>No one is onboarding on your team right now</h3><p>When HR adds a new hire who reports to you, they'll show up here with their plan.</p></div>`
        }
      </main>`;
  }

  // ---------- HIRE DETAIL (manager + HR) ----------
  function renderDetail(hire, v) {
    const td = today();
    const s = OB.hireStats(hire, td);
    const role = v.role;
    const canEdit = role === "hr" || (role === "manager" && hire.managerId === v.id);
    const backLabel = role === "hr" ? "All new hires" : "Your new hires";
    const tf = ui.taskForm;
    const te = ui.taskErrors;
    const minDue = OB.addDays(hire.startDate, -30);
    const maxDue = OB.addDays(hire.startDate, 27);

    const form = tf
      ? `
        <form class="card form" id="task-form" novalidate>
          <h2 class="section-title">Add a task for ${esc(firstName(hire.name))}</h2>
          <p class="muted">For things specific to this person or your team that aren't in the department plan.</p>
          <div class="row">
            <label class="field grow ${te.title ? "has-err" : ""}"><span>Task</span>
              <input name="title" maxlength="140" value="${esc(tf.title)}" placeholder="e.g. Read the Q3 roadmap doc" />
              ${te.title ? `<small class="err">${esc(te.title)}</small>` : ""}</label>
          </div>
          <div class="row">
            <label class="field ${te.owner ? "has-err" : ""}"><span>Who does it</span>
              <select name="owner">
                ${["newhire", "manager", "it", "hr"].map((o) => `<option value="${o}" ${tf.owner === o ? "selected" : ""}>${o === "newhire" ? esc(hire.name) : o === "manager" ? `${esc(personName(hire.managerId))} (manager)` : OB.OWNERS[o]}</option>`).join("")}
              </select></label>
            <label class="field ${te.dueDate ? "has-err" : ""}"><span>Due</span>
              <input type="date" name="dueDate" value="${esc(tf.dueDate)}" min="${minDue}" max="${maxDue}" />
              ${te.dueDate ? `<small class="err">${esc(te.dueDate)}</small>` : ""}</label>
          </div>
          <label class="field"><span>Details (optional)</span><input name="desc" maxlength="240" value="${esc(tf.desc)}" /></label>
          <div class="actions"><button type="submit" class="btn primary">Add task</button><button type="button" class="btn" data-action="cancel-task">Cancel</button></div>
        </form>`
      : "";

    return `
      <main class="wrap">
        <button class="link back" data-action="close-hire">← ${backLabel}</button>
        <section class="hero hero-detail">
          <div class="hd-left">
            <span class="avatar lg">${initials(hire.name)}</span>
            <div>
              <h1>${esc(hire.name)}</h1>
              <p class="lead">${esc(hire.title)} · ${esc(hire.department)} · reports to ${esc(personName(hire.managerId))}</p>
              <p class="muted">${esc(dayLabel(hire))}</p>
            </div>
          </div>
          <div class="hero-progress">
            ${statusChips(hire, s, role)}
            ${bulletGraph(s, { name: hire.name, noText: true })}
          </div>
        </section>
        ${phaseStepper(hire, s)}
        ${
          s.overdue.length
            ? `<section class="card warn"><h2 class="section-title">Past their date</h2><ul class="tasks tasks-compact">${OB.sortTasks(s.overdue).map((t) => taskRow(t, hire, role, { compact: true, showSource: true })).join("")}</ul></section>`
            : ""
        }
        <div class="toolbar">
          <h2 class="section-title inline">Full plan</h2>
          <div class="toolbar-actions">
            ${canEdit && !tf ? `<button class="btn" data-action="new-task" data-hire="${esc(hire.id)}">+ Add a task</button>` : ""}
            <button class="btn" data-action="view-as" data-hire="${esc(hire.id)}">See what ${esc(firstName(hire.name))} sees</button>
            ${role === "hr" ? `<button class="btn danger" data-action="delete-hire" data-hire="${esc(hire.id)}">Remove</button>` : ""}
          </div>
        </div>
        ${form}
        ${phaseSections(hire, role, { currentOnly: true, skipIds: new Set(s.overdue.map((t) => t.id)), showSource: true, canRemove: canEdit })}
        <p class="muted small legend">You can tick off tasks assigned to ${role === "hr" ? "HR and IT" : "you"}. Other tasks are completed by the person they're assigned to.</p>
      </main>`;
  }

  // ---------- HR VIEW ----------
  function renderHR(v) {
    if (ui.detailId && hireById(ui.detailId)) return renderDetail(hireById(ui.detailId), v);
    const tabs = `
      <div class="tabs" role="tablist">
        ${[
          // Long and short labels: the short ones show on narrow phones so all three tabs fit.
          ["hires", "New hires", "Hires"],
          ["add", "+ Add new hire", "+ Add"],
          ["templates", "Plan templates", "Templates"],
        ]
          .map(([id, l, sh]) => `<button role="tab" aria-selected="${ui.hrTab === id}" class="${ui.hrTab === id ? "on" : ""}" data-action="hr-tab" data-tab="${id}" aria-label="${l}"><span class="t-long">${l}</span><span class="t-short" aria-hidden="true">${sh}</span></button>`)
          .join("")}
      </div>`;
    let body;
    if (ui.hrTab === "add") body = renderAddHire();
    else if (ui.hrTab === "templates") body = renderTemplates();
    else body = renderHireTable();
    return `<main class="wrap"><section class="page-head"><h1>Onboarding</h1><p class="lead">Everyone joining MangoApps in their first four weeks.</p></section>${tabs}${body}</main>`;
  }

  // ---------- HR: cohort timeline (S1, simplified) ----------
  // One idea: "where is everyone in their onboarding?" One row per hire: a grey bar for their plan window
  // (a week before start to the end of week 4), filled blue up to Today (time elapsed), one Today line, one
  // status chip. "How much is done" lives in the table's bar, not here.
  const TL = { from: -14, to: 28 };
  const tlX = (d) => `${(((Math.max(TL.from, Math.min(TL.to, d)) - TL.from) / (TL.to - TL.from)) * 100).toFixed(2)}%`;
  const tlTodayLine = (y1, y2) => `<svg x="${tlX(0)}" y="0" overflow="visible"><rect class="tl-today" x="-1" y="${y1}" width="2" height="${y2 - y1}"/></svg>`;

  function cohortTimeline(rows) {
    const td = today();
    const all = rows.filter((r) => r.s.dayN <= 27 && r.s.dayN >= -(TL.to + 7)).sort((a, b) => a.h.startDate.localeCompare(b.h.startDate));
    if (!all.length) return "";
    const shown = all.slice(0, 15);
    const tick = (d, anchor) => `<text x="${tlX(d)}" y="14" class="tl-tick" text-anchor="${anchor}">${esc(shortDate(OB.addDays(td, d)))}</text>`;
    const axis = `
      <div class="tl-row tl-axis" aria-hidden="true"><span></span>
        <svg width="100%" height="24" focusable="false">${tick(TL.from, "start")}${tick(14, "middle")}${tick(TL.to, "end")}
          <text x="${tlX(0)}" y="14" class="tl-tick tl-today-lbl" text-anchor="middle">Today</text>${tlTodayLine(18, 24)}</svg><span></span></div>`;
    const rowsHtml = shown
      .map(({ h, s }) => {
        const s0 = OB.diffDays(h.startDate, td) - 7;
        const s1 = s0 + 34;
        // Time elapsed, not tasks done: filled from the window start up to Today. Not started yet = unfilled (F4).
        const fillEnd = s.dayN < 0 ? s0 : Math.min(0, s1);
        const seg = (a, b, cls) => {
          const x0 = parseFloat(tlX(a));
          const x1 = parseFloat(tlX(b));
          return x1 > x0 ? `<rect class="${cls}" x="${x0}%" y="15" width="${(x1 - x0).toFixed(2)}%" height="10" rx="5"/>` : "";
        };
        return `
          <div class="tl-row">
            <button class="tl-name" data-action="open-hire" data-hire="${esc(h.id)}"><strong>${esc(h.name)}</strong><span>${esc(h.department)}</span></button>
            <svg width="100%" height="40" aria-hidden="true" focusable="false">${seg(s0, s1, "tl-band")}${seg(s0, fillEnd, "tl-done")}${tlTodayLine(0, 40)}</svg>
            <span class="tl-chip">${primaryChip(h, s, "hr")}</span>
          </div>`;
      })
      .join("");
    const summary = shown
      .map(({ h, s }) => `${h.name}, ${h.department}: ${dayLabel(h)}, ${primaryWord(h, s, "hr")}.`)
      .join(" ");
    return `
      <section class="card timeline">
        <h2 class="section-title">Where everyone is</h2>
        <p class="sr-only">${esc(summary)}</p>
        <div class="tl">${axis}${rowsHtml}</div>
        ${all.length > shown.length ? `<p class="muted small">Showing the first 15 of ${all.length}. Use the department filter to narrow it down.</p>` : ""}
      </section>`;
  }

  // KPI tiles double as filters (tap again to show everyone).
  const KPI = {
    owe: { label: "Manager to-dos", test: (r) => r.s.youOwe > 0, kind: "action" },
    behind: { label: "Hires catching up", test: (r) => r.s.behind > 0, kind: "behind" },
    soon: { label: "Starting soon", test: (r) => r.s.dayN < 0 && r.s.dayN >= -14, kind: "upcoming" },
  };

  // "With IT" as a short line, only when IT/HR tasks are past their date and the chip doesn't already say so.
  function waitingNote(s) {
    if (!(s.waitingIt || s.waitingHr) || s.status === "waiting") return "";
    return `<div class="muted small wait-note">With ${[s.waitingIt && "IT", s.waitingHr && "HR"].filter(Boolean).join(" & ")}</div>`;
  }

  function renderHireTable() {
    const td = today();
    const rows = state.hires
      .map((h) => ({ h, s: OB.hireStats(h, td) }))
      // Most behind first (most overdue), then soonest start.
      .sort((a, b) => b.s.overdue.length - a.s.overdue.length || a.h.startDate.localeCompare(b.h.startDate));
    const kpi = KPI[ui.hrKpi] ? ui.hrKpi : "all";
    const deptRows = rows.filter((r) => ui.hrFilterDept === "all" || r.h.department === ui.hrFilterDept);
    const filtered = deptRows.filter((r) => (ui.hrFilterStatus === "all" || r.s.status === ui.hrFilterStatus) && (kpi === "all" || KPI[kpi].test(r)));
    const tiles = Object.entries(KPI)
      .map(([id, k]) => {
        const n = rows.filter(k.test).length;
        const on = id === kpi;
        return `<button class="stat ${on ? "on" : ""} ${n ? `stat-${k.kind}` : ""}" data-action="hr-kpi" data-kpi="${id}" aria-pressed="${on}">
            <span class="stat-num">${n}${n ? ICON[k.kind] : ""}</span><span class="stat-lbl">${esc(k.label)}</span></button>`;
      })
      .join("");
    const todos = [];
    for (const h of state.hires) for (const t of h.tasks) if ((t.owner === "hr" || t.owner === "it") && !t.done && t.dueDate <= OB.addDays(td, 7)) todos.push({ t, h });
    todos.sort((a, b) => a.t.dueDate.localeCompare(b.t.dueDate));

    const sel = (name, val, opts) =>
      `<select data-filter="${name}" aria-label="Filter by ${name}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${val === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;

    return `
      <div class="stats stats-kpi" role="group" aria-label="Filter new hires">${tiles}</div>
      ${cohortTimeline(filtered)}
      <section class="card">
        <div class="toolbar">
          <h2 class="section-title inline">New hires</h2>
          <div class="toolbar-actions">
            ${sel("dept", ui.hrFilterDept, [["all", "All departments"], ...OB.DEPARTMENTS.map((d) => [d, d])])}
            ${sel("status", ui.hrFilterStatus, [["all", "Any status"], ...Object.entries(OB.STATUS_LABEL)])}
          </div>
        </div>
        ${kpi !== "all" ? `<p class="kpi-showing">Showing: ${esc(KPI[kpi].label.toLowerCase())} · <button class="link link-pad" data-action="hr-kpi" data-kpi="all">show all</button></p>` : ""}
        ${
          !state.hires.length
            ? `<div class="empty"><h3>No new hires yet</h3><p>Add someone to generate their onboarding plan.</p><button class="btn primary" data-action="hr-tab" data-tab="add">+ Add new hire</button></div>`
            : !filtered.length
              ? `<div class="empty"><p>No new hires match these filters.</p><button class="link" data-action="clear-filters">Clear filters</button></div>`
              : `${bulletKey()}<div class="table-wrap"><table class="table table-hires">
                  <thead><tr><th>Name</th><th>Team</th><th>Start</th><th>Progress</th><th>Status</th></tr></thead>
                  <tbody>${filtered
                    .map(
                      ({ h, s }) => `
                    <tr data-action="open-hire" data-hire="${esc(h.id)}" tabindex="0">
                      <td class="td-name"><strong>${esc(h.name)}</strong><div class="muted small">${esc(h.title)}</div></td>
                      <td class="td-team">${esc(h.department)}<div class="muted small">${esc(personName(h.managerId))}</div></td>
                      <td class="td-start">${esc(shortDate(h.startDate))}<div class="muted small">${esc(weekdayShort(h.startDate))} · ${s.dayN < 0 ? `in ${-s.dayN}d` : s.dayN > 27 ? "done" : `day ${s.dayN + 1}`}</div></td>
                      <td class="td-prog">${bulletGraph(s, { name: h.name })}${catchUpNote(h, s, "hr")}</td>
                      <td class="td-status">${primaryChip(h, s, "hr")}${waitingNote(s)}</td>
                    </tr>`
                    )
                    .join("")}</tbody></table></div>`
        }
      </section>
      ${todoList(todos, "hr", "HR & IT to-dos this week", "No HR or IT tasks due in the next 7 days.")}`;
  }

  function defaultDraft() {
    return { name: "", title: "", department: "", managerId: "", startDate: OB.addDays(today(), 14) };
  }

  function renderAddHire() {
    const d = ui.draft || (ui.draft = defaultDraft());
    const e = ui.draftErrors;
    const mgrs = OB.PEOPLE.filter((p) => p.role === "manager");
    const field = (name, label, input) =>
      `<label class="field ${e[name] ? "has-err" : ""}"><span>${label}</span>${input}${e[name] ? `<small class="err">${esc(e[name])}</small>` : ""}</label>`;

    let preview = "";
    if (ui.preview) {
      const p = ui.preview;
      const included = p.tasks.filter((t) => !p.skip.has(t.key)).length;
      preview = `
        <section class="card" id="preview">
          <h2 class="section-title">Generated plan for ${esc(d.name.trim())}</h2>
          <p class="muted">Company tasks plus ${esc(d.department)} tasks, with due dates worked out from the start date. Untick anything that doesn't apply to this person.</p>
          ${OB.PHASES.map((ph) => {
            const ts = p.tasks.filter((t) => t.phase === ph.id);
            return `<h3 class="ph-h">${esc(ph.label)}</h3><ul class="preview-list">${ts
              .map(
                (t) => `<li><label><input type="checkbox" data-preview="${esc(t.key)}" ${p.skip.has(t.key) ? "" : "checked"} />
                  <span>${esc(t.title)}</span>
                  <span class="chip chip-${t.owner}">${t.owner === "newhire" ? "New hire" : OB.OWNERS[t.owner]}</span>
                  ${t.source !== "Company" ? `<span class="chip chip-src">${esc(t.source)}</span>` : ""}
                  <span class="muted small">${esc(OB.prettyDate(t.dueDate))}</span></label></li>`
              )
              .join("")}</ul>`;
          }).join("")}
          <div class="actions sticky-actions">
            <button class="btn primary" data-action="create-hire" ${included ? "" : "disabled"}>Create plan with ${included} tasks</button>
            <button class="btn" data-action="cancel-preview">Back to edit</button>
          </div>
          ${included ? "" : `<p class="err">Keep at least one task in the plan.</p>`}
        </section>`;
    }

    return `
      <form class="card form" id="hire-form" novalidate>
        <h2 class="section-title">Add a new hire</h2>
        <p class="muted">Their onboarding plan is built automatically from their department. You can adjust it before saving.</p>
        <div class="row">
          ${field("name", "Full name", `<input name="name" maxlength="90" value="${esc(d.name)}" autocomplete="off" ${ui.preview ? "disabled" : ""} />`)}
          ${field("title", "Job title", `<input name="title" maxlength="90" value="${esc(d.title)}" autocomplete="off" ${ui.preview ? "disabled" : ""} />`)}
        </div>
        <div class="row">
          ${field("department", "Department", `<select name="department" ${ui.preview ? "disabled" : ""}><option value="">Choose…</option>${OB.DEPARTMENTS.map((x) => `<option ${d.department === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`)}
          ${field("managerId", "Manager", `<select name="managerId" ${ui.preview ? "disabled" : ""}><option value="">Choose…</option>${mgrs.map((m) => `<option value="${m.id}" ${d.managerId === m.id ? "selected" : ""}>${esc(m.name)} · ${esc(m.department)}</option>`).join("")}</select>`)}
          ${field("startDate", "Start date", `<input type="date" name="startDate" value="${esc(d.startDate)}" ${ui.preview ? "disabled" : ""} />`)}
        </div>
        ${ui.draftWarnings.length ? `<ul class="warnings">${ui.draftWarnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
        ${ui.preview ? "" : `<div class="actions"><button type="submit" class="btn primary">Preview plan</button></div>`}
      </form>
      ${preview}`;
  }

  // ---------- HR: plan templates (U3) ----------
  // HR edits the Company template and each department's template. Edits apply to new plans only:
  // a hire's plan is a copy made when they were added, so people already onboarding keep theirs.
  const TPL_NAMES = () => ["Company", ...OB.DEPARTMENTS];
  const TPL_OWNERS = [
    ["newhire", "New hire"],
    ["manager", "Manager"],
    ["it", "IT"],
    ["hr", "HR"],
  ];
  const tplOwnerLabel = (o) => (TPL_OWNERS.find(([k]) => k === o) || [o, o])[1];
  const tplEdited = (name) => Array.isArray((state.templates || {})[name]) && OB.templateIsEdited(state.templates[name], OB.TEMPLATES[name]);
  const tplCurrent = () => (TPL_NAMES().includes(ui.tplName) ? ui.tplName : "Company");

  function tplDraftFrom(t) {
    const tm = OB.offsetToTiming(t.dayOffset);
    return {
      title: t.title || "", desc: t.desc || "", owner: t.owner || "newhire", n: String(tm.n), mode: tm.mode,
      isEvent: !!t.isEvent, hireTitle: t.hireTitle || "", hireDesc: t.hireDesc || "",
    };
  }
  function tplInput(d) {
    return { ...d, dayOffset: OB.timingToOffset(d.n, d.mode) };
  }
  // "Due Day 3 · Week 1" under the timing picker, so HR can see where the task lands.
  function tplWhenHint(d) {
    const o = OB.timingToOffset(d.n, d.mode);
    if (Number.isInteger(o) && Number(d.n) < 1) return d.mode === "day" ? "Day 1 is the first day." : "Pick 1 or more days before start.";
    if (!Number.isInteger(o) || o < OB.TPL_MIN_OFFSET || o > OB.TPL_MAX_OFFSET) return "Between 30 days before start and Day 28.";
    const ph = OB.PHASES.find((p) => p.id === OB.phaseForOffset(o));
    return `Shows as: ${OB.timingLabel(o)} · ${ph ? ph.label : ""}`;
  }
  function tplWarnings(name, key, d) {
    const siblings = templates()[name].filter((t) => t.key !== key);
    return OB.validateTemplateTask(tplInput(d), siblings).warnings;
  }
  // Live hints while typing, without a full re-render (keeps the cursor where it is).
  function tplLiveHints() {
    const e = ui.tplEdit;
    if (!e) return;
    const hint = document.getElementById("tpl-when-hint");
    if (hint) hint.textContent = tplWhenHint(e.draft);
    const warn = document.getElementById("tpl-warn");
    if (warn) warn.textContent = tplWarnText(e);
    const submit = document.getElementById("tpl-submit");
    if (submit) submit.textContent = tplSubmitLabel(e);
  }
  // Duplicate name (F5): the first Save shows the warning under the title and turns the button into
  // "Save anyway"; a second Save with the same name saves. Changing the name resets this.
  const tplTitleKey = (d) => (d.title || "").trim().toLowerCase();
  const tplDupAsked = (e) => !!e.dupAsked && e.dupAsked === tplTitleKey(e.draft) && tplWarnings(e.name, e.key, e.draft).length > 0;
  const tplWarnText = (e) => {
    const w = tplWarnings(e.name, e.key, e.draft).join(" ");
    return w && tplDupAsked(e) ? `${w} Select “Save anyway” to keep both.` : w;
  };
  const tplSubmitLabel = (e) => (tplDupAsked(e) ? "Save anyway" : e.key ? "Save changes" : "Add task");

  function tplForm(name) {
    const e = ui.tplEdit;
    const d = e.draft;
    const er = ui.tplErrors || {};
    const errMsg = (k) => (er[k] ? `<small class="err">${esc(er[k])}</small>` : "");
    const warn = tplWarnText(e);
    const maxN = d.mode === "before" ? 30 : 28;
    return `
      <form class="tpl-form form" id="tpl-form" novalidate aria-label="${e.key ? "Edit task" : "New task"}">
        <h3 class="tpl-form-title">${e.key ? "Edit task" : `New task for ${esc(name === "Company" ? "everyone" : name)}`}</h3>
        <label class="field ${er.title ? "has-err" : ""}"><span>Task name</span>
          <input id="tpl-title" name="title" maxlength="130" value="${esc(d.title)}" autocomplete="off" placeholder="e.g. Meet your onboarding buddy" />
          ${errMsg("title")}</label>
        <p class="tpl-warn" id="tpl-warn" role="status">${esc(warn)}</p>
        <label class="field ${er.desc ? "has-err" : ""}"><span>Description <span class="opt">(optional)</span></span>
          <textarea name="desc" rows="2" maxlength="250">${esc(d.desc)}</textarea>${errMsg("desc")}</label>
        <div class="row">
          <label class="field ${er.owner ? "has-err" : ""}"><span>Who does it</span>
            <select id="tpl-owner" name="owner">${TPL_OWNERS.map(([k, l]) => `<option value="${k}" ${d.owner === k ? "selected" : ""}>${l}</option>`).join("")}</select>
            ${errMsg("owner")}</label>
          <fieldset class="field tpl-timing ${er.dayOffset ? "has-err" : ""}">
            <legend>When</legend>
            <div class="tpl-timing-row">
              <input id="tpl-n" name="n" type="number" inputmode="numeric" min="1" max="${maxN}" step="1" value="${esc(d.n)}" aria-label="Number of days" />
              <select id="tpl-mode" name="mode" aria-label="Before start or on the job">
                <option value="before" ${d.mode === "before" ? "selected" : ""}>days before start</option>
                <option value="day" ${d.mode === "day" ? "selected" : ""}>day of the job</option>
              </select>
            </div>
            <small class="muted" id="tpl-when-hint">${esc(tplWhenHint(d))}</small>
            ${errMsg("dayOffset")}
          </fieldset>
        </div>
        <label class="check-line"><input id="tpl-event" type="checkbox" name="isEvent" ${d.isEvent ? "checked" : ""} /> This is a meeting or event</label>
        ${
          d.owner !== "newhire"
            ? `<fieldset class="tpl-hireview">
                <legend>How the new hire sees it <span class="opt">(optional)</span></legend>
                <p class="muted small">Shown in the new hire's "Being handled for you" list. Leave blank to use the task name.</p>
                <label class="field ${er.hireTitle ? "has-err" : ""}"><span>Title for the new hire</span>
                  <input name="hireTitle" maxlength="130" value="${esc(d.hireTitle)}" autocomplete="off" placeholder="e.g. Your laptop is shipped to your home" />${errMsg("hireTitle")}</label>
                <label class="field ${er.hireDesc ? "has-err" : ""}"><span>Description for the new hire</span>
                  <input name="hireDesc" maxlength="250" value="${esc(d.hireDesc)}" autocomplete="off" />${errMsg("hireDesc")}</label>
              </fieldset>`
            : ""
        }
        <div class="actions">
          <button type="submit" class="btn primary" id="tpl-submit">${esc(tplSubmitLabel(e))}</button>
          <button type="button" class="btn" data-action="tpl-cancel">Cancel</button>
        </div>
      </form>`;
  }

  function tplRow(name, t) {
    if (ui.tplEdit && ui.tplEdit.name === name && ui.tplEdit.key === t.key) return `<li class="tpl-task editing">${tplForm(name)}</li>`;
    return `
      <li class="tpl-task">
        <div class="tpl-main">
          <span class="tpl-title">${esc(t.title)}</span>
          ${t.desc ? `<p class="task-desc">${esc(t.desc)}</p>` : ""}
          <div class="task-meta">
            <span class="tpl-when">${ICON.calendar}${esc(OB.timingLabel(t.dayOffset))}</span>
            <span class="chip chip-${t.owner}">${esc(tplOwnerLabel(t.owner))}</span>
            ${t.isEvent ? `<span class="chip chip-src">Meeting</span>` : ""}
          </div>
        </div>
        <div class="tpl-actions">
          <button class="btn btn-sm btn-quiet" data-action="tpl-edit" data-key="${esc(t.key)}" aria-label="Edit '${esc(t.title)}'">Edit</button>
          <button class="btn btn-sm btn-quiet" data-action="tpl-remove" data-key="${esc(t.key)}" aria-label="Remove '${esc(t.title)}'">Remove</button>
        </div>
      </li>`;
  }

  function renderTemplates() {
    const name = tplCurrent();
    const tasks = templates()[name] || [];
    const edited = tplEdited(name);
    const picker = `
      <div class="tpl-picker" role="group" aria-label="Choose a template">
        ${TPL_NAMES()
          .map(
            (n) => `<button class="tpl-pick ${n === name ? "on" : ""}" data-action="tpl-pick" data-tpl="${esc(n)}" aria-pressed="${n === name}">
              ${esc(n)}${tplEdited(n) ? `<span class="tpl-edited">Edited</span>` : ""}</button>`
          )
          .join("")}
      </div>`;
    const adding = ui.tplEdit && ui.tplEdit.name === name && !ui.tplEdit.key;
    const phases = OB.PHASES.map((ph) => {
      const ts = tasks
        .filter((t) => OB.phaseForOffset(t.dayOffset) === ph.id)
        .sort((a, b) => a.dayOffset - b.dayOffset || a.title.localeCompare(b.title));
      if (!ts.length) return "";
      return `<h3 class="ph-h">${esc(ph.label)}</h3><ul class="tpl-list">${ts.map((t) => tplRow(name, t)).join("")}</ul>`;
    }).join("");
    const who = name === "Company" ? "Every new hire gets these tasks." : `New ${name} hires get these tasks plus the Company tasks.`;
    return `
      <div class="tpl-note" role="note">
        <span class="banner-ico">${ICON.bell}</span>
        <p><strong>Changes apply to new hires you add from now on.</strong> People already onboarding keep their current plan.</p>
      </div>
      <p class="muted">Every plan = <strong>Company</strong> tasks + the person's <strong>department</strong> tasks. Managers can still add one-off tasks to a single person's plan.</p>
      ${picker}
      <section class="card tpl-card">
        <div class="tpl-head">
          <div>
            <h2 class="section-title">${esc(name === "Company" ? "Company (everyone)" : name)}${edited ? ` <span class="tpl-edited">Edited</span>` : ""}</h2>
            <p class="muted small">${esc(who)} ${tasks.length} task${tasks.length === 1 ? "" : "s"}.</p>
          </div>
          <div class="toolbar-actions">
            ${edited ? `<button class="btn btn-quiet" data-action="tpl-reset">Reset to original</button>` : ""}
            ${adding ? "" : `<button class="btn" data-action="tpl-add">+ Add task</button>`}
          </div>
        </div>
        ${adding ? tplForm(name) : ""}
        ${tasks.length ? phases : `<p class="empty-sm">No tasks in this template. New ${esc(name)} hires get only the Company tasks.</p>`}
      </section>`;
  }

  function setTemplate(name, list) {
    if (!state.templates || typeof state.templates !== "object") state.templates = {};
    if (OB.templateIsEdited(list, OB.TEMPLATES[name])) state.templates[name] = list;
    else delete state.templates[name];
  }

  function saveTemplateTask(form) {
    const e = ui.tplEdit;
    if (!e || viewer().role !== "hr") return;
    for (const el of form.elements) if (el.name) e.draft[el.name] = el.type === "checkbox" ? el.checked : el.value;
    const list = templates()[e.name];
    const input = tplInput(e.draft);
    const r = OB.validateTemplateTask(input, list.filter((t) => t.key !== e.key));
    ui.tplErrors = r.errors;
    if (!r.ok) {
      render();
      const first = document.querySelector("#tpl-form .has-err input, #tpl-form .has-err select, #tpl-form .has-err textarea");
      if (first) first.focus();
      return;
    }
    // Duplicate name: first Save shows the warning and asks again ("Save anyway"); the second Save goes ahead.
    if (r.warnings.length && !tplDupAsked(e)) {
      e.dupAsked = tplTitleKey(e.draft);
      render();
      document.getElementById("tpl-title")?.focus();
      return;
    }
    const task = OB.makeTemplateTask(input, e.key || OB.newTemplateKey(templates()));
    const next = e.key ? list.map((t) => (t.key === e.key ? task : t)) : list.concat(task);
    setTemplate(e.name, next);
    ui.tplEdit = null;
    ui.tplErrors = {};
    toast(`${e.key ? "Saved" : "Added"}: ${task.title}. New ${e.name === "Company" ? "" : `${e.name} `}hires get this from now on.`);
    commit();
  }

  function templateAction(a, el) {
    if (viewer().role !== "hr") return;
    const name = tplCurrent();
    const list = templates()[name];
    // Undo for a removal is only valid until the next template action (or until the toast goes) (F10).
    if (a !== "tpl-undo") clearUndo();
    if (a === "tpl-undo") {
      const u = ui.undo;
      if (!u) return;
      clearUndo();
      setTemplate(u.name, u.list);
      ui.tplName = u.name;
      toast(`Put back: ${u.title}`);
      return commit();
    }
    if (a === "tpl-pick") {
      ui.tplName = el.dataset.tpl;
      ui.tplEdit = null;
      ui.tplErrors = {};
      return render();
    }
    if (a === "tpl-add" || a === "tpl-edit") {
      const t = a === "tpl-edit" ? list.find((x) => x.key === el.dataset.key) : { title: "", owner: "newhire", dayOffset: 0 };
      if (!t) return;
      ui.tplEdit = { name, key: a === "tpl-edit" ? t.key : null, draft: tplDraftFrom(t) };
      ui.tplErrors = {};
      render();
      document.getElementById("tpl-title")?.focus();
      return;
    }
    if (a === "tpl-cancel") {
      ui.tplEdit = null;
      ui.tplErrors = {};
      return render();
    }
    if (a === "tpl-remove") {
      const t = list.find((x) => x.key === el.dataset.key);
      if (!t) return;
      const rule = OB.removeTaskRule(name, list);
      if (rule === "blocked") return toast("The Company template needs at least one task. Edit this one instead.");
      if (rule === "confirm" && !confirm(`Remove the last task from ${name}? New ${name} hires would get only the Company tasks.`)) return;
      setTemplate(name, list.filter((x) => x.key !== t.key));
      if (ui.tplEdit && ui.tplEdit.key === t.key) ui.tplEdit = null;
      ui.undo = { name, list, title: t.title };
      toast(`Removed from ${name}: ${t.title}`, { label: "Undo", action: "tpl-undo" });
      return commit();
    }
    if (a === "tpl-reset") {
      if (!confirm(`Reset the ${name} template to its original tasks? Your changes to it will be lost. People already onboarding keep their current plan.`)) return;
      if (state.templates) delete state.templates[name];
      ui.tplEdit = null;
      toast(`${name} template is back to its original tasks.`);
      return commit();
    }
  }

  // ---------- main render ----------
  function render() {
    const v = viewer();
    if (v.id !== state.viewerId) state.viewerId = v.id;
    let main;
    if (v.role === "newhire") main = renderNewHire(hireById(v.id));
    else if (v.role === "manager") main = renderManager(v);
    else main = renderHR(v);

    const active = document.activeElement;
    const focusKey = active && (active.dataset.toggle || active.dataset.preview || active.id);
    // Week-strip days and KPI tiles keep keyboard focus across the re-render.
    const focusSel =
      active && active.dataset && active.dataset.action === "week-day" && active.dataset.day
        ? `[data-action="week-day"][data-day="${CSS.escape(active.dataset.day)}"]`
        : active && active.dataset && active.dataset.action === "hr-kpi" && active.classList.contains("stat")
          ? `.stat[data-kpi="${CSS.escape(active.dataset.kpi)}"]`
          : null;

    document.getElementById("app").innerHTML = `
      ${renderHeader()}
      ${main}
      <footer class="foot">
        Prototype with mock data, saved in this browser only.
        <button class="link" data-action="reset">Reset demo data</button>
      </footer>
      ${ui.toast ? `<div class="toast" role="status"><span>${esc(ui.toast)}</span>${ui.toastAct ? `<button class="toast-btn" data-action="${esc(ui.toastAct.action)}">${esc(ui.toastAct.label)}</button>` : ""}</div>` : ""}`;

    if (focusKey) {
      const el =
        document.querySelector(`[data-toggle="${CSS.escape(focusKey)}"]`) ||
        document.querySelector(`[data-preview="${CSS.escape(focusKey)}"]`) ||
        document.getElementById(focusKey);
      if (el) el.focus({ preventScroll: true });
    }
    if (focusSel) document.querySelector(focusSel)?.focus({ preventScroll: true });
  }

  // ---------- actions ----------
  function toggleTask(hireId, taskId, checked) {
    const h = hireById(hireId);
    if (!h) return;
    const t = h.tasks.find((x) => x.id === taskId);
    const v = viewer();
    if (!t || !OB.canComplete(v.role, t)) return;
    t.done = checked;
    t.doneAt = checked ? today() : null;
    t.doneBy = checked ? v.id : null;
    if (checked && v.role === "newhire" && h.tasks.every((x) => x.done)) toast("Onboarding complete. Welcome to MangoApps!");
    else if (checked) toast(`Done: ${t.title}`);
    commit();
  }

  function switchViewer(id) {
    state.viewerId = id;
    ui.detailId = null;
    ui.taskForm = null;
    ui.nhTab = "focus";
    ui.weekDay = null;
    ui.tplEdit = null;
    commit();
    window.scrollTo(0, 0);
  }

  function readForm(form) {
    const o = {};
    for (const el of form.elements) if (el.name) o[el.name] = el.value;
    return o;
  }

  const app = document.getElementById("app");

  app.addEventListener("change", (e) => {
    const el = e.target;
    if (el.id === "viewer-select") return switchViewer(el.value);
    if (el.id === "demo-date") {
      if (OB.isValidISO(el.value)) {
        state.demoToday = el.value === OB.todayISO() ? null : el.value;
        ui.folds = {};
        ui.weekDay = null;
        commit();
      }
      return;
    }
    if (el.dataset.toggle) return toggleTask(el.dataset.hire, el.dataset.toggle, el.checked);
    if (el.form && el.form.id === "tpl-form" && ui.tplEdit && el.name) {
      ui.tplEdit.draft[el.name] = el.type === "checkbox" ? el.checked : el.value;
      // Who does it decides whether the "How the new hire sees it" fields show.
      if (el.name === "owner" || el.name === "mode") render();
      else tplLiveHints();
      return;
    }
    if (el.dataset.filter === "dept") {
      ui.hrFilterDept = el.value;
      return render();
    }
    if (el.dataset.filter === "status") {
      ui.hrFilterStatus = el.value;
      return render();
    }
    if (el.dataset.preview && ui.preview) {
      if (el.checked) ui.preview.skip.delete(el.dataset.preview);
      else ui.preview.skip.add(el.dataset.preview);
      return render();
    }
    if (el.form && el.form.id === "hire-form" && ui.draft) {
      ui.draft[el.name] = el.value;
      // Suggest the department's manager when department changes.
      if (el.name === "department" && !ui.draft.managerId) {
        const m = OB.PEOPLE.find((p) => p.role === "manager" && p.department === el.value);
        if (m) {
          ui.draft.managerId = m.id;
          render();
        }
      }
    }
  });

  app.addEventListener("input", (e) => {
    const el = e.target;
    if (el.form && el.form.id === "hire-form" && ui.draft && el.name) ui.draft[el.name] = el.value;
    if (el.form && el.form.id === "task-form" && ui.taskForm && el.name) ui.taskForm[el.name] = el.value;
    if (el.form && el.form.id === "tpl-form" && ui.tplEdit && el.name && el.type !== "checkbox") {
      ui.tplEdit.draft[el.name] = el.value;
      tplLiveHints();
    }
  });

  app.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.id === "hire-form") {
      ui.draft = { ...ui.draft, ...readForm(form) };
      const r = OB.validateHire(ui.draft, today(), state.hires);
      ui.draftErrors = r.errors;
      ui.draftWarnings = r.warnings;
      if (r.ok) {
        const tpl = templates();
        const built = OB.buildPlan(ui.draft.department, ui.draft.startDate, [], today(), tpl);
        const tasks = OB.templateTasksFor(ui.draft.department, tpl).map((t, i) => ({ ...t, dueDate: built[i].dueDate, phase: built[i].phase }));
        ui.preview = { tasks, skip: new Set() };
      }
      render();
      if (r.ok) document.getElementById("preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      else form.querySelector(".has-err input, .has-err select")?.focus();
    }
    if (form.id === "tpl-form") return saveTemplateTask(form);
    if (form.id === "task-form") {
      const h = hireById(ui.detailId);
      ui.taskForm = { ...ui.taskForm, ...readForm(form) };
      const r = OB.validateCustomTask(ui.taskForm, h);
      ui.taskErrors = r.errors;
      if (r.ok) {
        h.tasks.push(OB.makeCustomTask(ui.taskForm, h, state.viewerId));
        const title = ui.taskForm.title.trim();
        ui.taskForm = null;
        ui.taskErrors = {};
        toast(`Added: ${title}`);
        commit();
      } else render();
    }
  });

  app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const a = el.dataset.action;
    const hid = el.dataset.hire;
    switch (a) {
      case "open-hire":
        // If a new hire's own name is clicked somewhere, ignore.
        ui.detailId = hid;
        ui.taskForm = null;
        ui.folds = {};
        render();
        window.scrollTo(0, 0);
        break;
      case "close-hire":
        ui.detailId = null;
        ui.taskForm = null;
        render();
        break;
      case "view-as":
        switchViewer(hid);
        break;
      case "nh-tab":
        ui.nhTab = el.dataset.tab;
        render();
        break;
      case "hr-tab":
        ui.hrTab = el.dataset.tab;
        ui.detailId = null;
        ui.tplEdit = null;
        render();
        break;
      case "clear-filters":
        ui.hrFilterDept = "all";
        ui.hrFilterStatus = "all";
        ui.hrKpi = "all";
        render();
        break;
      case "cancel-preview":
        ui.preview = null;
        render();
        break;
      case "create-hire": {
        const d = ui.draft;
        const r = OB.validateHire(d, today(), state.hires);
        if (!r.ok) {
          ui.preview = null;
          ui.draftErrors = r.errors;
          render();
          break;
        }
        const hire = {
          id: OB.newId("h"),
          name: d.name.trim(),
          title: d.title.trim(),
          department: d.department,
          managerId: d.managerId,
          startDate: d.startDate,
          tasks: OB.buildPlan(d.department, d.startDate, [...ui.preview.skip], today(), templates()),
        };
        state.hires.push(hire);
        ui.draft = null;
        ui.preview = null;
        ui.draftErrors = {};
        ui.draftWarnings = [];
        ui.hrTab = "hires";
        ui.detailId = hire.id;
        toast(`Plan created for ${hire.name}. ${personName(hire.managerId)} can now see it.`);
        commit();
        window.scrollTo(0, 0);
        break;
      }
      case "new-task": {
        const h = hireById(hid);
        const td = today();
        const due = td > h.startDate ? td : h.startDate;
        ui.taskForm = { title: "", owner: "newhire", dueDate: due > OB.addDays(h.startDate, 27) ? OB.addDays(h.startDate, 27) : due, desc: "" };
        ui.taskErrors = {};
        render();
        document.querySelector("#task-form input[name=title]")?.focus();
        break;
      }
      case "cancel-task":
        ui.taskForm = null;
        ui.taskErrors = {};
        render();
        break;
      case "remove-task": {
        const h = hireById(hid);
        const t = h && h.tasks.find((x) => x.id === el.dataset.task);
        if (t && confirm(`Remove "${t.title}" from ${h.name}'s plan?`)) {
          h.tasks = h.tasks.filter((x) => x.id !== t.id);
          commit();
        }
        break;
      }
      case "delete-hire": {
        const h = hireById(hid);
        if (h && confirm(`Remove ${h.name} and their onboarding plan? This can't be undone.`)) {
          state.hires = state.hires.filter((x) => x.id !== hid);
          ui.detailId = null;
          toast(`${h.name} removed.`);
          commit();
        }
        break;
      }
      case "event-yes":
      case "event-notyet": {
        const h = hireById(hid);
        const t = h && h.tasks.find((x) => x.id === el.dataset.task);
        if (!t) break;
        if (a === "event-yes") toggleTask(hid, t.id, true);
        else {
          t.notYetOn = today();
          commit();
        }
        break;
      }
      case "add-1on1": {
        const h = hireById(hid);
        if (h) download1on1Ics(h);
        break;
      }
      case "digest-ok":
        // Weekly digest: hidden until next Monday.
        reminders().hide[el.dataset.key] = OB.addDays(OB.weekStart(today()), 7);
        commit();
        break;
      case "nudge-ok":
        reminders().hide[el.dataset.key] = "9999-12-31";
        commit();
        break;
      case "week-day":
        ui.weekDay = el.dataset.day && el.dataset.day !== ui.weekDay ? el.dataset.day : null;
        render();
        break;
      case "hr-kpi":
        ui.hrKpi = el.dataset.kpi === ui.hrKpi ? "all" : el.dataset.kpi;
        render();
        break;
      case "add-cal": {
        const h = hireById(hid);
        if (h) downloadDay1Ics(h);
        break;
      }
      case "banner-snooze":
        // Hide this kind of reminder until tomorrow (demo date + 1).
        reminders().hide[el.dataset.key] = OB.addDays(today(), 1);
        commit();
        break;
      case "banner-ok":
        // Hide this exact reminder for good; something new (another slipped task, a new milestone) can still show.
        reminders().hide[el.dataset.key] = "9999-12-31";
        commit();
        break;
      case "tpl-pick":
      case "tpl-add":
      case "tpl-edit":
      case "tpl-cancel":
      case "tpl-remove":
      case "tpl-reset":
      case "tpl-undo":
        templateAction(a, el);
        break;
      case "real-date":
        state.demoToday = null;
        commit();
        break;
      case "reset":
        if (confirm("Reset all demo data? Any hires or changes you made will be lost.")) {
          state = OB.store.reset();
          Object.assign(ui, { detailId: null, draft: null, preview: null, taskForm: null, hrTab: "hires", nhTab: "focus", tplEdit: null, tplErrors: {}, tplName: "Company" });
          render();
        }
        break;
    }
  });

  // Remember which phase / "done" folds the viewer opened, so re-renders keep them.
  app.addEventListener(
    "toggle",
    (e) => {
      const k = e.target.dataset && e.target.dataset.fold;
      if (k) ui.folds[k] = e.target.open;
    },
    true
  );

  // Keyboard open for table rows
  app.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("tr[data-action]")) e.target.click();
  });

  OB.store.onExternalChange((s) => {
    state = s;
    if (ui.detailId && !hireById(ui.detailId)) ui.detailId = null;
    render();
  });

  render();
})();
