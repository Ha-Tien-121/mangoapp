// UI rendering and event handling. Plain JS, re-renders #app on each change.
(function () {
  let state = OB.store.load();
  // UI-only state (not saved)
  const ui = {
    hrTab: "hires", // hires | add | templates | insights | more
    hrSub: null, // + Add: null (one person) | "bulk"; More: null | compliance | documents | moves
    detailId: null, // hire being viewed by manager/HR
    nhTab: "focus", // focus (Today) | plan | schedule | learning | team
    nhForm: null, // Today > forms: null | "list" | a form id (OB.FORMS)
    formDraft: null, // { id, data } while a form is open (unsaved typing)
    formErrors: {},
    schedDay: null, // Schedule: picked day 0–4, or null for the default (Day 1 / today)
    // Round 4, pass C1 (HR).
    hrEdit: null, // { hireId, draft, errors, mgrNote } while "Edit hire" is open (U4)
    bulk: null, // { text, preview, allow: Set of row numbers to import anyway, done } (C1c)
    insPick: null, // Insights: { chart: past | pulse, key } bar whose details are open
    hireUndo: null, // { hire, index }: the hire just removed, while its Undo toast shows (U4)
    roleForm: null, // Templates: { name, department, errors } while "New role" is open (C1b)
    pulseErr: "", // new hire: the pulse check-in's error line
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
    // Round 4, pass B (manager). The manager's place is kept in the URL hash (OB.parseRoute / OB.buildRoute) so
    // Back works: { tab: team | readiness | oneonones | goals | notifications, hireId, show, task, noteId, day }.
    route: { tab: "team" },
    lastHash: null,
    detailShow: null, // hire detail drill-down: catchup | foryou | waiting (U3)
    detailTask: null, // hire detail drill-down to one task (U3)
    modal: null, // { kind: "buddy", hireId, pick } | { kind: "remind", hireId, taskId, draft, errors }
    modalReturn: null, // selector to focus when the modal closes
    ooForm: null, // 1:1s: { templateId, date, time } for "Start a 1:1 note"
    ooErrors: {},
    fuText: "", // 1:1 note: the follow-up being typed
    fuErrors: {},
    fuTask: null, // { fuId, owner, dueDate } while "Add to plan" is open on a follow-up
    fuTaskErrors: {},
    goalDraft: null, // Goals: { horizon, title, desc }
    goalErrors: {},
    previewKind: "digest", // Notifications preview: digest | nudge
    nhGoalNote: null, // new hire: goal id whose progress note is open
    // Round 4, pass C2 (HR part 2).
    compAudit: null, // Compliance: the item key whose audit trail is open
    docQuery: "", // Documents: search text
    docCat: "all", // Documents: category filter
    docEdit: null, // Documents: { id (null = new), draft } while the inline form is open
    docErrors: {},
    docUndo: null, // { doc, index }: the document just removed, while its Undo toast shows
  };

  // ---------- helpers ----------
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const today = () => state.demoToday || OB.todayISO();
  // Plan templates as HR has edited them (defaults in OB.TEMPLATES). Used for every new plan.
  // Round 4, C1b: plus the role templates (state.roles), which buildPlan reads as templates.roles.
  const templates = () => ({ ...OB.mergeTemplates(OB.TEMPLATES, state.templates), roles: state.roles || [] });
  // Round 4, C2c: the document library.
  const docs = () => state.documents || [];

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
  // ms (optional): how long it stays (removing a hire offers Undo for 10 seconds).
  function toast(msg, act, ms) {
    ui.toast = msg;
    ui.toastAct = act || null;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      ui.toast = null;
      ui.toastAct = null;
      ui.undo = null; // Undo is only offered while its toast is showing.
      ui.hireUndo = null;
      ui.docUndo = null;
      render();
    }, ms || (act ? 8000 : 2600));
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
    // Acknowledge tasks record the agreement itself (doneAt is the date it was given).
    if (t.done) return `${OB.taskType(t) === "acknowledge" ? "Acknowledged" : "Done"} ${t.doneAt ? OB.prettyDate(OB.shownDoneAt(t.doneAt, td)) : ""}`;
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
    video: svg(`<rect x="1.6" y="4" width="9" height="8" rx="1.8" ${S}/><path d="M10.6 7.1l3.8-2.1v6l-3.8-2.1" ${S}/>`),
    external: svg(`<path d="M9.5 2.5h4v4M13.5 2.5L7.8 8.2M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" ${S}/>`),
    // Round 4
    users: svg(`<circle cx="6" cy="5.6" r="2.4" ${S}/><path d="M1.8 13.4c.4-2.4 2.1-3.8 4.2-3.8s3.8 1.4 4.2 3.8M10.6 3.4a2.3 2.3 0 0 1 0 4.4M12 9.9c1.2.5 2 1.6 2.2 3.5" ${S}/>`),
    star: svg(`<path d="M8 1.9l1.8 3.8 4.1.5-3 2.9.8 4.1L8 11.2l-3.7 2 .8-4.1-3-2.9 4.1-.5z" ${S}/>`),
    focus: svg(`<circle cx="8" cy="8" r="6.4" ${S}/><circle cx="8" cy="8" r="2.6" ${S}/>`),
    cup: svg(`<path d="M2.6 5.6h8.2v4.2a3 3 0 0 1-3 3H5.6a3 3 0 0 1-3-3zM10.8 6.6h1a1.6 1.6 0 0 1 0 3.2h-1M5 1.8v1.8M7.4 1.8v1.8" ${S}/>`),
    shield: svg(`<path d="M8 1.8l5 1.9v3.9c0 3.1-2.1 5.3-5 6.6-2.9-1.3-5-3.5-5-6.6V3.7z" ${S}/><path d="M8 5.2v3.4M8 10.8v.1" ${S}/>`),
    draft: svg(`<path d="M10.8 2.6l2.6 2.6-7.6 7.6H3.2v-2.6zM9.2 4.2l2.6 2.6" ${S}/>`),
    // Round 4, pass B
    progress: svg(`<circle cx="8" cy="8" r="6.6" ${S}/><path d="M8 1.4a6.6 6.6 0 0 1 0 13.2z" fill="currentColor"/>`),
    mail: svg(`<rect x="1.8" y="3.4" width="12.4" height="9.2" rx="1.6" ${S}/><path d="M2.4 4.4L8 8.6l5.6-4.2" ${S}/>`),
    chat: svg(`<path d="M2.4 3.6a1.4 1.4 0 0 1 1.4-1.4h8.4a1.4 1.4 0 0 1 1.4 1.4v6.2a1.4 1.4 0 0 1-1.4 1.4H7.4L4.4 13.8v-2.6h-.6a1.4 1.4 0 0 1-1.4-1.4z" ${S}/>`),
    send: svg(`<path d="M14 2L7 9M14 2l-4.4 12-2.6-5-5-2.6z" ${S}/>`),
    back: svg(`<path d="M13 8H3.4M7.2 4.2L3.4 8l3.8 3.8" ${S} stroke-width="1.8"/>`),
  };

  // Task type icons (round 3): one small, muted icon per row. Plain tasks have none.
  const TYPE_ICON = {
    read: svg(`<path d="M8 4.2C6.4 3 4.3 2.8 2 3.4v9.4c2.3-.6 4.4-.4 6 .8 1.6-1.2 3.7-1.4 6-.8V3.4c-2.3-.6-4.4-.4-6 .8zM8 4.2v9.4" ${S}/>`),
    watch: svg(`<circle cx="8" cy="8" r="6.6" ${S}/><path d="M6.7 5.6v4.8L10.4 8z" ${S}/>`),
    acknowledge: svg(`<path d="M8 1.8l5 1.9v3.9c0 3.1-2.1 5.3-5 6.6-2.9-1.3-5-3.5-5-6.6V3.7z" ${S}/><path d="M5.8 8.1l1.6 1.6 2.9-3.1" ${S}/>`),
    meeting: ICON.calendar,
    form: svg(`<rect x="3" y="1.8" width="10" height="12.4" rx="1.6" ${S}/><path d="M5.6 5.4h4.8M5.6 8h4.8M5.6 10.6h2.6" ${S}/>`),
  };
  // Learning path kinds (round 4): watch / read reuse the task icons; practice is a small keyboard.
  const LEARN_ICON = {
    watch: TYPE_ICON.watch,
    read: TYPE_ICON.read,
    practice: svg(`<rect x="1.6" y="4" width="12.8" height="8" rx="1.6" ${S}/><path d="M4 6.6h.1M6.6 6.6h.1M9.2 6.6h.1M11.8 6.6h.1M4.6 9.4h6.8" ${S}/>`),
  };
  // Named for screen readers and on hover (title); decorative colour stays muted.
  function typeIcon(t) {
    const type = OB.taskType(t);
    if (!TYPE_ICON[type]) return "";
    const name = OB.TASK_TYPES[type];
    return `<span class="ttype" role="img" aria-label="${esc(name)}" title="${esc(name)}">${TYPE_ICON[type]}</span>`;
  }
  // Quiet "Open" link for a task's resource. Only http(s) links are ever rendered.
  // Round 4, C2c: a task linked to a library document opens the document's link.
  function taskLink(t, title) {
    const l = OB.taskLinkFor(t, docs());
    if (!l) return "";
    return `<a class="task-link" href="${esc(l.href)}" target="_blank" rel="noopener" aria-label="${esc(`Open ${l.doc ? `${l.doc.title} (document for ${title})` : title} (opens in a new tab)`)}">Open${ICON.external}</a>`;
  }

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

  // U3: a status chip as a real button that opens the most specific place: "3 to catch up" opens the hire
  // detail filtered to those tasks; "Starts Nov 9" / "On track" open the plan.
  const CHIP_SHOW = { action: "foryou", behind: "catchup", waiting: "waiting" };
  function chipButton(h, kind, text) {
    const show = CHIP_SHOW[kind];
    const name = firstName(h.name);
    const label = show ? `${name}: ${text}. Show these tasks` : `${name}: ${text}. Open ${name}'s plan`;
    return `<button class="schip schip-${kind} schip-btn" data-action="open-hire" data-hire="${esc(h.id)}" ${show ? `data-show="${show}"` : ""} aria-label="${esc(label)}">${ICON[kind] || ""}<span>${esc(text)}</span></button>`;
  }
  const statusChipButtons = (h, s, viewerRole) => `<div class="chips">${statusItems(h, s, viewerRole).map(([k, t]) => chipButton(h, k, t)).join("")}</div>`;

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
    const label = bulletLabel(s, o.name);
    // decorative: inside a button that carries the same words (U3 hire card).
    return `
      <div class="bullet" ${o.decorative ? `aria-hidden="true"` : `role="img" aria-label="${esc(label)}"`}>
        <svg class="bullet-svg" width="100%" height="14" aria-hidden="true" focusable="false">
          <rect class="bg-track" x="0" y="3" width="100%" height="8" rx="4"/>
          ${fill ? `<rect class="bg-done" x="0" y="3" width="${p(fill)}" height="8" rx="4"/>` : ""}
          ${b.expected && b.done < b.total ? `<svg x="${p(b.expected)}" y="0" overflow="visible"><rect class="bg-target" x="-1" y="0" width="2" height="14" rx="1"/></svg>` : ""}
        </svg>
        ${o.noText ? "" : `<span class="bullet-cap" aria-hidden="true">${esc(cap)}</span>`}
      </div>`;
  }
  function bulletLabel(s, name) {
    const b = s.own;
    return `${name ? `${name}'s own tasks: ` : ""}${b.done} of ${b.total} done, ${b.expected} expected by today${s.behind ? `, ${s.behind} to catch up` : ""}.`;
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
    // Round 4: a task linked to a pre-boarding form is done by submitting the form, so the new hire gets a
    // form button instead of a checkbox (offer → c-offer, W-4 → c-tax, deposit → c-deposit).
    const form = viewerRole === "newhire" && t.owner === "newhire" ? OB.formForTask(t) : null;
    const can = OB.canComplete(viewerRole, t) && !form;
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
    // Acknowledge tasks: the checkbox reads "I've read and agree" (round 3).
    const ack = OB.taskType(t) === "acknowledge";
    const cbLabel = ack
      ? t.done ? `Acknowledged: '${title}'. Untick to undo` : `I've read and agree: '${title}'`
      : `Mark '${title}' ${t.done ? "not done" : "done"}`;
    return `
      <li class="task ${t.done ? "is-done" : ""} ${overdue ? "is-overdue" : ""} ${o.big ? "task-big" : ""} ${o.highlight === t.id ? "is-focus" : ""}" data-row="${esc(t.id)}">
        <${can ? `label for="${cbId}"` : "div"} class="check">
          ${
            can
              ? `<input type="checkbox" id="${cbId}" data-toggle="${esc(t.id)}" data-hire="${esc(hire.id)}" ${t.done ? "checked" : ""} aria-label="${esc(cbLabel)}" />`
              : `<span class="check-ro ${t.done ? "on" : ""}" title="${t.done ? "Done" : form ? "Done when you submit the form" : `Only ${esc(who)} can complete this`}" aria-hidden="true"></span>`
          }
        </${can ? "label" : "div"}>
        <div class="task-body">
          <label ${can ? `for="${cbId}"` : ""} class="task-title">${typeIcon(t)}${esc(title)}</label>
          ${desc && !o.compact ? `<p class="task-desc">${esc(desc)}</p>` : ""}
          ${ack && can && !t.done ? `<label for="${cbId}" class="ack-line" aria-hidden="true">I've read and agree</label>` : ""}
          <div class="task-meta">
            ${dueHtml}
            ${form ? formTaskButton(form, hire, title) : taskLink(t, title)}
            ${o.hideOwner ? "" : `<span class="chip chip-${t.owner}">${esc(who)}</span>`}
            ${o.showSource && t.source !== "Company" ? `<span class="chip chip-src">${esc(t.source)}</span>` : ""}
            ${t.custom && o.canRemove ? `<button class="link danger" data-action="remove-task" data-hire="${esc(hire.id)}" data-task="${esc(t.id)}">Remove</button>` : ""}
            ${
              // Round 4 (a): the manager picks a specific buddy from the hire's team.
              viewerRole === "manager" && t.key === "c-buddy" && can
                ? `<button class="btn btn-xs bp-btn" data-action="buddy-pick" data-hire="${esc(hire.id)}" aria-label="${esc(`${OB.buddyFor(hire) ? "Change" : "Choose"} ${firstName(hire.name)}'s buddy`)}">${ICON.users}${OB.buddyFor(hire) ? `Buddy: ${esc(OB.buddyFor(hire).name)} · Change` : "Choose buddy"}</button>`
                : ""
            }
            ${
              // B4: a polite, editable reminder to whoever has the task (demo outbox only).
              o.remind && viewerRole === "manager" && !t.done && t.owner !== "manager"
                ? `<button class="btn btn-xs btn-quiet remind-btn" data-action="remind-task" data-hire="${esc(hire.id)}" data-task="${esc(t.id)}" aria-label="${esc(`Send a reminder about '${title}'`)}">${ICON.send}Send a reminder</button>`
                : ""
            }
          </div>
        </div>
      </li>`;
  }

  // "Fill in form" / "Continue form" / "View form" on a form-linked task row (new hire).
  function formTaskButton(f, hire, title) {
    const st = OB.formStatus(hire, f.id).status;
    const label = st === "submitted" ? "View form" : st === "draft" ? "Continue form" : "Fill in form";
    return `<button class="btn btn-xs form-btn" data-action="nh-form" data-form="${esc(f.id)}" aria-label="${esc(`${label}: ${title}`)}">${TYPE_ICON.form}${label}</button>`;
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
    // Remote hires get a video call instead of an address (OB.DAY1.remote).
    const d = OB.day1For(hire.department, hire.workType);
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
    const mgrFirst = d.mgr ? esc(firstName(d.mgr.name)) : "";
    // Remote: "Join from home" with the video-call link, no address.
    const place = d.isRemote
      ? `<li><span class="fact-ico">${ICON.video}</span><div><strong>Join from home · ${esc(d.place)}</strong>
          <span class="muted"><a class="day1-link" href="${esc(d.link)}" target="_blank" rel="noopener">${esc(d.link.replace(/^https?:\/\//, ""))}<span class="sr-only"> (video call, opens in a new tab)</span></a></span>
          ${d.note ? `<span class="muted">${esc(d.note)}</span>` : ""}</div></li>`
      : `<li><span class="fact-ico">${ICON.pin}</span><div><strong>${esc(d.place)}</strong><span class="muted">${esc(d.address)}</span></div></li>`;
    return `
      <div class="day1">
        <div class="day1-count"><span class="day1-num">${esc(big)}</span><span class="day1-sub">${esc(sub)}</span></div>
        <ul class="day1-facts">
          <li><span class="fact-ico">${ICON.calendar}</span><div><strong>${esc(OB.prettyDate(hire.startDate))} · ${esc(OB.fmtTime(d.time))}</strong><span class="muted">${d.isRemote ? "Welcome session, then a call with your manager" : "Orientation, then lunch"}</span></div></li>
          ${place}
          <li><span class="fact-avatars" aria-hidden="true">${d.greeter ? `<span class="avatar sm">${initials(d.greeter.name)}</span>` : ""}${d.mgr ? `<span class="avatar sm">${initials(d.mgr.name)}</span>` : ""}</span>
            <div>${
              d.isRemote
                ? `<strong>${esc(greeterName)} (HR) welcomes you${d.mgr ? `, then ${mgrFirst}, your manager, joins the call` : " on the call"}</strong>`
                : `<strong>${esc(greeterName)} (HR) meets you</strong><span class="muted">${d.mgr ? `then lunch with ${mgrFirst}, your manager` : "and shows you around"}</span>`
            }</div></li>
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
    const who = d.greeter ? `${d.greeter.name} (HR) ${d.isRemote ? "welcomes you on the video call" : "meets you"}` : "HR meets you";
    const ics = OB.buildIcs({
      uid: `day1-${hire.id}-${hire.startDate}@mangoapps.onboarding`,
      date: hire.startDate,
      start: d.time,
      end: d.end,
      summary: "First day at MangoApps",
      // Remote: LOCATION is the video-call link.
      location: d.isRemote ? d.link : `${d.place}, ${d.address}`,
      description: d.isRemote
        ? `${who} at ${OB.fmtTime(d.time)}${d.mgr ? `, then ${d.mgr.name} joins` : ""}. ${d.note ? `${d.note}. ` : ""}Keep ${d.bring}. Join: ${d.link}`
        : `${who} at ${OB.fmtTime(d.time)}${d.mgr ? `, then lunch with ${d.mgr.name}` : ""}. Bring ${d.bring}.`,
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
    if (b.kind === "pulse") return pulseCard(hire, b.pulse);
    let tone, icon, title, sub = "";
    if (b.kind === "day1") {
      const d = day1Details(hire);
      tone = "info";
      icon = ICON.bell;
      title = b.dayN === 0 ? "Today's the day." : b.dayN === -1 ? "Day 1 is tomorrow." : `Day 1 is in ${-b.dayN} days.`;
      // Remote: "Day 1 is tomorrow. Keep a photo ID nearby for your I-9 check on camera."
      title += d.isRemote ? ` Keep ${d.bring}.` : ` Bring ${d.bring}.`;
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

  // Round 4, C1a: the Day 7 / Day 30 pulse check-in. It takes the one banner slot (never a focus row), is shown
  // until answered or "Not now", and HR only ever sees the answers grouped together.
  function pulseCard(hire, id) {
    const p = OB.PULSES[id];
    return `
      <section class="banner banner-info pulse" aria-labelledby="pulse-q">
        <span class="banner-ico">${ICON.chat}</span>
        <form class="banner-body pulse-form" id="pulse-form" data-pulse="${id}" novalidate>
          <p class="pulse-eyebrow">${esc(p.label)} check-in · one question</p>
          <fieldset class="pulse-set">
            <legend class="banner-title" id="pulse-q">${esc(p.question)}</legend>
            <div class="pulse-opts">${OB.PULSE_ANSWERS.map(
              ([k, l]) => `<label class="pulse-opt" for="pulse-${k}"><input type="radio" name="answer" id="pulse-${k}" value="${k}" /><span>${esc(l)}</span></label>`
            ).join("")}</div>
          </fieldset>
          ${ui.pulseErr ? `<p class="err" role="alert">${esc(ui.pulseErr)}</p>` : ""}
          <label class="field pulse-comment"><span>Anything to add? <span class="opt">(optional)</span></span><textarea name="comment" id="pulse-comment" rows="2" maxlength="300"></textarea></label>
          <p class="muted small">HR sees answers grouped with everyone else's, never with your name.</p>
          <div class="banner-actions btn-pair pulse-actions">
            <button type="button" class="btn btn-sm btn-banner" data-action="pulse-later" data-pulse="${id}">Not now</button>
            <button type="submit" class="btn btn-sm btn-banner primary">Send answer</button>
          </div>
        </form>
      </section>`;
  }

  // ---------- NEW HIRE VIEW ----------
  // Round 4: five tabs. Today (focus view) · My plan · Schedule · Learning · Team. Forms open from Today.
  const NH_TABS = [
    // [id, label, short label for narrow phones]
    ["focus", "Today", "Today"],
    ["plan", "My plan", "Plan"],
    ["schedule", "Schedule", "Schedule"],
    ["learning", "Learning", "Learning"],
    ["team", "Team", "Team"],
  ];
  function nhTabs(tab) {
    return `
      <nav class="tabs nh-tabs" aria-label="Your onboarding">
        ${NH_TABS.map(
          ([id, l, sh]) =>
            `<button ${tab === id ? `aria-current="page" ` : ""}class="${tab === id ? "on" : ""}" data-action="nh-tab" data-tab="${id}" ${l !== sh ? `aria-label="${l}"` : ""}>${
              l !== sh ? `<span class="t-long">${l}</span><span class="t-short" aria-hidden="true">${sh}</span>` : l
            }</button>`
        ).join("")}
      </nav>`;
  }

  function renderNewHire(hire) {
    const tab = NH_TABS.some(([id]) => id === ui.nhTab) ? ui.nhTab : "focus";
    let body;
    if (tab === "focus" && ui.nhForm) body = renderForms(hire);
    else if (tab === "plan") body = renderMyPlan(hire);
    else if (tab === "schedule") body = renderSchedule(hire);
    else if (tab === "learning") body = renderLearning(hire);
    else if (tab === "team") body = renderTeam(hire);
    else body = renderToday(hire);
    return `<main class="wrap nh">${nhTabs(tab)}${body}</main>`;
  }

  function renderMyPlan(hire) {
    return `
      <section class="page-head nh-head"><h1>My plan</h1>
        <p class="lead">Everything in your onboarding plan (${hire.tasks.length} tasks). Later phases are folded away until you need them.</p></section>
      ${nhGoalsCard(hire)}
      ${phaseSections(hire, "newhire", { showSource: true })}
      ${nhDocsCard(hire)}`;
  }

  // ---------- NEW HIRE: Documents (C2c), in My plan so Today keeps its 3-focus rule ----------
  // Only the documents for this person: everyone's, their department's and their job level's.
  function nhDocsCard(hire) {
    const list = OB.docsFor(hire, docs());
    if (!list.length) return "";
    const groups = OB.DOC_CATEGORIES.map((c) => [c, list.filter((d) => d.category === c)]).filter(([, ds]) => ds.length);
    return `
      <section class="card docs-nh" id="nh-docs" aria-labelledby="nh-docs-title">
        <h2 class="section-title" id="nh-docs-title">Documents for you</h2>
        <p class="muted small">Policies, benefits and guides for ${esc(hire.department)}${OB.hireProfile(hire).jobLevel !== OB.JOB_LEVELS[0] ? ` and ${esc(OB.audienceLabel({ kind: "level", value: OB.hireProfile(hire).jobLevel }).toLowerCase())}` : ""}. They open in a new tab.</p>
        ${groups
          .map(
            ([c, ds]) => `
          <h3 class="doc-cat-h">${esc(c)}</h3>
          <ul class="doc-list doc-list-nh">${ds
            .map(
              (d) => `<li class="doc-item"><div class="doc-main">
                <a class="doc-title" href="${esc(d.link)}" target="_blank" rel="noopener" aria-label="${esc(`${d.title} (opens in a new tab)`)}">${TYPE_ICON.read}<span>${esc(d.title)}</span>${ICON.external}</a>
                ${d.desc ? `<p class="muted small doc-desc">${esc(d.desc)}</p>` : ""}</div></li>`
            )
            .join("")}</ul>`
          )
          .join("")}
      </section>`;
  }

  // ---------- NEW HIRE: goals, read-only, in My plan (B3, extra c) ----------
  // Not on Today, so Today keeps its 3-focus rule. The new hire can add an optional progress note per goal.
  function goalStatusChip(status) {
    const word = OB.GOAL_STATUS[status] || OB.GOAL_STATUS.todo;
    if (status === "done") return statusChip("done", word);
    if (status === "doing") return statusChip("progress", word);
    return statusChip("upcoming", word);
  }
  function nhGoalsCard(hire) {
    const mgr = person(hire.managerId);
    const mgrFirst = mgr ? firstName(mgr.name) : "your manager";
    const hs = OB.goalHorizons(hire);
    if (!(hire.goals || []).length)
      return `<section class="card goals-nh"><h2 class="section-title">Your 30/60/90-day goals</h2>
        <p class="muted">You'll set these with ${esc(mgrFirst)} in your first weeks. They'll show up here.</p></section>`;
    const groups = hs
      .filter((x) => x.total)
      .map(
        (x) => `
        <div class="gh">
          <h3 class="gh-line">${esc(x.line)}</h3>
          <ul class="goal-list">${x.goals
            .map((g) => {
              const open = ui.nhGoalNote === g.id;
              return `
              <li class="goal">
                <div class="goal-main">
                  <p class="goal-title"><strong>${esc(g.title)}</strong></p>
                  ${g.desc ? `<p class="muted small">${esc(g.desc)}</p>` : ""}
                  ${g.note && !open ? `<p class="goal-note"><span>Your note:</span> ${esc(g.note)}</p>` : ""}
                  ${
                    open
                      ? `<form class="goal-note-form" data-goal="${esc(g.id)}" novalidate>
                          <label class="field"><span>Your progress note (optional)</span>
                            <textarea name="note" rows="2" maxlength="300" id="gn-${esc(g.id)}">${esc(g.note)}</textarea></label>
                          <div class="actions"><button type="submit" class="btn btn-sm primary">Save note</button><button type="button" class="btn btn-sm" data-action="nh-goal-note" data-goal="">Cancel</button></div>
                        </form>`
                      : `<button class="link link-pad goal-note-btn" data-action="nh-goal-note" data-goal="${esc(g.id)}" aria-label="${esc(`${g.note ? "Edit your note" : "Add a progress note"}: ${g.title}`)}">${g.note ? "Edit your note" : "Add a progress note"}</button>`
                  }
                </div>
                <div class="goal-st">${goalStatusChip(g.status)}</div>
              </li>`;
            })
            .join("")}</ul>
        </div>`
      )
      .join("");
    return `
      <section class="card goals-nh">
        <h2 class="section-title">Your 30/60/90-day goals</h2>
        <p class="muted small">Set with ${esc(mgrFirst)}. ${esc(mgrFirst)} updates the status; you can add a note on how it's going.</p>
        ${groups}
      </section>`;
  }

  // Up next in Learning, as a focus row (only when it fits in the 3-row focus list).
  function learningFocusRow(it) {
    const kind = OB.LEARNING_KINDS[it.kind] || "";
    const verb = it.status === "inprogress" ? "Continue" : "Start";
    return `
      <li class="task task-big learn-row">
        <div class="check"><span class="learn-dot" aria-hidden="true">${LEARN_ICON[it.kind] || ""}</span></div>
        <div class="task-body">
          <span class="task-title">${esc(it.title)}</span>
          <div class="task-meta">
            <span class="due">Up next in Learning · ${esc(kind)} · ${esc(OB.minutesLabel(it.minutes))}</span>
            <button class="btn btn-xs" data-action="learn-start" data-item="${esc(it.id)}" aria-label="${esc(`${verb}: ${it.title}${it.link ? " (opens in a new tab)" : ""}`)}">${verb}</button>
          </div>
        </div>
      </li>`;
  }
  const learningLine = (it) =>
    `<p class="learn-line">${LEARN_ICON[it.kind] || ""}<span>Up next in Learning:</span> <button class="link" data-action="nh-tab" data-tab="learning">${esc(it.title)} · ${esc(OB.minutesLabel(it.minutes))}</button></p>`;

  // "2 of 5 forms done" on Today. A single quiet line once everything is in.
  function formsCard(hire) {
    const fs = OB.formsSummary(hire);
    if (fs.allDone)
      return `<section class="card forms-card forms-all"><p class="fc-done">${ICON.done}<span>All ${fs.total} pre-boarding forms are done.</span> <button class="link" data-action="nh-forms">View forms</button></p></section>`;
    const next = fs.items.find((x) => x.status !== "submitted");
    return `
      <section class="card forms-card">
        <div class="fc-row">
          <span class="fc-ico" aria-hidden="true">${TYPE_ICON.form}</span>
          <div class="fc-body">
            <h2 class="section-title">Pre-boarding forms</h2>
            <p class="fc-count"><strong>${fs.done} of ${fs.total} forms done</strong> · next: ${esc(next.short)}${next.status === "draft" ? " (draft saved)" : ""}</p>
          </div>
          <button class="btn primary fc-btn" data-action="nh-forms">Open forms</button>
        </div>
      </section>`;
  }

  function renderToday(hire) {
    const td = today();
    const stats = OB.hireStats(hire, td);
    const focus = OB.focusTasks(hire, td, 3);
    const lm = OB.learningModel(hire);
    const mgr = person(hire.managerId);
    const buddy = OB.buddyFor(hire);
    const curOrder = OB.PHASE_ORDER[stats.phase];
    const waiting = OB.sortTasks(
      hire.tasks.filter((t) => t.owner !== "newhire" && !t.done && (OB.PHASE_ORDER[t.phase] <= curOrder || t.dueDate <= OB.addDays(td, 3)))
    );
    const recentDone = hire.tasks
      .filter((t) => t.done)
      .sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""))
      .slice(0, 5);
    // The next learning item fills a focus slot only if there's room (at most 3 rows in total).
    const slot = stats.status === "complete" ? null : OB.todayLearningSlot(focus.tasks, lm.upNext, 3);

    let greeting;
    if (stats.dayN < 0) greeting = `${-stats.dayN} day${stats.dayN === -1 ? "" : "s"} until your first day`;
    else if (stats.dayN === 0) greeting = "Today is your first day. Welcome!";
    else if (stats.dayN > 27) greeting = "Your onboarding period is over";
    else greeting = `Day ${stats.dayN + 1} at MangoApps`;

    let focusHtml;
    if (stats.status === "complete") {
      focusHtml = `<div class="empty"><div class="empty-icon" aria-hidden="true">✓</div><h3>Onboarding complete</h3><p>You've finished every task in your plan. Nice work!</p></div>`;
    } else if (!focus.tasks.length) {
      focusHtml = `<div class="empty"><div class="empty-icon" aria-hidden="true">✓</div><h3>You're all caught up</h3><p>Nothing for you to do right now. ${waiting.length ? "A few things are with other people, listed below." : ""}</p>${slot === "line" ? learningLine(lm.upNext) : ""}</div>`;
    } else {
      focusHtml = `
        <h2 class="section-title">${focus.upcoming ? "Coming up next" : "Focus on these first"}</h2>
        ${focus.upcoming ? `<p class="muted">Nothing is due right now. Here's what's next, if you want a head start.</p>` : ""}
        <ul class="tasks">${focus.tasks.map((t) => taskRow(t, hire, "newhire", { big: true, hideOwner: true })).join("")}${slot === "row" ? learningFocusRow(lm.upNext) : ""}</ul>
        ${focus.more > 0 ? `<p class="more">+ ${focus.more} more for this stage. <button class="link" data-action="nh-tab" data-tab="plan">See your plan</button></p>` : ""}
        ${slot === "line" ? learningLine(lm.upNext) : ""}`;
    }
    return `
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
      <section class="card focus">${focusHtml}</section>
      ${formsCard(hire)}
      ${
        waiting.length
          ? `<section class="card">
              <h2 class="section-title">Being handled for you</h2>
              <p class="muted">Other people are taking care of these. Nothing for you to do.</p>
              <ul class="tasks tasks-compact">${waiting.slice(0, 3).map((t) => taskRow(t, hire, "newhire", { compact: true })).join("")}</ul>
              ${waiting.length > 3 ? `<p class="more"><button class="link" data-action="nh-tab" data-tab="plan">+${waiting.length - 3} more in your plan</button></p>` : ""}
            </section>`
          : ""
      }
      ${
        recentDone.length
          ? `<details class="card plain"><summary><h2 class="section-title inline">Recently done (${stats.done})</h2></summary>
              <ul class="tasks tasks-compact">${recentDone.map((t) => taskRow(t, hire, "newhire", { compact: true })).join("")}</ul></details>`
          : ""
      }
      <section class="card contacts">
        <h2 class="section-title">Questions?</h2>
        <div class="contact-row">
          ${mgr ? `<div class="contact"><span class="avatar" aria-hidden="true">${initials(mgr.name)}</span><div><strong>${esc(mgr.name)}</strong><span class="muted">Your manager</span></div></div>` : ""}
          ${buddy ? `<div class="contact"><span class="avatar avatar-buddy" aria-hidden="true">${initials(buddy.name)}</span><div><strong>${esc(buddy.name)}</strong><span class="muted">Your buddy · any question</span></div></div>` : ""}
          <div class="contact"><span class="avatar" aria-hidden="true">SK</span><div><strong>Sarah Kim</strong><span class="muted">HR · paperwork, benefits, policies</span></div></div>
        </div>
        <p class="muted small contacts-more"><button class="link" data-action="nh-tab" data-tab="team">Meet your whole team</button></p>
      </section>`;
  }

  // ---------- NEW HIRE: Team (A1) ----------
  function personCard(p, o) {
    const opt = o || {};
    return `
      <li class="pc ${opt.cls || ""}">
        <span class="avatar ${opt.big ? "lg" : ""} ${opt.avatarCls || ""}" aria-hidden="true">${esc(initials(p.name))}</span>
        <div class="pc-body">
          ${opt.tag ? `<span class="pc-tag">${opt.tagIcon || ""}${esc(opt.tag)}</span>` : ""}
          <p class="pc-name"><strong>${esc(p.name)}</strong>${p.pronouns ? ` <span class="pc-pron">(${esc(p.pronouns)})</span>` : ""}</p>
          <p class="muted pc-title">${esc(p.title)}</p>
          ${opt.note ? `<p class="pc-note">${esc(opt.note)}</p>` : ""}
          ${p.ask ? `<p class="pc-ask"><span>Ask me about</span> ${esc(p.ask)}</p>` : ""}
        </div>
      </li>`;
  }
  function renderTeam(hire) {
    const tv = OB.teamView(hire);
    const mgrFirst = tv.manager ? firstName(tv.manager.name) : "Your manager";
    const buddyHtml = tv.buddy
      ? `<ul class="pc-list">${personCard(tv.buddy, { cls: "pc-buddy", big: true, tag: "Your buddy", tagIcon: ICON.star, avatarCls: "avatar-buddy", note: "Your go-to person for any question, big or small." })}</ul>`
      : `<div class="pc-soon" role="note"><span class="pc-soon-ico" aria-hidden="true">${ICON.users}</span>
          <div><p class="pc-name"><strong>Your buddy will be introduced soon</strong></p>
          <p class="muted">${esc(mgrFirst)} is choosing someone from the team to help you settle in. They'll show up here.</p></div></div>`;
    return `
      <section class="page-head nh-head"><h1>Meet your team</h1>
        <p class="lead">Welcome to ${esc(hire.department)}, ${esc(firstName(hire.name))}! Here are the ${tv.size} people you'll work with most.</p></section>
      <div class="team-top">
        ${tv.manager ? `<section class="card team-card"><h2 class="sr-only">Your manager</h2><ul class="pc-list">${personCard(tv.manager, { big: true, tag: "Your manager", avatarCls: "avatar-mgr" })}</ul></section>` : ""}
        <section class="card team-card ${tv.buddy ? "team-buddy" : ""}"><h2 class="sr-only">Your buddy</h2>${buddyHtml}</section>
      </div>
      ${
        tv.others.length
          ? `<section class="card"><h2 class="section-title">The rest of the team</h2><ul class="pc-grid">${tv.others.map((p) => personCard(p)).join("")}</ul></section>`
          : ""
      }
      ${tv.hr ? `<section class="card"><h2 class="section-title">Your HR contact</h2><ul class="pc-list">${personCard(tv.hr, { tag: "HR" })}</ul></section>` : ""}`;
  }

  // ---------- NEW HIRE: Schedule (A2) ----------
  const AGENDA_ICON = () => ({ meeting: ICON.calendar, focus: ICON.focus, social: ICON.cup, training: TYPE_ICON.read });
  function renderSchedule(hire) {
    const td = today();
    const ws = OB.weekState(hire.startDate, td);
    const range = `${OB.prettyDate(ws.dates[0])} – ${OB.prettyDate(ws.dates[4])}`;
    if (ws.phase === "after") {
      return `
        <section class="page-head nh-head"><h1>Your first week</h1><p class="lead">${esc(range)}</p></section>
        <section class="card"><div class="empty"><div class="empty-icon" aria-hidden="true">✓</div><h3>Your first week is done</h3>
          <p>Nice work settling in. What comes next is in your plan.</p>
          <button class="btn primary" data-action="nh-tab" data-tab="plan">See your plan</button></div></section>`;
    }
    const ag = OB.firstWeekAgenda(hire);
    const sel = Number.isInteger(ui.schedDay) && ui.schedDay >= 0 && ui.schedDay <= 4 ? ui.schedDay : ws.defaultDay;
    const day = ag.days[sel];
    const picker = ag.days
      .map((d) => {
        const isToday = d.index === ws.todayIndex;
        const n = d.items.length;
        return `<button class="sd ${d.index === sel ? "on" : ""} ${isToday ? "sd-is-today" : ""}" data-action="sched-day" data-day="${d.index}" aria-pressed="${d.index === sel}"
            aria-label="${esc(`Day ${d.index + 1}, ${OB.prettyDate(d.date)}${isToday ? " (today)" : ""}: ${n} item${n === 1 ? "" : "s"}`)}">
            <span class="sd-n">Day ${d.index + 1}</span><span class="sd-d">${esc(weekdayShort(d.date))} <span class="sd-md">${esc(shortDate(d.date))}</span></span>
            ${isToday ? `<span class="sd-today">Today</span>` : ""}</button>`;
      })
      .join("");
    const icons = AGENDA_ICON();
    const items = day.items.length
      ? `<ol class="agenda">${day.items
          .map(
            (x) => `
          <li class="ag ${x.done ? "ag-done" : ""}">
            <div class="ag-time"><strong>${esc(OB.fmtTime(x.start))}</strong><span class="muted"><span class="sr-only">to </span>${esc(OB.fmtTime(x.end))}</span></div>
            <div class="ag-body">
              <span class="ag-kind ag-${esc(x.kind)}">${icons[x.kind] || ""}${esc(OB.AGENDA_KINDS[x.kind])}</span>
              <p class="ag-title"><strong>${esc(x.title)}</strong>${x.done ? ` <span class="cap-ok">✓ Done</span>` : ""}</p>
              ${x.where ? `<p class="ag-meta">${/^Video/.test(x.where) ? ICON.video : ICON.pin}<span><span class="sr-only">Where: </span>${esc(x.where)}</span></p>` : ""}
              ${x.with ? `<p class="ag-meta">${ICON.users}<span><span class="sr-only">With: </span>${esc(x.with)}</span></p>` : ""}
            </div>
          </li>`
          )
          .join("")}</ol>`
      : `<p class="empty-sm">Nothing scheduled. Time to settle in.</p>`;
    const isToday = sel === ws.todayIndex;
    return `
      <section class="page-head nh-head"><h1>Your first week</h1>
        <p class="lead">${esc(range)}. ${ws.phase === "before" ? "Times may shift a little; your manager confirms them on Day 1." : "Here's what's planned, day by day."}</p></section>
      <div class="sched-days" role="group" aria-label="Pick a day of your first week">${picker}</div>
      <section class="card sched-card">
        <div class="toolbar">
          <h2 class="section-title inline">Day ${sel + 1} · ${esc(weekdayLong(day.date))}, ${esc(shortDate(day.date))}${isToday ? ` <span class="now-pill">Today</span>` : ""}</h2>
          <button class="btn sched-ics" data-action="week-ics" data-hire="${esc(hire.id)}">${ICON.calendar} Add the week to calendar</button>
        </div>
        ${items}
      </section>`;
  }
  function downloadWeekIcs(hire) {
    const ag = OB.firstWeekAgenda(hire);
    const ics = OB.buildIcs(OB.agendaEvents(hire, ag, icsStamp()));
    downloadIcs(ics, "mangoapps-first-week.ics", `Calendar file downloaded with ${ag.items.length} events. Open it to add your first week.`);
  }

  // ---------- NEW HIRE: Learning (A3) ----------
  function renderLearning(hire) {
    const m = OB.learningModel(hire);
    const next = m.upNext;
    const rows = m.items
      .map((it, i) => {
        const isNext = next && it.id === next.id;
        const kind = OB.LEARNING_KINDS[it.kind] || "";
        let status = "";
        if (it.status === "done") status = statusChip("done", "Done");
        else if (it.status === "inprogress") status = statusChip("upcoming", "In progress");
        const act = [];
        if (it.status !== "done") {
          const verb = it.status === "inprogress" ? "Continue" : "Start";
          if (isNext || it.status === "inprogress")
            act.push(`<button class="btn ${isNext ? "primary" : ""} btn-sm" data-action="learn-start" data-item="${esc(it.id)}" aria-label="${esc(`${verb}: ${it.title}${it.link ? " (opens in a new tab)" : ""}`)}">${verb}</button>`);
          act.push(`<button class="btn btn-sm btn-quiet" data-action="learn-done" data-item="${esc(it.id)}" aria-label="${esc(`Mark as done: ${it.title}`)}">Mark as done</button>`);
        } else act.push(`<button class="btn btn-sm btn-quiet" data-action="learn-undo" data-item="${esc(it.id)}" aria-label="${esc(`Mark as not done: ${it.title}`)}">Undo</button>`);
        const linked = it.taskId ? hire.tasks.find((t) => t.id === it.taskId) : null;
        return `
          <li class="li ${isNext ? "li-next" : ""} ${it.status === "done" ? "li-done" : ""}">
            <span class="li-num" aria-hidden="true">${it.status === "done" ? "✓" : i + 1}</span>
            <div class="li-body">
              ${isNext ? `<span class="up-next">Up next</span>` : ""}
              <p class="li-title"><span class="li-kind" role="img" aria-label="${esc(kind)}" title="${esc(kind)}">${LEARN_ICON[it.kind] || ""}</span><strong>${esc(it.title)}</strong></p>
              <p class="li-meta"><span>${esc(kind)} · ${esc(OB.minutesLabel(it.minutes))}</span>${status}</p>
              ${linked ? `<p class="muted small li-link">Also ticks off “${esc(linked.title)}” in your plan.</p>` : ""}
            </div>
            <div class="li-act">${act.join("")}</div>
          </li>`;
      })
      .join("");
    return `
      <section class="page-head nh-head"><h1>Learning path</h1>
        <p class="lead">Short lessons to help you settle in. This order is a suggestion; go at your own pace.</p></section>
      <section class="card learn-card">
        <p class="learn-sum">${m.done === m.total ? ICON.done : ""}<strong>${esc(OB.learningSummary(m))}</strong></p>
        <ol class="learn-list">${rows}</ol>
      </section>`;
  }

  // ---------- NEW HIRE: Pre-boarding forms (A4) ----------
  const demoNote = () =>
    `<p class="demo-note" role="note">${ICON.shield}<span><strong>Demo only.</strong> Don't enter real personal or bank details. Anything you type stays in this browser.</span></p>`;
  function formChip(st) {
    if (st.status === "submitted") return statusChip("done", st.submittedAt ? `Submitted ${shortDate(OB.shownDoneAt(st.submittedAt, today()))}` : "Submitted");
    if (st.status === "draft") return statusChip("draft", st.savedAt ? `Draft saved ${shortDate(st.savedAt)}` : "Draft saved");
    return statusChip("upcoming", "Not started");
  }
  function renderForms(hire) {
    if (ui.nhForm !== "list" && OB.formDef(ui.nhForm)) return renderOneForm(hire, OB.formDef(ui.nhForm));
    const fs = OB.formsSummary(hire);
    return `
      <button class="link back" data-action="nh-form-close">← Today</button>
      <section class="page-head nh-head"><h1>Pre-boarding forms</h1>
        <p class="lead">${fs.done} of ${fs.total} forms done. Each one takes a few minutes.</p></section>
      ${demoNote()}
      <ul class="card form-list">${fs.items
        .map((st) => {
          const f = OB.formDef(st.id);
          const btn = st.status === "submitted" ? "View" : st.status === "draft" ? "Continue" : "Start";
          return `
            <li class="fl">
              <span class="fl-ico" aria-hidden="true">${TYPE_ICON.form}</span>
              <div class="fl-body"><p class="fl-title"><strong>${esc(f.title)}</strong></p><p class="muted small">${esc(f.desc)}</p>${formChip(st)}</div>
              <button class="btn ${st.status === "submitted" ? "btn-quiet" : ""} fl-btn" data-action="nh-form" data-form="${esc(f.id)}" aria-label="${esc(`${btn}: ${f.title}`)}">${btn}</button>
            </li>`;
        })
        .join("")}</ul>`;
  }
  function offerSummary(hire) {
    const mgr = person(hire.managerId);
    const p = OB.hireProfile(hire);
    const rows = [
      ["Role", `${hire.title}, ${hire.department}`],
      ["Start date", OB.prettyDate(hire.startDate)],
      ["Manager", mgr ? mgr.name : "To be confirmed"],
      ["Work type", `${p.workType} · ${p.jobLevel}`],
      ["Pay and benefits", "As in your offer email (not shown in this demo)"],
    ];
    return `<div class="offer-sum"><h2 class="section-title">Your offer at a glance</h2><dl class="fv-rows">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></div>`;
  }
  function formField(f, fl, val, err) {
    const id = `ff-${f.id}-${fl.name}`;
    const errId = `${id}-err`;
    const aria = err ? `aria-invalid="true" aria-describedby="${errId}"` : "";
    const errHtml = err ? `<small class="err" id="${errId}">${esc(err)}</small>` : "";
    const opt = fl.optional && !/optional/.test(fl.label) ? ` <span class="opt">(optional)</span>` : "";
    const v = val == null ? "" : val;
    if (fl.kind === "checkbox")
      return `<div class="field field-check ${err ? "has-err" : ""}"><label class="check-line" for="${id}"><input type="checkbox" id="${id}" name="${fl.name}" ${v === true ? "checked" : ""} ${aria} /> ${esc(fl.label)}</label>${errHtml}</div>`;
    let input;
    if (fl.kind === "select")
      input = `<select id="${id}" name="${fl.name}" ${aria}><option value="">${fl.optional ? "Leave blank" : "Choose…"}</option>${fl.options
        .map((o) => `<option ${v === o ? "selected" : ""}>${esc(o)}</option>`)
        .join("")}</select>`;
    else if (fl.kind === "secret")
      // Masked while typing; digits only (checked on submit). autocomplete off so a browser never fills real details.
      input = `<input id="${id}" name="${fl.name}" type="password" inputmode="numeric" autocomplete="off" maxlength="${fl.name === "routing" ? 9 : 17}" value="${esc(v)}" ${aria} />`;
    else if (fl.kind === "money")
      input = `<span class="money"><span aria-hidden="true">$</span><input id="${id}" name="${fl.name}" inputmode="decimal" autocomplete="off" maxlength="9" value="${esc(v)}" placeholder="0.00" ${aria} /></span>`;
    else
      input = `<input id="${id}" name="${fl.name}" type="${fl.kind === "tel" ? "tel" : "text"}" ${fl.kind === "tel" ? `inputmode="tel"` : fl.inputmode ? `inputmode="${fl.inputmode}"` : ""} autocomplete="off" maxlength="${fl.kind === "tel" ? 20 : 130}" value="${esc(v)}" ${aria} />`;
    const hint = fl.kind === "secret" && !err ? `<small class="muted">Digits only. Shown as dots while you type.</small>` : "";
    return `<label class="field ${err ? "has-err" : ""}" for="${id}"><span>${esc(fl.label)}${opt}</span>${input}${errHtml}${hint}</label>`;
  }
  function renderOneForm(hire, f) {
    const st = OB.formStatus(hire, f.id);
    const head = `
      <button class="link back" data-action="nh-forms">← All forms</button>
      <section class="page-head nh-head"><h1>${esc(f.title)}</h1><p class="lead">${esc(f.desc)}</p></section>
      ${demoNote()}`;
    if (st.status === "submitted") {
      const rows = OB.formViewRows(f.id, st.data);
      const linked = f.taskKey ? hire.tasks.find((t) => t.key === f.taskKey) : null;
      return `${head}
        <section class="card form-view">
          <p>${formChip(st)}</p>
          ${f.id === "offer" && !st.external ? offerSummary(hire) : ""}
          ${
            rows.length && !st.external
              ? `<dl class="fv-rows">${rows.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${r.sensitive && r.value !== "—" ? `<span aria-hidden="true">${esc(r.value)}</span><span class="sr-only">ending in ${esc(r.value.slice(-4))}</span>` : esc(r.value)}</dd></div>`).join("")}</dl>`
              : `<p class="muted">This was completed before forms moved into the app, so no details are stored here.</p>`
          }
          ${linked ? `<p class="muted small fv-linked">${ICON.done}<span>“${esc(linked.title)}” in your plan is done.</span></p>` : ""}
          <p class="muted small">Need to change something? Ask Sarah Kim in HR.</p>
        </section>`;
    }
    const d = ui.formDraft && ui.formDraft.id === f.id ? ui.formDraft.data : {};
    const er = ui.formErrors || {};
    const nErr = Object.keys(er).length;
    return `${head}
      <form class="card form nh-form" id="nh-form" data-form="${esc(f.id)}" novalidate>
        ${nErr ? `<div class="form-errsum" role="alert" tabindex="-1" id="form-errsum">${nErr === 1 ? "One field needs a change" : `${nErr} fields need a change`}. Details are under each one.</div>` : ""}
        ${f.id === "offer" ? offerSummary(hire) : ""}
        ${f.id === "offer" ? `<p class="muted small sign-hint">Type <strong>${esc(hire.name)}</strong> to sign. Capital letters don't matter.</p>` : ""}
        <div class="form-fields">${f.fields.map((fl) => formField(f, fl, d[fl.name], er[fl.name])).join("")}</div>
        <div class="actions">
          <button type="submit" class="btn primary">${f.id === "offer" ? "Sign offer" : "Submit"}</button>
          <button type="button" class="btn" data-action="form-draft" data-form="${esc(f.id)}">Save draft</button>
          <button type="button" class="btn btn-quiet" data-action="nh-forms">Cancel</button>
        </div>
        ${st.status === "draft" ? `<p class="muted small">Draft saved ${esc(shortDate(st.savedAt || today()))}. Submit when you're ready.</p>` : ""}
      </form>`;
  }
  // Values in the form element right now (checkboxes as booleans).
  function readNhForm(form) {
    const o = {};
    for (const el of form.elements) if (el.name) o[el.name] = el.type === "checkbox" ? el.checked : el.value;
    return o;
  }
  function openForm(hire, id) {
    const st = OB.formStatus(hire, id);
    ui.nhTab = "focus";
    ui.nhForm = id;
    ui.formErrors = {};
    ui.formDraft = { id, data: st.status === "draft" ? { ...st.data } : {} };
  }

  // HR hire detail: which forms are in, with sensitive numbers masked (A4). The manager readiness check can read OB.formsSummary too.
  function hireFormsCard(hire) {
    const fs = OB.formsSummary(hire);
    return `
      <section class="card hire-forms">
        <h2 class="section-title">Pre-boarding forms</h2>
        <p class="muted small">${fs.done} of ${fs.total} submitted. Bank numbers are masked. Demo data only.</p>
        <ul class="hf-list">${fs.items
          .map((st) => {
            const rows = st.status === "submitted" && !st.external ? OB.formViewRows(st.id, st.data) : [];
            const k = `hf-${hire.id}-${st.id}`;
            return `<li><div class="hf-row"><strong>${esc(st.title)}</strong>${formChip(st)}${st.external ? `<span class="muted small">completed outside the app</span>` : ""}</div>
              ${
                rows.length
                  ? `<details class="hf-view" data-fold="${esc(k)}" ${ui.folds[k] ? "open" : ""}><summary>View details</summary><dl class="fv-rows">${rows
                      .map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`)
                      .join("")}</dl></details>`
                  : ""
              }</li>`;
          })
          .join("")}</ul>
      </section>`;
  }

  // ---------- MANAGER VIEW ----------
  // Round 4, pass B: five tabs. Team · Day-1 readiness · 1:1s · Goals · Notifications (short labels on phones;
  // the tab bar may scroll inside itself at 320px). Hire detail opens from Team.
  const MGR_TABS = [
    ["team", "Team", "Team"],
    ["readiness", "Day-1 readiness", "Day 1"],
    ["oneonones", "1:1s", "1:1s"],
    ["goals", "Goals", "Goals"],
    ["notifications", "Notifications", "Nudges"],
  ];
  function mgrTabs(tab) {
    return `
      <nav class="tabs mgr-tabs" aria-label="Manager pages">
        ${MGR_TABS.map(
          ([id, l, sh]) =>
            `<button ${tab === id ? `aria-current="page" ` : ""}class="${tab === id ? "on" : ""}" data-action="mgr-tab" data-tab="${id}" ${l !== sh ? `aria-label="${l}"` : ""}>${
              l !== sh ? `<span class="t-long">${l}</span><span class="t-short" aria-hidden="true">${sh}</span>` : l
            }</button>`
        ).join("")}
      </nav>`;
  }
  const myHires = (v) => state.hires.filter((h) => h.managerId === v.id).sort((a, b) => a.startDate.localeCompare(b.startDate));

  // U3: every part of the card is a real control. Name and bar open the plan; the chip opens the plan filtered to
  // those tasks; the goals line opens the Goals tab for this person.
  function hireCard(h, viewerRole) {
    const td = today();
    const s = OB.hireStats(h, td);
    const name = firstName(h.name);
    const [kind, text] = statusItems(h, s, viewerRole)[0];
    const gl = OB.goalsCardLine(h, td);
    return `
      <article class="hire-card" data-hire="${esc(h.id)}">
        <button class="hc-top hc-open" data-action="open-hire" data-hire="${esc(h.id)}" aria-label="${esc(`${h.name}, ${h.title}. Open ${name}'s plan`)}">
          <span class="avatar" aria-hidden="true">${initials(h.name)}</span>
          <span class="hc-name"><strong>${esc(h.name)}</strong><span class="muted">${esc(h.title)}</span></span>
        </button>
        <div class="chips">${chipButton(h, kind, text)}</div>
        <div class="muted small">${esc(dayLabel(h))}</div>
        <button class="hc-bar" data-action="open-hire" data-hire="${esc(h.id)}" aria-label="${esc(`${bulletLabel(s, h.name)} Open ${name}'s plan`)}">${bulletGraph(s, { name: h.name, decorative: true })}</button>
        ${s.behind && kind !== "behind" ? `<button class="link hc-line" data-action="open-hire" data-hire="${esc(h.id)}" data-show="catchup" aria-label="${esc(`${name}: ${s.behind} to catch up. Show these tasks`)}">${ICON.behind} ${s.behind} to catch up</button>` : ""}
        ${gl ? `<button class="link hc-line" data-action="mgr-goals" data-hire="${esc(h.id)}" aria-label="${esc(`${name}'s goals, ${gl.line}. Open Goals`)}">${ICON.star} Goals · ${esc(gl.line)}</button>` : ""}
      </article>`;
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
    // The day before one of his hires starts, a Day-1 nudge replaces the digest (unless he turned it off, B4).
    const prefs = OB.notifyPrefsFor(state, v.id);
    const starting = prefs.dayBefore && mine.find((h) => OB.diffDays(h.startDate, td) === 1 && !isHidden(`${v.id}:nudge:${h.id}`));
    if (starting) {
      const d = OB.day1For(starting.department, starting.workType);
      const name = firstName(starting.name);
      const buddy = OB.buddyFor(starting);
      const slot = oneOnOneSlot(starting);
      return `
        <section class="banner banner-info nudge" aria-label="Day 1 reminder">
          <span class="banner-ico">${ICON.calendar}</span>
          <div class="banner-body">
            <p class="banner-title">${esc(name)} starts tomorrow. 4 things for Day 1:</p>
            <ol class="nudge-list">
              <li>Welcome ${esc(name)} at ${esc(OB.fmtTime(d.time))} · ${esc(d.isRemote ? `${d.place} (remote)` : d.place)}</li>
              <li>Introduce ${esc(name)} to the team</li>
              <li><button class="link" data-action="mgr-1on1s" data-hire="${esc(starting.id)}">Book a recurring 1:1</button> <span class="muted">(first one ${esc(OB.fmtTime(slot.start))}, after lunch)</span></li>
              <li><button class="link" data-action="mgr-tab" data-tab="readiness">Check the buddy is set</button>${buddy ? ` <span class="cap-ok">✓ ${esc(buddy.name)}</span>` : ""}</li>
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
    // the started hire with the most to catch up). Each one is a link to what it's about (U3).
    const parts = [
      forYou
        ? `<button class="link digest-link" data-action="goto-week">${forYou} to-do${forYou === 1 ? "" : "s"} for you</button>`
        : "nothing due from you",
    ];
    const next = mine.find((h) => OB.diffDays(h.startDate, td) >= 0 && OB.diffDays(h.startDate, td) <= 6);
    if (next) {
      const n = OB.diffDays(next.startDate, td);
      const when = `${firstName(next.name)} starts ${n === 0 ? "today" : n === 1 ? "tomorrow" : n <= 6 ? weekdayLong(next.startDate) : shortDate(next.startDate)}`;
      parts.push(`<button class="link digest-link" data-action="mgr-tab" data-tab="readiness" aria-label="${esc(`${when}. Open Day-1 readiness`)}">${esc(when)}</button>`);
    } else {
      const c = mine.filter((h) => statsOf(h).dayN >= 0 && statsOf(h).behind).sort((a, b) => statsOf(b).behind - statsOf(a).behind)[0];
      if (c) parts.push(`<button class="link digest-link" data-action="open-hire" data-hire="${esc(c.id)}" data-show="catchup">${esc(`${firstName(c.name)} has ${statsOf(c).behind} to catch up`)}</button>`);
    }
    return `
      <section class="banner banner-info digest" aria-label="Next 7 days">
        <span class="banner-ico">${ICON.bell}</span>
        <div class="banner-body"><p class="banner-title">Next 7 days: ${parts.join(" · ")}</p></div>
        <div class="banner-actions btn-pair"><button class="btn btn-sm btn-banner primary" data-action="digest-ok" data-key="${esc(key)}">Got it</button></div>
      </section>`;
  }

  // Rolling 7 days (today + the next 6): each day shows one number, the manager's to-dos on that day
  // (anything past its date counts on today). The strip, the list under it, the digest and the header all
  // read the same OB.rollingWeek result, so their numbers always agree (F1). Later items sit under a quiet,
  // folded "Later" line with no count. Tap a day to filter the list (kept in the URL hash, U3); tap again (or "clear") to see all 7 days.
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
      <section class="card week" id="week-card" tabindex="-1">
        <h2 class="section-title">Your to-dos, next 7 days</h2>
        <div class="wk-strip" role="group" aria-label="Today and the next 6 days. Tap a day to see its to-dos.">${strip}</div>
        ${sel ? `<p class="wk-showing">Showing ${esc(OB.prettyDate(sel))} · <button class="link link-pad" data-action="week-day" data-day="">clear</button></p>` : ""}
        ${list}
        ${later}
      </section>`;
  }

  function renderManager(v) {
    const r = ui.route || { tab: "team" };
    const tab = MGR_TABS.some(([id]) => id === r.tab) ? r.tab : "team";
    let body;
    if (tab === "readiness") body = renderReadiness(v);
    else if (tab === "oneonones") body = renderOneOnOnes(v);
    else if (tab === "goals") body = renderGoals(v);
    else if (tab === "notifications") body = renderNotifications(v);
    else if (ui.detailId && hireById(ui.detailId)) body = renderDetail(hireById(ui.detailId), v);
    else body = renderManagerTeam(v);
    return `<main class="wrap mgr">${mgrTabs(tab)}${body}</main>`;
  }

  function renderManagerTeam(v) {
    const td = today();
    const mine = myHires(v);
    const statsMap = new Map(mine.map((h) => [h.id, OB.hireStats(h, td)]));
    const statsOf = (h) => statsMap.get(h.id);
    const todos = [];
    for (const h of mine) for (const t of h.tasks) if (t.owner === "manager" && !t.done) todos.push({ t, h });
    todos.sort((a, b) => a.t.dueDate.localeCompare(b.t.dueDate));
    const week = OB.rollingWeek(todos, td);
    const forYou = week.total;
    // Catch-up counts only for hires who have started. Each is a link to those tasks (U3).
    const catchUp = mine
      .filter((h) => statsOf(h).dayN >= 0 && statsOf(h).behind)
      .map((h) => ({ h, text: `${firstName(h.name)} has ${statsOf(h).behind} to catch up` }));
    const top = mine.length ? managerDigest(v, mine, statsOf, week) : "";
    // While the digest is showing, the header doesn't repeat what it says.
    const digestShown = top.includes("banner-info digest");
    const lead = mine.length
      ? [
          `${mine.length} ${mine.length === 1 ? "person" : "people"} onboarding`,
          forYou && !digestShown ? `<button class="link lead-owe" data-action="goto-week">${forYou} to-do${forYou === 1 ? "" : "s"} for you</button>` : "",
          ...catchUp
            .filter((x) => !(digestShown && top.includes(esc(x.text))))
            .map((x) => `<button class="link" data-action="open-hire" data-hire="${esc(x.h.id)}" data-show="catchup">${esc(x.text)}</button>`),
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

    return `
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
        }`;
  }

  // ---------- MANAGER: Day-1 readiness (B1) ----------
  function readinessRow(h, it) {
    const name = firstName(h.name);
    const own = it.owner === "manager";
    const ownerWord = own ? "You" : it.owner === "newhire" ? name : OB.OWNERS[it.owner];
    const st = it.ready
      ? `<span class="ri-st ri-ok">${ICON.done}<span>Ready</span></span>`
      : `<span class="ri-st ri-wait">${ICON.upcoming}<span>Not ready yet</span></span>`;
    // U3: the item opens the task in the hire's plan (or the booked 1:1 note).
    const target = it.noteId
      ? `data-action="oo-open" data-hire="${esc(h.id)}" data-note="${esc(it.noteId)}"`
      : it.taskId
        ? `data-action="open-hire" data-hire="${esc(h.id)}" data-task="${esc(it.taskId)}"`
        : `data-action="open-hire" data-hire="${esc(h.id)}"`;
    const where = it.noteId ? "Open the 1:1 note" : it.taskId ? "Open the task in the plan" : `Open ${name}'s plan`;
    const labelBtn = `<button class="link ri-label" ${target} aria-label="${esc(`${it.label}, ${it.ready ? "ready" : "not ready yet"}. ${where}`)}">${esc(it.label)}</button>`;
    let act = "";
    if (own) {
      if (it.id === "buddy")
        act = `<button class="btn btn-sm ${it.ready ? "btn-quiet" : "primary"}" data-action="buddy-pick" data-hire="${esc(h.id)}" aria-label="${esc(`${it.ready ? "Change" : "Choose"} ${name}'s buddy`)}">${it.ready ? "Change" : "Choose buddy"}</button>`;
      else if (it.id === "note" && !it.ready)
        act = `<button class="btn btn-sm primary" data-action="ready-tick" data-hire="${esc(h.id)}" data-task="${esc(it.taskId)}" aria-label="${esc(`Mark done: ${it.taskTitle}`)}">Mark done</button>`;
      else if (it.id === "oneonone")
        act = it.noteId
          ? `<button class="btn btn-sm btn-quiet" data-action="oo-ics" data-hire="${esc(h.id)}" data-note="${esc(it.noteId)}" aria-label="${esc(`Add the first 1:1 with ${name} to your calendar`)}">${ICON.calendar} Add to calendar</button>`
          : !it.ready
            ? `<button class="btn btn-sm primary" data-action="ready-book" data-hire="${esc(h.id)}" aria-label="${esc(`Book your first 1:1 with ${name}`)}">Book 1:1</button>`
            : "";
    } else if (!it.ready)
      act = `<button class="btn btn-sm btn-quiet remind-btn" data-action="remind-ready" data-hire="${esc(h.id)}" data-item="${esc(it.id)}" aria-label="${esc(`Send a reminder about '${it.label}' to ${ownerWord}`)}">${ICON.send}Send a reminder</button>`;
    return `
      <li class="ri ${it.ready ? "ri-done" : ""}">
        ${st}
        <div class="ri-body">${labelBtn}${it.detail ? `<span class="muted small ri-detail">${esc(it.detail)}</span>` : ""}</div>
        <span class="chip chip-${esc(it.owner)} ri-owner"><span class="sr-only">Who: </span>${esc(ownerWord)}</span>
        <div class="ri-act">${act}</div>
      </li>`;
  }
  function renderReadiness(v) {
    const td = today();
    const list = OB.readinessHires(state.hires, v.id, td, 14);
    const head = `
      <section class="page-head"><h1>Day-1 readiness</h1>
        <p class="lead">Everyone on your team starting in the next 14 days. Tick off what's yours; for the rest, a friendly reminder is one click away.</p></section>`;
    if (!list.length)
      return `${head}
        <div class="card empty"><div class="empty-icon" aria-hidden="true">✓</div><h3>Nobody is starting in the next 14 days</h3>
          <p>When someone on your team is about to start, a short Day-1 checklist shows up here.</p>
          ${myHires(v).length ? `<button class="btn" data-action="mgr-tab" data-tab="team">See your team</button>` : ""}</div>`;
    const cards = list
      .map((h) => {
        const r = OB.readinessFor(h, td);
        const pct = r.total ? Math.round((r.ready / r.total) * 100) : 0;
        return `
          <section class="card ready-card" aria-label="${esc(`${h.name}, Day-1 readiness`)}">
            <div class="rc-head">
              <div>
                <h2 class="section-title">${esc(r.headline)}</h2>
                <p class="muted small">${esc(h.title)} · Day 1 is ${esc(OB.shortDay(h.startDate))}</p>
              </div>
              <button class="btn btn-sm btn-quiet" data-action="open-hire" data-hire="${esc(h.id)}" aria-label="${esc(`Open ${h.name}'s plan`)}">Open plan</button>
            </div>
            <div class="progress rc-meter" role="img" aria-label="${esc(`${r.ready} of ${r.total} ready`)}"><span style="width:${pct}%"></span></div>
            <ul class="ri-list">${r.items.map((it) => readinessRow(h, it)).join("")}</ul>
          </section>`;
      })
      .join("");
    return head + cards;
  }

  // ---------- MANAGER: pick a person (1:1s, Goals) ----------
  function pickedHire(v) {
    const mine = myHires(v);
    return mine.find((h) => h.id === (ui.route || {}).hireId) || mine[0] || null;
  }
  function hirePicker(v, tab, sel) {
    const mine = myHires(v);
    if (mine.length < 2) return "";
    return `<div class="hp" role="group" aria-label="Pick a person">${mine
      .map(
        (h) =>
          `<button class="tpl-pick hp-pick ${h.id === sel.id ? "on" : ""}" data-action="mgr-pick" data-tab="${tab}" data-hire="${esc(h.id)}" aria-pressed="${h.id === sel.id}"><span class="avatar hp-av" aria-hidden="true">${initials(h.name)}</span>${esc(h.name)}</button>`
      )
      .join("")}</div>`;
  }
  const noHiresCard = (what) =>
    `<div class="card empty"><div class="empty-icon" aria-hidden="true">👋</div><h3>No one is onboarding on your team right now</h3><p>${esc(what)}</p></div>`;

  // ---------- MANAGER: 1:1 agenda templates and notes (B2) ----------
  function defaultOoForm(h) {
    const used = new Set((h.oneOnOnes || []).map((n) => n.templateId));
    const tpl = OB.ONE_ON_ONE_TEMPLATES.find((t) => !used.has(t.id)) || OB.ONE_ON_ONE_TEMPLATES[0];
    return { hireId: h.id, templateId: tpl.id, date: OB.suggestedOneOnOneDate(h, tpl.id, today()), time: tpl.id === "first" ? oneOnOneSlot(h).start : "14:00" };
  }
  function ooEntry(h, n) {
    const pc = OB.pointsCovered(n);
    const fu = (n.followUps || []).length;
    const label = `${n.title}, ${OB.shortDay(n.date)} at ${OB.fmtTime(n.time)}: ${pc.done} of ${pc.total} points covered${fu ? `, ${fu} follow-up${fu === 1 ? "" : "s"}` : ""}. Open the note`;
    return `
      <li><button class="oo-entry" data-action="oo-open" data-hire="${esc(h.id)}" data-note="${esc(n.id)}" aria-label="${esc(label)}">
        <span class="oo-date" aria-hidden="true"><strong>${esc(weekdayShort(n.date))}</strong><span>${esc(shortDate(n.date))}</span></span>
        <span class="oo-main"><strong>${esc(n.title)}</strong><span class="muted small">${esc(OB.fmtTime(n.time))} · ${pc.done} of ${pc.total} points covered${fu ? ` · ${fu} follow-up${fu === 1 ? "" : "s"}` : ""}</span></span>
        <span class="oo-go" aria-hidden="true">›</span>
      </button></li>`;
  }
  function renderOneOnOnes(v) {
    const td = today();
    const head = `<section class="page-head"><h1>1:1s</h1><p class="lead">Agendas for the early 1:1s. Tick points as you cover them, keep notes, and turn follow-ups into plan tasks.</p></section>`;
    const h = pickedHire(v);
    if (!h) return head + noHiresCard("When someone joins your team, you can plan your 1:1s with them here.");
    const note = (ui.route || {}).noteId ? (h.oneOnOnes || []).find((n) => n.id === ui.route.noteId) : null;
    if (note) return renderOneOnOneNote(h, note, v);
    const f = ui.ooForm && ui.ooForm.hireId === h.id ? ui.ooForm : defaultOoForm(h);
    const er = ui.ooErrors || {};
    const tpl = OB.oneOnOneTemplate(f.templateId) || OB.ONE_ON_ONE_TEMPLATES[0];
    const name = firstName(h.name);
    const lists = OB.oneOnOnesFor(h, td);
    const err = (k) => (er[k] ? `<small class="err">${esc(er[k])}</small>` : "");
    return `
      ${head}
      ${hirePicker(v, "oneonones", h)}
      <form class="card form oo-form" id="oo-form" data-hire="${esc(h.id)}" novalidate>
        <h2 class="section-title">Start a 1:1 note with ${esc(name)}</h2>
        <div class="row">
          <label class="field grow ${er.templateId ? "has-err" : ""}"><span>Agenda template</span>
            <select name="templateId">${OB.ONE_ON_ONE_TEMPLATES.map((t) => `<option value="${t.id}" ${t.id === tpl.id ? "selected" : ""}>${esc(t.title)}</option>`).join("")}</select>${err("templateId")}</label>
          <label class="field ${er.date ? "has-err" : ""}"><span>Date</span><input type="date" name="date" value="${esc(f.date)}" />${err("date")}</label>
          <label class="field oo-time ${er.time ? "has-err" : ""}"><span>Time</span><input type="time" name="time" value="${esc(f.time)}" />${err("time")}</label>
        </div>
        <p class="muted small oo-tpl-hint">${tpl.points.length} talking points, starting with “${esc(tpl.points[0])}”.</p>
        <div class="actions"><button type="submit" class="btn primary">Start note</button></div>
      </form>
      <section class="card">
        <h2 class="section-title">Planned</h2>
        ${lists.planned.length ? `<ul class="oo-list">${lists.planned.map((n) => ooEntry(h, n)).join("")}</ul>` : `<p class="empty-sm">Nothing planned with ${esc(name)} yet. Start one above.</p>`}
      </section>
      <section class="card">
        <h2 class="section-title">Past</h2>
        ${lists.past.length ? `<ul class="oo-list">${lists.past.map((n) => ooEntry(h, n)).join("")}</ul>` : `<p class="empty-sm">No past 1:1s with ${esc(name)} yet.</p>`}
      </section>`;
  }
  function renderOneOnOneNote(h, note, v) {
    const td = today();
    const name = firstName(h.name);
    const planned = note.date >= td;
    const pc = OB.pointsCovered(note);
    const fe = ui.fuErrors || {};
    const fte = ui.fuTaskErrors || {};
    const fus = (note.followUps || [])
      .map((f) => {
        const task = f.taskId ? h.tasks.find((t) => t.id === f.taskId) : null;
        let right;
        if (task)
          right = `<span class="fu-in">${ICON.done}<span>In ${esc(name)}'s plan</span></span>
            <button class="link link-pad" data-action="open-hire" data-hire="${esc(h.id)}" data-task="${esc(task.id)}" aria-label="${esc(`Open the task '${task.title}' in ${name}'s plan`)}">Open task</button>`;
        else if (ui.fuTask && ui.fuTask.fuId === f.id) {
          const ft = ui.fuTask;
          right = `
            <form class="fu-task-form" id="fu-task-form" data-hire="${esc(h.id)}" data-note="${esc(note.id)}" data-fu="${esc(f.id)}" novalidate>
              <div class="row">
                <label class="field"><span>Who does it</span><select name="owner">
                  ${["newhire", "manager", "it", "hr"].map((o) => `<option value="${o}" ${ft.owner === o ? "selected" : ""}>${o === "newhire" ? esc(h.name) : o === "manager" ? "You" : OB.OWNERS[o]}</option>`).join("")}
                </select></label>
                <label class="field ${fte.dueDate ? "has-err" : ""}"><span>Due</span><input type="date" name="dueDate" value="${esc(ft.dueDate)}" min="${OB.addDays(h.startDate, -30)}" max="${OB.addDays(h.startDate, 27)}" />
                  ${fte.dueDate ? `<small class="err">${esc(fte.dueDate)}</small>` : ""}</label>
              </div>
              ${fte.title ? `<p class="err">${esc(fte.title)}</p>` : ""}
              <div class="actions"><button type="submit" class="btn btn-sm primary">Add to plan</button><button type="button" class="btn btn-sm" data-action="fu-cancel">Cancel</button></div>
            </form>`;
        } else
          right = `<button class="btn btn-sm" data-action="fu-plan" data-hire="${esc(h.id)}" data-note="${esc(note.id)}" data-fu="${esc(f.id)}" aria-label="${esc(`Add '${f.text}' to ${name}'s plan as a task`)}">+ Add to ${esc(name)}'s plan</button>`;
        return `<li class="fu"><p class="fu-text">${esc(f.text)}</p><div class="fu-right">${right}</div></li>`;
      })
      .join("");
    return `
      <button class="link back" data-action="oo-open" data-hire="${esc(h.id)}" data-note="">← All 1:1s with ${esc(name)}</button>
      <section class="card oo-note">
        <div class="toolbar oo-head">
          <div>
            <h1 class="oo-title">${esc(note.title)}</h1>
            <p class="muted">With ${esc(h.name)} · ${esc(OB.shortDay(note.date))} · ${esc(OB.fmtTime(note.time))}</p>
            <div class="chips">${planned ? statusChip("upcoming", "Planned") : statusChip("done", "Held")}</div>
          </div>
          ${planned ? `<button class="btn" data-action="oo-ics" data-hire="${esc(h.id)}" data-note="${esc(note.id)}">${ICON.calendar} Add to calendar</button>` : ""}
        </div>
        <fieldset class="oo-points">
          <legend><span class="section-title">Talking points</span> <span class="muted small">${pc.done} of ${pc.total} covered</span></legend>
          ${(note.points || [])
            .map(
              (p, i) =>
                `<label class="check-line oo-pt ${p.done ? "on" : ""}" for="oo-pt-${i}"><input type="checkbox" id="oo-pt-${i}" data-oo-point="${i}" data-hire="${esc(h.id)}" data-note="${esc(note.id)}" ${p.done ? "checked" : ""} /><span>${esc(p.text)}</span></label>`
            )
            .join("")}
        </fieldset>
        <label class="field oo-notes-field"><span>Notes</span>
          <textarea id="oo-notes" data-hire="${esc(h.id)}" data-note="${esc(note.id)}" rows="4" maxlength="2000" placeholder="Anything worth remembering from this conversation">${esc(note.notes)}</textarea>
          <small class="muted">Saved when you click or tab away.</small></label>
        <h2 class="section-title oo-fu-title">Follow-ups</h2>
        ${fus ? `<ul class="fu-list">${fus}</ul>` : `<p class="empty-sm">No follow-ups yet.</p>`}
        <form class="fu-add" id="fu-form" data-hire="${esc(h.id)}" data-note="${esc(note.id)}" novalidate>
          <label class="field grow ${fe.text ? "has-err" : ""}"><span>New follow-up</span>
            <input name="text" maxlength="170" value="${esc(ui.fuText)}" placeholder="e.g. Share the on-call rota doc" />
            ${fe.text ? `<small class="err">${esc(fe.text)}</small>` : ""}</label>
          <button type="submit" class="btn">Add follow-up</button>
        </form>
      </section>`;
  }
  function downloadOneOnOneIcs(h, note) {
    const ics = OB.buildIcs(OB.oneOnOneEvent(note, h, icsStamp()));
    downloadIcs(ics, `mangoapps-1on1-${firstName(h.name).toLowerCase()}-${note.date}.ics`, `Calendar file downloaded. Open it to add “${note.title}” with ${firstName(h.name)}.`);
  }

  // ---------- MANAGER: 30/60/90-day goals (B3) ----------
  function goalRowMgr(h, g) {
    const name = firstName(h.name);
    return `
      <li class="goal">
        <div class="goal-main">
          <p class="goal-title"><strong>${esc(g.title)}</strong></p>
          ${g.desc ? `<p class="muted small">${esc(g.desc)}</p>` : ""}
          ${g.note ? `<p class="goal-note"><span>${esc(name)}'s note:</span> ${esc(g.note)}</p>` : ""}
        </div>
        <div class="goal-st">
          ${goalStatusChip(g.status)}
          <select class="goal-sel" data-goal-status="${esc(g.id)}" data-hire="${esc(h.id)}" id="gs-${esc(g.id)}" aria-label="${esc(`Status of '${g.title}'`)}">
            ${Object.entries(OB.GOAL_STATUS).map(([k, w]) => `<option value="${k}" ${g.status === k ? "selected" : ""}>${esc(w)}</option>`).join("")}
          </select>
          <button class="link danger link-pad" data-action="goal-remove" data-hire="${esc(h.id)}" data-goal="${esc(g.id)}" aria-label="${esc(`Remove goal: ${g.title}`)}">Remove</button>
        </div>
      </li>`;
  }
  function renderGoals(v) {
    const head = `<section class="page-head"><h1>30/60/90-day goals</h1><p class="lead">A few clear goals per person. They see them, read-only, in their plan.</p></section>`;
    const h = pickedHire(v);
    if (!h) return head + noHiresCard("When someone joins your team, you can set their 30/60/90-day goals here.");
    const name = firstName(h.name);
    const d = ui.goalDraft && ui.goalDraft.hireId === h.id ? ui.goalDraft : { hireId: h.id, horizon: "30", title: "", desc: "" };
    const er = ui.goalErrors || {};
    const sugg = OB.suggestedGoalsFor(h);
    const horizons = OB.goalHorizons(h)
      .map(
        (x) => `
        <section class="card goal-h" id="goals-${x.horizon}">
          <h2 class="section-title">First ${x.horizon} days</h2>
          <p class="gh-line"><strong>${esc(x.line)}</strong></p>
          ${x.goals.length ? `<ul class="goal-list">${x.goals.map((g) => goalRowMgr(h, g)).join("")}</ul>` : `<p class="empty-sm">No goals for the first ${x.horizon} days yet.</p>`}
        </section>`
      )
      .join("");
    return `
      ${head}
      ${hirePicker(v, "goals", h)}
      ${horizons}
      <section class="card">
        <h2 class="section-title">Suggested starter goals for ${esc(h.department)}</h2>
        ${
          sugg.length
            ? `<ul class="sg-list">${sugg
                .map(
                  (g) => `
              <li class="sg"><span class="sg-h">${g.horizon} days</span>
                <div class="sg-body"><strong>${esc(g.title)}</strong><span class="muted small">${esc(g.desc)}</span></div>
                <button class="btn btn-sm" data-action="goal-suggest" data-hire="${esc(h.id)}" data-goal="${esc(g.id)}" aria-label="${esc(`Add goal for ${name}: ${g.title} (${g.horizon} days)`)}">+ Add</button></li>`
                )
                .join("")}</ul>`
            : `<p class="empty-sm">All the suggestions are in ${esc(name)}'s goals.</p>`
        }
      </section>
      <form class="card form" id="goal-form" data-hire="${esc(h.id)}" novalidate>
        <h2 class="section-title">Add your own goal for ${esc(name)}</h2>
        <div class="row">
          <label class="field ${er.horizon ? "has-err" : ""}"><span>By</span><select name="horizon">${OB.GOAL_HORIZONS.map((n) => `<option value="${n}" ${String(d.horizon) === String(n) ? "selected" : ""}>${n} days</option>`).join("")}</select></label>
          <label class="field grow ${er.title ? "has-err" : ""}"><span>Goal</span><input name="title" maxlength="130" value="${esc(d.title)}" placeholder="e.g. Present a demo at the team meeting" />${er.title ? `<small class="err">${esc(er.title)}</small>` : ""}</label>
        </div>
        <label class="field ${er.desc ? "has-err" : ""}"><span>Details <span class="opt">(optional)</span></span><input name="desc" maxlength="250" value="${esc(d.desc)}" />${er.desc ? `<small class="err">${esc(er.desc)}</small>` : ""}</label>
        <div class="actions"><button type="submit" class="btn primary">Add goal</button></div>
      </form>`;
  }

  // ---------- MANAGER: gentle nudges, demo notifications (B4) ----------
  const nowHHMM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const channelWord = (c) => (c === "inapp" ? "In-app" : OB.NOTIFY_CHANNELS[c] || c);
  // A digest or nudge line as a link to what it mentions (U3).
  function msgLineButton(l) {
    let attrs = "";
    if (l.taskId) attrs = `data-action="open-hire" data-hire="${esc(l.hireId)}" data-task="${esc(l.taskId)}"`;
    else if (l.show === "readiness") attrs = `data-action="mgr-tab" data-tab="readiness"`;
    else if (l.show === "oneonone") attrs = `data-action="mgr-1on1s" data-hire="${esc(l.hireId)}"`;
    else if (l.show === "catchup") attrs = `data-action="open-hire" data-hire="${esc(l.hireId)}" data-show="catchup"`;
    else if (l.hireId) attrs = `data-action="open-hire" data-hire="${esc(l.hireId)}"`;
    return attrs ? `<li><button class="link pv-line" ${attrs}>${esc(l.text)}</button></li>` : `<li>${esc(l.text)}</li>`;
  }
  function currentPreview(v) {
    const td = today();
    const prefs = OB.notifyPrefsFor(state, v.id);
    if (ui.previewKind === "nudge") {
      const nh = OB.nudgeHire(state.hires, v.id, td);
      return { kind: "nudge", hire: nh, msg: nh ? OB.buildNudge(v, nh, td) : null, prefs };
    }
    return { kind: "digest", hire: null, msg: OB.buildDigest(v, state.hires, td, prefs), prefs };
  }
  function renderNotifications(v) {
    const td = today();
    const prefs = OB.notifyPrefsFor(state, v.id);
    const pv = currentPreview(v);
    const box = (id, field, checked, label, value) =>
      `<label class="check-line" for="${id}"><input type="checkbox" id="${id}" data-notify="${field}" ${value ? `value="${value}"` : ""} ${checked ? "checked" : ""} /> ${label}</label>`;
    const chatHtml = (text) =>
      text
        .split("\n")
        .map((ln, i) => (i === 0 ? `<strong>${esc(ln.replace(/^\*|\*$/g, ""))}</strong>` : esc(ln)))
        .join("<br>");
    let preview;
    if (!pv.msg)
      preview = `<p class="empty-sm">Nobody on your team is starting soon, so there's no day-before nudge to preview.</p>`;
    else
      preview = `
        <div class="pv-grid">
          <figure class="pv-pane">
            <figcaption>${ICON.mail} Email</figcaption>
            <div class="pv-email">
              <dl class="pv-hdr">
                <div><dt>From</dt><dd>MangoApps Onboarding</dd></div>
                <div><dt>To</dt><dd>${esc(v.name)}</dd></div>
                <div><dt>Subject</dt><dd><strong>${esc(pv.msg.email.subject)}</strong></dd></div>
              </dl>
              <div class="pv-text">${esc(pv.msg.email.body)}</div>
            </div>
          </figure>
          <figure class="pv-pane">
            <figcaption>${ICON.chat} Slack or Teams message</figcaption>
            <div class="pv-chat">
              <span class="logo pv-logo" aria-hidden="true">MA</span>
              <div class="pv-chat-body"><p class="pv-who"><strong>MangoApps Onboarding</strong> <span class="pv-app">App</span></p><div class="pv-text">${chatHtml(pv.msg.chat)}</div></div>
            </div>
          </figure>
        </div>
        <div class="pv-links">
          <h3 class="pv-links-title">In the app, each line opens what it mentions</h3>
          <ul>${pv.msg.lines.map(msgLineButton).join("")}</ul>
        </div>`;
    const when =
      pv.kind === "digest"
        ? `Arrives every ${prefs.digestDay} at ${OB.fmtTime(prefs.digestTime)} · ${OB.channelSummary(prefs)}.`
        : pv.hire
          ? `Arrives the day before ${firstName(pv.hire.name)} starts (${OB.shortDay(OB.addDays(pv.hire.startDate, -1))}) · ${OB.channelSummary(prefs)}.${prefs.dayBefore ? "" : " It's turned off, so this is only a preview."}`
          : "";
    const mine = (state.outbox || []).filter((e) => e.fromId === v.id);
    const outbox = mine.length
      ? `<ul class="ob-list">${mine
          .map(
            (e) => `
          <li class="ob">
            <div class="ob-top"><span class="ob-ch">${e.channel === "email" ? ICON.mail : ICON.chat}${esc(channelWord(e.channel))}</span><span class="demo-tag">${esc(e.label)}</span></div>
            <p class="ob-sub"><strong>${esc(e.subject)}</strong></p>
            <p class="muted small">To ${esc(e.to)} · ${esc(OB.shortDay(e.date))} · ${esc(OB.fmtTime(e.time))}${e.kind === "reminder" ? " · Reminder" : " · Test"}</p>
            <details class="ob-body" data-fold="ob-${esc(e.id)}" ${ui.folds[`ob-${e.id}`] ? "open" : ""}><summary>Show message</summary><div class="pv-text">${esc(e.body)}</div></details>
          </li>`
          )
          .join("")}</ul>`
      : `<p class="empty-sm">Nothing here yet. Send a test above, or send a reminder from Day-1 readiness.</p>`;
    return `
      <section class="page-head"><h1>Notifications</h1>
        <p class="lead">Gentle nudges about onboarding, where you want them. This is a demo: nothing is sent, and test messages land in the demo outbox below.</p></section>
      <section class="card notify-prefs">
        <h2 class="section-title">Your preferences</h2>
        <fieldset class="field np-group"><legend>Where to get nudges</legend>
          <div class="np-opts">${Object.entries(OB.NOTIFY_CHANNELS)
            .map(([c, w]) => box(`nc-${c}`, "channel", prefs.channels.includes(c), esc(w), c))
            .join("")}</div>
          <p class="muted small np-hint">Now: ${esc(OB.channelSummary(prefs))}. “In-app only” turns the others off.</p>
        </fieldset>
        <fieldset class="field np-group"><legend>Weekly digest</legend>
          <div class="row np-row">
            <label class="field"><span>Day</span><select id="nd-day" data-notify="digestDay">${OB.NOTIFY_DAYS.map((d) => `<option ${prefs.digestDay === d ? "selected" : ""}>${d}</option>`).join("")}</select></label>
            <label class="field"><span>Time</span><input type="time" id="nd-time" data-notify="digestTime" value="${esc(prefs.digestTime)}" /></label>
          </div>
        </fieldset>
        ${box("nd-daybefore", "dayBefore", prefs.dayBefore, "Day-before nudge when someone is about to start")}
        ${box("nd-todo", "todoReminders", prefs.todoReminders, "Reminders for your own to-dos")}
        <p class="muted small">Changes save as you make them.</p>
      </section>
      <section class="card notify-preview" aria-labelledby="pv-title">
        <h2 class="section-title" id="pv-title">Preview</h2>
        <div class="pv-switch" role="group" aria-label="Which message to preview">
          <button class="tpl-pick ${pv.kind === "digest" ? "on" : ""}" data-action="pv-kind" data-kind="digest" aria-pressed="${pv.kind === "digest"}">Weekly digest</button>
          <button class="tpl-pick ${pv.kind === "nudge" ? "on" : ""}" data-action="pv-kind" data-kind="nudge" aria-pressed="${pv.kind === "nudge"}">Day-before nudge</button>
        </div>
        ${when ? `<p class="muted small pv-when">${esc(when)}</p>` : ""}
        ${preview}
        <div class="actions pv-actions">
          <button class="btn primary" data-action="send-test" ${pv.msg ? "" : "disabled"}>${ICON.send} Send test</button>
          <span class="demo-tag">Demo — not actually sent</span>
        </div>
      </section>
      <section class="card outbox" id="outbox" tabindex="-1">
        <div class="toolbar"><h2 class="section-title inline">Demo outbox</h2>${mine.length ? `<button class="btn btn-sm btn-quiet" data-action="outbox-clear">Clear outbox</button>` : ""}</div>
        <p class="muted small">Tests and reminders you “send” land here, marked Demo — not actually sent. Nothing leaves this browser.</p>
        ${outbox}
      </section>`;
  }

  // ---------- MANAGER: dialogs (buddy picker, send a reminder) ----------
  function renderModal() {
    const m = ui.modal;
    if (!m) return "";
    const h = hireById(m.hireId);
    if (!h) return "";
    const name = firstName(h.name);
    let inner = "";
    if (m.kind === "buddy") {
      const team = OB.teamFor(h.department);
      const sugg = OB.defaultBuddyId(h.department);
      const pick = m.pick || h.buddyId || sugg;
      inner = team
        ? `<form id="buddy-form" data-hire="${esc(h.id)}" novalidate>
            <h2 id="modal-title" class="section-title">Choose ${esc(name)}'s buddy</h2>
            <p class="muted small">Someone on the ${esc(h.department)} team ${esc(name)} can ask anything. Saving ticks off “Assign an onboarding buddy”, and ${esc(name)}'s Team page shows them.</p>
            <fieldset class="bp-list"><legend class="sr-only">${esc(h.department)} team</legend>
              ${team.members
                .map(
                  (p) => `
                <label class="bp-opt ${p.id === pick ? "on" : ""}" for="bp-${esc(p.id)}">
                  <input type="radio" name="buddy" id="bp-${esc(p.id)}" value="${esc(p.id)}" ${p.id === pick ? "checked" : ""} />
                  <span class="avatar" aria-hidden="true">${esc(initials(p.name))}</span>
                  <span class="bp-body"><strong>${esc(p.name)}</strong>${p.id === sugg ? ` <span class="bp-sugg">Suggested</span>` : ""}<span class="muted small">${esc(p.title)} · ask about ${esc(p.ask)}</span></span>
                </label>`
                )
                .join("")}
            </fieldset>
            <div class="actions"><button type="submit" class="btn primary">Save buddy</button><button type="button" class="btn" data-action="modal-close">Cancel</button></div>
          </form>`
        : `<h2 id="modal-title" class="section-title">No team list for ${esc(h.department)}</h2><div class="actions"><button type="button" class="btn" data-action="modal-close">Close</button></div>`;
    } else if (m.kind === "remove-hire") {
      const mgr = person(h.managerId);
      inner = `
        <h2 id="modal-title" class="section-title">Remove ${esc(h.name)}'s onboarding plan?</h2>
        <p>${esc(name)} and the plan leave every list${mgr ? `, including ${esc(firstName(mgr.name))}'s Team view` : ""}. This can't be undone in the app, apart from Undo for the next few seconds.</p>
        <div class="actions"><button type="button" class="btn danger-solid" data-action="remove-confirm" data-hire="${esc(h.id)}">Remove plan</button><button type="button" class="btn" data-action="modal-close">Keep it</button></div>`;
    } else if (m.kind === "remind") {
      const d = m.draft;
      const er = m.errors || {};
      const err = (k) => (er[k] ? `<small class="err">${esc(er[k])}</small>` : "");
      inner = `
        <form id="remind-form" novalidate>
          <h2 id="modal-title" class="section-title">Send a reminder</h2>
          <p class="demo-note" role="note">${ICON.shield}<span><strong>Demo — not actually sent.</strong> Saving puts it in your demo outbox. Nothing leaves this browser.</span></p>
          <div class="row">
            <label class="field ${er.to ? "has-err" : ""}"><span>To</span><input name="to" maxlength="80" value="${esc(d.to)}" />${err("to")}</label>
            <label class="field ${er.channel ? "has-err" : ""}"><span>Send by</span><select name="channel">${Object.keys(OB.NOTIFY_CHANNELS)
              .map((c) => `<option value="${c}" ${d.channel === c ? "selected" : ""}>${esc(channelWord(c))}</option>`)
              .join("")}</select>${err("channel")}</label>
          </div>
          <label class="field ${er.subject ? "has-err" : ""}"><span>Subject</span><input name="subject" maxlength="150" value="${esc(d.subject)}" />${err("subject")}</label>
          <label class="field ${er.body ? "has-err" : ""}"><span>Message</span><textarea name="body" rows="7" maxlength="1300">${esc(d.body)}</textarea>${err("body")}</label>
          <div class="actions"><button type="submit" class="btn primary">${ICON.send} Save to demo outbox</button><button type="button" class="btn" data-action="modal-close">Cancel</button></div>
        </form>`;
    }
    return `
      <div class="modal-wrap">
        <div class="modal-bg" data-action="modal-close" aria-hidden="true"></div>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${inner}</div>
      </div>`;
  }

  // ---------- HIRE DETAIL (manager + HR) ----------
  function renderDetail(hire, v) {
    const td = today();
    const s = OB.hireStats(hire, td);
    const role = v.role;
    const canEdit = role === "hr" || (role === "manager" && hire.managerId === v.id);
    // C2b: opened from Compliance, the back link goes back there.
    const moreBack = role === "hr" && ui.hrTab === "more" && ui.hrSub ? MORE_ITEMS.find(([id]) => id === ui.hrSub) : null;
    const backLabel = role === "hr" ? (moreBack ? `Back to ${moreBack[1]}` : "All new hires") : "Your new hires";
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

    // U3: drill-down. "3 to catch up" (and the other chips, readiness items, digest lines, 1:1 follow-ups) open
    // this page filtered to just those tasks, scrolled into view, with "Show the whole plan" to go back.
    const filt = ui.detailTask ? { task: ui.detailTask } : ui.detailShow ? { show: ui.detailShow } : null;
    const remind = role === "manager" && hire.managerId === v.id;
    let filterCard = "";
    if (filt) {
      const ft = OB.filterTasks(hire, filt, td);
      const what = OB.showLabel(filt, ft.length);
      filterCard = `
        <section class="card filter-card" id="detail-filter" tabindex="-1" aria-labelledby="filter-title">
          <div class="toolbar">
            <h2 class="section-title inline" id="filter-title">${filt.task ? `One task in ${esc(firstName(hire.name))}'s plan` : `Showing ${esc(what)} for ${esc(firstName(hire.name))}`}</h2>
            <button class="btn btn-sm btn-quiet" data-action="open-hire" data-hire="${esc(hire.id)}">Show the whole plan</button>
          </div>
          ${
            ft.length
              ? `<ul class="tasks tasks-compact">${ft.map((t) => taskRow(t, hire, role, { compact: false, showSource: true, remind, highlight: filt.task })).join("")}</ul>`
              : `<p class="empty-sm">Nothing here any more. Everything in this list is done.</p>`
          }
        </section>`;
    }
    return `
        <button class="link back" data-action="close-hire">${ICON.back} ${role === "manager" ? "Back to Team" : backLabel}</button>
        <section class="hero hero-detail">
          <div class="hd-left">
            <span class="avatar lg">${initials(hire.name)}</span>
            <div>
              <h1>${esc(hire.name)}</h1>
              <p class="lead">${esc(hire.title)} · ${esc(hire.department)} · reports to ${esc(personName(hire.managerId))}</p>
              <p class="muted">${esc(dayLabel(hire))}</p>
              <p class="muted small hd-profile">${esc(OB.hireProfile(hire).workType)} · ${esc(OB.hireProfile(hire).jobLevel)}${
                OB.roleById(hire.role, state.roles) ? ` · Role: ${esc(OB.roleById(hire.role, state.roles).name)}` : ""
              } · ${
                OB.buddyFor(hire) ? `Buddy: ${esc(OB.buddyFor(hire).name)}` : "Buddy: not picked yet"
              }</p>
            </div>
          </div>
          <div class="hero-progress">
            ${statusChipButtons(hire, s, role)}
            ${bulletGraph(s, { name: hire.name, noText: true })}
          </div>
        </section>
        ${phaseStepper(hire, s)}
        ${filterCard}
        ${filt ? "" : role === "manager" ? managerExtrasCard(hire) : ""}
        ${role === "hr" && !filt ? hireFormsCard(hire) : ""}
        ${
          s.overdue.length && !filt
            ? `<section class="card warn"><h2 class="section-title">Past their date</h2><ul class="tasks tasks-compact">${OB.sortTasks(s.overdue).map((t) => taskRow(t, hire, role, { compact: true, showSource: true, remind })).join("")}</ul></section>`
            : ""
        }
        ${filt ? "" : `<div class="toolbar">
          <h2 class="section-title inline">Full plan</h2>
          <div class="toolbar-actions">
            ${canEdit && !tf ? `<button class="btn" data-action="new-task" data-hire="${esc(hire.id)}">+ Add a task</button>` : ""}
            <button class="btn" data-action="view-as" data-hire="${esc(hire.id)}">See what ${esc(firstName(hire.name))} sees</button>
            ${role === "hr" ? `<button class="btn" data-action="edit-hire" data-hire="${esc(hire.id)}">Edit hire</button>` : ""}
            ${role === "hr" ? `<button class="btn danger" data-action="delete-hire" data-hire="${esc(hire.id)}" aria-label="${esc(`Remove ${hire.name}`)}">Remove</button>` : ""}
          </div>
        </div>
        ${form}
        ${phaseSections(hire, role, { currentOnly: true, skipIds: new Set(s.overdue.map((t) => t.id)), showSource: true, canRemove: canEdit, remind })}
        <p class="muted small legend">You can tick off tasks assigned to ${role === "hr" ? "HR and IT" : "you"}. Other tasks are completed by the person they're assigned to.</p>`}`;
  }

  // Manager's hire detail: goals per horizon and 1:1s, each line a link to its tab (U3).
  function managerExtrasCard(hire) {
    const td = today();
    const name = firstName(hire.name);
    const hs = OB.goalHorizons(hire);
    const oo = OB.oneOnOnesFor(hire, td);
    const next = oo.planned[0];
    return `
      <section class="card mx-card">
        <div class="mx-col">
          <h2 class="section-title">Goals</h2>
          <ul class="mx-list">${hs
            .map((x) => `<li><button class="link" data-action="mgr-goals" data-hire="${esc(hire.id)}" aria-label="${esc(`${name}'s goals, ${x.line}. Open Goals`)}">${esc(x.line)}</button></li>`)
            .join("")}</ul>
        </div>
        <div class="mx-col">
          <h2 class="section-title">1:1s</h2>
          <ul class="mx-list">
            ${next ? `<li><button class="link" data-action="oo-open" data-hire="${esc(hire.id)}" data-note="${esc(next.id)}">Next: ${esc(next.title)} · ${esc(OB.shortDay(next.date))}</button></li>` : `<li class="muted">None planned yet</li>`}
            <li><button class="link" data-action="mgr-1on1s" data-hire="${esc(hire.id)}">${oo.all.length ? `All 1:1s with ${esc(name)} (${oo.all.length})` : `Start a 1:1 note`}</button></li>
          </ul>
        </div>
      </section>`;
  }

  // ---------- HR VIEW ----------
  // Round 4, pass C1: five tabs. Hires · + Add · Templates · Insights · More (Bulk import, and the C2 pages).
  // Where HR is (page, hire, edit form) and the filter bar live in the URL hash (#/hr/..., OB.parseHrRoute), so Back
  // works. (The pass C1 filter bar was removed in pass C2 at the user's request.)
  const HR_TABS = [
    // [id, label, short label for narrow phones]
    ["hires", "New hires", "Hires"],
    ["add", "+ Add new hire", "+ Add"],
    ["templates", "Plan templates", "Templates"],
    ["insights", "Insights", "Insights"],
    ["more", "More", "More"],
  ];
  const hrRows = () => {
    const td = today();
    return state.hires.map((h) => ({ h, s: OB.hireStats(h, td) }));
  };
  const pct = (x) => `${(x * 100).toFixed(2)}%`;
  // The status icon that goes with a hire status word (statusChip kinds).
  const STATUS_KIND = { action: "action", behind: "behind", waiting: "waiting", upcoming: "upcoming", ontrack: "done", complete: "done" };

  function hrTabs(tab) {
    return `
      <nav class="tabs hr-tabs" aria-label="HR pages">
        ${HR_TABS.map(
          ([id, l, sh]) =>
            `<button ${tab === id ? `aria-current="page" ` : ""}class="${tab === id ? "on" : ""}" data-action="hr-tab" data-tab="${id}" ${l !== sh ? `aria-label="${l}"` : ""}>${
              l !== sh ? `<span class="t-long">${l}</span><span class="t-short" aria-hidden="true">${sh}</span>` : l
            }</button>`
        ).join("")}
      </nav>`;
  }

  function renderHR(v) {
    if (ui.detailId && hireById(ui.detailId)) {
      const h = hireById(ui.detailId);
      return `<main class="wrap">${ui.hrEdit ? renderEditHire(h) : renderDetail(h, v)}</main>`;
    }
    const tab = HR_TABS.some(([id]) => id === ui.hrTab) ? ui.hrTab : "hires";
    let body;
    if (tab === "add") body = ui.hrSub === "bulk" ? renderBulk() : renderAddHire();
    else if (tab === "templates") body = renderTemplates();
    else if (tab === "insights") body = renderInsights();
    else if (tab === "more") body = renderMore();
    else body = renderHireTable();
    return `<main class="wrap"><section class="page-head"><h1>Onboarding</h1><p class="lead">Everyone joining MangoApps in their first four weeks.</p></section>${hrTabs(tab)}${body}</main>`;
  }

  // ---------- HR routes (U2) ----------
  function currentHrRoute() {
    if (ui.detailId) return { page: "hire", hireId: ui.detailId, edit: !!ui.hrEdit };
    return { page: ui.hrTab || "hires", sub: ui.hrSub || undefined };
  }
  function hrPush(r) {
    const hash = OB.buildHrRoute(r);
    ui.lastHash = hash;
    if (location.hash !== hash) location.hash = hash;
  }
  function applyHrRoute(r) {
    Object.assign(ui, { taskForm: null, taskErrors: {}, modal: null, tplEdit: null, detailShow: null, detailTask: null, insPick: null, roleForm: null });
    if (r.page === "hire") {
      const h = hireById(r.hireId);
      ui.detailId = h ? h.id : null;
      ui.hrEdit = h && r.edit ? { hireId: h.id, draft: editDraftFor(h), errors: {}, mgrNote: "" } : null;
      if (!h) ui.hrTab = "hires";
    } else {
      ui.detailId = null;
      ui.hrEdit = null;
      ui.hrTab = r.page;
      ui.hrSub = r.sub || null;
    }
  }
  function hrNav(r, opts) {
    applyHrRoute(r);
    hrPush(r);
    ui.folds = {};
    render();
    if (!(opts && opts.keepScroll)) window.scrollTo(0, 0);
  }
  // KPI numbers (plain numbers since the filter bar was removed in pass C2).
  const KPI = {
    owe: { label: "Manager to-dos", kind: "action" },
    behind: { label: "Hires catching up", kind: "behind" },
    soon: { label: "Starting soon", kind: "upcoming" },
  };

  // "With IT" as a short line, only when IT/HR tasks are past their date and the chip doesn't already say so.
  function waitingNote(s) {
    if (!(s.waitingIt || s.waitingHr) || s.status === "waiting") return "";
    return `<div class="muted small wait-note">With ${[s.waitingIt && "IT", s.waitingHr && "HR"].filter(Boolean).join(" & ")}</div>`;
  }

  // ---------- "Where everyone is" (the round-2 timeline, restored by user request in round 4 C2) ----------
  // One question: "where is everyone in their onboarding?" One row per person: a grey bar for their plan window
  // (a week before start to the end of week 4), filled blue up to Today (time elapsed), one Today line, one status
  // chip. Kept from U5: each name is a button that opens a small pop-up (a bottom sheet on phones) with the details
  // and Open plan / Edit. Phase labels with counts sit above it as plain text.
  const TL = { from: -14, to: 28 };
  const tlX = (d) => `${(((Math.max(TL.from, Math.min(TL.to, d)) - TL.from) / (TL.to - TL.from)) * 100).toFixed(2)}%`;
  const tlTodayLine = (y1, y2) => `<svg x="${tlX(0)}" y="0" overflow="visible"><rect class="tl-today" x="-1" y="${y1}" width="2" height="${y2 - y1}"/></svg>`;

  function whereLane(rows) {
    const td = today();
    const all = rows.filter((r) => r.s.dayN <= 27 && r.s.dayN >= -(TL.to + 7)).sort((a, b) => a.h.startDate.localeCompare(b.h.startDate));
    if (!all.length) return "";
    // How many people are in each phase: plain text.
    const phases = OB.PHASES.map((p) => {
      const n = all.filter((r) => OB.currentPhase(r.h.startDate, td) === p.id).length;
      return `<li class="tl-phase">${esc(p.label)} <span class="tl-phase-n">${n}</span></li>`;
    }).join("");
    const shownRows = all;
    const shown = shownRows.slice(0, 15);
    const tick = (d, anchor, cls) => `<text x="${tlX(d)}" y="14" class="tl-tick${cls ? ` ${cls}` : ""}" text-anchor="${anchor}">${esc(shortDate(OB.addDays(td, d)))}</text>`;
    const axis = `
      <div class="tl-row tl-axis" aria-hidden="true"><span></span>
        <svg width="100%" height="24" focusable="false">${tick(TL.from, "start")}${tick(14, "middle", "tl-tick-mid")}${tick(TL.to, "end")}
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
        const label = `${h.name}, ${h.department}: ${OB.phaseLine(h.startDate, td)}, ${primaryWord(h, s, "hr")}. Show details`;
        return `
          <div class="tl-row">
            <button class="tl-name wl-trigger" data-action="wl-pop" data-key="${esc(h.id)}" data-hires="${esc(h.id)}" aria-expanded="false" aria-controls="wl-pop" aria-label="${esc(label)}"><strong>${esc(h.name)}</strong><span>${esc(h.department)}</span></button>
            <svg width="100%" height="40" aria-hidden="true" focusable="false">${seg(s0, s1, "tl-band")}${seg(s0, fillEnd, "tl-done")}${tlTodayLine(0, 40)}</svg>
            <span class="tl-chip">${primaryChip(h, s, "hr")}</span>
          </div>`;
      })
      .join("");
    const summary = shown.map(({ h, s }) => `${h.name}, ${h.department}: ${dayLabel(h)}, ${primaryWord(h, s, "hr")}.`).join(" ");
    return `
      <section class="card timeline" id="where">
        <h2 class="section-title">Where everyone is</h2>
        <ul class="tl-phases" aria-label="People per phase">${phases}</ul>
        <p class="sr-only">${esc(summary)}</p>
        <div class="tl">${axis}${rowsHtml}</div>
        <p class="muted small tl-help">Select a name for details.${shownRows.length > shown.length ? ` Showing the first 15 of ${shownRows.length}.` : ""}</p>
      </section>`;
  }

  // The pop-up for one person: details + Open plan / Edit. "N of M done" is the same own-tasks count as the table row.
  function wlPopHtml(ids) {
    const td = today();
    const h = hireById(ids[0]);
    if (!h) return "";
    const s = OB.hireStats(h, td);
    const nx = OB.nextOpenTask(h);
    return `
      <div class="wl-pop-head"><p class="wl-pop-name"><strong>${esc(h.name)}</strong><span class="muted small">${esc(h.title)}</span></p><button class="wl-x" data-action="wl-close" aria-label="Close details">×</button></div>
      <dl class="wl-dl">
        <div><dt>Team</dt><dd>${esc(h.department)} · manager ${esc(personName(h.managerId))}</dd></div>
        <div><dt>Start</dt><dd>${esc(OB.shortDay(h.startDate))} · ${esc(OB.phaseLine(h.startDate, td))}</dd></div>
        <div><dt>Status</dt><dd>${primaryChip(h, s, "hr")}</dd></div>
        <div><dt>Own tasks</dt><dd>${s.own.done} of ${s.own.total} done${nx ? ` · next: ${esc(nx.title)}` : ""}</dd></div>
      </dl>
      <div class="wl-pop-act">
        <button class="btn btn-sm primary" data-action="open-hire" data-hire="${esc(h.id)}" aria-label="${esc(`Open ${h.name}'s plan`)}">Open plan</button>
        <button class="btn btn-sm" data-action="edit-hire" data-hire="${esc(h.id)}" aria-label="${esc(`Edit ${h.name}`)}">Edit</button>
      </div>`;
  }
  // Only one pop-up at a time, opened by click / tap / Enter / Space (not hover or focus, so Tab is one stop per
  // person). It sits right after its name button in the row, so Tab moves from the button into it.
  let wlPop = null; // { key, btn }
  function openWlPop(btn) {
    if (wlPop && wlPop.btn === btn) return;
    closeWlPop(false);
    const ids = (btn.dataset.hires || "").split(",").filter(Boolean);
    const el = document.createElement("div");
    el.className = "wl-pop";
    el.id = "wl-pop";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", `${personName(ids[0])}: details`);
    el.innerHTML = wlPopHtml(ids);
    // Phones: a bottom sheet over a light backdrop (CSS); tapping the backdrop closes it.
    const bd = document.createElement("div");
    bd.className = "wl-backdrop";
    bd.dataset.action = "wl-close";
    bd.setAttribute("aria-hidden", "true");
    btn.after(bd, el);
    btn.setAttribute("aria-expanded", "true");
    btn.classList.add("on");
    // Desktop: beside the name, over the bar area, so the names below stay visible and clickable.
    if (!window.matchMedia("(max-width: 640px)").matches) {
      const tw = btn.parentElement.clientWidth;
      const x = btn.offsetLeft + btn.offsetWidth + 12;
      const pw = Math.max(240, Math.min(320, tw - x));
      el.style.width = `${pw}px`;
      el.style.left = `${Math.max(0, Math.min(tw - pw, x))}px`;
    }
    wlPop = { key: btn.dataset.key, btn };
  }
  function closeWlPop(focusBack) {
    if (!wlPop) return;
    const b = wlPop.btn;
    document.getElementById("wl-pop")?.remove();
    document.querySelector(".wl-backdrop")?.remove();
    b.setAttribute("aria-expanded", "false");
    b.classList.remove("on");
    wlPop = null;
    if (focusBack && b.isConnected) b.focus();
  }
  // F7: on narrow screens the date ticks under "Where everyone is" would run together. Keep Today first, then the
  // start/end dates, then the middle one, and hide any label that comes within 8px of one already kept.
  function fitTlTicks() {
    const svg = document.querySelector(".tl-axis svg");
    if (!svg) return;
    const ticks = [...svg.querySelectorAll("text")];
    ticks.forEach((t) => t.classList.remove("tl-tick-hide"));
    const rank = (t) => (t.classList.contains("tl-today-lbl") ? 0 : t.classList.contains("tl-tick-mid") ? 2 : 1);
    const kept = [];
    ticks.sort((a, b) => rank(a) - rank(b)).forEach((t) => {
      const r = t.getBoundingClientRect();
      if (!r.width) return;
      if (kept.some((k) => r.left < k.right + 8 && r.right > k.left - 8)) t.classList.add("tl-tick-hide");
      else kept.push(r);
    });
  }
  window.addEventListener("resize", () => fitTlTicks());
  const inWl = (node) => !!(node && node.closest && (node.closest(".wl-pop") || node.closest(".wl-trigger") || node.closest(".wl-backdrop")));

  function renderHireTable() {
    const td = today();
    const rows = hrRows()
      // Most behind first (most overdue), then soonest start.
      .sort((a, b) => b.s.overdue.length - a.s.overdue.length || a.h.startDate.localeCompare(b.h.startDate));
    const filtered = rows;
    const tiles = Object.entries(KPI)
      .map(([id, k]) => {
        const n = rows.filter((r) => OB.KPI_TESTS[id](r.s)).length;
        return `<div class="stat ${n ? `stat-${k.kind}` : ""}">
            <span class="stat-num">${n}${n ? ICON[k.kind] : ""}</span><span class="stat-lbl">${esc(k.label)}</span></div>`;
      })
      .join("");
    const shownIds = new Set(filtered.map((r) => r.h.id));
    const todos = [];
    for (const h of state.hires) if (shownIds.has(h.id)) for (const t of h.tasks) if ((t.owner === "hr" || t.owner === "it") && !t.done && t.dueDate <= OB.addDays(td, 7)) todos.push({ t, h });
    todos.sort((a, b) => a.t.dueDate.localeCompare(b.t.dueDate));

    return `
      <div class="stats stats-kpi" role="group" aria-label="Key numbers">${tiles}</div>
      ${whereLane(rows)}
      <section class="card" id="hire-list">
        <div class="toolbar">
          <h2 class="section-title inline">New hires</h2>
        </div>
        ${
          !state.hires.length
            ? `<div class="empty"><h3>No new hires yet</h3><p>Add someone to generate their onboarding plan.</p><button class="btn primary" data-action="hr-tab" data-tab="add">+ Add new hire</button></div>`
            : `${bulletKey()}<div class="table-wrap"><table class="table table-hires">
                  <thead><tr><th>Name</th><th>Team</th><th>Start</th><th>Progress</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>
                  <tbody>${filtered
                    .map(
                      ({ h, s }) => `
                    <tr data-action="open-hire" data-hire="${esc(h.id)}" tabindex="0" aria-label="${esc(`${h.name}, ${h.title}. Open plan`)}">
                      <td class="td-name"><strong>${esc(h.name)}</strong><div class="muted small">${esc(h.title)}</div></td>
                      <td class="td-team">${esc(h.department)}<div class="muted small">${esc(personName(h.managerId))}</div></td>
                      <td class="td-start">${esc(shortDate(h.startDate))}<div class="muted small">${esc(weekdayShort(h.startDate))} · ${s.dayN < 0 ? `in ${-s.dayN}d` : s.dayN > 27 ? "done" : `day ${s.dayN + 1}`}</div></td>
                      <td class="td-prog">${bulletGraph(s, { name: h.name })}${catchUpNote(h, s, "hr")}</td>
                      <td class="td-status">${primaryChip(h, s, "hr")}${waitingNote(s)}</td>
                      <td class="td-act"><div class="row-acts">
                        <button class="btn btn-xs btn-quiet" data-action="edit-hire" data-hire="${esc(h.id)}" aria-label="${esc(`Edit ${h.name}`)}">Edit</button>
                        <button class="btn btn-xs btn-quiet" data-action="delete-hire" data-hire="${esc(h.id)}" aria-label="${esc(`Remove ${h.name}`)}">Remove</button>
                      </div></td>
                    </tr>`
                    )
                    .join("")}</tbody></table></div>`
        }
      </section>
      ${todoList(todos, "hr", "HR & IT to-dos this week", "No HR or IT tasks due in the next 7 days.")}`;
  }

  // ---------- C1a. Insights: plain-language numbers and at most 3 simple charts ----------
  // One horizontal bar list per question, one colour. A bar is a button only when it opens something (who / which
  // comments); otherwise (o.action unset) it's a plain bar with its words.
  function hbar(o) {
    if (!o.action)
      return `
      <li class="hb-item">
        <div class="hbar hbar-plain" role="img" aria-label="${esc(o.aria)}">
          <span class="hb-l" aria-hidden="true">${esc(o.label)}</span>
          <span class="hb-row" aria-hidden="true"><span class="hb-track"><span class="hb-fill" style="width:${pct(o.frac > 0 ? Math.max(0.02, Math.min(1, o.frac)) : 0)}"></span></span><span class="hb-v">${esc(o.value)}</span></span>
        </div>
      </li>`;
    return `
      <li class="hb-item">
        <button class="hbar ${o.on ? "on" : ""}" data-action="${o.action}" ${o.data} ${o.expanded != null ? `aria-expanded="${o.expanded}"` : `aria-pressed="${!!o.on}"`} aria-label="${esc(o.aria)}">
          <span class="hb-l">${esc(o.label)}</span>
          <span class="hb-row"><span class="hb-track" aria-hidden="true"><span class="hb-fill" style="width:${pct(o.frac > 0 ? Math.max(0.02, Math.min(1, o.frac)) : 0)}"></span></span><span class="hb-v">${esc(o.value)}</span></span>
        </button>
        ${o.detail || ""}
      </li>`;
  }
  function renderInsights() {
    const td = today();
    const ins = OB.insights(state.hires.concat(state.archive || []), td);
    const pick = ui.insPick || {};
    const lead = `<p class="lead ins-lead">Based on ${ins.hires} ${ins.hires === 1 ? "person" : "people"}: everyone onboarding now and people who finished.</p>`;
    if (!ins.hires) return `${lead}<section class="card"><div class="empty"><p>No onboarding data yet.</p></div></section>`;
    const kpis = `
      <div class="stats stats-kpi" role="group" aria-label="Key numbers">
        <div class="stat"><span class="stat-num">${ins.finished}${ins.finished ? ICON.done : ""}</span><span class="stat-lbl">Finished onboarding</span></div>
        <div class="stat"><span class="stat-num">${ins.week1.avg == null ? "–" : ins.week1.avg}</span><span class="stat-lbl">Days to finish Week 1, on average</span></div>
        <div class="stat"><span class="stat-num">${ins.pulse.answered}</span><span class="stat-lbl">Check-in answers</span></div>
      </div>`;

    // 1. How long does Week 1 take?
    const w = ins.week1;
    const maxD = Math.max(1, ...w.byDept.map((x) => x.avg));
    const c1 = `
      <section class="card chart" aria-labelledby="ch-week1">
        <h2 class="section-title" id="ch-week1">How long does Week 1 take?</h2>
        ${
          w.n
            ? `<p class="ch-head">New hires finish their Week 1 tasks in <strong class="ch-num">${w.avg} days</strong> on average.</p>
               <ul class="hbars">${w.byDept
                 .map((x) =>
                   hbar({
                     label: x.dept, value: `${x.avg} days`, frac: x.avg / maxD,
                     aria: `${x.dept}: ${x.avg} days on average, ${x.n} ${x.n === 1 ? "hire" : "hires"}`,
                   })
                 )
                 .join("")}</ul>
               <p class="muted small">From Day 1 to the day the last Week 1 task was done, for ${w.n} ${w.n === 1 ? "person" : "people"}.</p>`
            : `<p class="empty-sm">Nobody has finished their Week 1 tasks yet.</p>`
        }
      </section>`;

    // 2. Which tasks most often go past their date?
    const top = ins.pastDate;
    const maxC = top.length ? top[0].count : 1;
    const c2 = `
      <section class="card chart" aria-labelledby="ch-past">
        <h2 class="section-title" id="ch-past">Which tasks most often go past their date?</h2>
        ${
          top.length
            ? `<p class="ch-head">“${esc(top[0].title)}” went past its date for <strong class="ch-num">${top[0].count} of ${ins.hires}</strong> people.</p>
               <ul class="hbars">${top
                 .map((t) => {
                   const open = pick.chart === "past" && pick.key === t.key;
                   const detail = open
                     ? `<ul class="hb-detail" aria-label="${esc(`People whose “${t.title}” went past its date`)}">${t.hires
                         .map((x) => `<li><span>${esc(x.name)}</span>${x.archived ? `<span class="muted small">finished onboarding</span>` : `<button class="btn btn-xs" data-action="open-hire" data-hire="${esc(x.id)}" aria-label="${esc(`Open ${x.name}'s plan`)}">Open</button>`}</li>`)
                         .join("")}</ul>`
                     : "";
                   return hbar({
                     label: t.title, value: `${t.count}`, frac: t.count / maxC, action: "ins-pick", data: `data-chart="past" data-key="${esc(t.key)}"`, expanded: open, detail,
                     aria: `${t.title}: went past its date for ${t.count} ${t.count === 1 ? "person" : "people"}. ${open ? "Hide who" : "Show who"}`,
                   });
                 })
                 .join("")}</ul>
               <p class="muted small">Done after its date, or still open with its date passed. Select a task to see who it affected.</p>`
            : `<p class="empty-sm">Every task for these people was done by its date.</p>`
        }
      </section>`;

    // 3. How do new hires feel? (pulse check-ins, anonymous in aggregate)
    const pu = ins.pulse;
    const maxP = Math.max(1, ...Object.values(pu.counts));
    const c3 = `
      <section class="card chart" aria-labelledby="ch-pulse">
        <h2 class="section-title" id="ch-pulse">How do new hires feel?</h2>
        ${
          pu.answered
            ? `<p class="ch-head"><strong class="ch-num">${pu.counts.great} of ${pu.answered}</strong> check-in answers were “Great”.</p>
               <ul class="hbars">${OB.PULSE_ANSWERS.map(([k, l]) => {
                 const n = pu.counts[k];
                 const open = pick.chart === "pulse" && pick.key === k;
                 const cs = pu.comments[k];
                 const detail = open
                   ? pu.showComments
                     ? cs.length
                       ? `<ul class="hb-detail hb-quotes" aria-label="${esc(`Comments with “${l}”`)}">${cs.map((c) => `<li>“${esc(c)}”</li>`).join("")}</ul>`
                       : `<p class="hb-note muted small">No comments with this answer.</p>`
                     : `<p class="hb-note muted small">Comments show once there are at least 3 answers, so no one can be picked out.</p>`
                   : "";
                 return hbar({
                   label: l, value: `${n}`, frac: n / maxP, action: "ins-pick", data: `data-chart="pulse" data-key="${k}"`, expanded: open, detail,
                   aria: `${l}: ${n} ${n === 1 ? "answer" : "answers"}. ${open ? "Hide comments" : "Show comments"}`,
                 });
               }).join("")}</ul>
               <p class="muted small">From the Day 7 and Day 30 check-ins. Comments are shown without names or dates.</p>`
            : `<p class="empty-sm">No check-in answers for these people yet.</p>`
        }
      </section>`;
    return `${lead}${kpis}${c1}${c2}${c3}`;
  }

  // ---------- More: Bulk import, Compliance, Documents (pass C2) ----------
  const MORE_ITEMS = [
    ["bulk", "Bulk import", "Add several new hires at once from a CSV file."],
    ["compliance", "Compliance", "Who has signed and acknowledged what."],
    ["documents", "Documents", "Policies, benefits and team guides."],
  ];
  function renderMore() {
    const sub = MORE_ITEMS.find(([id]) => id === ui.hrSub && id !== "bulk");
    if (sub) {
      const back = `<button class="link back" data-action="hr-more">${ICON.back} Back to More</button>`;
      if (sub[0] === "compliance") return back + renderCompliance();
      return back + renderDocuments();
    }
    return `
      <ul class="more-list" aria-label="More HR tools">${MORE_ITEMS.map(
        ([id, t, d]) => `
        <li><button class="more-item" data-action="hr-more" data-sub="${id}">
          <span class="more-t"><strong>${esc(t)}</strong><span class="muted small">${esc(d)}</span></span>
          <span class="more-go" aria-hidden="true">›</span></button></li>`
      ).join("")}</ul>`;
  }

  // ---------- C2b. Compliance ----------
  function renderCompliance() {
    const td = today();
    const m = OB.complianceMatrix(state.hires, td);
    const head = `
      <section class="page-sub"><h2 class="section-title">Compliance</h2>
        <p class="muted">Acknowledge tasks, plus tasks marked “Required” in the plan templates, for everyone with an onboarding plan.</p></section>`;
    if (!m.total) return `${head}<section class="card"><div class="empty"><p>${esc(m.headline)}.</p></div></section>`;
    const pick = m.columns.some((c) => c.key === ui.compAudit) ? ui.compAudit : null;
    const colStats = (c) => {
      const cells = m.rows.map((r) => r.cells[c.key]).filter((x) => x.state !== "na");
      return { done: cells.filter((x) => x.state === "done").length, of: cells.length };
    };
    const ths = m.columns
      .map((c) => {
        const st = colStats(c);
        const on = pick === c.key;
        return `<th scope="col" class="comp-th"><button class="comp-col ${on ? "on" : ""}" data-action="comp-audit" data-key="${esc(c.key)}" aria-expanded="${on}" aria-controls="comp-audit" aria-label="${esc(`${c.title}: ${st.done} of ${st.of} ${c.ack ? "acknowledged" : "done"}. ${on ? "Hide" : "Show"} the audit trail`)}">
          <span class="comp-col-t">${typeIcon(c)}${esc(c.title)}</span><span class="comp-col-n">${st.done} of ${st.of}</span></button></th>`;
      })
      .join("");
    const body = m.rows
      .map((r) => {
        const h = r.hire;
        const status = r.allDone ? statusChip("done", "All signed") : statusChip("upcoming", `${r.open} not yet`);
        const tds = m.columns
          .map((c) => {
            const cell = r.cells[c.key];
            return `<td class="cc cc-${cell.state}"><span role="img" aria-label="${esc(OB.cellWords(cell, c, h))}">${esc(OB.cellText(cell))}</span></td>`;
          })
          .join("");
        return `<tr><th scope="row" class="comp-person"><button class="link comp-name" data-action="open-hire" data-hire="${esc(h.id)}" aria-label="${esc(`Open ${h.name}'s plan`)}">${esc(h.name)}</button><span class="muted small">${esc(h.department)}</span>${status}</th>${tds}</tr>`;
      })
      .join("");
    // F5: on phones (under 640px) one card per person instead of the wide matrix (CSS shows one or the other).
    const cards = m.rows
      .map((r) => {
        const h = r.hire;
        const status = r.allDone ? statusChip("done", "All signed") : statusChip("upcoming", `${r.open} not yet`);
        const items = m.columns
          .map((c) => {
            const cell = r.cells[c.key];
            const on = pick === c.key;
            const st = cell.state === "na" ? "— Not in plan" : OB.cellText(cell);
            return `<li class="ci ci-${cell.state}"><span class="ci-st" role="img" aria-label="${esc(cell.state === "na" ? `${h.name}, ${c.title}: not in this person's plan` : OB.cellWords(cell, c, h))}">${esc(st)}</span><span class="ci-dot" aria-hidden="true">·</span>
              <button class="link ci-t ${on ? "on" : ""}" data-action="comp-audit" data-key="${esc(c.key)}" data-hire="${esc(h.id)}" aria-expanded="${on}" aria-controls="comp-audit" aria-label="${esc(`${c.title}: ${on ? "hide" : "show"} the audit trail`)}">${typeIcon(c)}${esc(c.title)}</button></li>`;
          })
          .join("");
        return `<li class="comp-pcard"><div class="comp-pc-head"><div class="comp-pc-who"><button class="link comp-name" data-action="open-hire" data-hire="${esc(h.id)}" aria-label="${esc(`Open ${h.name}'s plan`)}">${esc(h.name)}</button><span class="muted small">${esc(h.department)}</span></div>${status}</div><ul class="ci-list">${items}</ul></li>`;
      })
      .join("");
    let audit = "";
    if (pick) {
      const a = OB.auditTrail(m, pick, state.hires);
      audit = `
        <section class="card comp-audit" id="comp-audit" tabindex="-1" aria-labelledby="comp-audit-h">
          <div class="toolbar"><h2 class="section-title inline" id="comp-audit-h">Audit trail: ${esc(a.column.title)}</h2>
            <button class="btn btn-sm btn-quiet" data-action="comp-audit" data-key="${esc(pick)}" aria-label="Close the audit trail">Close</button></div>
          ${
            a.entries.length
              ? `<ol class="audit-list">${a.entries
                  .map((e) => `<li><span class="audit-when">${ICON.done}<strong>${esc(e.at ? OB.dayMd(e.at) : "Date not recorded")}</strong></span><span>${esc(e.text)}.</span></li>`)
                  .join("")}</ol>`
              : `<p class="empty-sm">Nobody has ${a.column.ack ? "acknowledged" : "completed"} this yet.</p>`
          }
          ${a.notYet.length ? `<p class="muted small audit-notyet">${ICON.upcoming} Not yet: ${a.notYet.map((x) => `${esc(x.hireName)} (planned ${esc(OB.dayMd(x.dueDate))})`).join(", ")}.</p>` : ""}
        </section>`;
    }
    return `
      ${head}
      <section class="card comp-card" aria-labelledby="comp-h">
        <div class="toolbar">
          <h2 class="section-title inline" id="comp-h">Who has signed what</h2>
          <button class="btn" data-action="comp-export">Export CSV</button>
        </div>
        <p class="ch-head"><strong class="ch-num">${m.signed} of ${m.total}</strong> ${m.total === 1 ? "person has" : "people have"} everything signed.</p>
        <p class="muted small comp-key"><span aria-hidden="true">✓</span> done, with the date · <span aria-hidden="true">○</span> not yet · <span aria-hidden="true">—</span> not in this person's plan. Select an item for its audit trail.</p>
        <div class="table-wrap comp-wrap" role="region" aria-label="Compliance matrix (scrolls sideways)" tabindex="0">
          <table class="table comp-table"><thead><tr><th scope="col" class="comp-person">Person</th>${ths}</tr></thead><tbody>${body}</tbody></table>
        </div>
        <ul class="comp-cards" aria-label="Who has signed what, one card per person">${cards}</ul>
        <p class="muted small">Export CSV downloads this table plus the audit log. Demo only: the file is made in this browser.</p>
      </section>
      ${audit}`;
  }
  function downloadText(text, filename, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type || "text/csv;charset=utf-8" }));
    const x = document.createElement("a");
    x.href = url;
    x.download = filename;
    document.body.appendChild(x);
    x.click();
    x.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- C2c. Documents ----------
  const audienceOptions = (val) =>
    `<option value="everyone" ${val === "everyone" ? "selected" : ""}>Everyone</option>
     <optgroup label="Department">${OB.DEPARTMENTS.map((x) => `<option value="department:${esc(x)}" ${val === `department:${x}` ? "selected" : ""}>${esc(x)}</option>`).join("")}</optgroup>
     <optgroup label="Job level">${OB.JOB_LEVELS.map((x) => `<option value="level:${esc(x)}" ${val === `level:${x}` ? "selected" : ""}>${esc(OB.audienceLabel({ kind: "level", value: x }))}</option>`).join("")}</optgroup>`;
  function docForm() {
    const e = ui.docEdit;
    const d = e.draft;
    const er = ui.docErrors || {};
    const err = (k) => (er[k] ? `<small class="err">${esc(er[k])}</small>` : "");
    return `
      <form class="doc-form form" id="doc-form" novalidate aria-labelledby="doc-form-h">
        <h3 class="tpl-form-title" id="doc-form-h">${e.id ? "Edit document" : "New document"}</h3>
        <div class="row">
          <label class="field ${er.title ? "has-err" : ""}"><span>Title</span><input id="doc-f-title" name="title" maxlength="110" value="${esc(d.title)}" autocomplete="off" />${err("title")}</label>
          <label class="field ${er.category ? "has-err" : ""}"><span>Category</span><select id="doc-f-category" name="category"><option value="">Choose…</option>${OB.DOC_CATEGORIES.map((c) => `<option ${d.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>${err("category")}</label>
        </div>
        <label class="field ${er.desc ? "has-err" : ""}"><span>Description <span class="opt">(optional)</span></span><textarea id="doc-f-desc" name="desc" rows="2" maxlength="250">${esc(d.desc)}</textarea>${err("desc")}</label>
        <div class="row">
          <label class="field ${er.link ? "has-err" : ""}"><span>Link</span><input id="doc-f-link" name="link" type="url" inputmode="url" maxlength="500" value="${esc(d.link)}" autocomplete="off" placeholder="https://" />${err("link")}</label>
          <label class="field ${er.audience ? "has-err" : ""}"><span>Who sees it</span><select id="doc-f-audience" name="audience">${audienceOptions(d.audience)}</select>${err("audience") || `<small class="muted">New hires see it under My plan.</small>`}</label>
        </div>
        <div class="actions"><button type="submit" class="btn primary">${e.id ? "Save changes" : "Add document"}</button><button type="button" class="btn" data-action="doc-cancel">Cancel</button></div>
      </form>`;
  }
  function docRow(d) {
    if (ui.docEdit && ui.docEdit.id === d.id) return `<li class="doc-item editing">${docForm()}</li>`;
    const usedBy = Object.values(templates()).flat().filter((t) => t && t.docId === d.id).length;
    return `
      <li class="doc-item">
        <div class="doc-main">
          <a class="doc-title" href="${esc(d.link)}" target="_blank" rel="noopener" aria-label="${esc(`${d.title} (opens in a new tab)`)}">${TYPE_ICON.read}<span>${esc(d.title)}</span>${ICON.external}</a>
          ${d.desc ? `<p class="muted small doc-desc">${esc(d.desc)}</p>` : ""}
          <div class="task-meta">
            <span class="chip chip-src">${esc(d.category)}</span>
            <span class="chip chip-rule">${ICON.users}${esc(OB.audienceLabel(d.audience))}</span>
            ${d.updated ? `<span class="muted small">Updated ${esc(shortDate(d.updated))}</span>` : ""}
            ${usedBy ? `<span class="muted small">Linked from ${usedBy} template ${usedBy === 1 ? "task" : "tasks"}</span>` : ""}
          </div>
        </div>
        <div class="tpl-actions">
          <button class="btn btn-sm btn-quiet" data-action="doc-edit" data-doc="${esc(d.id)}" aria-label="${esc(`Edit ${d.title}`)}">Edit</button>
          <button class="btn btn-sm btn-quiet" data-action="doc-remove" data-doc="${esc(d.id)}" aria-label="${esc(`Remove ${d.title}`)}">Remove</button>
        </div>
      </li>`;
  }
  function docResults() {
    const list = OB.searchDocs(docs(), ui.docQuery, ui.docCat);
    const n = list.length;
    const what = [ui.docCat !== "all" ? `in ${ui.docCat}` : "", ui.docQuery.trim() ? `matching “${ui.docQuery.trim()}”` : ""].filter(Boolean).join(" ");
    return `
      <p class="doc-count" role="status">${n} ${n === 1 ? "document" : "documents"}${what ? ` ${esc(what)}` : ""}</p>
      ${n ? `<ul class="doc-list">${list.map(docRow).join("")}</ul>` : `<div class="empty"><p>No documents match.</p><button class="link" data-action="doc-clear">Clear search</button></div>`}`;
  }
  function renderDocuments() {
    const adding = ui.docEdit && !ui.docEdit.id;
    return `
      <section class="page-sub"><h2 class="section-title">Documents</h2>
        <p class="muted">Policies, benefits and guides. Each new hire sees the ones for everyone, their department and their job level. Read and acknowledge tasks in the plan templates can link to one.</p></section>
      <section class="card doc-card">
        <div class="doc-tools">
          <label class="field doc-q"><span>Search documents</span><input type="search" id="doc-q" value="${esc(ui.docQuery)}" autocomplete="off" placeholder="e.g. handbook" /></label>
          <label class="field doc-cat"><span>Category</span><select id="doc-cat"><option value="all">All categories</option>${OB.DOC_CATEGORIES.map((c) => `<option ${ui.docCat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
          ${adding ? "" : `<button class="btn doc-add" data-action="doc-add">+ Add document</button>`}
        </div>
        ${adding ? docForm() : ""}
        <div id="doc-results">${docResults()}</div>
      </section>`;
  }

  // ---------- + Add: one person, or bulk import (C1c) ----------
  function addModes(mode) {
    return `
      <div class="seg" role="group" aria-label="How to add">
        <button class="seg-b ${mode === "one" ? "on" : ""}" data-action="add-mode" data-mode="one" aria-pressed="${mode === "one"}">One person</button>
        <button class="seg-b ${mode === "bulk" ? "on" : ""}" data-action="add-mode" data-mode="bulk" aria-pressed="${mode === "bulk"}">Bulk import</button>
      </div>`;
  }

  function defaultDraft() {
    return { name: "", title: "", department: "", managerId: "", startDate: OB.addDays(today(), 14), workType: OB.WORK_TYPES[0], jobLevel: OB.JOB_LEVELS[0], role: "" };
  }
  const managers = () => OB.PEOPLE.filter((p) => p.role === "manager");
  // F4: a weekend start date gets a calm note under the date with a one-click "Use Mon, Nov 16" fix (add + edit).
  // The live region is always there, so typing a new date announces the note.
  const wkHintInner = (iso, form) => {
    const w = OB.weekendStart(iso);
    return w
      ? `<p class="wk-hint-t">${ICON.clock}<span>${esc(w.text)}</span></p><button type="button" class="btn btn-sm" data-action="use-monday" data-form="${form}" data-date="${esc(w.monday)}">${esc(w.label)}</button>`
      : "";
  };
  const wkHint = (iso, form) => `<div class="wk-hint" id="${form}-wk" role="status">${wkHintInner(iso, form)}</div>`;
  const roleSelect = (id, dept, val, disabled) =>
    `<select name="role" id="${id}" ${disabled ? "disabled" : ""}><option value="">None</option>${OB.rolesFor(dept, state.roles)
      .map((r) => `<option value="${esc(r.id)}" ${val === r.id ? "selected" : ""}>${esc(r.name)}</option>`)
      .join("")}</select>`;

  function renderAddHire() {
    const d = ui.draft || (ui.draft = defaultDraft());
    const e = ui.draftErrors;
    const field = (name, label, input) =>
      `<label class="field ${e[name] ? "has-err" : ""}"><span>${label}</span>${input}${e[name] ? `<small class="err">${esc(e[name])}</small>` : ""}</label>`;
    const dis = ui.preview ? "disabled" : "";
    const role = d.role ? OB.roleById(d.role, state.roles) : null;

    let preview = "";
    if (ui.preview) {
      const p = ui.preview;
      const included = p.tasks.filter((t) => !p.skip.has(t.key)).length;
      const n = p.skipped.length;
      // Tasks a rule leaves out (e.g. remote-only for an onsite hire): one quiet line, folded (round 3).
      const skippedNote = n
        ? `<details class="pv-skipped" data-fold="pv-skipped" ${ui.folds["pv-skipped"] ? "open" : ""}>
            <summary>${n} task${n === 1 ? "" : "s"} skipped (not relevant to this role)</summary>
            <ul class="pv-skipped-list">${p.skipped
              .map((t) => `<li>${typeIcon(t)}<span>${esc(t.title)}</span> <span class="muted small">Only: ${esc(t.rule)}</span></li>`)
              .join("")}</ul></details>`
        : "";
      preview = `
        <section class="card" id="preview">
          <h2 class="section-title">Generated plan for ${esc(d.name.trim())}</h2>
          <p class="muted">Company tasks plus ${esc(d.department)} tasks${role ? ` plus ${esc(role.name)} role tasks` : ""}, matched to ${esc(d.workType)} · ${esc(d.jobLevel)}, with due dates worked out from the start date (weekend dates move to a weekday). Untick anything that doesn't apply to this person.</p>
          ${skippedNote}
          ${OB.PHASES.map((ph) => {
            const ts = p.tasks.filter((t) => t.phase === ph.id);
            return `<h3 class="ph-h">${esc(ph.label)}</h3><ul class="preview-list">${ts
              .map(
                (t) => `<li><label><input type="checkbox" data-preview="${esc(t.key)}" ${p.skip.has(t.key) ? "" : "checked"} />
                  <span class="pv-body"><span class="pv-title">${typeIcon(t)}${esc(t.title)}</span>
                  <span class="chip chip-${t.owner}">${t.owner === "newhire" ? "New hire" : OB.OWNERS[t.owner]}</span>
                  ${t.source !== "Company" ? `<span class="chip chip-src ${t.sourceKind === "role" ? "chip-role" : ""}">From: ${esc(t.source)}</span>` : ""}
                  <span class="muted small">${esc(OB.prettyDate(t.dueDate))}</span>
                  ${t.reason ? `<span class="pv-reason">Because: ${esc(t.reason)}</span>` : ""}</span></label></li>`
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
      ${addModes("one")}
      <form class="card form" id="hire-form" novalidate>
        <h2 class="section-title">Add a new hire</h2>
        <p class="muted">Their onboarding plan is built automatically from their department, role, work type and job level. You can adjust it before saving.</p>
        <div class="row">
          ${field("name", "Full name", `<input name="name" id="hf-name" maxlength="90" value="${esc(d.name)}" autocomplete="off" ${dis} />`)}
          ${field("title", "Job title", `<input name="title" id="hf-title" maxlength="90" value="${esc(d.title)}" autocomplete="off" ${dis} />`)}
        </div>
        <div class="row">
          ${field("department", "Department", `<select name="department" id="hf-department" ${dis}><option value="">Choose…</option>${OB.DEPARTMENTS.map((x) => `<option ${d.department === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`)}
          ${field("managerId", "Manager", `<select name="managerId" id="hf-managerId" ${dis}><option value="">Choose…</option>${managers().map((m) => `<option value="${m.id}" ${d.managerId === m.id ? "selected" : ""}>${esc(m.name)} · ${esc(m.department)}</option>`).join("")}</select>`)}
          ${field("startDate", "Start date", `<input type="date" name="startDate" id="hf-startDate" value="${esc(d.startDate)}" ${dis} />`)}
        </div>
        <div class="row">
          ${field("workType", "Work type", `<select name="workType" id="hf-workType" ${dis}>${OB.WORK_TYPES.map((x) => `<option ${d.workType === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`)}
          ${field("jobLevel", "Job level", `<select name="jobLevel" id="hf-jobLevel" ${dis}>${OB.JOB_LEVELS.map((x) => `<option ${d.jobLevel === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`)}
          ${field("role", "Role", roleSelect("hf-role", d.department, d.role, ui.preview || !d.department))}
        </div>
        ${wkHint(d.startDate, "hf")}
        ${(() => {
          const wk = OB.weekendStart(d.startDate);
          const ws = ui.draftWarnings.filter((w) => !wk || w !== wk.text); // the weekend note shows under the date instead
          return ws.length ? `<ul class="warnings">${ws.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : "";
        })()}
        ${ui.preview ? "" : `<div class="actions"><button type="submit" class="btn primary">Preview plan</button></div>`}
      </form>
      ${preview}`;
  }

  // ---------- C1c. Bulk import ----------
  function renderBulk() {
    const b = ui.bulk || (ui.bulk = { text: "", preview: null, allow: new Set(), done: null });
    const pv = b.preview;
    let result = "";
    if (b.done) {
      result = `
        <section class="card bulk-done" id="bulk-result" tabindex="-1">
          <p class="fc-done">${ICON.done}<span><strong>Imported ${b.done.names.length} ${b.done.names.length === 1 ? "hire" : "hires"}:</strong> ${esc(b.done.names.join(", "))}. Their plans are ready and their managers can see them.</span></p>
          ${b.done.skipped ? `<p class="muted small">${b.done.skipped} ${b.done.skipped === 1 ? "row was" : "rows were"} skipped. Fix and paste ${b.done.skipped === 1 ? "it" : "them"} again any time.</p>` : ""}
          <div class="actions"><button class="btn primary" data-action="hr-tab" data-tab="hires">See them in Hires</button><button class="btn" data-action="bulk-again">Import more</button></div>
        </section>`;
    } else if (pv && pv.headerError) {
      result = `<section class="card" id="bulk-result" tabindex="-1"><p class="err" role="alert">${esc(pv.headerError)}</p></section>`;
    } else if (pv) {
      const c = OB.bulkCounts(pv.rows, b.allow);
      const parts = [`${c.ready} ready`];
      if (c.fix) parts.push(`${c.fix} ${c.fix === 1 ? "needs" : "need"} a fix`);
      if (c.dupSkipped) parts.push(`${c.dupSkipped} possible ${c.dupSkipped === 1 ? "duplicate" : "duplicates"} (skipped unless you tick “Import anyway”)`);
      result = `
        <section class="card" id="bulk-result" tabindex="-1" aria-labelledby="bulk-h">
          <h2 class="section-title" id="bulk-h">Check before importing</h2>
          <p class="bulk-sum" role="status">${pv.rows.length} ${pv.rows.length === 1 ? "row" : "rows"}: ${esc(parts.join(", "))}.</p>
          <div class="table-wrap"><table class="table compact bulk-table">
            <thead><tr><th>Row</th><th>Name</th><th>Team</th><th>Start</th><th>Role</th><th>Check</th></tr></thead>
            <tbody>${pv.rows
              .map((r) => {
                const role = r.input.role ? OB.roleById(r.input.role, state.roles) : null;
                const mgr = person(r.input.managerId);
                let check;
                // F4: a weekend start date is a "Check" note; the row still imports.
                const wkNote = r.weekend ? `<p class="small bulk-note"><strong>Check:</strong> ${esc(r.weekend.text)}</p>` : "";
                const otherW = r.warnings.filter((w) => !r.weekend || w !== r.weekend.text);
                if (!r.ok) check = `${statusChip("behind", "Needs a fix")}<ul class="bulk-errs">${r.errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
                else if (r.duplicate)
                  check = `${statusChip("waiting", "Possible duplicate")}<p class="muted small">${esc(r.warnings[0])}</p>${wkNote}
                    <label class="check-line check-sm"><input type="checkbox" id="bulk-allow-${r.row}" data-bulk-allow="${r.row}" ${b.allow.has(r.row) ? "checked" : ""} /> Import anyway</label>`;
                else check = `${statusChip("done", "Ready")}${wkNote}${otherW.length ? `<p class="muted small">${esc(otherW.join(" "))}</p>` : ""}`;
                return `<tr><td>${r.row}</td><td><strong>${esc(r.input.name || "(no name)")}</strong><div class="muted small">${esc(r.input.title)}</div></td>
                  <td>${esc(r.input.department)}<div class="muted small">${esc(mgr ? mgr.name : "")}</div></td>
                  <td class="td-nowrap">${OB.isValidISO(r.input.startDate) ? esc(shortDate(r.input.startDate)) : esc(r.input.startDate)}</td>
                  <td class="bulk-role">${role ? esc(role.name) : `<span class="muted">None</span>`}</td><td class="bulk-check">${check}</td></tr>`;
              })
              .join("")}</tbody></table></div>
          <div class="actions"><button class="btn primary" data-action="bulk-import" ${c.ready ? "" : "disabled"}>Import ${c.ready} ${c.ready === 1 ? "hire" : "hires"}</button></div>
          <p class="muted small">Each plan is built exactly like adding one person: Company, department and role tasks, matched to work type and job level.</p>
        </section>`;
    }
    return `
      ${addModes("bulk")}
      <section class="card form">
        <h2 class="section-title">Bulk import</h2>
        <p class="muted">Paste rows from a spreadsheet as CSV, or choose a .csv file. The first row names the columns: name, title, department, manager, start date, work type, job level, role. Work type, job level and role can be blank.</p>
        <div class="actions bulk-tools">
          <button type="button" class="btn" data-action="bulk-sample">Download sample CSV</button>
          <label class="btn file-btn" for="bulk-file">Choose a .csv file<input type="file" id="bulk-file" accept=".csv,text/csv" class="sr-only" /></label>
        </div>
        <label class="field"><span>Paste CSV here</span><textarea id="bulk-text" rows="7" spellcheck="false" placeholder="name,title,department,manager,start date,work type,job level,role">${esc(b.text)}</textarea></label>
        <div class="actions"><button type="button" class="btn primary" data-action="bulk-check">Check rows</button></div>
        <p class="muted small">Demo only: the file stays in this browser.</p>
      </section>
      ${result}`;
  }

  // ---------- U4. Edit hire ----------
  function editDraftFor(h) {
    const p = OB.hireProfile(h);
    return { name: h.name, title: h.title, department: h.department, managerId: h.managerId, startDate: h.startDate, workType: p.workType, jobLevel: p.jobLevel, role: h.role || "" };
  }
  function renderEditHire(h) {
    const e = ui.hrEdit;
    const d = e.draft;
    const er = e.errors || {};
    const first = firstName(h.name);
    const field = (name, label, input) =>
      `<label class="field ${er[name] ? "has-err" : ""}"><span>${label}</span>${input}${er[name] ? `<small class="err">${esc(er[name])}</small>` : ""}</label>`;
    const input = { ...d, startDate: OB.isValidISO(d.startDate) ? d.startDate : h.startDate, role: d.role || null };
    const s = OB.planHireEdit(h, input, today(), templates()).summary;
    const oldMgr = person(h.managerId);
    const lines = [];
    if (s.managerChanged)
      lines.push(`<li>${ICON.action}<span><strong>${esc(s.managerLine)}</strong> ${esc(`${oldMgr ? firstName(oldMgr.name) : "The old manager"}'s Team view no longer shows ${first}.`)}</span></li>`);
    if (e.mgrNote) lines.push(`<li>${ICON.users}<span>${esc(e.mgrNote)}</span></li>`);
    if (s.planChanged) {
      const list = (xs) => `<ul class="es-tasks">${xs.map((t) => `<li>${esc(t.title)} <span class="chip chip-src">From: ${esc(t.source)}</span></li>`).join("")}</ul>`;
      lines.push(`<li>${ICON.calendar}<span><strong>Plan: ${s.removed.length} open ${s.removed.length === 1 ? "task comes" : "tasks come"} out and ${s.added.length} ${s.added.length === 1 ? "goes" : "go"} in.</strong>
        ${s.keptDone} done ${s.keptDone === 1 ? "task" : "tasks"}${s.keptCustom ? ` and ${s.keptCustom} added by hand` : ""} stay as they are.
        ${s.removed.length ? `<details class="es-fold" open><summary>Comes out (${s.removed.length})</summary>${list(s.removed)}</details>` : ""}
        ${s.added.length ? `<details class="es-fold" open><summary>Goes in (${s.added.length})</summary>${list(s.added)}</details>` : ""}</span></li>`);
    }
    if (s.startChanged)
      lines.push(`<li>${ICON.clock}<span><strong>Start date moves from ${esc(OB.shortDay(s.startFrom))} to ${esc(OB.shortDay(s.startTo))}.</strong> ${s.shifted} open ${s.shifted === 1 ? "task gets a new due date" : "tasks get new due dates"}.</span></li>`);
    if (s.buddyFrom !== s.buddyTo) {
      const name = (id) => {
        for (const t of Object.values(OB.TEAMS || {})) {
          const m = t.members.find((x) => x.id === id);
          if (m) return m.name;
        }
        return "";
      };
      lines.push(`<li>${ICON.users}<span>${esc(s.buddyTo ? `Buddy changes from ${name(s.buddyFrom)} to ${name(s.buddyTo)} (${d.department}).` : `${name(s.buddyFrom)} stays in ${h.department}, so the buddy is picked again by the new manager.`)}</span></li>`);
    }
    const roles = OB.rolesFor(d.department, state.roles);
    return `
      <button class="link back" data-action="edit-cancel">${ICON.back} Back to ${esc(first)}'s plan</button>
      <form class="card form" id="edit-form" novalidate aria-labelledby="ef-title">
        <h1 class="section-title" id="ef-title">Edit ${esc(h.name)}</h1>
        <p class="muted">Changes apply to ${esc(first)}'s plan now. Done tasks and tasks added by hand always stay.</p>
        <div class="row">
          ${field("name", "Full name", `<input name="name" id="ef-name" maxlength="90" value="${esc(d.name)}" autocomplete="off" />`)}
          ${field("title", "Job title", `<input name="title" id="ef-title-in" maxlength="90" value="${esc(d.title)}" autocomplete="off" />`)}
        </div>
        <div class="row">
          ${field("department", "Department", `<select name="department" id="ef-department">${OB.DEPARTMENTS.map((x) => `<option ${d.department === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`)}
          ${field("managerId", "Manager", `<select name="managerId" id="ef-managerId">${managers().map((m) => `<option value="${m.id}" ${d.managerId === m.id ? "selected" : ""}>${esc(m.name)} · ${esc(m.department)}</option>`).join("")}</select>`)}
          ${field("startDate", "Start date", `<input type="date" name="startDate" id="ef-startDate" value="${esc(d.startDate)}" />`)}
        </div>
        <div class="row">
          ${field("workType", "Work type", `<select name="workType" id="ef-workType">${OB.WORK_TYPES.map((x) => `<option ${d.workType === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`)}
          ${field("jobLevel", "Job level", `<select name="jobLevel" id="ef-jobLevel">${OB.JOB_LEVELS.map((x) => `<option ${d.jobLevel === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`)}
          ${field("role", "Role", roleSelect("ef-role", d.department, roles.some((r) => r.id === d.role) ? d.role : "", false))}
        </div>
        ${wkHint(d.startDate, "ef")}
        <section class="edit-sum" aria-labelledby="es-title">
          <h2 class="section-title" id="es-title">What changes</h2>
          <div id="edit-summary" role="status">${lines.length ? `<ul class="es-list">${lines.join("")}</ul>` : `<p class="muted">Nothing changes yet. Edit a field above to see what happens to the plan.</p>`}</div>
        </section>
        <div class="actions"><button type="submit" class="btn primary">Save changes</button><button type="button" class="btn" data-action="edit-cancel">Cancel</button></div>
      </form>`;
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
  // Round 4, C1b: role templates are named "role:<id>" in the editor (state.roles holds them).
  const roleOfName = (n) => (typeof n === "string" && n.startsWith("role:") ? (state.roles || []).find((r) => `role:${r.id}` === n) || null : null);
  const tplDisplay = (n) => (roleOfName(n) ? roleOfName(n).name : n);
  const tplEdited = (name) => !roleOfName(name) && Array.isArray((state.templates || {})[name]) && OB.templateIsEdited(state.templates[name], OB.TEMPLATES[name]);
  const tplCurrent = () => (TPL_NAMES().includes(ui.tplName) || roleOfName(ui.tplName) ? ui.tplName : "Company");
  const tplList = (name) => (roleOfName(name) ? roleOfName(name).tasks : templates()[name] || []);
  // Every template's tasks by name (for unique task keys across Company, departments and roles).
  const allTemplateLists = () => {
    const out = OB.mergeTemplates(OB.TEMPLATES, state.templates);
    for (const r of state.roles || []) out[`role:${r.id}`] = r.tasks;
    return out;
  };

  function tplDraftFrom(t) {
    const tm = OB.offsetToTiming(t.dayOffset);
    const a = OB.cleanAppliesTo(t.appliesTo) || {};
    return {
      title: t.title || "", desc: t.desc || "", owner: t.owner || "newhire", n: String(tm.n), mode: tm.mode,
      type: OB.taskType(t), link: t.link || "", workTypes: a.workTypes || [], jobLevels: a.jobLevels || [],
      hireTitle: t.hireTitle || "", hireDesc: t.hireDesc || "",
      required: !!t.required, docId: t.docId || "",
    };
  }
  function tplInput(d) {
    return { ...d, dayOffset: OB.timingToOffset(d.n, d.mode), appliesTo: { workTypes: d.workTypes, jobLevels: d.jobLevels } };
  }
  // "Everyone" / "Only: People managers · Remote" (live under "Who gets this task", and as a chip in the list).
  const tplWhoText = (appliesTo) => {
    const sum = OB.appliesSummary(appliesTo);
    return sum ? `Only: ${sum}` : "Everyone";
  };
  // "Due Day 3 · Week 1" under the timing picker, so HR can see where the task lands.
  function tplWhenHint(d) {
    const o = OB.timingToOffset(d.n, d.mode);
    if (Number.isInteger(o) && Number(d.n) < 1) return d.mode === "day" ? "Day 1 is the first day." : "Pick 1 or more days before start.";
    if (!Number.isInteger(o) || o < OB.TPL_MIN_OFFSET || o > OB.TPL_MAX_OFFSET) return "Between 30 days before start and Day 28.";
    const ph = OB.PHASES.find((p) => p.id === OB.phaseForOffset(o));
    return `Shows as: ${OB.timingLabel(o)} · ${ph ? ph.label : ""}`;
  }
  function tplWarnings(name, key, d) {
    const siblings = tplList(name).filter((t) => t.key !== key);
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
    const who = document.getElementById("tpl-who-sum");
    if (who) who.textContent = tplWhoText(tplInput(e.draft).appliesTo);
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
        <h3 class="tpl-form-title">${e.key ? "Edit task" : `New task for ${esc(name === "Company" ? "everyone" : roleOfName(name) ? `the ${tplDisplay(name)} role` : name)}`}</h3>
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
        <div class="row">
          <label class="field tpl-type-field ${er.type ? "has-err" : ""}"><span>Type</span>
            <span class="tpl-type-row">
              <span class="tpl-type-ico" aria-hidden="true">${TYPE_ICON[d.type] || ""}</span>
              <select id="tpl-type" name="type">${Object.entries(OB.TASK_TYPES)
                .map(([k, l]) => `<option value="${k}" ${d.type === k ? "selected" : ""}>${esc(TPL_TYPE_HINT[k] ? `${l} · ${TPL_TYPE_HINT[k]}` : l)}</option>`)
                .join("")}</select>
            </span>${errMsg("type")}</label>
          <label class="field ${er.link ? "has-err" : ""}"><span>Link <span class="opt">(optional)</span></span>
            <input id="tpl-link" name="link" type="url" inputmode="url" maxlength="500" value="${esc(d.link)}" autocomplete="off" placeholder="https://" />
            ${errMsg("link") || `<small class="muted">Shows as an “Open” link on the task.</small>`}</label>
        </div>
        <div class="row">
          ${
            d.type === "read" || d.type === "acknowledge"
              ? `<label class="field ${er.docId ? "has-err" : ""}"><span>Document <span class="opt">(optional)</span></span>
                  <select id="tpl-doc" name="docId"><option value="">No document: use the link above</option>${OB.DOC_CATEGORIES.map(
                    (c) =>
                      `<optgroup label="${esc(c)}">${docs()
                        .filter((x) => x.category === c)
                        .map((x) => `<option value="${esc(x.id)}" ${d.docId === x.id ? "selected" : ""}>${esc(x.title)}</option>`)
                        .join("")}</optgroup>`
                  ).join("")}</select>
                  ${errMsg("docId") || `<small class="muted">From the document library. The task's “Open” uses the document's link.</small>`}</label>`
              : ""
          }
          <div class="field tpl-req">
            <span class="field-l">Compliance</span>
            <label class="check-line check-sm" for="tpl-required"><input type="checkbox" id="tpl-required" name="required" ${d.required ? "checked" : ""} /> Required: track it on the Compliance page</label>
            <small class="muted">${d.type === "acknowledge" ? "Acknowledge tasks are always tracked." : "For signatures and mandatory training."}</small>
          </div>
        </div>
        <fieldset class="tpl-who ${er.appliesTo ? "has-err" : ""}">
          <legend>Who gets this task</legend>
          <p class="tpl-who-sum" id="tpl-who-sum" role="status">${esc(tplWhoText(tplInput(d).appliesTo))}</p>
          ${tplCheckGroup("Work type", "wt", OB.WORK_TYPES, d.workTypes)}
          ${tplCheckGroup("Job level", "jl", OB.JOB_LEVELS, d.jobLevels)}
          <p class="muted small tpl-who-hint">Leave a group unticked to include everyone in it.</p>
          ${errMsg("appliesTo")}
        </fieldset>
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

  // Short hints in the Type picker.
  const TPL_TYPE_HINT = { task: "", read: "a page or guide", watch: "a video or course", acknowledge: "“I've read and agree”", meeting: "a scheduled event", form: "fill in and submit" };
  function tplCheckGroup(label, name, all, picked) {
    return `<fieldset class="tpl-who-group"><legend>${esc(label)}</legend><div class="tpl-who-opts">${all
      .map(
        (v, i) => `<label class="check-line check-sm"><input id="tpl-${name}-${i}" type="checkbox" name="${name}" value="${esc(v)}" ${picked.includes(v) ? "checked" : ""} /> ${esc(v)}</label>`
      )
      .join("")}</div></fieldset>`;
  }

  function tplRow(name, t) {
    if (ui.tplEdit && ui.tplEdit.name === name && ui.tplEdit.key === t.key) return `<li class="tpl-task editing">${tplForm(name)}</li>`;
    return `
      <li class="tpl-task">
        <div class="tpl-main">
          <span class="tpl-title">${typeIcon(t)}${esc(t.title)}</span>
          ${t.desc ? `<p class="task-desc">${esc(t.desc)}</p>` : ""}
          <div class="task-meta">
            <span class="tpl-when">${ICON.calendar}${esc(OB.timingLabel(t.dayOffset))}</span>
            <span class="chip chip-${t.owner}">${esc(tplOwnerLabel(t.owner))}</span>
            ${OB.appliesSummary(t.appliesTo) ? `<span class="chip chip-rule">${esc(tplWhoText(t.appliesTo))}</span>` : ""}
            ${t.required || OB.taskType(t) === "acknowledge" ? `<span class="chip chip-req">${ICON.shield}${t.required ? "Required" : "Compliance"}</span>` : ""}
            ${t.docId && docs().find((x) => x.id === t.docId) ? `<span class="chip chip-rule chip-doc">${TYPE_ICON.read}Doc: ${esc(docs().find((x) => x.id === t.docId).title)}</span>` : ""}
          </div>
        </div>
        <div class="tpl-actions">
          <button class="btn btn-sm btn-quiet" data-action="tpl-edit" data-key="${esc(t.key)}" aria-label="Edit '${esc(t.title)}'">Edit</button>
          <button class="btn btn-sm btn-quiet" data-action="tpl-remove" data-key="${esc(t.key)}" aria-label="Remove '${esc(t.title)}'">Remove</button>
        </div>
      </li>`;
  }

  // Round 4, C1b: the "New role" form (a role belongs to one department and starts with no tasks).
  function roleFormHtml() {
    const f = ui.roleForm;
    const er = f.errors || {};
    const err = (k) => (er[k] ? `<small class="err">${esc(er[k])}</small>` : "");
    return `
      <form class="card form role-form" id="role-form" novalidate aria-labelledby="role-form-title">
        <h2 class="section-title" id="role-form-title">New role template</h2>
        <p class="muted small">New hires with this role get its tasks on top of the Company and department tasks.</p>
        <div class="row">
          <label class="field ${er.name ? "has-err" : ""}"><span>Role name</span><input id="role-name" name="name" maxlength="70" value="${esc(f.name)}" autocomplete="off" placeholder="e.g. Data Analyst" />${err("name")}</label>
          <label class="field ${er.department ? "has-err" : ""}"><span>Department</span><select id="role-dept" name="department"><option value="">Choose…</option>${OB.DEPARTMENTS.map(
            (d) => `<option ${f.department === d ? "selected" : ""}>${esc(d)}</option>`
          ).join("")}</select>${err("department")}</label>
        </div>
        <div class="actions"><button type="submit" class="btn primary">Create role</button><button type="button" class="btn" data-action="tpl-role-cancel">Cancel</button></div>
      </form>`;
  }

  function renderTemplates() {
    const name = tplCurrent();
    const role = roleOfName(name);
    const tasks = tplList(name);
    const edited = tplEdited(name);
    const pill = (n, label, sub) => `<button class="tpl-pick ${n === name ? "on" : ""}" data-action="tpl-pick" data-tpl="${esc(n)}" aria-pressed="${n === name}">
              ${esc(label)}${sub ? `<span class="tpl-sub">${esc(sub)}</span>` : ""}${tplEdited(n) ? `<span class="tpl-edited">Edited</span>` : ""}</button>`;
    const picker = `
      <div class="tpl-picker" role="group" aria-label="Choose a template">
        ${TPL_NAMES().map((n) => pill(n, n)).join("")}
      </div>
      <div class="tpl-picker tpl-roles" role="group" aria-label="Role templates">
        <span class="tpl-group-l">Roles</span>
        ${(state.roles || []).map((r) => pill(`role:${r.id}`, r.name, r.department)).join("")}
        <button class="tpl-pick tpl-new" data-action="tpl-role-new" aria-label="New role template">+ New role</button>
      </div>`;
    const adding = ui.tplEdit && ui.tplEdit.name === name && !ui.tplEdit.key;
    const phases = OB.PHASES.map((ph) => {
      const ts = tasks
        .filter((t) => OB.phaseForOffset(t.dayOffset) === ph.id)
        .sort((a, b) => a.dayOffset - b.dayOffset || a.title.localeCompare(b.title));
      if (!ts.length) return "";
      return `<h3 class="ph-h">${esc(ph.label)}</h3><ul class="tpl-list">${ts.map((t) => tplRow(name, t)).join("")}</ul>`;
    }).join("");
    const who = role
      ? `New ${role.department} hires with the ${role.name} role get these tasks, plus the Company and ${role.department} tasks.`
      : name === "Company"
        ? "Every new hire gets these tasks."
        : `New ${name} hires get these tasks plus the Company tasks.`;
    const title = role ? `${role.name} <span class="chip chip-src">${esc(role.department)} role</span>` : esc(name === "Company" ? "Company (everyone)" : name);
    return `
      <div class="tpl-note" role="note">
        <span class="banner-ico">${ICON.bell}</span>
        <p><strong>Changes apply to new hires you add from now on.</strong> People already onboarding keep their current plan.</p>
      </div>
      <p class="muted">Every plan = <strong>Company</strong> tasks + the person's <strong>department</strong> tasks + their <strong>role</strong> tasks, if they have a role. Managers can still add one-off tasks to a single person's plan.</p>
      ${picker}
      ${ui.roleForm ? roleFormHtml() : ""}
      <section class="card tpl-card">
        <div class="tpl-head">
          <div>
            <h2 class="section-title">${role ? esc(role.name) + ` <span class="chip chip-src">${esc(role.department)} role</span>` : title}${edited ? ` <span class="tpl-edited">Edited</span>` : ""}</h2>
            <p class="muted small">${esc(who)} ${tasks.length} task${tasks.length === 1 ? "" : "s"}.</p>
          </div>
          <div class="toolbar-actions">
            ${edited ? `<button class="btn btn-quiet" data-action="tpl-reset">Reset to original</button>` : ""}
            ${role ? `<button class="btn btn-quiet" data-action="tpl-role-remove">Remove role</button>` : ""}
            ${adding ? "" : `<button class="btn" data-action="tpl-add">+ Add task</button>`}
          </div>
        </div>
        ${adding ? tplForm(name) : ""}
        ${tasks.length ? phases : `<p class="empty-sm">${role ? `No tasks in this role yet. Add the first one: new ${esc(role.name)} hires get it on top of their department plan.` : `No tasks in this template. New ${esc(name)} hires get only the Company tasks.`}</p>`}
      </section>`;
  }

  function setTemplate(name, list) {
    const role = roleOfName(name);
    if (role) {
      role.tasks = list;
      return;
    }
    if (!state.templates || typeof state.templates !== "object") state.templates = {};
    if (OB.templateIsEdited(list, OB.TEMPLATES[name])) state.templates[name] = list;
    else delete state.templates[name];
  }

  function saveTemplateTask(form) {
    const e = ui.tplEdit;
    if (!e || viewer().role !== "hr") return;
    for (const el of form.elements) if (el.name && el.name !== "wt" && el.name !== "jl") e.draft[el.name] = el.type === "checkbox" ? el.checked : el.value;
    const ticked = (n) => [...form.querySelectorAll(`input[name="${n}"]:checked`)].map((x) => x.value);
    e.draft.workTypes = ticked("wt");
    e.draft.jobLevels = ticked("jl");
    const list = tplList(e.name);
    const input = tplInput(e.draft);
    const r = OB.validateTemplateTask(input, list.filter((t) => t.key !== e.key), docs());
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
    const task = OB.makeTemplateTask(input, e.key || OB.newTemplateKey(allTemplateLists()));
    const next = e.key ? list.map((t) => (t.key === e.key ? task : t)) : list.concat(task);
    setTemplate(e.name, next);
    ui.tplEdit = null;
    ui.tplErrors = {};
    toast(`${e.key ? "Saved" : "Added"}: ${task.title}. New ${e.name === "Company" ? "" : roleOfName(e.name) ? `${tplDisplay(e.name)} ` : `${e.name} `}hires get this from now on.`);
    commit();
  }

  function templateAction(a, el) {
    if (viewer().role !== "hr") return;
    const name = tplCurrent();
    const list = tplList(name);
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
      ui.roleForm = null;
      return render();
    }
    if (a === "tpl-role-new") {
      ui.roleForm = { name: "", department: "", errors: {} };
      ui.tplEdit = null;
      render();
      document.getElementById("role-name")?.focus();
      return;
    }
    if (a === "tpl-role-cancel") {
      ui.roleForm = null;
      return render();
    }
    if (a === "tpl-role-remove") {
      const role = roleOfName(name);
      if (!role || !confirm(`Remove the ${role.name} role? New hires can't pick it any more. People already onboarding keep their current plan.`)) return;
      state.roles = state.roles.filter((r) => r.id !== role.id);
      for (const h of state.hires) if (h.role === role.id) h.role = null;
      ui.tplName = "Company";
      ui.tplEdit = null;
      toast(`Removed the ${role.name} role.`);
      return commit();
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
      const dn = tplDisplay(name);
      if (rule === "blocked") return toast("The Company template needs at least one task. Edit this one instead.");
      if (rule === "confirm" && !confirm(roleOfName(name) ? `Remove the last task from the ${dn} role? The role then adds nothing to new plans.` : `Remove the last task from ${name}? New ${name} hires would get only the Company tasks.`)) return;
      setTemplate(name, list.filter((x) => x.key !== t.key));
      if (ui.tplEdit && ui.tplEdit.key === t.key) ui.tplEdit = null;
      ui.undo = { name, list, title: t.title };
      toast(`Removed from ${dn}: ${t.title}`, { label: "Undo", action: "tpl-undo" });
      return commit();
    }
    if (a === "tpl-reset") {
      if (roleOfName(name)) return;
      if (!confirm(`Reset the ${name} template to its original tasks? Your changes to it will be lost. People already onboarding keep their current plan.`)) return;
      if (state.templates) delete state.templates[name];
      ui.tplEdit = null;
      toast(`${name} template is back to its original tasks.`);
      return commit();
    }
  }

  // ---------- main render ----------
  function render() {
    wlPop = null; // the "Where everyone is" pop-up lives in the DOM only; a re-render closes it
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
        : active && active.dataset && active.dataset.action === "sched-day"
            ? `[data-action="sched-day"][data-day="${CSS.escape(active.dataset.day)}"]`
            : active && active.dataset && (active.dataset.action === "nh-tab" || active.dataset.action === "mgr-tab" || active.dataset.action === "hr-tab") && active.dataset.tab
              ? `[data-action="${active.dataset.action}"][data-tab="${CSS.escape(active.dataset.tab)}"]`
              : active && active.dataset && (active.dataset.action === "mgr-pick" || active.dataset.action === "pv-kind")
                ? `[data-action="${active.dataset.action}"][data-${active.dataset.action === "pv-kind" ? "kind" : "hire"}="${CSS.escape(active.dataset.kind || active.dataset.hire || "")}"]`
                : active && active.dataset && ["ins-pick", "add-mode", "tpl-pick", "comp-audit"].includes(active.dataset.action)
                  ? `[data-action="${active.dataset.action}"]${["phase", "key", "dept", "mode", "tpl"].filter((k) => active.dataset[k]).map((k) => `[data-${k}="${CSS.escape(active.dataset[k])}"]`).join("")}`
                  : null;

    document.getElementById("app").innerHTML = `
      ${renderHeader()}
      ${main}
      <footer class="foot">
        Prototype with mock data, saved in this browser only.
        <button class="link" data-action="reset">Reset demo data</button>
      </footer>
      ${ui.toast ? `<div class="toast" role="status"><span>${esc(ui.toast)}</span>${ui.toastAct ? `<button class="toast-btn" data-action="${esc(ui.toastAct.action)}">${esc(ui.toastAct.label)}</button>` : ""}</div>` : ""}
      ${v.role === "manager" || v.role === "hr" ? renderModal() : ""}`;
    fitTlTicks();

    // A dialog that just opened gets focus on its first control (the picked radio, or the first field).
    if (ui.modal && ui.modal.justOpened) {
      ui.modal.justOpened = false;
      const m = document.querySelector(".modal");
      (m && (m.querySelector("input:checked") || m.querySelector("input, select, textarea, button")))?.focus();
      return;
    }
    if (focusKey) {
      const el =
        document.querySelector(`[data-toggle="${CSS.escape(focusKey)}"]`) ||
        document.querySelector(`[data-preview="${CSS.escape(focusKey)}"]`) ||
        document.getElementById(focusKey);
      if (el) el.focus({ preventScroll: true });
    }
    if (focusSel) ([...document.querySelectorAll(focusSel)].find((x) => x.offsetParent) || document.querySelector(focusSel))?.focus({ preventScroll: true });
  }

  // ---------- actions ----------
  function toggleTask(hireId, taskId, checked) {
    const h = hireById(hireId);
    if (!h) return;
    const t = h.tasks.find((x) => x.id === taskId);
    const v = viewer();
    if (!t || !OB.canComplete(v.role, t)) return;
    // Round 4 (a): the manager picks a specific buddy, so ticking "Assign an onboarding buddy" opens the picker.
    if (checked && v.role === "manager" && t.key === "c-buddy" && !OB.buddyFor(h)) {
      openModal({ kind: "buddy", hireId: h.id }, `[data-action="buddy-pick"][data-hire="${h.id}"]`);
      return;
    }
    // Unticking it clears the buddy, so the new hire's Team page goes back to "introduced soon".
    if (!checked && t.key === "c-buddy") h.buddyId = null;
    t.done = checked;
    t.doneAt = checked ? today() : null;
    t.doneBy = checked ? v.id : null;
    // Round 4: ticking "Assign an onboarding buddy" picks the team's default buddy; unticking a task linked to a
    // learning item puts that item back to "not done" (ticking it shows the item as done).
    if (checked) OB.assignBuddyOnTask(h, t);
    else OB.syncLearningFromTask(h, t);
    if (checked && v.role === "newhire" && h.tasks.every((x) => x.done)) toast("Onboarding complete. Welcome to MangoApps!");
    else if (checked) toast(`${OB.taskType(t) === "acknowledge" ? "Acknowledged" : "Done"}: ${t.title}`);
    commit();
  }

  function switchViewer(id) {
    state.viewerId = id;
    ui.detailId = null;
    ui.taskForm = null;
    ui.nhTab = "focus";
    ui.nhForm = null;
    ui.formDraft = null;
    ui.formErrors = {};
    ui.schedDay = null;
    ui.weekDay = null;
    ui.tplEdit = null;
    ui.detailShow = null;
    ui.detailTask = null;
    ui.modal = null;
    ui.nhGoalNote = null;
    ui.hrEdit = null;
    ui.insPick = null;
    ui.pulseErr = "";
    // The manager's and HR's place lives in the URL hash; a new viewer starts without one.
    applyRoute({ tab: "team" });
    clearHash();
    commit();
    window.scrollTo(0, 0);
  }

  // ---------- manager routes in the URL hash (U3) ----------
  function clearHash() {
    ui.lastHash = "";
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }
  function applyRoute(r) {
    ui.route = r;
    ui.detailId = r.tab === "team" && r.hireId ? r.hireId : null;
    ui.detailShow = r.show || null;
    ui.detailTask = r.task || null;
    if (r.tab === "team" && !r.hireId) ui.weekDay = r.day || null;
    ui.taskForm = null;
    ui.taskErrors = {};
    ui.fuTask = null;
    ui.fuErrors = {};
    ui.fuTaskErrors = {};
    ui.ooErrors = {};
    ui.goalErrors = {};
    ui.modal = null;
    if (!(ui.ooForm && ui.ooForm.hireId === r.hireId)) ui.ooForm = null;
  }
  // Go somewhere on the manager's screens. Pushes a history entry, so the browser's Back button works.
  function nav(route) {
    const hash = OB.buildRoute(route);
    applyRoute(OB.parseRoute(hash));
    ui.lastHash = hash;
    if (location.hash !== hash) location.hash = hash;
    ui.folds = {};
    render();
    afterNav();
  }
  // A drill-down scrolls to the filtered list; anything else starts at the top.
  function afterNav() {
    const f = document.getElementById("detail-filter");
    if (f) {
      f.scrollIntoView({ block: "start" });
      f.focus({ preventScroll: true });
    } else window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", () => {
    if (location.hash === ui.lastHash) return;
    // HR (round 4, C1): pages, the hire being edited and the filter bar.
    if (viewer().role === "hr") {
      const r = OB.parseHrRoute(location.hash);
      if (!r) return;
      ui.lastHash = location.hash;
      applyHrRoute(r);
      OB.store.save(state);
      render();
      window.scrollTo(0, 0);
      return;
    }
    if (viewer().role !== "manager") return;
    ui.lastHash = location.hash;
    applyRoute(OB.parseRoute(location.hash));
    render();
    afterNav();
  });
  function openHire(hid, show, task) {
    if (!hireById(hid)) return;
    if (viewer().role === "manager") return nav({ tab: "team", hireId: hid, show: show || undefined, task: task || undefined });
    if (viewer().role === "hr") {
      applyHrRoute({ page: "hire", hireId: hid });
      hrPush({ page: "hire", hireId: hid });
    }
    ui.detailId = hid;
    ui.detailShow = show || null;
    ui.detailTask = task || null;
    ui.taskForm = null;
    ui.folds = {};
    render();
    afterNav();
  }

  // ---------- manager dialogs ----------
  function openModal(m, returnSel) {
    ui.modal = { ...m, justOpened: true };
    ui.modalReturn = returnSel || null;
    render();
  }
  function closeModal() {
    ui.modal = null;
    render();
    if (ui.modalReturn) document.querySelector(ui.modalReturn)?.focus();
    ui.modalReturn = null;
  }
  function openReminder(hid, item, taskId, returnSel) {
    const v = viewer();
    const h = hireById(hid);
    if (!h) return;
    const prefs = OB.notifyPrefsFor(state, v.id);
    const d = OB.reminderDraft(h, item, v, today());
    openModal({ kind: "remind", hireId: hid, taskId: taskId || null, draft: { ...d, channel: prefs.channels[0] }, errors: {} }, returnSel);
  }
  function saveReminder(form) {
    const v = viewer();
    const m = ui.modal;
    if (!m || m.kind !== "remind") return;
    const d = { ...m.draft, ...readForm(form) };
    m.draft = d;
    const r = OB.validateReminder(d);
    m.errors = r.errors;
    if (!r.ok) {
      render();
      document.querySelector(".modal .has-err input, .modal .has-err textarea, .modal .has-err select")?.focus();
      return;
    }
    OB.addToOutbox(state, OB.makeOutboxEntry({ ...d, kind: "reminder", fromId: v.id, hireId: m.hireId, taskId: m.taskId }, today(), nowHHMM()));
    ui.modal = null;
    toast(`Saved to your demo outbox for ${d.to}. Demo — not actually sent.`, { label: "View outbox", action: "goto-outbox" });
    commit();
    if (ui.modalReturn) document.querySelector(ui.modalReturn)?.focus();
    ui.modalReturn = null;
  }
  function saveBuddy(form) {
    const v = viewer();
    const h = hireById(form.dataset.hire);
    const picked = form.querySelector("input[name=buddy]:checked");
    if (!h || !picked) return;
    const m = OB.chooseBuddy(h, picked.value, today(), v.id);
    if (!m) return;
    ui.modal = null;
    toast(`${m.name} is ${firstName(h.name)}'s buddy. ${firstName(h.name)}'s Team page shows them now.`);
    commit();
    if (ui.modalReturn) document.querySelector(ui.modalReturn)?.focus();
    ui.modalReturn = null;
  }
  // The hire's 1:1 note by id (manager screens).
  function noteOf(hid, noteId) {
    const h = hireById(hid);
    return h ? { h, note: (h.oneOnOnes || []).find((n) => n.id === noteId) || null } : { h: null, note: null };
  }

  function readForm(form) {
    const o = {};
    for (const el of form.elements) if (el.name) o[el.name] = el.value;
    return o;
  }

  // ---------- new hire actions (round 4) ----------
  function submitNhForm(form) {
    const v = viewer();
    const h = hireById(v.id);
    const id = form.dataset.form;
    if (!h || v.role !== "newhire" || !OB.formDef(id)) return;
    const data = readNhForm(form);
    ui.formDraft = { id, data };
    const r = OB.submitForm(h, id, data, today(), h.id);
    ui.formErrors = r.errors;
    if (!r.ok) {
      render();
      // Focus the first field that needs a change (the summary above is announced as an alert).
      document.querySelector("#nh-form .has-err input, #nh-form .has-err select")?.focus();
      return;
    }
    const f = OB.formDef(id);
    ui.nhForm = "list";
    ui.formDraft = null;
    ui.formErrors = {};
    toast(r.task ? `Submitted: ${f.title}. “${r.task.title}” is done.` : `Submitted: ${f.title}.`);
    commit();
    window.scrollTo(0, 0);
  }

  function learningAction(a, itemId) {
    const v = viewer();
    const h = hireById(v.id);
    if (!h || v.role !== "newhire") return;
    const it = OB.learningModel(h).items.find((x) => x.id === itemId);
    if (!it) return;
    if (a === "learn-start") {
      if (it.status !== "inprogress") OB.setLearningStatus(h, it.id, "inprogress", today(), h.id);
      // Placeholder links only (example.com); opened in a new tab like task "Open" links.
      if (it.link && OB.isValidLink(it.link)) window.open(it.link, "_blank", "noopener");
      else toast(`Started: ${it.title}. Mark it as done when you finish.`);
    } else if (a === "learn-done") {
      const t = OB.setLearningStatus(h, it.id, "done", today(), h.id);
      toast(t ? `Done: ${it.title}. “${t.title}” is ticked off too.` : `Done: ${it.title}`);
    } else if (a === "learn-undo") {
      OB.setLearningStatus(h, it.id, "todo", today(), h.id);
    }
    commit();
  }

  // ---------- manager form changes (round 4, pass B). Returns true when handled. ----------
  function managerChange(el) {
    const v = viewer();
    if (v.role !== "manager") return false;
    // 1:1 note: tick a talking point as covered.
    if (el.dataset.ooPoint != null) {
      const { note } = noteOf(el.dataset.hire, el.dataset.note);
      const p = note && note.points[Number(el.dataset.ooPoint)];
      if (p) {
        p.done = el.checked;
        commit();
      }
      return true;
    }
    // 1:1 note: notes save when the box loses focus.
    if (el.id === "oo-notes") {
      const { note } = noteOf(el.dataset.hire, el.dataset.note);
      if (note && note.notes !== el.value) {
        note.notes = el.value.slice(0, 2000);
        // No re-render here: the click that moved focus away must still land.
        OB.store.save(state);
        const hint = el.parentElement && el.parentElement.querySelector("small");
        if (hint) hint.textContent = "Notes saved.";
      }
      return true;
    }
    if (el.dataset.goalStatus) {
      const h = hireById(el.dataset.hire);
      const g = h && OB.setGoalStatus(h, el.dataset.goalStatus, el.value, today());
      if (g) {
        toast(`“${g.title}”: ${OB.GOAL_STATUS[g.status]}`);
        commit();
      }
      return true;
    }
    if (el.dataset.notify) {
      const cur = OB.notifyPrefsFor(state, v.id);
      const f = el.dataset.notify;
      let next;
      if (f === "channel") next = OB.setChannel(cur, el.value, el.checked);
      else if (f === "dayBefore" || f === "todoReminders") next = OB.cleanNotifyPrefs({ ...cur, [f]: el.checked });
      else next = OB.cleanNotifyPrefs({ ...cur, [f]: el.value });
      state.notify = state.notify || {};
      state.notify[v.id] = next;
      toast(`Saved. Nudges go to: ${OB.channelSummary(next)}.`);
      commit();
      return true;
    }
    // Start a 1:1: picking a template suggests its date.
    if (el.form && el.form.id === "oo-form") {
      const h = hireById(el.form.dataset.hire);
      if (!h) return true;
      const f = ui.ooForm && ui.ooForm.hireId === h.id ? ui.ooForm : defaultOoForm(h);
      ui.ooForm = { ...f, ...readForm(el.form), hireId: h.id };
      if (el.name === "templateId") {
        ui.ooForm.date = OB.suggestedOneOnOneDate(h, el.value, today());
        render();
      }
      return true;
    }
    if (el.form && el.form.id === "goal-form") {
      ui.goalDraft = { ...readForm(el.form), hireId: el.form.dataset.hire };
      return true;
    }
    if (el.form && el.form.id === "fu-task-form" && ui.fuTask) {
      ui.fuTask = { ...ui.fuTask, ...readForm(el.form) };
      return true;
    }
    if (el.form && el.form.id === "remind-form" && ui.modal) {
      ui.modal.draft = { ...ui.modal.draft, ...readForm(el.form) };
      return true;
    }
    if (el.form && el.form.id === "buddy-form" && ui.modal) {
      ui.modal.pick = el.value;
      document.querySelectorAll(".bp-opt").forEach((l) => l.classList.toggle("on", l.contains(el)));
      return true;
    }
    return false;
  }

  // ---------- manager form submits ----------
  function managerSubmit(form) {
    const v = viewer();
    if (v.role === "newhire" && form.classList.contains("goal-note-form")) {
      const h = hireById(v.id);
      const r = h && OB.setGoalNote(h, form.dataset.goal, form.elements.note.value, today());
      if (r && r.ok) {
        ui.nhGoalNote = null;
        toast(r.goal.note ? "Note saved. Your manager can see it." : "Note removed.");
        commit();
      } else if (r) toast(r.error);
      return true;
    }
    if (v.role !== "manager") return false;
    if (form.id === "buddy-form") return saveBuddy(form), true;
    if (form.id === "remind-form") return saveReminder(form), true;
    if (form.id === "oo-form") {
      const h = hireById(form.dataset.hire);
      if (!h) return true;
      const input = { ...readForm(form) };
      ui.ooForm = { ...input, hireId: h.id };
      const r = OB.validateOneOnOne(input, h);
      ui.ooErrors = r.errors;
      if (!r.ok) {
        render();
        form.querySelector(".has-err input, .has-err select")?.focus();
        return true;
      }
      const note = OB.newOneOnOne(h, input, v.id, today());
      h.oneOnOnes = (h.oneOnOnes || []).concat(note);
      ui.ooForm = null;
      OB.store.save(state);
      toast(`Started: ${note.title} with ${firstName(h.name)}, ${OB.shortDay(note.date)}.`);
      nav({ tab: "oneonones", hireId: h.id, noteId: note.id });
      return true;
    }
    if (form.id === "fu-form") {
      const { h, note } = noteOf(form.dataset.hire, form.dataset.note);
      if (!note) return true;
      const r = OB.addFollowUp(note, form.elements.text.value);
      ui.fuErrors = r.errors;
      if (!r.ok) {
        ui.fuText = form.elements.text.value;
        render();
        document.querySelector("#fu-form input[name=text]")?.focus();
        return true;
      }
      ui.fuText = "";
      toast(`Follow-up added. You can put it in ${firstName(h.name)}'s plan.`);
      commit();
      document.querySelector("#fu-form input[name=text]")?.focus();
      return true;
    }
    if (form.id === "fu-task-form") {
      const { h, note } = noteOf(form.dataset.hire, form.dataset.note);
      if (!note) return true;
      const r = OB.followUpToTask(h, note, form.dataset.fu, readForm(form), v.id);
      ui.fuTaskErrors = r.errors;
      if (!r.ok) return render(), true;
      ui.fuTask = null;
      toast(`Added to ${firstName(h.name)}'s plan: ${r.task.title}`);
      commit();
      return true;
    }
    if (form.id === "goal-form") {
      const h = hireById(form.dataset.hire);
      if (!h) return true;
      const input = readForm(form);
      const r = OB.addGoal(h, input, today());
      ui.goalErrors = r.errors;
      ui.goalDraft = { ...input, hireId: h.id };
      if (!r.ok) {
        render();
        form.querySelector(".has-err input, .has-err select")?.focus();
        return true;
      }
      ui.goalDraft = null;
      toast(`Goal added for ${firstName(h.name)}: ${r.goal.title}`);
      commit();
      return true;
    }
    return false;
  }

  // ---------- manager clicks (round 4, pass B). Returns true when handled. ----------
  function managerClick(a, el) {
    const v = viewer();
    const hid = el.dataset.hire;
    const sel = (extra) => `[data-action="${a}"]${hid ? `[data-hire="${CSS.escape(hid)}"]` : ""}${extra || ""}`;
    switch (a) {
      case "mgr-tab":
        nav({ tab: el.dataset.tab });
        return true;
      case "mgr-pick":
        nav({ tab: el.dataset.tab, hireId: hid });
        return true;
      case "mgr-goals":
        nav({ tab: "goals", hireId: hid });
        return true;
      case "mgr-1on1s":
        nav({ tab: "oneonones", hireId: hid });
        return true;
      case "oo-open":
        nav({ tab: "oneonones", hireId: hid, noteId: el.dataset.note || undefined });
        return true;
      case "oo-ics": {
        const { h, note } = noteOf(hid, el.dataset.note);
        if (note) downloadOneOnOneIcs(h, note);
        return true;
      }
      case "ready-tick":
        toggleTask(hid, el.dataset.task, true);
        return true;
      case "ready-book": {
        const h = hireById(hid);
        if (!h || OB.firstOneOnOne(h)) return true;
        const note = OB.newOneOnOne(h, { templateId: "first", date: OB.nextWeekday(h.startDate), time: oneOnOneSlot(h).start }, v.id, today());
        h.oneOnOnes = (h.oneOnOnes || []).concat(note);
        toast(`Booked: first 1:1 with ${firstName(h.name)}, ${OB.shortDay(note.date)} at ${OB.fmtTime(note.time)}.`);
        commit();
        return true;
      }
      case "buddy-pick":
        openModal({ kind: "buddy", hireId: hid }, sel());
        return true;
      case "remind-ready": {
        const h = hireById(hid);
        const it = h && OB.readinessFor(h, today()).items.find((x) => x.id === el.dataset.item);
        if (!it) return true;
        let label = it.taskTitle;
        if (it.id === "forms") {
          const fs = OB.formsSummary(h);
          label = `your pre-boarding forms (${fs.total - fs.done} still to fill in: ${fs.items.filter((x) => x.status !== "submitted").map((x) => x.short).join(", ")})`;
        }
        openReminder(hid, { owner: it.owner, label }, it.taskId, sel(`[data-item="${CSS.escape(it.id)}"]`));
        return true;
      }
      case "remind-task": {
        const h = hireById(hid);
        const t = h && h.tasks.find((x) => x.id === el.dataset.task);
        if (t) openReminder(hid, { owner: t.owner, label: t.title }, t.id, sel(`[data-task="${CSS.escape(t.id)}"]`));
        return true;
      }
      case "modal-close":
        closeModal();
        return true;
      case "fu-plan": {
        const h = hireById(hid);
        if (!h) return true;
        ui.fuTask = { fuId: el.dataset.fu, owner: "newhire", dueDate: OB.followUpDue(h, today()) };
        ui.fuTaskErrors = {};
        render();
        document.querySelector("#fu-task-form select")?.focus();
        return true;
      }
      case "fu-cancel":
        ui.fuTask = null;
        ui.fuTaskErrors = {};
        render();
        return true;
      case "goal-suggest": {
        const h = hireById(hid);
        const g = h && OB.addSuggestedGoal(h, el.dataset.goal, today());
        if (g) {
          toast(`Added for ${firstName(h.name)}: ${g.title} (${g.horizon} days)`);
          commit();
        }
        return true;
      }
      case "goal-remove": {
        const h = hireById(hid);
        const g = h && (h.goals || []).find((x) => x.id === el.dataset.goal);
        if (g && confirm(`Remove the goal “${g.title}” from ${h.name}'s goals?`)) {
          h.goals = h.goals.filter((x) => x.id !== g.id);
          toast(`Goal removed: ${g.title}`);
          commit();
        }
        return true;
      }
      case "pv-kind":
        ui.previewKind = el.dataset.kind === "nudge" ? "nudge" : "digest";
        render();
        return true;
      case "send-test": {
        const pv = currentPreview(v);
        if (!pv.msg) return true;
        for (const e of OB.testEntries(pv.prefs, pv.msg, pv.kind === "nudge" ? "test-nudge" : "test-digest", v, today(), nowHHMM()).reverse()) OB.addToOutbox(state, e);
        toast(`Test saved to your demo outbox (${OB.channelSummary(pv.prefs)}). Demo — not actually sent.`);
        commit();
        document.getElementById("outbox")?.scrollIntoView({ block: "start" });
        return true;
      }
      case "outbox-clear":
        state.outbox = (state.outbox || []).filter((e) => e.fromId !== v.id);
        commit();
        return true;
      case "goto-outbox":
        nav({ tab: "notifications" });
        document.getElementById("outbox")?.scrollIntoView({ block: "start" });
        return true;
      case "goto-week": {
        const w = document.getElementById("week-card");
        if (w) {
          w.scrollIntoView({ block: "start" });
          w.focus({ preventScroll: true });
        }
        return true;
      }
    }
    return false;
  }

  // ---------- HR clicks (round 4, pass C1). Returns true when handled. ----------
  function hrClick(a, el) {
    const v = viewer();
    const hid = el.dataset.hire;
    switch (a) {
      // Pulse check-in "Not now" is the new hire's; everything else below is HR's.
      case "pulse-later": {
        const h = hireById(v.id);
        if (h && v.role === "newhire" && OB.dismissPulse(h, el.dataset.pulse, today())) {
          ui.pulseErr = "";
          toast("No problem. This check-in won't come back.");
          commit();
        }
        return true;
      }
    }
    if (v.role !== "hr") return false;
    switch (a) {
      case "ins-pick": {
        const p = ui.insPick;
        ui.insPick = p && p.chart === el.dataset.chart && p.key === el.dataset.key ? null : { chart: el.dataset.chart, key: el.dataset.key };
        render();
        return true;
      }
      case "wl-pop":
        if (wlPop && wlPop.btn === el) closeWlPop(false);
        else openWlPop(el);
        return true;
      case "wl-close":
        closeWlPop(true);
        return true;
      case "use-monday": {
        // F4: one click moves a weekend start date to the next Monday (add form, also in its preview; edit form).
        const date = el.dataset.date;
        if (!OB.isValidISO(date)) return true;
        toast(`Start date set to ${OB.shortDay(date)}.`);
        if (el.dataset.form === "ef" && ui.hrEdit) {
          ui.hrEdit.draft.startDate = date;
          render();
          document.getElementById("ef-startDate")?.focus();
        } else if (el.dataset.form === "hf" && ui.draft) {
          ui.draft.startDate = date;
          if (ui.preview) {
            const r = OB.validateHire(ui.draft, today(), state.hires, state.roles);
            ui.draftErrors = r.errors;
            ui.draftWarnings = r.warnings;
            if (r.ok) {
              const pv = OB.previewPlan(ui.draft, ui.draft.startDate, today(), templates());
              ui.preview = { tasks: pv.tasks, skipped: pv.skipped, skip: ui.preview.skip };
            } else ui.preview = null;
          } else ui.draftWarnings = ui.draftWarnings.filter((w) => !/ is a (Saturday|Sunday)\. /.test(w));
          render();
          const inp = document.getElementById("hf-startDate");
          (inp && !inp.disabled ? inp : document.querySelector('[data-action="create-hire"]'))?.focus();
        }
        return true;
      }
      case "hr-more":
        if (el.dataset.sub === "bulk") hrNav({ page: "add", sub: "bulk" });
        else hrNav({ page: "more", sub: el.dataset.sub || undefined });
        return true;
      case "add-mode":
        hrNav({ page: "add", sub: el.dataset.mode === "bulk" ? "bulk" : undefined }, { keepScroll: true });
        return true;
      case "edit-hire":
        if (hireById(hid)) hrNav({ page: "hire", hireId: hid, edit: true });
        return true;
      case "edit-cancel":
        if (ui.hrEdit) hrNav({ page: "hire", hireId: ui.hrEdit.hireId });
        return true;
      case "remove-confirm": {
        const h = hireById(hid);
        if (!h) return true;
        const wasOpen = ui.detailId === h.id;
        ui.hireUndo = OB.removeHire(state, h.id);
        ui.modal = null;
        ui.modalReturn = null;
        toast(`Removed ${h.name}'s onboarding plan.`, { label: "Undo", action: "hire-undo" }, 10000);
        if (wasOpen) {
          OB.store.save(state);
          hrNav({ page: ui.hrTab || "hires" });
        } else commit();
        // The button that opened the dialog is gone: keyboard focus goes to Undo.
        document.querySelector(".toast-btn")?.focus();
        return true;
      }
      case "hire-undo": {
        const r = ui.hireUndo;
        ui.hireUndo = null;
        if (r && OB.restoreHire(state, r)) toast(`Put back: ${r.hire.name}'s onboarding plan.`);
        commit();
        // F6c: keyboard focus goes back to the restored row (its Remove button, else its name), not <body>.
        if (r) {
          const q = CSS.escape(r.hire.id);
          (document.querySelector(`[data-action="delete-hire"][data-hire="${q}"]`) || document.querySelector(`[data-action="open-hire"][data-hire="${q}"]`))?.focus();
        }
        return true;
      }
      case "bulk-sample": {
        const url = URL.createObjectURL(new Blob([OB.SAMPLE_CSV], { type: "text/csv;charset=utf-8" }));
        const x = document.createElement("a");
        x.href = url;
        x.download = "mangoapps-new-hires-sample.csv";
        document.body.appendChild(x);
        x.click();
        x.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast("Sample CSV downloaded. Fill it in, then paste it or choose the file.");
        return true;
      }
      case "bulk-check": {
        const b = ui.bulk || (ui.bulk = { text: "", preview: null, allow: new Set(), done: null });
        b.text = document.getElementById("bulk-text")?.value || b.text;
        b.preview = OB.bulkPreview(b.text, today(), state.hires, state.roles);
        b.allow = new Set();
        b.done = null;
        render();
        const r = document.getElementById("bulk-result");
        if (r) {
          r.scrollIntoView({ block: "start" });
          r.focus({ preventScroll: true });
        }
        return true;
      }
      case "bulk-import": {
        const b = ui.bulk;
        if (!b || !b.preview || b.preview.headerError) return true;
        const hs = OB.bulkImport(b.preview.rows, b.allow, today(), templates());
        if (!hs.length) return true;
        state.hires.push(...hs);
        ui.bulk = { text: "", preview: null, allow: new Set(), done: { names: hs.map((h) => h.name), skipped: b.preview.rows.length - hs.length } };
        toast(`Imported ${hs.length} ${hs.length === 1 ? "hire" : "hires"}.`);
        commit();
        document.getElementById("bulk-result")?.focus();
        return true;
      }
      case "bulk-again":
        ui.bulk = null;
        render();
        document.getElementById("bulk-text")?.focus();
        return true;
      // ---- C2b. Compliance ----
      case "comp-audit": {
        const k = el.dataset.key;
        const closing = ui.compAudit === k;
        ui.compAudit = closing ? null : k;
        render();
        // Back to the control that was used (the matrix column, or the item in a phone card), whichever is visible.
        if (closing) {
          const sel = `[data-action="comp-audit"][data-key="${CSS.escape(k)}"]`;
          const from = el.dataset.hire ? document.querySelector(`.ci-t${sel}[data-hire="${CSS.escape(el.dataset.hire)}"]`) : null;
          (from && from.offsetParent ? from : [...document.querySelectorAll(`.comp-col${sel}, .ci-t${sel}`)].find((x) => x.offsetParent))?.focus();
        }
        else {
          const p = document.getElementById("comp-audit");
          if (p) {
            p.scrollIntoView({ block: "nearest" });
            p.focus({ preventScroll: true });
          }
        }
        return true;
      }
      case "comp-export": {
        const m = OB.complianceMatrix(state.hires, today());
        downloadText(OB.complianceCsv(m, state.hires), `mangoapps-compliance-${today()}.csv`);
        toast(`Compliance CSV downloaded: ${m.total} ${m.total === 1 ? "person" : "people"}, ${m.columns.length} items, plus the audit log.`);
        return true;
      }
      // ---- C2c. Documents ----
      case "doc-add":
        ui.docEdit = { id: null, draft: { title: "", category: ui.docCat !== "all" ? ui.docCat : "", desc: "", link: "", audience: "everyone" } };
        ui.docErrors = {};
        render();
        document.getElementById("doc-f-title")?.focus();
        return true;
      case "doc-edit": {
        const d = docs().find((x) => x.id === el.dataset.doc);
        if (!d) return true;
        ui.docEdit = { id: d.id, draft: { title: d.title, category: d.category, desc: d.desc || "", link: d.link, audience: OB.audienceValue(d.audience) } };
        ui.docErrors = {};
        render();
        document.getElementById("doc-f-title")?.focus();
        return true;
      }
      case "doc-cancel": {
        const id = ui.docEdit && ui.docEdit.id;
        ui.docEdit = null;
        ui.docErrors = {};
        render();
        document.querySelector(id ? `[data-action="doc-edit"][data-doc="${CSS.escape(id)}"]` : "[data-action=doc-add]")?.focus();
        return true;
      }
      case "doc-clear":
        ui.docQuery = "";
        ui.docCat = "all";
        render();
        document.getElementById("doc-q")?.focus();
        return true;
      case "doc-remove": {
        const i = docs().findIndex((x) => x.id === el.dataset.doc);
        if (i < 0) return true;
        const [d] = state.documents.splice(i, 1);
        if (ui.docEdit && ui.docEdit.id === d.id) ui.docEdit = null;
        ui.docUndo = { doc: d, index: i };
        toast(`Removed: ${d.title}. Tasks linked to it use their own link again.`, { label: "Undo", action: "doc-undo" });
        commit();
        document.querySelector(".toast-btn")?.focus();
        return true;
      }
      case "doc-undo": {
        const u = ui.docUndo;
        ui.docUndo = null;
        if (u && !docs().some((x) => x.id === u.doc.id)) {
          state.documents.splice(Math.min(u.index, state.documents.length), 0, u.doc);
          toast(`Put back: ${u.doc.title}`);
        }
        commit();
        if (u) document.querySelector(`[data-action="doc-remove"][data-doc="${CSS.escape(u.doc.id)}"]`)?.focus(); // F6c
        return true;
      }
    }
    return false;
  }

  // ---------- HR + new hire form submits (round 4, pass C1). Returns true when handled. ----------
  function hrSubmit(form) {
    const v = viewer();
    if (form.id === "pulse-form") {
      const h = hireById(v.id);
      if (!h || v.role !== "newhire") return true;
      const ans = form.querySelector("input[name=answer]:checked");
      const comment = form.elements.comment.value;
      const r = OB.answerPulse(h, form.dataset.pulse, ans ? ans.value : "", comment, today());
      if (!r.ok) {
        ui.pulseErr = r.error;
        render();
        const c = document.getElementById("pulse-comment");
        if (c) c.value = comment;
        document.querySelector("#pulse-form input[name=answer]")?.focus();
        return true;
      }
      ui.pulseErr = "";
      toast("Thanks for sharing. HR sees it grouped with everyone else's answers.");
      commit();
      return true;
    }
    if (v.role !== "hr") return false;
    if (form.id === "doc-form") {
      const e = ui.docEdit;
      if (!e) return true;
      e.draft = { ...e.draft, ...readForm(form) };
      const r = OB.validateDoc(e.draft, docs(), e.id);
      ui.docErrors = r.errors;
      if (!r.ok) {
        render();
        document.querySelector("#doc-form .has-err input, #doc-form .has-err select, #doc-form .has-err textarea")?.focus();
        return true;
      }
      const doc = OB.makeDoc(e.draft, today(), docs(), e.id);
      if (!Array.isArray(state.documents)) state.documents = [];
      if (e.id) state.documents = state.documents.map((x) => (x.id === e.id ? doc : x));
      else state.documents.push(doc);
      ui.docEdit = null;
      ui.docErrors = {};
      toast(`${e.id ? "Saved" : "Added"}: ${doc.title}. ${OB.audienceLabel(doc.audience) === "Everyone" ? "Every new hire" : `New hires in ${OB.audienceLabel(doc.audience)}`} can see it.`);
      commit();
      document.querySelector(`[data-action="doc-edit"][data-doc="${CSS.escape(doc.id)}"]`)?.focus();
      return true;
    }
    if (form.id === "role-form") {
      const input = readForm(form);
      const r = OB.validateRole(input, state.roles);
      ui.roleForm = { ...input, errors: r.errors };
      if (!r.ok) {
        render();
        document.querySelector("#role-form .has-err input, #role-form .has-err select")?.focus();
        return true;
      }
      const role = OB.makeRole(input, state.roles);
      state.roles.push(role);
      ui.roleForm = null;
      ui.tplName = `role:${role.id}`;
      toast(`Created the ${role.name} role (${role.department}). Add its first task.`);
      commit();
      document.querySelector('[data-action="tpl-add"]')?.focus();
      return true;
    }
    if (form.id === "edit-form") {
      const e = ui.hrEdit;
      const h = e && hireById(e.hireId);
      if (!h) return true;
      e.draft = { ...e.draft, ...readForm(form) };
      const input = { ...e.draft, role: e.draft.role || null };
      const r = OB.validateHireEdit(input, h, today(), state.hires, state.roles);
      e.errors = r.errors;
      if (!r.ok) {
        render();
        document.querySelector("#edit-form .has-err input, #edit-form .has-err select")?.focus();
        return true;
      }
      const sum = OB.applyHireEdit(h, input, today(), templates());
      const bits = [`Saved changes for ${h.name}.`];
      if (sum.managerLine) bits.push(sum.managerLine);
      if (sum.planChanged) bits.push(`${sum.removed.length} open ${sum.removed.length === 1 ? "task" : "tasks"} out, ${sum.added.length} in.`);
      if (sum.startChanged) bits.push(`${sum.shifted} due ${sum.shifted === 1 ? "date" : "dates"} updated.`);
      OB.store.save(state);
      toast(bits.join(" "));
      hrNav({ page: "hire", hireId: h.id });
      return true;
    }
    return false;
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
        ui.schedDay = null;
        commit();
      }
      return;
    }
    if (el.dataset.toggle) return toggleTask(el.dataset.hire, el.dataset.toggle, el.checked);
    if (managerChange(el)) return;
    if (el.form && el.form.id === "nh-form" && ui.formDraft && el.name) {
      ui.formDraft.data[el.name] = el.type === "checkbox" ? el.checked : el.value;
      return;
    }
    if (el.form && el.form.id === "tpl-form" && ui.tplEdit && el.name) {
      const d = ui.tplEdit.draft;
      // "Who gets this task" checkboxes: keep the ticked values in list order, then update the summary line.
      if (el.name === "wt" || el.name === "jl") {
        const k = el.name === "wt" ? "workTypes" : "jobLevels";
        const set = new Set(d[k]);
        if (el.checked) set.add(el.value);
        else set.delete(el.value);
        d[k] = (k === "workTypes" ? OB.WORK_TYPES : OB.JOB_LEVELS).filter((x) => set.has(x));
        return tplLiveHints();
      }
      d[el.name] = el.type === "checkbox" ? el.checked : el.value;
      // Who does it decides whether the "How the new hire sees it" fields show; Type swaps the icon.
      if (el.name === "owner" || el.name === "mode" || el.name === "type") render();
      else tplLiveHints();
      return;
    }
    // Round 4, C2c (HR): the documents category filter.
    if (el.id === "doc-cat") {
      ui.docCat = el.value;
      return render();
    }
    // Round 4, C1 (HR): the edit-hire form, bulk import.
    if (el.form && el.form.id === "edit-form" && ui.hrEdit && el.name) {
      const e = ui.hrEdit;
      const d = e.draft;
      d[el.name] = el.value;
      if (el.name === "department") {
        if (!OB.rolesFor(d.department, state.roles).some((r) => r.id === d.role)) d.role = "";
        // The manager must belong to the new department: pick that department's manager, and say so.
        const m = person(d.managerId);
        e.mgrNote = "";
        if (!m || m.department !== d.department) {
          const nid = OB.managerFor(d.department);
          if (nid) {
            d.managerId = nid;
            e.mgrNote = `${m ? `${m.name} manages ${m.department}, so ` : ""}${personName(nid)} from ${d.department} is picked as the manager. Pick someone else from ${d.department} if needed.`;
          }
        }
      }
      if (el.name === "managerId") e.mgrNote = "";
      if (el.name === "name" || el.name === "title") return;
      return render();
    }
    if (el.id === "bulk-file" && el.files && el.files[0]) {
      const rd = new FileReader();
      rd.onload = () => {
        ui.bulk = { text: String(rd.result || ""), preview: null, allow: new Set(), done: null };
        ui.bulk.preview = OB.bulkPreview(ui.bulk.text, today(), state.hires, state.roles);
        render();
        document.getElementById("bulk-result")?.focus();
      };
      rd.readAsText(el.files[0]);
      return;
    }
    if (el.dataset.bulkAllow && ui.bulk) {
      const n = Number(el.dataset.bulkAllow);
      if (el.checked) ui.bulk.allow.add(n);
      else ui.bulk.allow.delete(n);
      return render();
    }
    if (el.dataset.preview && ui.preview) {
      if (el.checked) ui.preview.skip.delete(el.dataset.preview);
      else ui.preview.skip.add(el.dataset.preview);
      return render();
    }
    if (el.form && el.form.id === "hire-form" && ui.draft) {
      ui.draft[el.name] = el.value;
      if (el.name === "startDate") {
        const hint = document.getElementById("hf-wk");
        if (hint) hint.innerHTML = wkHintInner(el.value, "hf");
      }
      // A new department: suggest its manager (unless the picked one already manages it) and its roles.
      if (el.name === "department") {
        if (!OB.rolesFor(el.value, state.roles).some((r) => r.id === ui.draft.role)) ui.draft.role = "";
        const m = person(ui.draft.managerId);
        if (!m || m.department !== el.value) {
          const nid = OB.managerFor(el.value);
          if (nid) ui.draft.managerId = nid;
        }
        render();
      }
    }
  });

  app.addEventListener("input", (e) => {
    const el = e.target;
    if (el.form && el.form.id === "hire-form" && ui.draft && el.name) ui.draft[el.name] = el.value;
    if (el.form && el.form.id === "edit-form" && ui.hrEdit && el.name) ui.hrEdit.draft[el.name] = el.value;
    if (el.form && el.form.id === "role-form" && ui.roleForm && el.name) ui.roleForm[el.name] = el.value;
    if (el.id === "bulk-text" && ui.bulk) ui.bulk.text = el.value;
    if (el.form && el.form.id === "doc-form" && ui.docEdit && el.name) ui.docEdit.draft[el.name] = el.value;
    // Documents search: only the results re-render, so typing keeps its place.
    if (el.id === "doc-q") {
      ui.docQuery = el.value;
      const r = document.getElementById("doc-results");
      if (r) r.innerHTML = docResults();
    }
    if (el.form && el.form.id === "task-form" && ui.taskForm && el.name) ui.taskForm[el.name] = el.value;
    if (el.form && el.form.id === "nh-form" && ui.formDraft && el.name) ui.formDraft.data[el.name] = el.type === "checkbox" ? el.checked : el.value;
    if (el.form && el.form.id === "tpl-form" && ui.tplEdit && el.name && el.type !== "checkbox") {
      ui.tplEdit.draft[el.name] = el.value;
      tplLiveHints();
    }
    // Round 4, pass B: keep typing in manager forms across re-renders.
    if (el.form && el.form.id === "fu-form" && el.name === "text") ui.fuText = el.value;
    if (el.form && el.form.id === "goal-form" && el.name) ui.goalDraft = { ...(ui.goalDraft || {}), ...readForm(el.form), hireId: el.form.dataset.hire };
    if (el.form && el.form.id === "remind-form" && ui.modal && el.name) ui.modal.draft[el.name] = el.value;
  });

  app.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    if (managerSubmit(form)) return;
    if (hrSubmit(form)) return;
    if (form.id === "hire-form") {
      ui.draft = { ...ui.draft, ...readForm(form) };
      const r = OB.validateHire(ui.draft, today(), state.hires, state.roles);
      ui.draftErrors = r.errors;
      ui.draftWarnings = r.warnings;
      if (r.ok) {
        const pv = OB.previewPlan(ui.draft, ui.draft.startDate, today(), templates());
        ui.preview = { tasks: pv.tasks, skipped: pv.skipped, skip: new Set() };
      }
      render();
      if (r.ok) document.getElementById("preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      else form.querySelector(".has-err input, .has-err select")?.focus();
    }
    if (form.id === "tpl-form") return saveTemplateTask(form);
    if (form.id === "nh-form") return submitNhForm(form);
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
    if (wlPop && !inWl(e.target)) closeWlPop(false);
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const a = el.dataset.action;
    const hid = el.dataset.hire;
    if (managerClick(a, el)) return;
    if (hrClick(a, el)) return;
    switch (a) {
      case "open-hire":
        // U3: data-show / data-task open the plan filtered to those tasks (managers: via the URL hash).
        openHire(hid, el.dataset.show, el.dataset.task);
        break;
      case "close-hire":
        if (viewer().role === "manager") {
          nav({ tab: "team", day: ui.weekDay || undefined });
          break;
        }
        if (viewer().role === "hr") {
          hrNav({ page: ui.hrTab || "hires", sub: ui.hrSub || undefined });
          break;
        }
        ui.detailId = null;
        ui.detailShow = null;
        ui.detailTask = null;
        ui.taskForm = null;
        render();
        break;
      case "nh-goal-note":
        ui.nhGoalNote = el.dataset.goal || null;
        render();
        if (ui.nhGoalNote) document.getElementById(`gn-${ui.nhGoalNote}`)?.focus();
        break;
      case "view-as":
        switchViewer(hid);
        break;
      case "nh-tab":
        ui.nhTab = el.dataset.tab;
        ui.nhForm = null;
        ui.formErrors = {};
        render();
        if (el.getAttribute("role") !== "tab") window.scrollTo(0, 0);
        break;
      case "nh-forms":
        ui.nhTab = "focus";
        ui.nhForm = "list";
        ui.formDraft = null;
        ui.formErrors = {};
        render();
        window.scrollTo(0, 0);
        break;
      case "nh-form-close":
        ui.nhForm = null;
        ui.formDraft = null;
        ui.formErrors = {};
        render();
        window.scrollTo(0, 0);
        break;
      case "nh-form": {
        const h = hireById(viewer().id);
        if (!h || !OB.formDef(el.dataset.form)) break;
        openForm(h, el.dataset.form);
        render();
        window.scrollTo(0, 0);
        break;
      }
      case "form-draft": {
        const v = viewer();
        const h = hireById(v.id);
        const formEl = document.getElementById("nh-form");
        if (!h || v.role !== "newhire" || !formEl) break;
        const data = readNhForm(formEl);
        OB.saveFormDraft(h, el.dataset.form, data, today());
        ui.formDraft = { id: el.dataset.form, data };
        ui.formErrors = {};
        toast("Draft saved. Come back any time to finish it.");
        commit();
        break;
      }
      case "sched-day":
        ui.schedDay = Number(el.dataset.day);
        render();
        break;
      case "week-ics": {
        const h = hireById(hid);
        if (h) downloadWeekIcs(h);
        break;
      }
      case "learn-start":
      case "learn-done":
      case "learn-undo":
        learningAction(a, el.dataset.item);
        break;
      case "hr-tab":
        hrNav({ page: el.dataset.tab }, { keepScroll: el.getAttribute("role") === "tab" });
        break;
      case "cancel-preview":
        ui.preview = null;
        render();
        break;
      case "create-hire": {
        const d = ui.draft;
        const r = OB.validateHire(d, today(), state.hires, state.roles);
        if (!r.ok) {
          ui.preview = null;
          ui.draftErrors = r.errors;
          render();
          break;
        }
        // Same builder as bulk import (C1c): Company + department + role tasks, minus the ones HR unticked.
        const hire = OB.makeHire(d, today(), templates(), [...ui.preview.skip]);
        state.hires.push(hire);
        ui.draft = null;
        ui.preview = null;
        ui.draftErrors = {};
        ui.draftWarnings = [];
        ui.hrTab = "hires";
        OB.store.save(state);
        toast(`Plan created for ${hire.name}. ${personName(hire.managerId)} can now see it.`);
        hrNav({ page: "hire", hireId: hire.id });
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
      case "delete-hire":
        // U4: a calm confirm dialog, then an Undo toast for 10 seconds.
        if (hireById(hid)) openModal({ kind: "remove-hire", hireId: hid }, `[data-action="delete-hire"][data-hire="${CSS.escape(hid)}"]`);
        break;
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
      case "week-day": {
        const day = el.dataset.day && el.dataset.day !== ui.weekDay ? el.dataset.day : null;
        // Managers: the picked day is kept in the URL hash (U3), so Back returns to it.
        if (viewer().role === "manager") {
          const h = OB.buildRoute({ tab: "team", day: day || undefined });
          applyRoute(OB.parseRoute(h));
          ui.lastHash = h;
          if (location.hash !== h) location.hash = h;
        } else ui.weekDay = day;
        render();
        break;
      }
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
      case "tpl-role-new":
      case "tpl-role-cancel":
      case "tpl-role-remove":
        templateAction(a, el);
        break;
      case "real-date":
        state.demoToday = null;
        commit();
        break;
      case "reset":
        if (confirm("Reset all demo data? Any hires or changes you made will be lost.")) {
          state = OB.store.reset();
          Object.assign(ui, { hrSub: null, hrEdit: null, bulk: null, insPick: null, roleForm: null, hireUndo: null, pulseErr: "" });
          Object.assign(ui, { compAudit: null, docQuery: "", docCat: "all", docEdit: null, docErrors: {}, docUndo: null });
          Object.assign(ui, { detailId: null, draft: null, preview: null, taskForm: null, hrTab: "hires", nhTab: "focus", tplEdit: null, tplErrors: {}, tplName: "Company", nhForm: null, formDraft: null, formErrors: {}, schedDay: null, nhGoalNote: null, previewKind: "digest", goalDraft: null });
          applyRoute({ tab: "team" });
          clearHash();
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
    if (wlPop && e.key === "Escape") {
      e.preventDefault();
      closeWlPop(true);
      return;
    }
    // Dialogs: Esc closes; Tab stays inside the dialog.
    if (ui.modal && e.key === "Escape") {
      e.preventDefault();
      closeModal();
    } else if (ui.modal && e.key === "Tab") {
      const m = document.querySelector(".modal");
      const f = m ? [...m.querySelectorAll("input:not([type=radio]), input[type=radio]:checked, select, textarea, button")].filter((x) => !x.disabled) : [];
      if (!f.length) return;
      const firstEl = f[0];
      const lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      } else if (!m.contains(document.activeElement)) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  });

  // U5 (round 4 fix F2/F6b): the pop-up opens on click / Enter / Space only. Focus leaving it and its name closes it.
  app.addEventListener("focusout", (e) => {
    if (!wlPop || inWl(e.relatedTarget) || !e.relatedTarget) return;
    closeWlPop(false);
  });

  OB.store.onExternalChange((s) => {
    state = s;
    if (ui.detailId && !hireById(ui.detailId)) ui.detailId = null;
    if (ui.modal && !hireById(ui.modal.hireId)) ui.modal = null;
    render();
  });

  // A manager opening a link with a route (e.g. #/hire/marcus?show=catchup) lands there.
  if (viewer().role === "manager" && location.hash) {
    ui.lastHash = location.hash;
    applyRoute(OB.parseRoute(location.hash));
  }
  // ...and HR the same (#/hr/insights, #/hr/hire/emily/edit).
  if (viewer().role === "hr" && OB.parseHrRoute(location.hash)) {
    ui.lastHash = location.hash;
    applyHrRoute(OB.parseHrRoute(location.hash));
  }
  render();
})();
