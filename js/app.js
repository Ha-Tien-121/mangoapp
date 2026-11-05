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
    draft: null, // add-hire form
    draftErrors: {},
    draftWarnings: [],
    preview: null, // generated plan preview for the add-hire form
    taskForm: null, // custom task form on detail page
    taskErrors: {},
    toast: null,
  };

  // ---------- helpers ----------
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const today = () => state.demoToday || OB.todayISO();

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

  function toast(msg) {
    ui.toast = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      ui.toast = null;
      render();
    }, 2600);
  }

  function dueLabel(t) {
    const td = today();
    if (t.done) return `Done ${t.doneAt ? OB.prettyDate(t.doneAt) : ""}`;
    const d = OB.diffDays(t.dueDate, td);
    if (d < 0) return `Overdue · was due ${OB.prettyDate(t.dueDate)}`;
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

  function statusBadge(status) {
    return `<span class="badge badge-${status}">${OB.STATUS_LABEL[status]}</span>`;
  }

  function progressBar(pct, label) {
    return `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(label || "Progress")}"><span style="width:${pct}%"></span></div>`;
  }

  // ---------- header ----------
  function renderHeader() {
    const v = viewer();
    const opt = (id, label) => `<option value="${esc(id)}" ${state.viewerId === id ? "selected" : ""}>${esc(label)}</option>`;
    const hr = OB.PEOPLE.filter((p) => p.role === "hr");
    const mgrs = OB.PEOPLE.filter((p) => p.role === "manager");
    const isDemoDate = !!state.demoToday;
    return `
      <header class="topbar">
        <div class="brand"><span class="logo" aria-hidden="true">BP</span><div><strong>BrightPath</strong><span class="sub">Onboarding</span></div></div>
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
    const overdue = OB.isOverdue(t, today());
    const who = ownerLabel(t, hire, viewerRole);
    const doneBy = t.done && t.doneBy ? ` by ${esc(t.doneBy === state.viewerId ? "you" : personName(t.doneBy))}` : "";
    const cbId = `cb-${t.id}`;
    return `
      <li class="task ${t.done ? "is-done" : ""} ${overdue ? "is-overdue" : ""} ${o.big ? "task-big" : ""}">
        <div class="check">
          ${
            can
              ? `<input type="checkbox" id="${cbId}" data-toggle="${esc(t.id)}" data-hire="${esc(hire.id)}" ${t.done ? "checked" : ""} aria-label="Mark '${esc(t.title)}' ${t.done ? "not done" : "done"}" />`
              : `<span class="check-ro ${t.done ? "on" : ""}" title="${t.done ? "Done" : `Only ${esc(who)} can complete this`}" aria-hidden="true"></span>`
          }
        </div>
        <div class="task-body">
          <label ${can ? `for="${cbId}"` : ""} class="task-title">${esc(t.title)}</label>
          ${t.desc && !o.compact ? `<p class="task-desc">${esc(t.desc)}</p>` : ""}
          <div class="task-meta">
            <span class="due ${overdue ? "due-over" : ""}">${esc(dueLabel(t))}${doneBy}</span>
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
      const open = o.allOpen || !isFuture;
      return `
        <details class="phase ${isCur ? "phase-current" : ""}" ${open ? "open" : ""}>
          <summary>
            <span class="phase-name">${esc(p.label)}${isCur ? ` <span class="now-pill">Now</span>` : ""}</span>
            <span class="phase-count">${done}/${tasks.length} done</span>
          </summary>
          <p class="phase-hint">${esc(p.hint)}</p>
          ${
            tasks.length
              ? `<ul class="tasks">${tasks.map((t) => taskRow(t, hire, viewerRole, o)).join("")}</ul>`
              : `<p class="empty-sm">No tasks in this phase.</p>`
          }
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
    const myOpen = hire.tasks.filter((t) => t.owner === "newhire" && !t.done);
    const myOverdue = myOpen.filter((t) => OB.isOverdue(t, td));
    const recentDone = hire.tasks
      .filter((t) => t.done)
      .sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""))
      .slice(0, 5);

    let greeting;
    if (stats.dayN < 0) greeting = `${-stats.dayN} day${stats.dayN === -1 ? "" : "s"} until your first day`;
    else if (stats.dayN === 0) greeting = "Today is your first day. Welcome!";
    else if (stats.dayN > 27) greeting = "Your onboarding period is over";
    else greeting = `Day ${stats.dayN + 1} at BrightPath`;

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
                <ul class="tasks tasks-compact">${waiting.map((t) => taskRow(t, hire, "newhire", { compact: true })).join("")}</ul>
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
        <section class="hero">
          <div>
            <p class="eyebrow">${esc(hire.title)} · ${esc(hire.department)}</p>
            <h1>Hi ${esc(firstName(hire.name))}</h1>
            <p class="lead">${esc(greeting)}${stats.dayN < 0 ? ` · you start ${esc(OB.prettyDate(hire.startDate))}` : ""}</p>
            ${myOverdue.length ? `<p class="alert">${myOverdue.length} of your tasks ${myOverdue.length === 1 ? "is" : "are"} overdue. They're at the top of your list.</p>` : ""}
          </div>
          <div class="hero-progress">
            <div class="big-num">${stats.done}<span>/${stats.total}</span></div>
            <div class="muted">tasks done</div>
            ${progressBar(stats.pct, "Overall onboarding progress")}
          </div>
        </section>
        ${phaseStepper(hire, stats)}
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
  function hireCard(h) {
    const s = OB.hireStats(h, today());
    const myTodo = h.tasks.filter((t) => t.owner === "manager" && !t.done).length;
    return `
      <button class="hire-card" data-action="open-hire" data-hire="${esc(h.id)}">
        <div class="hc-top">
          <span class="avatar">${initials(h.name)}</span>
          <div class="hc-name"><strong>${esc(h.name)}</strong><span class="muted">${esc(h.title)}</span></div>
          ${statusBadge(s.status)}
        </div>
        <div class="muted small">${esc(dayLabel(h))}</div>
        ${progressBar(s.pct, `${h.name} progress`)}
        <div class="hc-foot">
          <span>${s.done}/${s.total} done · ${s.pct}%</span>
          ${s.overdue.length ? `<span class="over">${s.overdue.length} overdue</span>` : ""}
          ${myTodo ? `<span class="mine">${myTodo} for you</span>` : ""}
        </div>
      </button>`;
  }

  function todoList(items, viewerRole, title, emptyMsg) {
    if (!items.length) return `<section class="card"><h2 class="section-title">${esc(title)}</h2><p class="empty-sm">${esc(emptyMsg)}</p></section>`;
    return `
      <section class="card">
        <h2 class="section-title">${esc(title)}</h2>
        <ul class="tasks">${items
          .map(
            ({ t, h }) => `
              <li class="todo-group">
                <div class="todo-for">For <button class="link" data-action="open-hire" data-hire="${esc(h.id)}">${esc(h.name)}</button></div>
                <ul class="tasks tasks-compact">${taskRow(t, h, viewerRole, { compact: true })}</ul>
              </li>`
          )
          .join("")}</ul>
      </section>`;
  }

  function renderManager(v) {
    if (ui.detailId && hireById(ui.detailId)) return renderDetail(hireById(ui.detailId), v);
    const td = today();
    const mine = state.hires.filter((h) => h.managerId === v.id).sort((a, b) => a.startDate.localeCompare(b.startDate));
    const todos = [];
    for (const h of mine) for (const t of h.tasks) if (t.owner === "manager" && !t.done) todos.push({ t, h });
    todos.sort((a, b) => a.t.dueDate.localeCompare(b.t.dueDate));
    const soon = todos.filter(({ t }) => t.dueDate <= OB.addDays(td, 7));
    const attention = mine.filter((h) => OB.hireStats(h, td).status === "attention").length;

    return `
      <main class="wrap">
        <section class="page-head">
          <h1>Your new hires</h1>
          <p class="lead">${mine.length ? `${mine.length} ${mine.length === 1 ? "person is" : "people are"} onboarding on your team${attention ? ` · <strong class="over">${attention} need${attention === 1 ? "s" : ""} attention</strong>` : ""}.` : ""}</p>
        </section>
        ${
          mine.length
            ? `<div class="grid">${mine.map(hireCard).join("")}</div>
               ${todoList(soon, "manager", "Your to-dos this week", "Nothing due from you in the next 7 days.")}`
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
            ${statusBadge(s.status)}
            <div class="big-num">${s.pct}<span>%</span></div>
            ${progressBar(s.pct)}
            <div class="muted small">${s.done} of ${s.total} tasks done${s.overdue.length ? ` · <span class="over">${s.overdue.length} overdue</span>` : ""}</div>
          </div>
        </section>
        ${phaseStepper(hire, s)}
        ${
          s.overdue.length
            ? `<section class="card warn"><h2 class="section-title">Overdue</h2><ul class="tasks tasks-compact">${OB.sortTasks(s.overdue).map((t) => taskRow(t, hire, role, { compact: true, showSource: true })).join("")}</ul></section>`
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
        ${phaseSections(hire, role, { allOpen: true, showSource: true, canRemove: canEdit })}
        <p class="muted small legend">You can tick off tasks assigned to ${role === "hr" ? "HR and IT" : "you"}. Other tasks are completed by the person they're assigned to.</p>
      </main>`;
  }

  // ---------- HR VIEW ----------
  function renderHR(v) {
    if (ui.detailId && hireById(ui.detailId)) return renderDetail(hireById(ui.detailId), v);
    const tabs = `
      <div class="tabs" role="tablist">
        ${[
          ["hires", "New hires"],
          ["add", "+ Add new hire"],
          ["templates", "Plan templates"],
        ]
          .map(([id, l]) => `<button role="tab" aria-selected="${ui.hrTab === id}" class="${ui.hrTab === id ? "on" : ""}" data-action="hr-tab" data-tab="${id}">${l}</button>`)
          .join("")}
      </div>`;
    let body;
    if (ui.hrTab === "add") body = renderAddHire();
    else if (ui.hrTab === "templates") body = renderTemplates();
    else body = renderHireTable();
    return `<main class="wrap"><section class="page-head"><h1>Onboarding</h1><p class="lead">Everyone joining BrightPath in their first four weeks.</p></section>${tabs}${body}</main>`;
  }

  function renderHireTable() {
    const td = today();
    const rows = state.hires
      .map((h) => ({ h, s: OB.hireStats(h, td) }))
      .sort((a, b) => a.h.startDate.localeCompare(b.h.startDate));
    const active = rows.filter((r) => r.s.dayN <= 27);
    const nAttention = rows.filter((r) => r.s.status === "attention").length;
    const nSoon = rows.filter((r) => r.s.dayN < 0 && r.s.dayN >= -14).length;
    const filtered = rows.filter(
      (r) => (ui.hrFilterDept === "all" || r.h.department === ui.hrFilterDept) && (ui.hrFilterStatus === "all" || r.s.status === ui.hrFilterStatus)
    );
    const todos = [];
    for (const h of state.hires) for (const t of h.tasks) if ((t.owner === "hr" || t.owner === "it") && !t.done && t.dueDate <= OB.addDays(td, 7)) todos.push({ t, h });
    todos.sort((a, b) => a.t.dueDate.localeCompare(b.t.dueDate));

    const sel = (name, val, opts) =>
      `<select data-filter="${name}" aria-label="Filter by ${name}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${val === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;

    return `
      <div class="stats">
        <div class="stat"><div class="stat-num">${active.length}</div><div class="muted">onboarding now</div></div>
        <div class="stat ${nAttention ? "stat-bad" : ""}"><div class="stat-num">${nAttention}</div><div class="muted">need attention</div></div>
        <div class="stat"><div class="stat-num">${nSoon}</div><div class="muted">starting in next 2 weeks</div></div>
      </div>
      <section class="card">
        <div class="toolbar">
          <h2 class="section-title inline">New hires</h2>
          <div class="toolbar-actions">
            ${sel("dept", ui.hrFilterDept, [["all", "All departments"], ...OB.DEPARTMENTS.map((d) => [d, d])])}
            ${sel("status", ui.hrFilterStatus, [["all", "Any status"], ...Object.entries(OB.STATUS_LABEL)])}
          </div>
        </div>
        ${
          !state.hires.length
            ? `<div class="empty"><h3>No new hires yet</h3><p>Add someone to generate their onboarding plan.</p><button class="btn primary" data-action="hr-tab" data-tab="add">+ Add new hire</button></div>`
            : !filtered.length
              ? `<div class="empty"><p>No new hires match these filters.</p><button class="link" data-action="clear-filters">Clear filters</button></div>`
              : `<div class="table-wrap"><table class="table">
                  <thead><tr><th>Name</th><th>Department</th><th>Manager</th><th>Start</th><th>Progress</th><th>Status</th></tr></thead>
                  <tbody>${filtered
                    .map(
                      ({ h, s }) => `
                    <tr data-action="open-hire" data-hire="${esc(h.id)}" tabindex="0">
                      <td><strong>${esc(h.name)}</strong><div class="muted small">${esc(h.title)}</div></td>
                      <td>${esc(h.department)}</td>
                      <td>${esc(personName(h.managerId))}</td>
                      <td>${esc(OB.prettyDate(h.startDate))}<div class="muted small">${s.dayN < 0 ? `in ${-s.dayN}d` : s.dayN > 27 ? "done" : `day ${s.dayN + 1}`}</div></td>
                      <td class="td-prog">${progressBar(s.pct)}<div class="muted small">${s.done}/${s.total}${s.overdue.length ? ` · <span class="over">${s.overdue.length} overdue</span>` : ""}</div></td>
                      <td>${statusBadge(s.status)}</td>
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

  function renderTemplates() {
    const offsetLabel = (o) => (o < 0 ? `${-o} day${o === -1 ? "" : "s"} before start` : o === 0 ? "Day 1" : `Day ${o + 1}`);
    const block = (name, tasks, note) => `
      <section class="card">
        <h2 class="section-title">${esc(name)} <span class="muted small">${tasks.length} tasks${note ? ` · ${note}` : ""}</span></h2>
        <table class="table compact"><thead><tr><th>Task</th><th>Who</th><th>When</th></tr></thead>
        <tbody>${tasks
          .slice()
          .sort((a, b) => a.dayOffset - b.dayOffset)
          .map((t) => `<tr><td>${esc(t.title)}</td><td><span class="chip chip-${t.owner}">${t.owner === "newhire" ? "New hire" : OB.OWNERS[t.owner]}</span></td><td class="muted">${offsetLabel(t.dayOffset)}</td></tr>`)
          .join("")}</tbody></table>
      </section>`;
    return `
      <p class="muted">Every plan = <strong>Company</strong> tasks + the person's <strong>department</strong> tasks. Managers can add extra tasks for an individual. Editing templates here is a next step. For now they're read-only.</p>
      ${block("Company (everyone)", OB.TEMPLATES.Company, "applies to all departments")}
      ${OB.DEPARTMENTS.map((d) => block(d, OB.TEMPLATES[d] || [])).join("")}`;
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

    document.getElementById("app").innerHTML = `
      ${renderHeader()}
      ${main}
      <footer class="foot">
        Prototype with mock data, saved in this browser only.
        <button class="link" data-action="reset">Reset demo data</button>
      </footer>
      ${ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : ""}`;

    if (focusKey) {
      const el =
        document.querySelector(`[data-toggle="${CSS.escape(focusKey)}"]`) ||
        document.querySelector(`[data-preview="${CSS.escape(focusKey)}"]`) ||
        document.getElementById(focusKey);
      if (el) el.focus({ preventScroll: true });
    }
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
    if (checked && v.role === "newhire" && h.tasks.every((x) => x.done)) toast("Onboarding complete. Welcome to BrightPath!");
    else if (checked) toast(`Done: ${t.title}`);
    commit();
  }

  function switchViewer(id) {
    state.viewerId = id;
    ui.detailId = null;
    ui.taskForm = null;
    ui.nhTab = "focus";
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
        commit();
      }
      return;
    }
    if (el.dataset.toggle) return toggleTask(el.dataset.hire, el.dataset.toggle, el.checked);
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
        const built = OB.buildPlan(ui.draft.department, ui.draft.startDate, [], today());
        const tasks = OB.templateTasksFor(ui.draft.department).map((t, i) => ({ ...t, dueDate: built[i].dueDate, phase: built[i].phase }));
        ui.preview = { tasks, skip: new Set() };
      }
      render();
      if (r.ok) document.getElementById("preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      else form.querySelector(".has-err input, .has-err select")?.focus();
    }
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
        render();
        break;
      case "clear-filters":
        ui.hrFilterDept = "all";
        ui.hrFilterStatus = "all";
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
          tasks: OB.buildPlan(d.department, d.startDate, [...ui.preview.skip], today()),
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
      case "real-date":
        state.demoToday = null;
        commit();
        break;
      case "reset":
        if (confirm("Reset all demo data? Any hires or changes you made will be lost.")) {
          state = OB.store.reset();
          Object.assign(ui, { detailId: null, draft: null, preview: null, taskForm: null, hrTab: "hires", nhTab: "focus" });
          render();
        }
        break;
    }
  });

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
