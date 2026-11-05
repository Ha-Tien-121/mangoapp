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
  function templateTasksFor(department) {
    const company = OB.TEMPLATES.Company.map((t) => ({ ...t, source: "Company" }));
    const dept = (OB.TEMPLATES[department] || []).map((t) => ({ ...t, source: department }));
    return company.concat(dept).sort((a, b) => a.dayOffset - b.dayOffset);
  }

  function makeTask(t, startDate) {
    return {
      id: newId("t"),
      key: t.key || null,
      source: t.source,
      title: t.title,
      desc: t.desc || "",
      owner: t.owner,
      dayOffset: t.dayOffset,
      dueDate: addDays(startDate, t.dayOffset),
      phase: phaseForOffset(t.dayOffset),
      done: false,
      doneAt: null,
      doneBy: null,
    };
  }

  // createdOn (optional): when a plan is created late, tasks whose due date has already
  // passed become due that day instead of showing as overdue from the start.
  function buildPlan(department, startDate, skipKeys, createdOn) {
    const skip = new Set(skipKeys || []);
    return templateTasksFor(department)
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

  function hireStats(hire, today) {
    const tasks = hire.tasks;
    const done = tasks.filter((t) => t.done).length;
    const overdue = tasks.filter((t) => isOverdue(t, today));
    const total = tasks.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const dayN = diffDays(today, hire.startDate);
    let status;
    if (total > 0 && done === total) status = "complete";
    else if (overdue.length) status = "attention";
    else if (dayN < 0) status = "prestart";
    else status = "ontrack";
    const byPhase = {};
    for (const p of OB.PHASES) {
      const pt = tasks.filter((t) => t.phase === p.id);
      byPhase[p.id] = { total: pt.length, done: pt.filter((t) => t.done).length };
    }
    return { total, done, pct, overdue, dayN, status, byPhase, phase: currentPhase(hire.startDate, today) };
  }

  const STATUS_LABEL = {
    complete: "Complete",
    attention: "Needs attention",
    prestart: "Not started yet",
    ontrack: "On track",
  };

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

  Object.assign(OB, {
    parseDate, fmtISO, addDays, diffDays, isValidISO, prettyDate, todayISO,
    phaseForOffset, currentPhase, PHASE_ORDER,
    newId, templateTasksFor, buildPlan, sortTasks,
    isOverdue, hireStats, STATUS_LABEL, focusTasks, canComplete,
    validateHire, validateCustomTask, makeCustomTask,
  });
})();
