// Round 4, pass B: pure logic for the manager's Day-1 readiness, 1:1 notes, 30/60/90 goals, gentle nudges
// (demo notifications) and the URL-hash routes behind the clickable manager screens (U3).
// No DOM access (tested in tests.html). Loaded after newhire.js in index.html and tests.html.
//
// Shapes (saved in localStorage, filled for older saves by OB.migrateManagerHire / OB.migrateManagerState):
//   hire.oneOnOnes  [{ id, hireId, managerId, templateId, title, date "YYYY-MM-DD", time "HH:MM",
//                      points: [{ text, done }], notes, followUps: [{ id, text, taskId | null }], createdAt }]
//   hire.goals      [{ id, horizon: 30 | 60 | 90, title, desc, status: "todo" | "doing" | "done",
//                      note (the new hire's own progress note), suggestedId | null, createdAt, updatedAt }]
//   state.notify    { [managerId]: { channels: ["inapp"] | ["email", "slack", "teams" (any)], digestDay: "Mon".."Fri",
//                      digestTime: "HH:MM", dayBefore: bool, todoReminders: bool } }
//   state.outbox    [{ id, date, time, kind: "test-digest" | "test-nudge" | "reminder", channel, to, toRole,
//                      subject, body, fromId, hireId, taskId, label: "Demo — not actually sent", demo: true }]
window.OB = window.OB || {};

