// Pure onboarding logic: plan generation, progress, focus list, validation.
// No DOM access here so it can be tested on its own (see tests.html).
window.OB = window.OB || {};

(function () {
  // ---- Dates (always "YYYY-MM-DD" strings in local time) ----
  function parseDate(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function fmtISO(dt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function addDays(s, n) {
    const dt = parseDate(s);
    dt.setDate(dt.getDate() + n);
    return fmtISO(dt);
  }
  function diffDays(a, b) {
    // a - b in whole days
    return Math.round((parseDate(a) - parseDate(b)) / 86400000);
  }
  function isValidISO(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    return fmtISO(parseDate(s)) === s;
  }
  function prettyDate(s) {
    return parseDate(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  function todayISO() {
    return fmtISO(new Date());
  }

  // ---- Phases ----
  function phaseForOffset(dayOffset) {
    if (dayOffset < 0) return "before";
    if (dayOffset <= 6) return "week1";
    return "month1";
  }
  function currentPhase(startDate, today) {
    return phaseForOffset(diffDays(today, startDate));
  }
  const PHASE_ORDER = { before: 0, week1: 1, month1: 2 };

  // ---- Plan generation ----
  let idCounter = 0;
  function newId(prefix) {
    idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
  }

  // Company tasks + the department's tasks, sorted by due date.
  // templates (optional): HR's edited templates (see mergeTemplates). Defaults to OB.TEMPLATES.
  function templateTasksFor(department, templates) {
    const tpl = templates || OB.TEMPLATES;
    const company = (tpl.Company || []).map((t) => ({ ...t, source: "Company" }));
    const dept = (tpl[department] || []).map((t) => ({ ...t, source: department }));
    return company.concat(dept).sort((a, b) => a.dayOffset - b.dayOffset);
  }

  function makeTask(t, startDate) {
    return {
      id: newId("t"),
      key: t.key || null,
      source: t.source,
      title: t.title,
      desc: t.desc || "",
      // Optional wording for the new hire's own view of tasks other people do.
      hireTitle: t.hireTitle || null,
      hireDesc: t.hireDesc || null,
      owner: t.owner,
      dayOffset: t.dayOffset,
      dueDate: addDays(startDate, t.dayOffset),
      phase: phaseForOffset(t.dayOffset),
      // Scheduled meetings (orientation, 1:1s). For the new hire these are never "overdue".
      isEvent: !!t.isEvent,
      done: false,
      doneAt: null,
      doneBy: null,
    };
  }

  // createdOn (optional): when a plan is created late, tasks whose due date has already
  // passed become due that day instead of showing as overdue from the start.
  function buildPlan(department, startDate, skipKeys, createdOn, templates) {
    const skip = new Set(skipKeys || []);
    return templateTasksFor(department, templates)
      .filter((t) => !skip.has(t.key))
      .map((t) => {
        const task = makeTask(t, startDate);
        if (createdOn && task.dueDate < createdOn) task.dueDate = createdOn;
        return task;
      });
  }

  function sortTasks(tasks) {
    return tasks.slice().sort((a, b) => a.dayOffset - b.dayOffset || a.title.localeCompare(b.title));
  }

  // ---- Status ----
  function isOverdue(task, today) {
    return !task.done && task.dueDate < today;
  }

  // Status says whose action is needed (research round 2, D2):
  //   complete  every task done
  //   action    the manager owes something overdue (the only "red" state)
  //   behind    the hire's own tasks are overdue (meetings don't count). Gentle, even before Day 1.
  //   waiting   only IT/HR tasks are overdue
  //   upcoming  hasn't started yet, nothing owed
  //   ontrack   started, nothing overdue
  function hireStats(hire, today) {
    const tasks = hire.tasks;
    const done = tasks.filter((t) => t.done).length;
    const overdue = tasks.filter((t) => isOverdue(t, today));
    const total = tasks.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const dayN = diffDays(today, hire.startDate);
    const youOwe = overdue.filter((t) => t.owner === "manager").length;
    // Same set as the progress bar's gap: ownProgress(hire, today).toCatchUp === behind.
    const own = ownProgress(hire, today);
    const behind = own.toCatchUp;
    const waitingIt = overdue.filter((t) => t.owner === "it").length;
    const waitingHr = overdue.filter((t) => t.owner === "hr").length;
    let status;
    if (total > 0 && done === total) status = "complete";
    else if (youOwe) status = "action";
    else if (behind) status = "behind";
    else if (waitingIt || waitingHr) status = "waiting";
    else if (dayN < 0) status = "upcoming";
    else status = "ontrack";
    const byPhase = {};
    for (const p of OB.PHASES) {
      const pt = tasks.filter((t) => t.phase === p.id);
      byPhase[p.id] = { total: pt.length, done: pt.filter((t) => t.done).length };
    }
    return {
      total, done, pct, overdue, dayN, status, byPhase, phase: currentPhase(hire.startDate, today),
      youOwe, behind, waitingIt, waitingHr,
      waitingOn: { newhire: behind, manager: youOwe, it: waitingIt, hr: waitingHr },
      // Progress bar numbers (see ownProgress).
      own,
    };
  }

  // ONE definition for the progress bar AND the "N to catch up" chip (round 2, F11).
  // The bar counts only the new hire's own tasks, not meetings (meetings are ticked by whoever ran them):
  //   total         the hire's own tasks in the plan        -> bar scale, "N of M done" caption
  //   done          how many of those are done              -> caption
  //   expected      those whose date is before today        -> the tick, "where they'd be by today"
  //   doneExpected  how many of the expected ones are done  -> the blue fill
  //   toCatchUp     expected - doneExpected                 -> the gap between fill and tick = the chip's number
  function ownProgress(hire, today) {
    const own = hire.tasks.filter((t) => t.owner === "newhire" && !t.isEvent);
    const due = own.filter((t) => t.dueDate < today);
    const doneExpected = due.filter((t) => t.done).length;
    return { total: own.length, done: own.filter((t) => t.done).length, expected: due.length, doneExpected, toCatchUp: due.length - doneExpected };
  }

  // Manager to-dos on a rolling 7 days (today + the next 6). The single source of truth for the week strip,
  // the list under it, the digest ("N to-dos for you") and the page header (round 2, F1).
  // items: [{ t: task, ... }]. Anything past its date counts on today. Items after the 7 days go to `later`.
  function rollingWeek(items, today, days) {
    const n = days || 7;
    const dates = Array.from({ length: n }, (_, i) => addDays(today, i));
    const last = dates[n - 1];
    const dayOf = (it) => (it.t.dueDate < today ? today : it.t.dueDate);
    const inWindow = items.filter((it) => dayOf(it) <= last);
    return {
      days: dates.map((date) => ({ date, items: inWindow.filter((it) => dayOf(it) === date) })),
      items: inWindow,
      total: inWindow.length,
      later: items.filter((it) => dayOf(it) > last),
    };
  }

  const STATUS_LABEL = {
    action: "To-do for manager",
    behind: "Catching up",
    waiting: "With IT/HR",
    upcoming: "Not started yet",
    ontrack: "On track",
    complete: "Complete",
  };

  // Monday of the week that contains `day` (weeks run Mon–Sun).
  function weekStart(day) {
    const wd = (parseDate(day).getDay() + 6) % 7; // Mon = 0
    return addDays(day, -wd);
  }

  // "What should I focus on first?" Emily's ask.
  // Open tasks the new hire owns that are overdue or belong to the current (or earlier) phase,
  // soonest due first. If there are none, show the next few upcoming ones instead.
  function focusTasks(hire, today, limit) {
    const n = limit || 3;
    const cur = PHASE_ORDER[currentPhase(hire.startDate, today)];
    const mine = sortTasks(hire.tasks.filter((t) => t.owner === "newhire" && !t.done));
    const now = mine.filter((t) => PHASE_ORDER[t.phase] <= cur || t.dueDate <= addDays(today, 2));
    if (now.length) return { tasks: now.slice(0, n), more: now.length - Math.min(now.length, n), upcoming: false };
    return { tasks: mine.slice(0, n), more: 0, upcoming: true };
  }

  // Who can tick what. HR also covers IT tasks in this prototype.
  function canComplete(viewerRole, task) {
    if (viewerRole === "newhire") return task.owner === "newhire";
    if (viewerRole === "manager") return task.owner === "manager";
    if (viewerRole === "hr") return task.owner === "hr" || task.owner === "it";
    return false;
  }

  // ---- Validation ----
  const MAX_PAST_DAYS = 27; // a plan covers the first 4 weeks

  function validateHire(input, today, existing) {
    const errors = {};
    const warnings = [];
    const name = (input.name || "").trim();
    const title = (input.title || "").trim();
    if (!name) errors.name = "Enter the new hire's name.";
    else if (name.length > 80) errors.name = "Name must be 80 characters or fewer.";
    if (!title) errors.title = "Enter a job title.";
    else if (title.length > 80) errors.title = "Job title must be 80 characters or fewer.";
    if (!OB.DEPARTMENTS.includes(input.department)) errors.department = "Pick a department.";
    if (!input.managerId) errors.managerId = "Pick a manager.";
    if (!input.startDate) errors.startDate = "Pick a start date.";
    else if (!isValidISO(input.startDate)) errors.startDate = "That isn't a valid date.";
    else {
      const d = diffDays(input.startDate, today);
      if (d < -MAX_PAST_DAYS) errors.startDate = "This person started more than 4 weeks ago, so the onboarding plan would already be over.";
      else if (d > 365) errors.startDate = "Start date is more than a year away. Check the year.";
      else if (d < 0) warnings.push("Start date is in the past. Tasks that would already be due are moved to today.");
      else if (d < 10) warnings.push("Start date is soon. Tasks that would already be due are moved to today, so expect a busy few days.");
    }
    if (name && (existing || []).some((h) => h.name.trim().toLowerCase() === name.toLowerCase())) {
      warnings.push(`There is already a new hire called ${name}. Make sure this isn't a duplicate.`);
    }
    return { errors, warnings, ok: Object.keys(errors).length === 0 };
  }

  function validateCustomTask(input, hire) {
    const errors = {};
    const title = (input.title || "").trim();
    if (!title) errors.title = "Enter a task name.";
    else if (title.length > 120) errors.title = "Keep it under 120 characters.";
    if (!OB.OWNERS[input.owner]) errors.owner = "Pick who does this.";
    if (!input.dueDate || !isValidISO(input.dueDate)) errors.dueDate = "Pick a due date.";
    else {
      const off = diffDays(input.dueDate, hire.startDate);
      if (off > 27) errors.dueDate = "The plan covers the first 4 weeks. Pick a date within 4 weeks of the start date.";
      if (off < -30) errors.dueDate = "That's more than 30 days before the start date.";
    }
    return { errors, ok: Object.keys(errors).length === 0 };
  }

  function makeCustomTask(input, hire, addedBy) {
    const off = diffDays(input.dueDate, hire.startDate);
    return {
      ...makeTask(
        { key: null, source: "Added by manager", title: input.title.trim(), desc: (input.desc || "").trim(), owner: input.owner, dayOffset: off },
        hire.startDate
      ),
      custom: true,
      addedBy,
    };
  }


  // ---- Editable plan templates (HR only; edits apply to new plans only) ----
  // Saved state keeps a full copy of each template HR has changed: { Company: [...], Sales: [...] }.
  // Anything missing or malformed falls back to the defaults in OB.TEMPLATES.
  const TPL_MIN_OFFSET = -30;
  const TPL_MAX_OFFSET = 27;

  function cleanTemplateTask(t) {
    if (!t || typeof t !== "object" || typeof t.title !== "string" || !t.title.trim()) return null;
    if (!OB.OWNERS[t.owner] || !Number.isInteger(t.dayOffset)) return null;
    const out = { key: String(t.key || ""), title: t.title, owner: t.owner, dayOffset: t.dayOffset, desc: t.desc || "" };
    if (t.isEvent) out.isEvent = true;
    if (t.owner !== "newhire" && t.hireTitle) out.hireTitle = t.hireTitle;
    if (t.owner !== "newhire" && t.hireDesc) out.hireDesc = t.hireDesc;
    return out.key ? out : null;
  }

  // Defaults + HR's saved copies. Never mutates either input.
  function mergeTemplates(defaults, saved) {
    const out = {};
    const s = saved && typeof saved === "object" ? saved : {};
    for (const name of Object.keys(defaults)) {
      const own = Array.isArray(s[name]) ? s[name].map(cleanTemplateTask).filter(Boolean) : null;
      out[name] = (own || defaults[name]).map((t) => ({ ...t }));
    }
    return out;
  }

  // Does a saved template differ from its default? (Order doesn't matter.)
  function templateIsEdited(tasks, defaults) {
    const norm = (list) =>
      JSON.stringify(
        (list || [])
          .map((t) => cleanTemplateTask(t) || {})
          .map((t) => ({ k: t.key, t: t.title, d: t.desc || "", o: t.owner, n: t.dayOffset, e: !!t.isEvent, ht: t.hireTitle || "", hd: t.hireDesc || "" }))
          .sort((a, b) => String(a.k).localeCompare(String(b.k)))
      );
    return norm(tasks) !== norm(defaults);
  }

  // "5 days before start" <-> dayOffset -5; "Day 3 of the job" <-> dayOffset 2. NaN if not a whole number.
  function timingToOffset(n, mode) {
    const v = Number(n);
    if (String(n == null ? "" : n).trim() === "" || !Number.isInteger(v)) return NaN;
    return mode === "before" ? -v : v - 1;
  }
  function offsetToTiming(o) {
    return o < 0 ? { n: -o, mode: "before" } : { n: o + 1, mode: "day" };
  }
  function timingLabel(o) {
    return o < 0 ? `${-o} day${o === -1 ? "" : "s"} before start` : `Day ${o + 1}`;
  }

  // input: { title, desc, owner, dayOffset, isEvent, hireTitle, hireDesc }. siblings: the template's other tasks.
  function validateTemplateTask(input, siblings) {
    const errors = {};
    const warnings = [];
    const title = (input.title || "").trim();
    if (!title) errors.title = "Enter a task name.";
    else if (title.length > 120) errors.title = "Keep it to 120 characters or fewer.";
    if ((input.desc || "").trim().length > 240) errors.desc = "Keep the description to 240 characters or fewer.";
    if (!OB.OWNERS[input.owner]) errors.owner = "Pick who does this.";
    const o = input.dayOffset;
    // input.n / input.mode (optional) are the raw timing picker values. "Day 0 of the job" would otherwise
    // turn into "1 day before start" without a word, so it's an error (F9).
    const nRaw = input.n == null || String(input.n).trim() === "" ? null : Number(input.n);
    if (!Number.isInteger(o)) errors.dayOffset = "Enter a whole number of days.";
    else if (input.mode === "day" && nRaw !== null && nRaw < 1) errors.dayOffset = "Day 1 is the first day.";
    else if (input.mode === "before" && nRaw !== null && nRaw < 1) errors.dayOffset = "Pick 1 or more days before start.";
    else if (o < TPL_MIN_OFFSET) errors.dayOffset = "Pick up to 30 days before start.";
    else if (o > TPL_MAX_OFFSET) errors.dayOffset = "The plan covers the first 4 weeks. Pick Day 28 or earlier.";
    if (input.owner !== "newhire") {
      if ((input.hireTitle || "").trim().length > 120) errors.hireTitle = "Keep it to 120 characters or fewer.";
      if ((input.hireDesc || "").trim().length > 240) errors.hireDesc = "Keep it to 240 characters or fewer.";
    }
    if (title && (siblings || []).some((t) => t.title.trim().toLowerCase() === title.toLowerCase())) {
      warnings.push("This template already has a task with this name. You can still save it.");
    }
    return { errors, warnings, ok: Object.keys(errors).length === 0 };
  }

  // A clean template task from a validated form. Keeps the key when editing.
  function makeTemplateTask(input, key) {
    const t = { key, title: input.title.trim(), owner: input.owner, dayOffset: input.dayOffset, desc: (input.desc || "").trim() };
    if (input.isEvent) t.isEvent = true;
    if (input.owner !== "newhire") {
      if ((input.hireTitle || "").trim()) t.hireTitle = input.hireTitle.trim();
      if ((input.hireDesc || "").trim()) t.hireDesc = input.hireDesc.trim();
    }
    return t;
  }

  // A key no template uses yet (keys link plan tasks back to their template, e.g. for skip lists).
  function newTemplateKey(templates) {
    const used = new Set(Object.values(templates || {}).flat().map((t) => t.key));
    let k;
    do k = newId("u"); while (used.has(k));
    return k;
  }

  // Removing a template's last task: Company must keep one; a department may go empty after a confirm.
  function removeTaskRule(name, tasks) {
    if ((tasks || []).length > 1) return "ok";
    return name === "Company" ? "blocked" : "confirm";
  }

  // ---- New hire's calm view of time ----
  // "Due today" / "Due tomorrow" / "Due in 3 days" (up to 6), otherwise the date.
  function countdownLabel(dueDate, today) {
    const d = diffDays(dueDate, today);
    if (d === 0) return "Due today";
    if (d === 1) return "Due tomorrow";
    if (d > 1 && d <= 6) return `Due in ${d} days`;
    return `Due ${prettyDate(dueDate)}`;
  }

  // A meeting whose date has passed but nobody ticked it: ask "Did this happen?" instead of "overdue".
  function isEventPending(task, today) {
    return !!task.isEvent && !task.done && task.dueDate < today;
  }

  // The new hire's own late tasks (not counting past meetings).
  function ownLate(hire, today) {
    return sortTasks(hire.tasks.filter((t) => t.owner === "newhire" && isOverdue(t, today) && !t.isEvent));
  }

  // Progress in the current phase, counting only the new hire's own tasks.
  function myPhaseProgress(hire, today) {
    const phase = currentPhase(hire.startDate, today);
    const mine = hire.tasks.filter((t) => t.owner === "newhire" && t.phase === phase);
    const label = (OB.PHASES.find((p) => p.id === phase) || {}).label || phase;
    return { phase, label, total: mine.length, done: mine.filter((t) => t.done).length };
  }

  // Journey strip: 7 days before start, Week 1 (7 days), Weeks 2–4 (21 days).
  const JOURNEY = [
    { id: "before", from: -7, days: 7, short: "Before" },
    { id: "week1", from: 0, days: 7, short: "Week 1" },
    { id: "month1", from: 7, days: 21, short: "Weeks 2–4" },
  ];
  // One question: "where am I in my first weeks?" A grey track, a today marker, and phases that are finished
  // (their dates have passed, or all the hire's own tasks in them are done). No date-proportional fill (F2).
  // doneByPhase (optional): { before: true, ... } from ownPhasesDone().
  function journeyModel(startDate, today, doneByPhase) {
    const dayN = diffDays(today, startDate);
    const span = JOURNEY.reduce((n, s) => n + s.days, 0);
    const lo = JOURNEY[0].from;
    const clamp = (x) => Math.max(0, Math.min(1, x));
    const allDone = doneByPhase || {};
    // Mark the middle of today, so Day 1 sits inside Week 1 rather than on the boundary.
    const todayFrac = clamp((dayN - lo + 0.5) / span);
    const segments = JOURNEY.map((s) => {
      const from = (s.from - lo) / span;
      const width = s.days / span;
      const state = dayN >= s.from + s.days ? "past" : dayN >= s.from || s.id === "before" ? "current" : "future";
      const finished = state === "past" || !!allDone[s.id];
      const label = (OB.PHASES.find((p) => p.id === s.id) || {}).label || s.id;
      return { id: s.id, label, short: s.short, from, width, state, finished };
    });
    let pill;
    if (dayN < 0) pill = `Today · ${-dayN} day${dayN === -1 ? "" : "s"} to go`;
    else if (dayN === 0) pill = "Today · Day 1";
    else pill = `Day ${dayN + 1}`;
    return { dayN, todayFrac, segments, pill };
  }

  // Phases where the new hire has done every one of their own tasks (journey strip ✓).
  function ownPhasesDone(hire) {
    const out = {};
    for (const p of OB.PHASES) {
      const mine = hire.tasks.filter((t) => t.owner === "newhire" && t.phase === p.id);
      out[p.id] = mine.length > 0 && mine.every((t) => t.done);
    }
    return out;
  }

  // ---- Day 1 logistics + calendar file ----
  function day1For(department) {
    return { ...OB.DAY1, ...((OB.DAY1_BY_DEPT || {})[department] || {}) };
  }
  function fmtTime(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    const ap = h >= 12 ? "pm" : "am";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")}${ap}`;
  }

  // Minimal RFC 5545 calendar file for one event, in floating local time.
  // ev: { uid, date "YYYY-MM-DD", start "HH:MM", end "HH:MM", summary, location, description, stamp "YYYYMMDDTHHMMSSZ" }
  function buildIcs(ev) {
    const text = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
    const dt = (d, hm) => `${d.replace(/-/g, "")}T${hm.replace(":", "")}00`;
    // Fold lines longer than 75 characters (continuation lines start with a space).
    const fold = (line) => {
      const parts = [];
      while (line.length > 75) {
        parts.push(line.slice(0, 75));
        line = " " + line.slice(75);
      }
      parts.push(line);
      return parts.join("\r\n");
    };
    const stamp = ev.stamp || `${ev.date.replace(/-/g, "")}T000000Z`;
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MangoApps//Onboarding//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dt(ev.date, ev.start)}`,
      `DTEND:${dt(ev.date, ev.end || ev.start)}`,
      `SUMMARY:${text(ev.summary)}`,
      `LOCATION:${text(ev.location)}`,
      `DESCRIPTION:${text(ev.description)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    return lines.map(fold).join("\r\n") + "\r\n";
  }

  // ---- Quiet milestones (one-time) ----
  // Finishing all your own tasks in the current phase, or reaching Day 1 / Week 1 / Day 30.
  function milestoneFor(hire, today) {
    const dayN = diffDays(today, hire.startDate);
    const prog = myPhaseProgress(hire, today);
    const idx = OB.PHASES.findIndex((p) => p.id === prog.phase);
    const next = OB.PHASES[idx + 1];
    if (prog.total > 0 && prog.done === prog.total) {
      const weekday = parseDate(hire.startDate).toLocaleDateString(undefined, { weekday: "long" });
      const title =
        prog.phase === "before" ? `${prog.label}: done. See you ${dayN === -1 ? "tomorrow" : weekday}!` : `${prog.label}: done. Nice work!`;
      return { id: `phase-${prog.phase}`, title, next: next ? `Next up: ${next.label}. ${next.hint}.` : "That's everything you own in your plan." };
    }
    if (dayN >= 1 && dayN <= 3) return { id: "day1", title: "Day 1: done. You made it through your first day!", next: "This week: get settled, meet people, get access working." };
    if (dayN >= 7 && dayN <= 10) return { id: "week1", title: "Week 1: done. One week at MangoApps!", next: "Next up: Weeks 2–4. Start contributing and set goals." };
    if (dayN >= 29 && dayN <= 33) return { id: "day30", title: "Day 30: your first month is done.", next: "Thanks for working through the plan. Your manager will keep it going from here." };
    return null;
  }

  // ---- Reminder rules: at most one banner for the new hire ----
  // Priority: Day-1 logistics (3 days before → Day 1) > own overdue > due within 48h > milestone.
  // reminders: { hide: { key: "YYYY-MM-DD" (hidden while today < date) }, seen: { key: firstShownDate } }
  // Each banner has a per-kind key (snooze) and a content key (Got it), so new content can still show.
  function pickBanner(hire, today, reminders) {
    const r = reminders || {};
    const hide = r.hide || {};
    const seen = r.seen || {};
    const hidden = (k) => !!hide[k] && today < hide[k];
    const dayN = diffDays(today, hire.startDate);
    const cands = [];
    if (dayN >= -3 && dayN <= 0) cands.push({ kind: "day1", sig: hire.startDate, dayN });
    const late = ownLate(hire, today);
    if (late.length) cands.push({ kind: "overdue", sig: late.map((t) => t.id).join(","), tasks: late });
    const soon = sortTasks(
      hire.tasks.filter((t) => t.owner === "newhire" && !t.done && t.dueDate >= today && diffDays(t.dueDate, today) <= 1)
    );
    if (soon.length) cands.push({ kind: "due48", sig: soon.map((t) => t.id).join(","), tasks: soon });
    const m = milestoneFor(hire, today);
    if (m) {
      const k = `${hire.id}:milestone:${m.id}`;
      if (!seen[k] || seen[k] === today) cands.push({ kind: "milestone", sig: m.id, milestone: m });
    }
    for (const c of cands) {
      c.kindKey = `${hire.id}:${c.kind}`;
      c.key = `${hire.id}:${c.kind}:${c.sig}`;
      if (!hidden(c.kindKey) && !hidden(c.key)) return c;
    }
    return null;
  }

  Object.assign(OB, {
    parseDate, fmtISO, addDays, diffDays, isValidISO, prettyDate, todayISO,
    phaseForOffset, currentPhase, PHASE_ORDER,
    newId, templateTasksFor, buildPlan, sortTasks,
    isOverdue, hireStats, ownProgress, rollingWeek, STATUS_LABEL, weekStart, focusTasks, canComplete,
    validateHire, validateCustomTask, makeCustomTask,
    mergeTemplates, templateIsEdited, timingToOffset, offsetToTiming, timingLabel,
    validateTemplateTask, makeTemplateTask, newTemplateKey, removeTaskRule, TPL_MIN_OFFSET, TPL_MAX_OFFSET,
    countdownLabel, isEventPending, ownLate, myPhaseProgress, journeyModel, ownPhasesDone,
    day1For, fmtTime, buildIcs, milestoneFor, pickBanner,
  });
})();
