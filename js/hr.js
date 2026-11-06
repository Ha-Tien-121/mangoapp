// Round 4, pass C1: pure logic for HR (Sarah): the "Where everyone is" pop-up details (U5),
// insights + pulse check-ins (C1a), role templates (C1b), bulk import with a small CSV parser (C1c), and
// edit / remove hire (U4). No DOM access (tested in tests.html). Loaded after manager.js.
//
// Shapes (saved in localStorage, filled for older saves by OB.migrateHrState / OB.migrateHrHire):
//   hire.role        role template id ("role-backend") or null
//   hire.pulses      { d7?: { answer: "great" | "okay" | "better", comment, at } | { dismissed: true, at },
//                      d30?: same }   (answers are only ever shown to HR in aggregate)
//   state.roles      [{ id, name, department, tasks: [template task, as in OB.TEMPLATES] }]
//   state.archive    [hire with archived: true, archivedAt]   finished hires from earlier months: feed Insights only,
//                    never the active lists, the manager's Team view or "Viewing as"
window.OB = window.OB || {};

(function () {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const md = (iso) => {
    const d = OB.parseDate(iso);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  };
  const first = (n) => String(n || "").split(" ")[0];
  const plural = (n, word, many) => `${n} ${n === 1 ? word : many || `${word}s`}`;
  const norm = (s) => String(s == null ? "" : s).trim().toLowerCase().replace(/[\s_]+/g, " ");
  const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

  // ---------- C1b. Role templates ----------
  function rolesOf(state) {
    return state && Array.isArray(state.roles) ? state.roles : OB.ROLE_TEMPLATES || [];
  }
  function rolesFor(department, roles) {
    return (roles || OB.ROLE_TEMPLATES || []).filter((r) => r.department === department);
  }
  function roleById(id, roles) {
    return (roles || OB.ROLE_TEMPLATES || []).find((r) => r.id === id) || null;
  }
  function cleanRole(r) {
    if (!r || typeof r !== "object" || typeof r.id !== "string" || typeof r.name !== "string" || !r.name.trim()) return null;
    if (!OB.DEPARTMENTS.includes(r.department)) return null;
    const tasks = (Array.isArray(r.tasks) ? r.tasks : []).map(OB.cleanTemplateTask).filter(Boolean);
    return { id: r.id, name: r.name.trim().slice(0, 60), department: r.department, tasks };
  }
  function validateRole(input, roles, selfId) {
    const errors = {};
    const name = (input.name || "").trim();
    if (!name) errors.name = "Enter a role name, like Backend Engineer.";
    else if (name.length > 60) errors.name = "Keep the role name to 60 characters or fewer.";
    if (!OB.DEPARTMENTS.includes(input.department)) errors.department = "Pick the department this role belongs to.";
    if (name && (roles || []).some((r) => r.id !== selfId && r.department === input.department && norm(r.name) === norm(name))) {
      errors.name = `${input.department} already has a role called ${name}.`;
    }
    return { errors, ok: Object.keys(errors).length === 0 };
  }
  function makeRole(input, roles) {
    const used = new Set((roles || []).map((r) => r.id));
    let id;
    do id = OB.newId("role"); while (used.has(id));
    return { id, name: input.name.trim(), department: input.department, tasks: [] };
  }

  // ---------- one hire, built the same way for single add and bulk import ----------
  function makeHire(input, today, templates, skipKeys) {
    const p = OB.hireProfile(input);
    const h = {
      id: OB.newId("h"),
      name: input.name.trim(),
      title: input.title.trim(),
      department: input.department,
      workType: p.workType,
      jobLevel: p.jobLevel,
      role: input.role || null,
      managerId: input.managerId,
      startDate: input.startDate,
    };
    h.tasks = OB.buildPlan(h, h.startDate, skipKeys || [], today, templates);
    Object.assign(h, { buddyId: null, learning: {}, forms: {}, oneOnOnes: [], goals: [], pulses: {} });
    return h;
  }

  // ---------- C1c. CSV ----------
  // RFC 4180-ish: quoted fields, commas and line breaks inside quotes, "" for a quote, CRLF / LF / CR line ends,
  // a leading byte-order mark. Returns [{ line, cells }] with the physical line each record starts on; blank
  // lines are skipped.
  function parseCsv(text) {
    const s = String(text || "").replace(/^﻿/, "");
    const out = [];
    let cells = [];
    let cell = "";
    let q = false;
    let line = 1;
    let start = 1;
    let touched = false; // the record has any content (so blank lines can be skipped)
    const endCell = () => {
      cells.push(cell);
      cell = "";
    };
    const endRecord = () => {
      endCell();
      if (touched || cells.some((c) => c.trim() !== "")) out.push({ line: start, cells });
      cells = [];
      touched = false;
    };
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === '"') {
          if (s[i + 1] === '"') {
            cell += '"';
            i++;
          } else q = false;
        } else {
          if (c === "\n" || (c === "\r" && s[i + 1] !== "\n")) line++;
          cell += c === "\r" && s[i + 1] === "\n" ? "" : c;
        }
        continue;
      }
      if (c === '"') {
        q = true;
        touched = true;
      } else if (c === ",") {
        endCell();
        touched = true;
      } else if (c === "\r" || c === "\n") {
        if (c === "\r" && s[i + 1] === "\n") i++;
        endRecord();
        line++;
        start = line;
      } else cell += c;
    }
    if (cell !== "" || cells.length || touched) endRecord();
    // A record of only commas (",,,") is blank too.
    return out.filter((r) => r.cells.some((c) => c.trim() !== ""));
  }

  const FIELDS = [
    ["name", "name", ["name", "full name", "fullname", "employee", "employee name"]],
    ["title", "title", ["title", "job title", "position"]],
    ["department", "department", ["department", "dept", "team"]],
    ["manager", "manager", ["manager", "manager name", "reports to"]],
    ["startDate", "start date", ["start date", "start", "startdate", "start date (yyyy-mm-dd)", "first day"]],
    ["workType", "work type", ["work type", "worktype", "work style"]],
    ["jobLevel", "job level", ["job level", "joblevel", "level"]],
    ["role", "role", ["role", "role template"]],
  ];
  const REQUIRED = ["name", "title", "department", "manager", "startDate"];
  // Header row -> { field: column index }. Column names are matched without caring about case, spaces or underscores.
  function mapHeader(cells) {
    const map = {};
    (cells || []).forEach((c, i) => {
      const n = norm(c);
      for (const [field, , aliases] of FIELDS) if (map[field] === undefined && aliases.includes(n)) map[field] = i;
    });
    const missing = REQUIRED.filter((f) => map[f] === undefined).map((f) => FIELDS.find((x) => x[0] === f)[1]);
    return { map, missing };
  }

  const SAMPLE_CSV =
    "name,title,department,manager,start date,work type,job level,role\r\n" +
    "Jordan Lee,Backend Engineer,Engineering,David Okafor,2026-11-23,Hybrid,Individual contributor,Backend Engineer\r\n" +
    '"Rivera, Sam",Account Executive,Sales,Priya Shah,2026-11-30,Onsite,Individual contributor,Account Executive\r\n' +
    "Mia Park,Support Specialist,Customer Support,Omar Haddad,2026-12-07,Remote,Individual contributor,\r\n";

  // "2026-11-23" or "11/23/2026" (US order) -> ISO. Anything else stays as typed (validateHire explains it).
  function parseStartDate(s) {
    const v = String(s || "").trim();
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
    if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
    return v;
  }
  function findManager(text) {
    const n = norm(text);
    if (!n) return null;
    const mgrs = OB.PEOPLE.filter((p) => p.role === "manager");
    return mgrs.find((p) => p.id === n || norm(p.name) === n) || mgrs.find((p) => norm(first(p.name)) === n) || null;
  }
  const pickFrom = (v, list) => list.find((x) => norm(x) === norm(v)) || null;

  // Every pasted row checked the same way as the single add form (validateHire), plus duplicate names (against
  // people already onboarding, and earlier rows in the same paste). Errors and warnings are plain sentences.
  // Returns { headerError, rows: [{ row, input, errors: [], warnings: [], duplicate, ok }] }.
  function bulkPreview(text, today, existing, roles) {
    const recs = parseCsv(text);
    if (!recs.length) return { headerError: "Paste some rows first, starting with a header row.", rows: [] };
    const { map, missing } = mapHeader(recs[0].cells);
    if (missing.length) {
      return { headerError: `The first row needs column names. Missing: ${missing.join(", ")}. Download the sample to see the layout.`, rows: [] };
    }
    const seen = new Map((existing || []).map((h) => [norm(h.name), "existing"]));
    const rows = recs.slice(1).map((r) => {
      const get = (f) => (map[f] === undefined ? "" : String(r.cells[map[f]] == null ? "" : r.cells[map[f]]).trim());
      const errors = [];
      const warnings = [];
      const dept = pickFrom(get("department"), OB.DEPARTMENTS);
      const mgr = findManager(get("manager"));
      const wtRaw = get("workType");
      const jlRaw = get("jobLevel");
      const roleRaw = get("role");
      const input = {
        name: get("name"),
        title: get("title"),
        department: dept || get("department"),
        managerId: mgr ? mgr.id : "",
        startDate: parseStartDate(get("startDate")),
        workType: wtRaw ? pickFrom(wtRaw, OB.WORK_TYPES) || wtRaw : OB.WORK_TYPES[0],
        jobLevel: jlRaw ? pickFrom(jlRaw, OB.JOB_LEVELS) || jlRaw : OB.JOB_LEVELS[0],
        role: "",
      };
      if (roleRaw && norm(roleRaw) !== "none") {
        const role = rolesFor(dept, roles).find((x) => norm(x.name) === norm(roleRaw));
        if (role) input.role = role.id;
        else {
          const names = rolesFor(dept, roles).map((x) => x.name);
          errors.push(`No “${roleRaw}” role${dept ? ` in ${dept}` : ""}. ${names.length ? `Use ${names.join(" or ")}, or leave it blank.` : "Leave it blank."}`);
        }
      }
      const v = OB.validateHire(input, today, [], roles);
      if (v.errors.department) errors.push(get("department") ? `“${get("department")}” isn't a department. Use ${OB.DEPARTMENTS.join(", ")}.` : v.errors.department);
      delete v.errors.department;
      if (v.errors.managerId) {
        errors.push(get("manager") ? `We couldn't find a manager called “${get("manager")}”.` : v.errors.managerId);
        delete v.errors.managerId;
      }
      if (v.errors.startDate && get("startDate") && !OB.isValidISO(input.startDate)) {
        errors.push(`“${get("startDate")}” isn't a date we can read. Use 2026-11-23.`);
        delete v.errors.startDate;
      }
      if (v.errors.workType) {
        errors.push(`Work type “${wtRaw}” isn't one of ${OB.WORK_TYPES.join(", ")}.`);
        delete v.errors.workType;
      }
      if (v.errors.jobLevel) {
        errors.push(`Job level “${jlRaw}” isn't one of ${OB.JOB_LEVELS.join(", ")}.`);
        delete v.errors.jobLevel;
      }
      for (const k of ["name", "title", "startDate", "role"]) if (v.errors[k]) errors.push(v.errors[k]);
      warnings.push(...v.warnings.filter((w) => !/^There is already/.test(w)));
      const key = norm(input.name);
      let duplicate = false;
      if (key && seen.has(key)) {
        duplicate = true;
        warnings.unshift(seen.get(key) === "existing" ? `${input.name} is already onboarding. Possible duplicate.` : `${input.name} is also in row ${seen.get(key)}. Possible duplicate.`);
      } else if (key) seen.set(key, r.line);
      // F4: a weekend start still imports; the check column shows it as a "Check" note with the suggested Monday.
      return { row: r.line, input, errors, warnings, duplicate, weekend: v.weekend || null, ok: errors.length === 0 };
    });
    return { headerError: null, rows };
  }
  // Which rows import: valid ones, minus possible duplicates unless HR ticked "Import anyway" for that row.
  function bulkCounts(rows, allowDup) {
    const allow = allowDup || new Set();
    const ready = rows.filter((r) => r.ok && (!r.duplicate || allow.has(r.row)));
    return {
      ready: ready.length,
      fix: rows.filter((r) => !r.ok).length,
      dupSkipped: rows.filter((r) => r.ok && r.duplicate && !allow.has(r.row)).length,
      rows: ready,
    };
  }
  function bulkImport(rows, allowDup, today, templates) {
    return bulkCounts(rows, allowDup).rows.map((r) => makeHire(r.input, today, templates));
  }

  // ---------- KPI numbers on the Hires page (plain numbers since pass C2: the filter bar was removed) ----------
  const KPI_TESTS = {
    owe: (s) => s.youOwe > 0,
    behind: (s) => s.behind > 0,
    soon: (s) => s.dayN < 0 && s.dayN >= -14,
  };
  const PHASE_WORDS = { before: "Before Day 1", week1: "Week 1", month1: "Weeks 2–4" };

  // ---------- HR routes in the URL hash (so Back works) ----------
  // #/hr/hires  ·  #/hr/add[/bulk]  ·  #/hr/templates  ·  #/hr/insights  ·  #/hr/more[/compliance|documents]
  // #/hr/hire/<id>[/edit]. A query string (the old filter bar) is ignored.
  const HR_PAGES = ["hires", "add", "templates", "insights", "more"];
  const MORE_SUBS = ["compliance", "documents", "bulk"];
  function parseHrRoute(hash) {
    const raw = String(hash || "").replace(/^#/, "").replace(/^\//, "");
    const path = raw.split("?")[0];
    const segs = path.split("/").filter(Boolean);
    if (segs[0] !== "hr") return null;
    if (segs[1] === "hire" && ID_RE.test(segs[2] || "")) return { page: "hire", hireId: segs[2], edit: segs[3] === "edit" };
    const page = HR_PAGES.includes(segs[1]) ? segs[1] : "hires";
    const r = { page };
    if (page === "add" && segs[2] === "bulk") r.sub = "bulk";
    if (page === "more" && MORE_SUBS.includes(segs[2]) && segs[2] !== "bulk") r.sub = segs[2];
    return r;
  }
  function buildHrRoute(r) {
    const x = r || {};
    if (x.page === "hire" && x.hireId) return `#/hr/hire/${x.hireId}${x.edit ? "/edit" : ""}`;
    const page = HR_PAGES.includes(x.page) ? x.page : "hires";
    let h = `#/hr/${page}`;
    if (page === "add" && x.sub === "bulk") h += "/bulk";
    if (page === "more" && x.sub && MORE_SUBS.includes(x.sub)) h += `/${x.sub}`;
    return h;
  }

  // ---------- U5. "Where everyone is" (round-2 timeline restored): pop-up details per person ----------
  // "Week 1 · Day 3" / "Before Day 1 · starts in 4 days" / "Weeks 2–4 · Day 11" / "Finished · Day 34".
  function phaseLine(startDate, today) {
    const n = OB.diffDays(today, startDate);
    if (n < 0) return `Before Day 1 · starts in ${plural(-n, "day")}`;
    if (n > 27) return `Onboarding period over · Day ${n + 1}`;
    return `${PHASE_WORDS[OB.phaseForOffset(n)]} · Day ${n + 1}`;
  }
  function nextOpenTask(hire) {
    return OB.sortTasks((hire.tasks || []).filter((t) => !t.done))[0] || null;
  }

  // ---------- C1a. Pulse check-ins ----------
  const PULSE_ANSWERS = [
    ["great", "Great"],
    ["okay", "Okay"],
    ["better", "Could be better"],
  ];
  // Day 7 (dayN 6) and Day 30 (dayN 29), each open for a week; shown once (answered or "Not now").
  const PULSES = {
    d7: { from: 6, to: 13, question: "How's your first week going?", label: "Day 7" },
    d30: { from: 29, to: 36, question: "How's your first month going?", label: "Day 30" },
  };
  function pulseDue(hire, today) {
    const n = OB.diffDays(today, hire.startDate);
    const done = hire.pulses && typeof hire.pulses === "object" ? hire.pulses : {};
    for (const [id, p] of Object.entries(PULSES)) if (n >= p.from && n <= p.to && !done[id]) return id;
    return null;
  }
  function answerPulse(hire, id, answer, comment, today) {
    if (!PULSES[id]) return { ok: false, error: "Unknown check-in." };
    if (!PULSE_ANSWERS.some(([k]) => k === answer)) return { ok: false, error: "Pick one of the three answers." };
    const c = String(comment || "").trim();
    if (c.length > 300) return { ok: false, error: "Keep the comment to 300 characters or fewer." };
    hire.pulses = hire.pulses && typeof hire.pulses === "object" ? hire.pulses : {};
    hire.pulses[id] = { answer, comment: c, at: today };
    return { ok: true };
  }
  function dismissPulse(hire, id, today) {
    if (!PULSES[id]) return false;
    hire.pulses = hire.pulses && typeof hire.pulses === "object" ? hire.pulses : {};
    hire.pulses[id] = { dismissed: true, at: today };
    return true;
  }

  // ---------- C1a. Insights ----------
  // Days from Day 1 to the last Week 1 task done ("Day N" it finished on). null until every Week 1 task is done.
  function week1Days(hire) {
    const w = (hire.tasks || []).filter((t) => t.phase === "week1");
    if (!w.length || !w.every((t) => t.done && t.doneAt)) return null;
    const last = w.map((t) => t.doneAt).sort().pop();
    return Math.max(1, OB.diffDays(last, hire.startDate) + 1);
  }
  const avg1 = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  // A task "went past its date" when it was done after its date, or is still open and its date has passed.
  const wentPast = (t, today) => (t.done ? !!t.doneAt && t.doneAt > t.dueDate : t.dueDate < today);
  // hires: active + archived.
  function insights(hires, today) {
    const shown = (hires || []).map((h) => ({ h, s: OB.hireStats(h, today) }));
    const list = shown.map((r) => r.h);
    // 1. Week 1
    const w1 = list.map((h) => ({ h, d: week1Days(h) })).filter((x) => x.d != null);
    const byDept = OB.DEPARTMENTS.map((dept) => {
      const xs = w1.filter((x) => x.h.department === dept).map((x) => x.d);
      return { dept, avg: avg1(xs), n: xs.length };
    }).filter((x) => x.n);
    // 2. Tasks that most often go past their date
    const tally = new Map();
    for (const h of list) {
      for (const t of h.tasks || []) {
        if (!wentPast(t, today)) continue;
        const k = t.key || `custom:${t.title.toLowerCase()}`;
        if (!tally.has(k)) tally.set(k, { key: k, title: t.title, hires: [] });
        const e = tally.get(k);
        if (!e.hires.some((x) => x.id === h.id)) e.hires.push({ id: h.id, name: h.name, archived: !!h.archived });
      }
    }
    const pastDate = [...tally.values()]
      .map((e) => ({ ...e, count: e.hires.length }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
      .slice(0, 5);
    // 3. Pulse check-ins (anonymous: counts and comments only, never who said what)
    const counts = { great: 0, okay: 0, better: 0 };
    const comments = { great: [], okay: [], better: [] };
    for (const h of list) {
      for (const id of Object.keys(PULSES)) {
        const p = (h.pulses || {})[id];
        if (!p || p.dismissed || !counts.hasOwnProperty(p.answer)) continue;
        counts[p.answer] += 1;
        if (p.comment) comments[p.answer].push(p.comment);
      }
    }
    for (const k of Object.keys(comments)) comments[k].sort((a, b) => a.localeCompare(b)); // no order that hints at who
    const answered = counts.great + counts.okay + counts.better;
    return {
      hires: list.length,
      finished: shown.filter((r) => r.s.status === "complete").length,
      week1: { avg: avg1(w1.map((x) => x.d)), n: w1.length, byDept },
      pastDate,
      pulse: { counts, comments, answered, showComments: answered >= 3 },
    };
  }

  // ---------- Seed: finished hires from earlier months (feed Insights only) ----------
  // weeksAgo: started on the Monday this many weeks before this week's Monday. slip: { taskKey: days done after its date }.
  function buildArchivedHire(seed, today, templates) {
    const startDate = OB.addDays(OB.weekStart(today), -7 * seed.weeksAgo);
    const p = OB.hireProfile(seed);
    const h = {
      id: seed.id, name: seed.name, title: seed.title, department: seed.department, workType: p.workType, jobLevel: p.jobLevel,
      role: seed.role || null, managerId: seed.managerId, startDate, archived: true,
    };
    h.tasks = OB.buildPlan(h, startDate, [], null, templates).map((t) => {
      const slip = (seed.slip || {})[t.key] || 0;
      const doneAt = OB.addDays(t.dueDate, slip);
      return { ...t, done: true, doneAt, doneBy: t.owner === "newhire" ? seed.id : t.owner === "manager" ? seed.managerId : "sarah" };
    });
    h.archivedAt = OB.addDays(startDate, 34);
    h.buddyId = OB.defaultBuddyId ? OB.defaultBuddyId(seed.department) : null;
    h.pulses = {};
    for (const [id, v] of Object.entries(seed.pulses || {})) {
      if (PULSES[id] && v) h.pulses[id] = { answer: v[0], comment: v[1] || "", at: OB.addDays(startDate, PULSES[id].from) };
    }
    Object.assign(h, { learning: {}, forms: {}, oneOnOnes: [], goals: [] });
    return h;
  }
  function seedArchive(today, templates) {
    return (OB.ARCHIVED_HIRES || []).map((s) => buildArchivedHire(s, today, templates));
  }

  // ---------- U4. Edit hire: manager reassignment, department / role / profile swap, start date shift ----------
  function validateHireEdit(input, hire, today, existing, roles) {
    const r = OB.validateHire(input, today, (existing || []).filter((h) => h.id !== hire.id), roles);
    if (input.startDate === hire.startDate) {
      delete r.errors.startDate;
      r.warnings = r.warnings.filter((w) => !/^Start date/.test(w));
    }
    // The manager must belong to the (new) department.
    r.warnings = r.warnings.filter((w) => !/manages /.test(w));
    const m = OB.PEOPLE.find((p) => p.id === input.managerId);
    if (m && OB.DEPARTMENTS.includes(input.department) && m.department !== input.department) {
      r.errors.managerId = `Pick a manager in ${input.department}. ${m.name} manages ${m.department}.`;
    }
    r.ok = Object.keys(r.errors).length === 0;
    return r;
  }
  // A manager for a department (the first one listed), for "the manager must belong to the new department".
  function managerFor(department) {
    const m = OB.PEOPLE.find((p) => p.role === "manager" && p.department === department);
    return m ? m.id : "";
  }
  // Works out the plan after an edit, without changing the hire. Rules:
  //  - done tasks and custom tasks are always kept
  //  - template tasks that aren't done and no longer apply (other department / role / work type / job level) go
  //  - template tasks the new profile gets that the plan doesn't have are added (ones HR left out when the plan was
  //    made stay out: they applied before too)
  //  - a new start date recomputes the due dates of tasks that aren't done (weekend rule; never before today)
  //  - a new manager takes over the manager tasks that aren't done (tasks follow hire.managerId)
  function planHireEdit(hire, input, today, templates) {
    const next = { ...hire, ...input, role: ("role" in input ? input.role : hire.role) || null };
    const nextProfile = OB.hireProfile(next);
    next.workType = nextProfile.workType;
    next.jobLevel = nextProfile.jobLevel;
    const tplFor = (h) => OB.templateTasksFor(h.department, templates, h.role).filter((t) => OB.taskApplies(t, h));
    const oldKeys = new Set(tplFor(hire).map((t) => t.key));
    const target = tplFor(next);
    const targetKeys = new Set(target.map((t) => t.key));
    const have = new Set(hire.tasks.map((t) => t.key).filter(Boolean));
    const removed = hire.tasks.filter((t) => !t.done && !t.custom && t.key && !targetKeys.has(t.key));
    const startChanged = next.startDate !== hire.startDate;
    let shifted = 0;
    const kept = hire.tasks
      .filter((t) => !removed.includes(t))
      .map((t) => {
        if (!startChanged || t.done) return { ...t };
        let due = t.custom ? OB.addDays(next.startDate, t.dayOffset) : OB.planDueDate(next.startDate, t.dayOffset);
        if (due < today) due = today;
        if (due !== t.dueDate) shifted += 1;
        return { ...t, dueDate: due };
      });
    const addedTpl = target.filter((t) => !have.has(t.key) && !oldKeys.has(t.key));
    const added = OB.buildPlan(next, next.startDate, [], today, templates).filter((t) => addedTpl.some((x) => x.key === t.key));
    const tasks = OB.sortTasks(kept.concat(added));
    const mgrChanged = next.managerId !== hire.managerId;
    const deptChanged = next.department !== hire.department;
    let buddyId = hire.buddyId || null;
    if (deptChanged && buddyId) {
      const team = OB.teamFor ? OB.teamFor(next.department) : null;
      if (!team || !team.members.some((m) => m.id === buddyId)) {
        const cb = tasks.find((t) => t.key === "c-buddy");
        buddyId = cb && cb.done && OB.defaultBuddyId ? OB.defaultBuddyId(next.department) : null;
      }
    }
    const pname = (id) => (OB.PEOPLE.find((p) => p.id === id) || {}).name || "the new manager";
    const summary = {
      managerChanged: mgrChanged,
      managerFrom: hire.managerId,
      managerTo: next.managerId,
      managerTasks: mgrChanged ? tasks.filter((t) => t.owner === "manager" && !t.done).length : 0,
      deptChanged,
      planChanged: removed.length > 0 || added.length > 0,
      removed: removed.map((t) => ({ title: t.title, source: t.source })),
      added: added.map((t) => ({ title: t.title, source: t.source })),
      keptDone: tasks.filter((t) => t.done).length,
      keptCustom: tasks.filter((t) => t.custom).length,
      startChanged,
      startFrom: hire.startDate,
      startTo: next.startDate,
      shifted,
      buddyFrom: hire.buddyId || null,
      buddyTo: buddyId,
    };
    // "David's 3 open tasks move to Priya."
    summary.managerLine = mgrChanged
      ? summary.managerTasks
        ? `${first(pname(hire.managerId))}'s ${plural(summary.managerTasks, "open task")} ${summary.managerTasks === 1 ? "moves" : "move"} to ${first(pname(next.managerId))}.`
        : `${first(pname(next.managerId))} becomes the manager. There are no open manager tasks to move.`
      : "";
    const fields = {
      name: next.name, title: next.title, department: next.department, managerId: next.managerId, startDate: next.startDate,
      workType: next.workType, jobLevel: next.jobLevel, role: next.role, buddyId,
    };
    return { tasks, fields, summary };
  }
  function applyHireEdit(hire, input, today, templates) {
    const p = planHireEdit(hire, input, today, templates);
    Object.assign(hire, p.fields);
    hire.name = hire.name.trim();
    hire.title = hire.title.trim();
    hire.tasks = p.tasks;
    return p.summary;
  }

  // ---------- U4. Remove a hire, with Undo ----------
  function removeHire(state, id) {
    const i = (state.hires || []).findIndex((h) => h.id === id);
    if (i < 0) return null;
    const [hire] = state.hires.splice(i, 1);
    const wasViewer = state.viewerId === id;
    if (wasViewer) state.viewerId = "sarah"; // "Viewing as" falls back to HR
    return { hire, index: i, wasViewer };
  }
  function restoreHire(state, removed) {
    if (!removed || !removed.hire || state.hires.some((h) => h.id === removed.hire.id)) return false;
    state.hires.splice(Math.min(removed.index, state.hires.length), 0, removed.hire);
    return true;
  }

  // ---------- Older saves ----------
  function migrateHrHire(h, roles) {
    if (!h || typeof h !== "object") return h;
    if (typeof h.role !== "string" || !roleById(h.role, roles)) h.role = null;
    if (!h.pulses || typeof h.pulses !== "object" || Array.isArray(h.pulses)) h.pulses = {};
    for (const k of Object.keys(h.pulses)) {
      const p = h.pulses[k];
      const okAnswer = p && typeof p === "object" && (p.dismissed || PULSE_ANSWERS.some(([a]) => a === p.answer));
      if (!PULSES[k] || !okAnswer) delete h.pulses[k];
      else if (!p.dismissed) p.comment = typeof p.comment === "string" ? p.comment.slice(0, 300) : "";
    }
    return h;
  }
  // State saved before pass C1: roles (the seed role templates), archive (seeded finished hires). The pass C1
  // filter bar was removed in pass C2, so an old saved hrFilter is dropped.
  function migrateHrState(s, today) {
    const roles = Array.isArray(s.roles) ? s.roles.map(cleanRole).filter(Boolean) : (OB.ROLE_TEMPLATES || []).map((r) => JSON.parse(JSON.stringify(r)));
    s.roles = roles;
    for (const h of s.hires || []) migrateHrHire(h, roles);
    if (!Array.isArray(s.archive)) s.archive = seedArchive(today || OB.todayISO());
    else s.archive = s.archive.filter((h) => h && typeof h === "object" && Array.isArray(h.tasks) && OB.isValidISO(h.startDate));
    for (const h of s.archive) {
      h.archived = true;
      migrateHrHire(h, roles);
    }
    delete s.hrFilter;
    return s;
  }

  Object.assign(OB, {
    rolesOf, rolesFor, roleById, cleanRole, validateRole, makeRole, makeHire,
    parseCsv, mapHeader, SAMPLE_CSV, parseStartDate, findManager, bulkPreview, bulkCounts, bulkImport,
    KPI_TESTS, PHASE_WORDS,
    parseHrRoute, buildHrRoute,
    phaseLine, nextOpenTask,
    PULSE_ANSWERS, PULSES, pulseDue, answerPulse, dismissPulse,
    week1Days, insights, buildArchivedHire, seedArchive,
    validateHireEdit, managerFor, planHireEdit, applyHireEdit, removeHire, restoreHire,
    migrateHrHire, migrateHrState,
  });
})();