(function () {
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const WD_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
  const first = (n) => String(n || "").split(" ")[0];
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  // Locale-independent dates, so messages and tests read the same everywhere: "Mon, Nov 9".
  function shortDay(iso) {
    const d = OB.parseDate(iso);
    return `${WD[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }
  const weekdayOf = (iso) => WD[OB.parseDate(iso).getDay()];
  const weekdayLongOf = (iso) => WD_LONG[OB.parseDate(iso).getDay()];
  // Saturday / Sunday move to the next Monday.
  function nextWeekday(iso) {
    const wd = OB.parseDate(iso).getDay();
    return wd === 6 ? OB.addDays(iso, 2) : wd === 0 ? OB.addDays(iso, 1) : iso;
  }

  // ---------- Seed (extra b): every seed hire starts on a weekday ----------
  // startWeek: a Monday, this many weeks from the Monday of today's week. Older seeds used startOffset (days).
  function seedStartDate(seed, today) {
    if (Number.isInteger(seed.startWeek)) return OB.addDays(OB.weekStart(today), 7 * seed.startWeek);
    return nextWeekday(OB.addDays(today, seed.startOffset || 0));
  }

  // "starts today" / "starts tomorrow" / "starts Mon" (within 6 days) / "starts Mon, Nov 16" / "started Mon, Oct 26".
  function startsWord(startDate, today) {
    const n = OB.diffDays(startDate, today);
    if (n < 0) return `started ${shortDay(startDate)}`;
    if (n === 0) return "starts today";
    if (n === 1) return "starts tomorrow";
    if (n <= 6) return `starts ${weekdayOf(startDate)}`;
    return `starts ${shortDay(startDate)}`;
  }

  // ---------- B1. Day-1 readiness ----------
  // Seven checks computed from the plan. owner: who has it ("it", "manager" = You, "newhire").
  // A check whose task isn't in this hire's plan is left out (so the count stays honest).
  const READINESS = [
    { id: "laptop", label: "Laptop shipped", owner: "it", taskKey: "c-laptop" },
    { id: "accounts", label: "Email and Slack accounts created", owner: "it", taskKey: "c-accounts" },
    { id: "tools", label: "Tool access set up", owner: "it", taskKey: "*-access" },
    { id: "buddy", label: "Buddy assigned", owner: "manager", taskKey: "c-buddy" },
    { id: "note", label: "Welcome note sent", owner: "manager", taskKey: "c-note" },
    { id: "oneonone", label: "First 1:1 booked", owner: "manager", taskKey: "c-1on1" },
    { id: "forms", label: "Forms submitted", owner: "newhire", taskKey: null },
  ];
  function readinessTask(hire, key) {
    const tasks = hire.tasks || [];
    if (key === "*-access") return tasks.find((t) => t.key && /-access$/.test(t.key) && t.key !== "c-access") || null;
    return key ? tasks.find((t) => t.key === key) || null : null;
  }
  // The planned first 1:1 (the "First 1:1 (Day 1)" template), or null.
  const firstOneOnOne = (hire) => (hire.oneOnOnes || []).find((n) => n.templateId === "first") || null;

  function readinessFor(hire, today) {
    const items = [];
    for (const def of READINESS) {
      const task = readinessTask(hire, def.taskKey);
      const base = { id: def.id, label: def.label, owner: def.owner, taskId: task ? task.id : null, taskTitle: task ? task.title : def.label, detail: "", noteId: null };
      if (def.id === "buddy") {
        const b = OB.buddyFor(hire);
        if (!task && !b) continue;
        items.push({ ...base, ready: !!b, detail: b ? b.name : "" });
      } else if (def.id === "oneonone") {
        const n = firstOneOnOne(hire);
        if (!task && !n) continue;
        items.push({ ...base, ready: !!n || !!(task && task.done), detail: n ? `${shortDay(n.date)} · ${OB.fmtTime(n.time)}` : "", noteId: n ? n.id : null });
      } else if (def.id === "forms") {
        const fs = OB.formsSummary(hire);
        if (!fs.total) continue;
        items.push({ ...base, ready: fs.allDone, detail: `${fs.done} of ${fs.total} forms` });
      } else {
        if (!task) continue;
        items.push({ ...base, ready: !!task.done });
      }
    }
    const ready = items.filter((x) => x.ready).length;
    const sw = startsWord(hire.startDate, today);
    return {
      hireId: hire.id, items, ready, total: items.length, allReady: ready === items.length,
      daysUntil: OB.diffDays(hire.startDate, today), startsWord: sw,
      headline: `${first(hire.name)}: ${ready} of ${items.length} ready · ${sw}`,
    };
  }
  // His hires starting within the next `days` days, including anyone whose Day 1 is today. Soonest first.
  function readinessHires(hires, managerId, today, days) {
    const n = days == null ? 14 : days;
    return (hires || [])
      .filter((h) => h.managerId === managerId && OB.diffDays(h.startDate, today) >= 0 && OB.diffDays(h.startDate, today) <= n)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
  // Choosing a buddy (extra a): sets buddyId and completes "Assign an onboarding buddy". Returns the member or null.
  function chooseBuddy(hire, memberId, today, byId) {
    const team = OB.teamFor(hire.department);
    const m = team && team.members.find((x) => x.id === memberId);
    if (!m) return null;
    hire.buddyId = m.id;
    const t = (hire.tasks || []).find((x) => x.key === "c-buddy");
    if (t && !t.done) Object.assign(t, { done: true, doneAt: today, doneBy: byId || hire.managerId || null });
    return m;
  }

  // ---------- B2. 1:1 notes ----------
  const oneOnOneTemplate = (id) => (OB.ONE_ON_ONE_TEMPLATES || []).find((t) => t.id === id) || null;
  // The template's suggested date (start + dayOffset, on a weekday), or the next weekday from today if that has passed.
  function suggestedOneOnOneDate(hire, templateId, today) {
    const tpl = oneOnOneTemplate(templateId);
    const d = nextWeekday(OB.addDays(hire.startDate, tpl ? tpl.dayOffset : 0));
    return d < today ? nextWeekday(today) : d;
  }
  function validateOneOnOne(input, hire) {
    const errors = {};
    if (!oneOnOneTemplate(input.templateId)) errors.templateId = "Pick an agenda template.";
    if (!input.date || !OB.isValidISO(input.date)) errors.date = "Pick a date.";
    else {
      const off = OB.diffDays(input.date, hire.startDate);
      if (off < -30) errors.date = "Pick a date no more than 30 days before the start date.";
      else if (off > 120) errors.date = "Pick a date within the first 4 months.";
    }
    if (!HHMM.test(input.time || "")) errors.time = "Pick a time.";
    return { errors, ok: Object.keys(errors).length === 0 };
  }
  function newOneOnOne(hire, input, managerId, today) {
    const tpl = oneOnOneTemplate(input.templateId);
    return {
      id: OB.newId("oo"), hireId: hire.id, managerId: managerId || hire.managerId, templateId: tpl.id, title: tpl.title,
      date: input.date, time: input.time, points: tpl.points.map((text) => ({ text, done: false })),
      notes: "", followUps: [], createdAt: today,
    };
  }
  // planned: today or later, soonest first. past: before today, latest first.
  function oneOnOnesFor(hire, today) {
    const all = (hire.oneOnOnes || []).slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return { all, planned: all.filter((n) => n.date >= today), past: all.filter((n) => n.date < today).reverse() };
  }
  function pointsCovered(note) {
    const pts = note.points || [];
    return { done: pts.filter((p) => p.done).length, total: pts.length };
  }
  function addFollowUp(note, text) {
    const v = String(text || "").trim();
    if (!v) return { ok: false, errors: { text: "Write the follow-up first." } };
    if (v.length > 160) return { ok: false, errors: { text: "Keep it to 160 characters or fewer." } };
    const fu = { id: OB.newId("fu"), text: v, taskId: null };
    note.followUps = note.followUps || [];
    note.followUps.push(fu);
    return { ok: true, errors: {}, followUp: fu };
  }
  // Default due date for a follow-up task: today, kept inside the plan window (start date to Day 28).
  function followUpDue(hire, today) {
    const lo = hire.startDate;
    const hi = OB.addDays(hire.startDate, 27);
    return today < lo ? lo : today > hi ? hi : today;
  }
  // Turns a follow-up into a task in the hire's plan (the same rules as "+ Add a task").
  // input: { owner, dueDate }. Returns { ok, errors, task }.
  function followUpToTask(hire, note, fuId, input, byId) {
    const fu = (note.followUps || []).find((f) => f.id === fuId);
    if (!fu) return { ok: false, errors: { text: "That follow-up isn't there any more." }, task: null };
    const existing = fu.taskId && (hire.tasks || []).find((t) => t.id === fu.taskId);
    if (existing) return { ok: true, errors: {}, task: existing };
    const data = { title: fu.text, owner: input.owner, dueDate: input.dueDate, desc: `Follow-up from the 1:1 on ${shortDay(note.date)}.` };
    const r = OB.validateCustomTask(data, hire);
    if (!r.ok) return { ok: false, errors: r.errors, task: null };
    const task = OB.makeCustomTask(data, hire, byId);
    task.source = "1:1 follow-up";
    task.fromOneOnOne = note.id;
    hire.tasks.push(task);
    fu.taskId = task.id;
    return { ok: true, errors: {}, task };
  }
  // A calendar event for OB.buildIcs (30 minutes).
  function oneOnOneEvent(note, hire, stamp) {
    return {
      uid: `${note.id}-${hire.id}@mangoapps.onboarding`, date: note.date, start: note.time, end: OB.addMinutes(note.time, 30),
      summary: `${note.title}: ${hire.name}`, location: "",
      description: `Talking points: ${(note.points || []).map((p) => p.text).join("; ")}.`, stamp,
    };
  }

  // ---------- B3. 30/60/90 goals ----------
  function suggestedGoals(department) {
    const s = OB.SUGGESTED_GOALS || {};
    return (s.Company || []).concat(s[department] || []);
  }
  // Suggestions not added yet, in horizon order.
  function suggestedGoalsFor(hire) {
    const used = new Set((hire.goals || []).map((g) => g.suggestedId).filter(Boolean));
    return suggestedGoals(hire.department).filter((g) => !used.has(g.id)).sort((a, b) => a.horizon - b.horizon);
  }
  function validateGoal(input) {
    const errors = {};
    const title = String(input.title || "").trim();
    if (!title) errors.title = "Write the goal.";
    else if (title.length > 120) errors.title = "Keep it to 120 characters or fewer.";
    if (String(input.desc || "").trim().length > 240) errors.desc = "Keep the description to 240 characters or fewer.";
    if (!OB.GOAL_HORIZONS.includes(Number(input.horizon))) errors.horizon = "Pick 30, 60 or 90 days.";
    return { errors, ok: Object.keys(errors).length === 0 };
  }
  function makeGoal(input, today, suggestedId) {
    return {
      id: OB.newId("g"), horizon: Number(input.horizon), title: String(input.title).trim(), desc: String(input.desc || "").trim(),
      status: "todo", note: "", suggestedId: suggestedId || null, createdAt: today, updatedAt: today,
    };
  }
  function addGoal(hire, input, today) {
    const r = validateGoal(input);
    if (!r.ok) return { ...r, goal: null };
    const g = makeGoal(input, today);
    hire.goals = hire.goals || [];
    hire.goals.push(g);
    return { ...r, goal: g };
  }
  // One click: adds a suggested goal (once).
  function addSuggestedGoal(hire, suggestedId, today) {
    const s = suggestedGoals(hire.department).find((g) => g.id === suggestedId);
    if (!s || (hire.goals || []).some((g) => g.suggestedId === suggestedId)) return null;
    const g = makeGoal(s, today, s.id);
    hire.goals = hire.goals || [];
    hire.goals.push(g);
    return g;
  }
  function setGoalStatus(hire, goalId, status, today) {
    const g = (hire.goals || []).find((x) => x.id === goalId);
    if (!g || !OB.GOAL_STATUS[status]) return null;
    g.status = status;
    g.updatedAt = today;
    return g;
  }
  // The new hire's own progress note (optional, up to 280 characters).
  function setGoalNote(hire, goalId, note, today) {
    const g = (hire.goals || []).find((x) => x.id === goalId);
    if (!g) return { ok: false, error: "That goal isn't there any more." };
    const v = String(note || "").trim();
    if (v.length > 280) return { ok: false, error: "Keep your note to 280 characters or fewer." };
    g.note = v;
    g.updatedAt = today;
    return { ok: true, goal: g };
  }
  // "30 days: 2 of 3 done" per horizon.
  function goalHorizons(hire) {
    return OB.GOAL_HORIZONS.map((h) => {
      const goals = (hire.goals || []).filter((g) => g.horizon === h);
      const done = goals.filter((g) => g.status === "done").length;
      return { horizon: h, goals, total: goals.length, done, line: goals.length ? `${h} days: ${done} of ${goals.length} done` : `${h} days: no goals yet` };
    });
  }
  // The one line for a hire card: the horizon they're in now (or the first with goals). "" with no goals.
  function goalsCardLine(hire, today) {
    const hs = goalHorizons(hire).filter((x) => x.total);
    if (!hs.length) return null;
    const dayN = OB.diffDays(today, hire.startDate);
    const want = dayN < 30 ? 30 : dayN < 60 ? 60 : 90;
    return hs.find((x) => x.horizon === want) || hs[0];
  }

  // ---------- B4. Gentle nudges (demo notifications) ----------
  const CHANNELS = () => Object.keys(OB.NOTIFY_CHANNELS || { inapp: 1, email: 1, slack: 1, teams: 1 });
  function defaultNotifyPrefs() {
    return { channels: ["email"], digestDay: "Mon", digestTime: "09:00", dayBefore: true, todoReminders: true };
  }
  // "In-app only" stands alone; any other channel replaces it; nothing ticked means in-app only.
  function cleanNotifyPrefs(p) {
    const d = defaultNotifyPrefs();
    const x = p && typeof p === "object" && !Array.isArray(p) ? p : {};
    let ch = Array.isArray(x.channels) ? CHANNELS().filter((c) => x.channels.includes(c)) : d.channels;
    if (ch.some((c) => c !== "inapp")) ch = ch.filter((c) => c !== "inapp");
    if (!ch.length) ch = ["inapp"];
    return {
      channels: ch,
      digestDay: (OB.NOTIFY_DAYS || []).includes(x.digestDay) ? x.digestDay : d.digestDay,
      digestTime: HHMM.test(x.digestTime || "") ? x.digestTime : d.digestTime,
      dayBefore: typeof x.dayBefore === "boolean" ? x.dayBefore : d.dayBefore,
      todoReminders: typeof x.todoReminders === "boolean" ? x.todoReminders : d.todoReminders,
    };
  }
  // Ticking or unticking one channel box. Returns new, clean prefs.
  function setChannel(prefs, channel, on) {
    const p = cleanNotifyPrefs(prefs);
    let ch;
    if (channel === "inapp") ch = on ? ["inapp"] : p.channels.filter((c) => c !== "inapp");
    else ch = on ? p.channels.filter((c) => c !== "inapp").concat(channel) : p.channels.filter((c) => c !== channel);
    return cleanNotifyPrefs({ ...p, channels: ch });
  }
  function notifyPrefsFor(state, managerId) {
    return cleanNotifyPrefs(((state && state.notify) || {})[managerId]);
  }
  // "Email and Slack" / "In-app only".
  function channelSummary(prefs) {
    const names = cleanNotifyPrefs(prefs).channels.map((c) => OB.NOTIFY_CHANNELS[c]);
    return names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }

  // When a to-do is due, in calm words: "today", "tomorrow", "by Fri, Nov 6", "open since Wed, Nov 4".
  function dueText(dueDate, today) {
    const n = OB.diffDays(dueDate, today);
    if (n < 0) return `open since ${shortDay(dueDate)}`;
    if (n === 0) return "today";
    if (n === 1) return "tomorrow";
    return `by ${shortDay(dueDate)}`;
  }
  // Words managers' messages never use (standing preference). Whole words only, any capitals.
  const BANNED_RE = /\b(owe|owes|owed|owing|behind|overdue|late|failed|fail|fails|missed|attention)\b/gi;
  function bannedWords(text) {
    return (String(text || "").match(BANNED_RE) || []).map((w) => w.toLowerCase());
  }

  // Weekly digest, built from real data. Each line says which hire (and task) it's about, so the in-app preview
  // can link to it (U3). Returns { subject, lines: [{ kind, text, hireId, taskId, show }], email: { subject, body }, chat, todoCount }.
  function buildDigest(manager, hires, today, prefs) {
    const p = cleanNotifyPrefs(prefs);
    const mine = (hires || []).filter((h) => h.managerId === manager.id).sort((a, b) => a.startDate.localeCompare(b.startDate));
    const lines = [];
    const todos = [];
    for (const h of mine) for (const t of h.tasks || []) if (t.owner === "manager" && !t.done) todos.push({ t, h });
    todos.sort((a, b) => a.t.dueDate.localeCompare(b.t.dueDate));
    const week = OB.rollingWeek(todos, today);
    if (p.todoReminders)
      for (const { t, h } of week.items) lines.push({ kind: "todo", text: `${t.title} for ${first(h.name)}, ${dueText(t.dueDate, today)}`, hireId: h.id, taskId: t.id, show: null });
    for (const h of mine) {
      const n = OB.diffDays(h.startDate, today);
      if (n >= 0 && n <= 6) {
        const r = readinessFor(h, today);
        const when = n === 0 ? "starts today" : n === 1 ? "starts tomorrow" : `starts ${weekdayLongOf(h.startDate)}`;
        lines.push({ kind: "start", text: `${first(h.name)} ${when} · ${r.ready} of ${r.total} ready for Day 1`, hireId: h.id, taskId: null, show: "readiness" });
      } else if (n < 0) {
        const own = OB.ownProgress(h, today);
        if (own.toCatchUp) lines.push({ kind: "catchup", text: `${first(h.name)} has ${own.toCatchUp} to catch up`, hireId: h.id, taskId: null, show: "catchup" });
      }
    }
    if (!lines.length) lines.push({ kind: "calm", text: "Nothing needs you this week. Enjoy the calm.", hireId: null, taskId: null, show: null });
    const todoCount = week.total;
    const people = `${mine.length} ${mine.length === 1 ? "person" : "people"} onboarding`;
    const subject = `Your onboarding week: ${p.todoReminders ? `${plural(todoCount, "to-do")} for you` : people}`;
    const bullets = lines.map((l) => `• ${l.text}`);
    const body = [`Hi ${first(manager.name)},`, "", "Here's your onboarding week at a glance:", "", ...bullets, "", "Open MangoApps Onboarding to see the details.", "", "MangoApps Onboarding"].join("\n");
    const chat = [`*Your onboarding week*`, ...bullets].join("\n");
    return { subject, lines, email: { subject, body }, chat, todoCount };
  }
  // Who the day-before nudge is about: whoever starts tomorrow, else the next person to start (for the preview).
  function nudgeHire(hires, managerId, today) {
    const up = readinessHires(hires, managerId, today, 365).filter((h) => OB.diffDays(h.startDate, today) >= 1);
    return up.find((h) => OB.diffDays(h.startDate, today) === 1) || up[0] || null;
  }
  function buildNudge(manager, hire, today) {
    const d = OB.day1For(hire.department, hire.workType);
    const r = readinessFor(hire, today);
    const name = first(hire.name);
    const n = OB.diffDays(hire.startDate, today);
    const when = n === 1 ? "tomorrow" : `on ${shortDay(hire.startDate)}`;
    const oo = r.items.find((x) => x.id === "oneonone");
    const lines = [
      { kind: "nudge", text: `Welcome ${name} at ${OB.fmtTime(d.time)} · ${d.isRemote ? `${d.place} (remote)` : d.place}`, hireId: hire.id, taskId: null, show: null },
      { kind: "nudge", text: `Introduce ${name} to the team`, hireId: hire.id, taskId: null, show: null },
      { kind: "nudge", text: oo && oo.ready ? `Your first 1:1 is booked: ${oo.detail}` : "Book your first 1:1", hireId: hire.id, taskId: null, show: "oneonone" },
      { kind: "nudge", text: `Day-1 readiness: ${r.ready} of ${r.total} ready`, hireId: hire.id, taskId: null, show: "readiness" },
    ];
    const subject = `${name} starts ${when}`;
    const bullets = lines.map((l, i) => `${i + 1}. ${l.text}`);
    const body = [`Hi ${first(manager.name)},`, "", `${name} starts ${when}. ${lines.length} things for Day 1:`, "", ...bullets, "", "MangoApps Onboarding"].join("\n");
    const chat = [`*${name} starts ${when}*`, ...bullets].join("\n");
    return { subject, lines, email: { subject, body }, chat };
  }

  // A polite, pre-filled reminder to whoever has a task (IT, HR or the new hire). Editable before saving.
  // item: { owner: "it" | "hr" | "newhire", label } (a readiness item, or a task: { owner, title }).
  function reminderDraft(hire, item, manager, today) {
    const owner = item.owner;
    const label = item.label || item.title || "";
    const mgr = first(manager && manager.name) || "Your manager";
    const hr = (OB.PEOPLE || []).find((p) => p.role === "hr");
    const to = owner === "newhire" ? hire.name : owner === "hr" ? (hr ? `${hr.name} (HR)` : "HR") : "IT help desk";
    const hi = owner === "newhire" ? first(hire.name) : owner === "hr" ? (hr ? first(hr.name) : "HR team") : "IT team";
    const sw = startsWord(hire.startDate, today);
    if (owner === "newhire") {
      return {
        to, toRole: owner,
        subject: `A friendly reminder: ${label}`,
        body: `Hi ${hi},\n\nJust a friendly reminder about “${label}”. Whenever you have a few minutes is fine, and let me know if anything is unclear.\n\nThanks,\n${mgr}`,
      };
    }
    return {
      to, toRole: owner,
      subject: `Quick check: ${label} for ${hire.name}`,
      body: `Hi ${hi},\n\nA quick check on “${label}” for ${hire.name}, who ${sw}. Could you let me know when it's done, or if you need anything from me?\n\nThanks,\n${mgr}`,
    };
  }
  function validateReminder(input) {
    const errors = {};
    if (!String(input.to || "").trim()) errors.to = "Say who it's for.";
    const s = String(input.subject || "").trim();
    if (!s) errors.subject = "Add a subject.";
    else if (s.length > 140) errors.subject = "Keep the subject to 140 characters or fewer.";
    const b = String(input.body || "").trim();
    if (!b) errors.body = "Write a short message.";
    else if (b.length > 1200) errors.body = "Keep the message to 1,200 characters or fewer.";
    if (!CHANNELS().includes(input.channel)) errors.channel = "Pick how to send it.";
    return { errors, ok: Object.keys(errors).length === 0 };
  }
  const DEMO_LABEL = "Demo — not actually sent";
  // date: the demo date; time: "HH:MM" (wall clock). Nothing is sent: entries only live in state.outbox.
  function makeOutboxEntry(input, date, time) {
    return {
      id: OB.newId("ob"), date, time: HHMM.test(time || "") ? time : "09:00", kind: input.kind || "reminder",
      channel: CHANNELS().includes(input.channel) ? input.channel : "inapp", to: String(input.to || "").trim(), toRole: input.toRole || null,
      subject: String(input.subject || "").trim(), body: String(input.body || "").trim(),
      fromId: input.fromId || null, hireId: input.hireId || null, taskId: input.taskId || null,
      label: DEMO_LABEL, demo: true,
    };
  }
  // Newest first; keeps the last 40.
  function addToOutbox(state, entry) {
    state.outbox = [entry].concat(Array.isArray(state.outbox) ? state.outbox : []).slice(0, 40);
    return state.outbox;
  }
  // "Send test": one entry per chosen channel, for the digest or the day-before nudge.
  function testEntries(prefs, msg, kind, manager, date, time) {
    return cleanNotifyPrefs(prefs).channels.map((ch) =>
      makeOutboxEntry({ kind, channel: ch, to: ch === "inapp" ? `${manager.name} (in-app)` : manager.name, toRole: "manager", subject: msg.subject, body: ch === "email" ? msg.email.body : msg.chat, fromId: manager.id }, date, time)
    );
  }

  // ---------- U3. Routes in the URL hash (manager) ----------
  // #/team[?day=YYYY-MM-DD] · #/hire/<id>[?show=catchup|foryou|waiting][&task=<taskId>] · #/readiness
  // #/1on1s[/<hireId>[/<noteId>]] · #/goals[/<hireId>] · #/nudges
  const SHOWS = ["catchup", "foryou", "waiting"];
  function parseRoute(hash) {
    let raw = String(hash || "").replace(/^#/, "").replace(/^\//, "");
    try {
      raw = decodeURI(raw);
    } catch (e) {
      return { tab: "team" };
    }
    const [path, qs] = raw.split("?");
    const segs = path.split("/").filter(Boolean);
    const q = {};
    for (const part of (qs || "").split("&")) {
      const [k, v] = part.split("=");
      if (k) q[k] = v == null ? "" : v;
    }
    const id = (s) => (s && ID_RE.test(s) ? s : null);
    switch (segs[0]) {
      case "hire": {
        const hireId = id(segs[1]);
        if (!hireId) return { tab: "team" };
        const r = { tab: "team", hireId };
        if (SHOWS.includes(q.show)) r.show = q.show;
        if (id(q.task)) r.task = q.task;
        return r;
      }
      case "readiness":
        return { tab: "readiness" };
      case "1on1s": {
        const r = { tab: "oneonones" };
        if (id(segs[1])) r.hireId = segs[1];
        if (r.hireId && id(segs[2])) r.noteId = segs[2];
        return r;
      }
      case "goals":
        return id(segs[1]) ? { tab: "goals", hireId: segs[1] } : { tab: "goals" };
      case "nudges":
        return { tab: "notifications" };
      default: {
        const r = { tab: "team" };
        if (q.day && OB.isValidISO(q.day)) r.day = q.day;
        return r;
      }
    }
  }
  function buildRoute(r) {
    const x = r || {};
    if (x.tab === "team" && x.hireId) {
      const q = [x.show && SHOWS.includes(x.show) ? `show=${x.show}` : "", x.task ? `task=${x.task}` : ""].filter(Boolean).join("&");
      return `#/hire/${x.hireId}${q ? `?${q}` : ""}`;
    }
    if (x.tab === "readiness") return "#/readiness";
    if (x.tab === "oneonones") return `#/1on1s${x.hireId ? `/${x.hireId}${x.noteId ? `/${x.noteId}` : ""}` : ""}`;
    if (x.tab === "goals") return `#/goals${x.hireId ? `/${x.hireId}` : ""}`;
    if (x.tab === "notifications") return "#/nudges";
    return `#/team${x.day ? `?day=${x.day}` : ""}`;
  }
  // The tasks a drill-down shows. show: catchup (the new hire's own tasks expected by today, the "N to catch up"
  // chip), foryou (manager tasks past their date), waiting (IT/HR tasks past their date). task: one task.
  function filterTasks(hire, route, today) {
    const r = route || {};
    const tasks = hire.tasks || [];
    let out = [];
    if (r.task) out = tasks.filter((t) => t.id === r.task);
    else if (r.show === "catchup") out = tasks.filter((t) => t.owner === "newhire" && !t.isEvent && !t.done && t.dueDate < today);
    else if (r.show === "foryou") out = tasks.filter((t) => t.owner === "manager" && OB.isOverdue(t, today));
    else if (r.show === "waiting") out = tasks.filter((t) => (t.owner === "it" || t.owner === "hr") && OB.isOverdue(t, today));
    return OB.sortTasks(out);
  }
  // "3 to catch up" / "1 for you" / "2 with IT or HR" / "1 task".
  function showLabel(route, n) {
    const r = route || {};
    if (r.task) return "1 task";
    if (r.show === "catchup") return `${n} to catch up`;
    if (r.show === "foryou") return `${n} for you`;
    if (r.show === "waiting") return `${n} with IT or HR`;
    return "";
  }

  // ---------- Older saves and seed ----------
  function cleanNote(n, hire) {
    if (!n || typeof n !== "object" || typeof n.id !== "string" || !OB.isValidISO(n.date)) return null;
    const tpl = oneOnOneTemplate(n.templateId);
    return {
      id: n.id, hireId: hire.id, managerId: n.managerId || hire.managerId, templateId: tpl ? tpl.id : "first",
      title: typeof n.title === "string" && n.title ? n.title : tpl ? tpl.title : "1:1",
      date: n.date, time: HHMM.test(n.time || "") ? n.time : "14:00",
      points: (Array.isArray(n.points) ? n.points : []).filter((p) => p && typeof p.text === "string").map((p) => ({ text: p.text, done: !!p.done })),
      notes: typeof n.notes === "string" ? n.notes : "",
      followUps: (Array.isArray(n.followUps) ? n.followUps : []).filter((f) => f && typeof f.text === "string").map((f) => ({ id: f.id || OB.newId("fu"), text: f.text, taskId: f.taskId || null })),
      createdAt: n.createdAt || n.date,
    };
  }
  function cleanGoal(g) {
    if (!g || typeof g !== "object" || typeof g.id !== "string" || typeof g.title !== "string" || !g.title.trim()) return null;
    return {
      id: g.id, horizon: OB.GOAL_HORIZONS.includes(Number(g.horizon)) ? Number(g.horizon) : 30, title: g.title, desc: typeof g.desc === "string" ? g.desc : "",
      status: OB.GOAL_STATUS[g.status] ? g.status : "todo", note: typeof g.note === "string" ? g.note : "", suggestedId: g.suggestedId || null,
      createdAt: g.createdAt || null, updatedAt: g.updatedAt || null,
    };
  }
  // Hires saved before pass B get oneOnOnes [] and goals []; malformed entries are dropped or fixed.
  function migrateManagerHire(h) {
    if (!h || typeof h !== "object") return h;
    h.oneOnOnes = (Array.isArray(h.oneOnOnes) ? h.oneOnOnes : []).map((n) => cleanNote(n, h)).filter(Boolean);
    h.goals = (Array.isArray(h.goals) ? h.goals : []).map(cleanGoal).filter(Boolean);
    return h;
  }
  // State saved before pass B gets notify {} and outbox [].
  function migrateManagerState(s) {
    if (!s.notify || typeof s.notify !== "object" || Array.isArray(s.notify)) s.notify = {};
    for (const k of Object.keys(s.notify)) s.notify[k] = cleanNotifyPrefs(s.notify[k]);
    s.outbox = (Array.isArray(s.outbox) ? s.outbox : []).filter((e) => e && typeof e === "object" && typeof e.subject === "string").map((e) => ({ ...e, label: DEMO_LABEL, demo: true }));
    return s;
  }
  // Seeded 1:1 notes and goals (OB.SEED_HIRES[].oneOnOnes / .goals).
  function seedManagerExtras(hire, seed, today) {
    hire.oneOnOnes = (seed.oneOnOnes || []).map((o) => {
      const tpl = oneOnOneTemplate(o.templateId);
      const covered = new Set(o.covered || []);
      return {
        id: o.id, hireId: hire.id, managerId: hire.managerId, templateId: tpl.id, title: tpl.title,
        date: nextWeekday(OB.addDays(hire.startDate, o.dayOffset || 0)), time: o.time || "14:00",
        points: tpl.points.map((text, i) => ({ text, done: covered.has(i) })), notes: o.notes || "",
        followUps: (o.followUps || []).map((text, i) => ({ id: `${o.id}-fu${i + 1}`, text, taskId: null })), createdAt: hire.startDate,
      };
    });
    const sugg = suggestedGoals(hire.department);
    hire.goals = (seed.goals || [])
      .map((g, i) => {
        const s = sugg.find((x) => x.id === g.suggestedId);
        if (!s) return null;
        return { id: `g-${hire.id}-${i + 1}`, horizon: s.horizon, title: s.title, desc: s.desc, status: g.status || "todo", note: g.note || "", suggestedId: s.id, createdAt: hire.startDate, updatedAt: today };
      })
      .filter(Boolean);
    return hire;
  }

  Object.assign(OB, {
    shortDay, weekdayOf, weekdayLongOf, nextWeekday, seedStartDate, startsWord,
    READINESS, readinessFor, readinessHires, chooseBuddy, firstOneOnOne,
    oneOnOneTemplate, suggestedOneOnOneDate, validateOneOnOne, newOneOnOne, oneOnOnesFor, pointsCovered, addFollowUp, followUpDue, followUpToTask, oneOnOneEvent,
    suggestedGoals, suggestedGoalsFor, validateGoal, makeGoal, addGoal, addSuggestedGoal, setGoalStatus, setGoalNote, goalHorizons, goalsCardLine,
    defaultNotifyPrefs, cleanNotifyPrefs, setChannel, notifyPrefsFor, channelSummary, dueText, bannedWords,
    buildDigest, nudgeHire, buildNudge, reminderDraft, validateReminder, makeOutboxEntry, addToOutbox, testEntries, DEMO_LABEL,
    parseRoute, buildRoute, filterTasks, showLabel,
    migrateManagerHire, migrateManagerState, seedManagerExtras,
  });
})();
