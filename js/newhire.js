// Round 4, pass A: pure logic for the new hire's Team, Schedule, Learning and Forms.
// No DOM access (tested in tests.html). Loaded after plan.js in index.html and tests.html.
// Shapes saved on each hire (filled for older saves by OB.migrateHireExtras):
//   hire.buddyId   string | null                       a teammate id from OB.TEAMS[dept].members
//   hire.learning  { [itemId]: { status: "inprogress" | "done", at: "YYYY-MM-DD" } }
//   hire.forms     { [formId]: { status: "draft" | "submitted", data: {...}, savedAt, submittedAt } }
window.OB = window.OB || {};

(function () {
  // ---------- A1. Team and buddy ----------
  function teamFor(department) {
    return (OB.TEAMS || {})[department] || null;
  }
  // The teammate a manager's "Assign an onboarding buddy" picks (the team's default), or null.
  function defaultBuddyId(department) {
    const t = teamFor(department);
    return t && t.members.some((m) => m.id === t.defaultBuddyId) ? t.defaultBuddyId : null;
  }
  // The hire's buddy as a team member, or null while none is assigned (or the id isn't on their team).
  function buddyFor(hire) {
    const t = hire && teamFor(hire.department);
    if (!t || !hire.buddyId) return null;
    return t.members.find((m) => m.id === hire.buddyId) || null;
  }
  // Manager card, buddy (or null) and everyone else on the team (buddy left out, so nobody shows twice).
  function teamView(hire) {
    const t = teamFor(hire.department);
    const managerId = hire.managerId || (t && t.managerId);
    const manager = (OB.PEOPLE || []).find((p) => p.id === managerId) || null;
    const buddy = buddyFor(hire);
    const others = t ? t.members.filter((m) => !buddy || m.id !== buddy.id) : [];
    const hr = (OB.PEOPLE || []).find((p) => p.role === "hr") || null;
    return { manager, buddy, others, hr, size: (t ? t.members.length : 0) + (manager ? 1 : 0) };
  }
  // Ticking "Assign an onboarding buddy" sets the default buddy if there isn't one. Returns the buddy id.
  function assignBuddyOnTask(hire, task) {
    if (task && task.key === "c-buddy" && task.done && !buddyFor(hire)) hire.buddyId = defaultBuddyId(hire.department);
    return hire.buddyId || null;
  }

  // ---------- A2. First-week schedule ----------
  function isWeekend(iso) {
    const d = OB.parseDate(iso).getDay();
    return d === 0 || d === 6;
  }
  // The hire's first five working days: the start date, then the next four weekdays.
  function firstWeekDates(startDate) {
    const out = [startDate];
    let d = startDate;
    while (out.length < 5) {
      d = OB.addDays(d, 1);
      if (!isWeekend(d)) out.push(d);
    }
    return out;
  }
  function addMinutes(hhmm, m) {
    const [h, mm] = hhmm.split(":").map(Number);
    const t = Math.max(0, Math.min(23 * 60 + 59, h * 60 + mm + m));
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }
  const DEFAULT_MEETING = { start: "15:00", minutes: 30 };

  // Names for "with": manager, buddy, HR, team, IT; anything else is shown as written.
  function withText(w, hire) {
    if (!w) return "";
    if (w === "manager") {
      const m = (OB.PEOPLE || []).find((p) => p.id === hire.managerId);
      return m ? `${m.name} (your manager)` : "Your manager";
    }
    if (w === "buddy") {
      const b = buddyFor(hire);
      return b ? `${b.name} (your buddy)` : "Your buddy";
    }
    if (w === "hr") {
      const h = (OB.PEOPLE || []).find((p) => p.role === "hr");
      return h ? `${h.name} (HR)` : "HR";
    }
    if (w === "team") return "Your team";
    if (w === "it") return "IT help desk";
    return w;
  }

  // The week as days of items, sorted by time: the Company + department agenda, plus the plan's Week 1
  // meeting tasks on their due day (default 3:00pm, 30 min, stacked if several). An agenda item with a
  // taskKey IS that task (shows its done state), so it never appears twice.
  // Item: { id, day, date, start, end, title, where, with, kind, taskId, done, fromTask }
  function firstWeekAgenda(hire, agenda) {
    const src = agenda || OB.AGENDA || {};
    const dates = firstWeekDates(hire.startDate);
    const remote = OB.hireProfile(hire).workType === "Remote";
    const d1 = OB.day1For(hire.department, hire.workType);
    const tasks = hire.tasks || [];
    const byKey = {};
    for (const t of tasks) if (t.key) byKey[t.key] = t;
    const linked = new Set();
    const items = [];
    for (const a of (src.Company || []).concat(src[hire.department] || [])) {
      if (!(a.day >= 0 && a.day <= 4)) continue;
      let start = a.start;
      let end = a.end;
      // Day 1's welcome and lunch follow the Day-1 card's times (e.g. Support starts at 8:30).
      if (a.day1 === "start") (start = d1.time), (end = addMinutes(d1.time, a.minutes || 60));
      if (a.day1 === "end") (start = addMinutes(d1.end, -(a.minutes || 60))), (end = d1.end);
      const t = a.taskKey ? byKey[a.taskKey] : null;
      if (t) linked.add(t.id);
      // Remote hires join by video unless the item says otherwise; Day 1's welcome uses the Day-1 card's place.
      const where = remote ? a.whereRemote || "Video call" : a.day1 === "start" ? d1.place : a.where;
      items.push({
        id: a.id, day: a.day, date: dates[a.day], start, end: end || start,
        title: remote && a.titleRemote ? a.titleRemote : a.title,
        where, with: withText(a.with, hire), kind: OB.AGENDA_KINDS[a.kind] ? a.kind : "meeting",
        taskId: t ? t.id : null, done: t ? !!t.done : false, fromTask: false,
      });
    }
    // Week 1 meeting tasks not already on the agenda: placed on the first working day on or after the due date.
    const stack = {};
    const meetings = OB.sortTasks(tasks.filter((t) => t.isEvent && t.phase === "week1" && !linked.has(t.id)));
    for (const t of meetings) {
      const day = dates.findIndex((d) => d >= t.dueDate);
      if (day < 0) continue;
      const n = (stack[day] = (stack[day] || 0) + 1) - 1;
      const start = t.time || addMinutes(DEFAULT_MEETING.start, n * DEFAULT_MEETING.minutes);
      items.push({
        id: `task-${t.id}`, day, date: dates[day], start, end: t.endTime || addMinutes(start, DEFAULT_MEETING.minutes),
        title: t.owner !== "newhire" && t.hireTitle ? t.hireTitle : t.title,
        where: remote ? "Video call" : "", with: t.owner === "manager" ? withText("manager", hire) : t.owner === "hr" ? withText("hr", hire) : "",
        kind: "meeting", taskId: t.id, done: !!t.done, fromTask: true,
      });
    }
    const days = dates.map((date, i) => ({
      index: i, date,
      items: items.filter((x) => x.day === i).sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title)),
    }));
    return { dates, days, items: days.flatMap((d) => d.items) };
  }

  // "before" (not started), "during" (today is on or before the 5th working day), "after".
  // defaultDay: Day 1 before start; today (or the next working day) during; null after.
  function weekState(startDate, today) {
    const dates = firstWeekDates(startDate);
    if (today < dates[0]) return { phase: "before", defaultDay: 0, todayIndex: -1, dates };
    if (today > dates[4]) return { phase: "after", defaultDay: null, todayIndex: -1, dates };
    const i = dates.indexOf(today);
    return { phase: "during", defaultDay: i >= 0 ? i : dates.findIndex((d) => d > today), todayIndex: i, dates };
  }

  // The whole week as calendar events for OB.buildIcs (one VEVENT each).
  function agendaEvents(hire, agenda, stamp) {
    return agenda.items.map((x) => ({
      uid: `wk1-${hire.id}-${x.id}@mangoapps.onboarding`,
      date: x.date, start: x.start, end: x.end, summary: x.title,
      location: x.where || "",
      description: [x.with ? `With ${x.with}` : "", OB.AGENDA_KINDS[x.kind] || ""].filter(Boolean).join(". "),
      stamp,
    }));
  }

  // ---------- A3. Learning path ----------
  function learningItems(department, learning) {
    const src = learning || OB.LEARNING || {};
    return (src.Company || []).concat(src[department] || []);
  }
  // Items with a status (done if recorded or the linked task is done), counts, minutes left and "Up next"
  // (the first item not done, in the suggested order; an item in progress comes first).
  function learningModel(hire, learning) {
    const rec = hire.learning || {};
    const byKey = {};
    for (const t of hire.tasks || []) if (t.key) byKey[t.key] = t;
    const items = learningItems(hire.department, learning).map((it) => {
      const r = rec[it.id] || {};
      const task = it.taskKey ? byKey[it.taskKey] || null : null;
      const done = r.status === "done" || !!(task && task.done);
      const status = done ? "done" : r.status === "inprogress" ? "inprogress" : "todo";
      return { ...it, status, taskId: task ? task.id : null, doneAt: done ? r.at || (task && task.doneAt) || null : null };
    });
    const open = items.filter((x) => x.status !== "done");
    const upNext = open.find((x) => x.status === "inprogress") || open[0] || null;
    const minutesLeft = open.reduce((n, x) => n + (Number(x.minutes) || 0), 0);
    return { items, total: items.length, done: items.length - open.length, minutesLeft, upNext };
  }
  // "3 of 7 done · about 45 min left" / "All 7 done".
  function learningSummary(m) {
    if (!m.total) return "Nothing to learn here yet";
    if (m.done === m.total) return `All ${m.total} done`;
    return `${m.done} of ${m.total} done · about ${minutesLabel(m.minutesLeft)} left`;
  }
  function minutesLabel(n) {
    if (n < 60) return `${n} min`;
    const h = Math.floor(n / 60);
    const m = n % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  // status: "inprogress" | "done" | "todo". Keeps a linked plan task in step (done <-> done).
  function setLearningStatus(hire, itemId, status, today, byId) {
    const it = learningItems(hire.department).find((x) => x.id === itemId);
    if (!it) return null;
    hire.learning = hire.learning || {};
    if (status === "todo") delete hire.learning[itemId];
    else hire.learning[itemId] = { status, at: today };
    const task = it.taskKey ? (hire.tasks || []).find((t) => t.key === it.taskKey) : null;
    if (task && task.owner === "newhire") {
      if (status === "done" && !task.done) Object.assign(task, { done: true, doneAt: today, doneBy: byId || hire.id });
      if (status === "todo" && task.done) Object.assign(task, { done: false, doneAt: null, doneBy: null });
    }
    return task || null;
  }
  // When a linked plan task is unticked, its learning item goes back to "not done" too.
  function syncLearningFromTask(hire, task) {
    if (!task || !task.key || task.done) return;
    for (const it of learningItems(hire.department)) if (it.taskKey === task.key && hire.learning) delete hire.learning[it.id];
  }
  // Today view: the next learning item takes a focus slot only if fewer than 3 tasks are showing and it
  // isn't already one of them. Otherwise it's a small "Up next in Learning" line (or nothing when all done).
  function todayLearningSlot(focusTasks, upNext, limit) {
    if (!upNext) return null;
    const n = limit || 3;
    if (upNext.taskId && focusTasks.some((t) => t.id === upNext.taskId)) return null;
    return focusTasks.length > 0 && focusTasks.length < n ? "row" : "line";
  }

  // ---------- A4. Pre-boarding forms ----------
  const formDef = (id) => (OB.FORMS || []).find((f) => f.id === id) || null;
  const formForTask = (task) => (task && task.key ? (OB.FORMS || []).find((f) => f.taskKey === task.key) || null : null);
  const digits = (s) => String(s == null ? "" : s).replace(/\D/g, "");
  const normName = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

  // ••••6789 (always 4 dots, so the length isn't given away).
  function maskNumber(s) {
    const d = digits(s);
    return d.length > 4 ? `••••${d.slice(-4)}` : "••••";
  }

  // Friendly messages, keyed by field name. hire is needed for the e-signature name check.
  function validateForm(formId, data, hire) {
    const d = data || {};
    const v = (k) => String(d[k] == null ? "" : d[k]).trim();
    const errors = {};
    const phone = (k, who) => {
      if (!v(k)) errors[k] = `Enter ${who} phone number.`;
      else if (/[^\d\s()+.-]/.test(v(k))) errors[k] = "Use digits, spaces, dashes or brackets only.";
      else if (digits(v(k)).length < 10 || digits(v(k)).length > 15) errors[k] = "Enter a phone number with 10 to 15 digits.";
    };
    const text = (k, msg, max) => {
      if (!v(k)) errors[k] = msg;
      else if (v(k).length > (max || 80)) errors[k] = `Keep it to ${max || 80} characters or fewer.`;
    };
    const pick = (k, msg) => {
      const f = formDef(formId).fields.find((x) => x.name === k);
      if (!f.options.includes(v(k))) errors[k] = msg;
    };
    if (formId === "personal") {
      if (v("preferredName").length > 60) errors.preferredName = "Keep it to 60 characters or fewer.";
      if (v("pronouns") && !formDef("personal").fields[1].options.includes(v("pronouns"))) errors.pronouns = "Pick from the list, or leave it blank.";
      phone("phone", "your");
      text("street", "Enter your street address.", 120);
      text("city", "Enter your city.", 60);
      if (!v("zip")) errors.zip = "Enter your ZIP code.";
      else if (!/^\d{5}(-\d{4})?$/.test(v("zip"))) errors.zip = "ZIP codes are 5 digits, like 94107.";
    } else if (formId === "emergency") {
      text("name", "Enter your contact's name.", 80);
      pick("relationship", "Pick how you know them.");
      phone("phone", "their");
    } else if (formId === "w4") {
      pick("filingStatus", "Pick a filing status.");
      if (v("extra")) {
        const x = v("extra").replace(/^\$/, "");
        if (!/^\d+(\.\d{1,2})?$/.test(x)) errors.extra = "Enter an amount like 25 or 25.50, or leave it blank.";
        else if (Number(x) > 10000) errors.extra = "Enter an amount up to $10,000.";
      }
    } else if (formId === "deposit") {
      text("bank", "Enter your bank's name.", 80);
      const r = v("routing");
      if (!r) errors.routing = "Enter the routing number.";
      else if (/\D/.test(r)) errors.routing = "Use digits only, no spaces or dashes.";
      else if (r.length !== 9) errors.routing = `Routing numbers are 9 digits. This one has ${r.length}.`;
      const a = v("account");
      if (!a) errors.account = "Enter the account number.";
      else if (/\D/.test(a)) errors.account = "Use digits only, no spaces or dashes.";
      else if (a.length < 4 || a.length > 17) errors.account = "Account numbers are 4 to 17 digits.";
      if (!errors.account) {
        if (!v("accountConfirm")) errors.accountConfirm = "Enter the account number again.";
        else if (v("accountConfirm") !== a) errors.accountConfirm = "The two account numbers don't match. Check both.";
      }
    } else if (formId === "offer") {
      const full = (hire && hire.name) || "";
      if (!v("signature")) errors.signature = "Type your full name to sign.";
      else if (normName(v("signature")) !== normName(full)) errors.signature = `Type your name as it appears on the offer: ${full}.`;
      if (d.agree !== true && d.agree !== "true" && d.agree !== "on") errors.agree = "Tick the box to accept the offer.";
    } else errors._form = "Unknown form.";
    return { errors, ok: Object.keys(errors).length === 0 };
  }

  // What gets saved: trimmed values, digits only for numbers, no confirmation copy.
  function cleanFormData(formId, data) {
    const f = formDef(formId);
    const out = {};
    for (const fl of f ? f.fields : []) {
      if (fl.confirmOnly) continue;
      const raw = data ? data[fl.name] : undefined;
      if (fl.kind === "checkbox") out[fl.name] = raw === true || raw === "true" || raw === "on";
      else if (fl.kind === "secret") out[fl.name] = digits(raw);
      else if (fl.kind === "money") out[fl.name] = String(raw == null ? "" : raw).trim().replace(/^\$/, "");
      else out[fl.name] = String(raw == null ? "" : raw).trim();
    }
    return out;
  }

  // status: "submitted" | "draft" | "todo". A form whose linked task was done before forms were online
  // (older saves) counts as submitted, with no stored details (external: true).
  function formStatus(hire, formId) {
    const rec = (hire.forms || {})[formId];
    if (rec && rec.status === "submitted") return { status: "submitted", submittedAt: rec.submittedAt || null, data: rec.data || {}, external: false };
    const f = formDef(formId);
    const task = f && f.taskKey ? (hire.tasks || []).find((t) => t.key === f.taskKey) : null;
    if (task && task.done) return { status: "submitted", submittedAt: task.doneAt || null, data: null, external: true };
    if (rec && rec.status === "draft") return { status: "draft", savedAt: rec.savedAt || null, data: rec.data || {} };
    return { status: "todo" };
  }
  // "2 of 5 forms done" for the Forms card; items in OB.FORMS order. Readable by manager readiness and HR.
  function formsSummary(hire) {
    const items = (OB.FORMS || []).map((f) => ({ id: f.id, title: f.title, short: f.short, taskKey: f.taskKey, ...formStatus(hire, f.id) }));
    const done = items.filter((x) => x.status === "submitted").length;
    return { items, done, total: items.length, allDone: done === items.length };
  }
  function saveFormDraft(hire, formId, data, today) {
    hire.forms = hire.forms || {};
    const prev = hire.forms[formId];
    if (prev && prev.status === "submitted") return prev;
    hire.forms[formId] = { status: "draft", data: { ...(data || {}) }, savedAt: today, submittedAt: null };
    delete hire.forms[formId].data.accountConfirm;
    return hire.forms[formId];
  }
  // Validates, saves as submitted and completes the linked plan task (offer→c-offer, W-4→c-tax, deposit→c-deposit).
  function submitForm(hire, formId, data, today, byId) {
    const r = validateForm(formId, data, hire);
    if (!r.ok) return { ...r, task: null };
    hire.forms = hire.forms || {};
    hire.forms[formId] = { status: "submitted", data: cleanFormData(formId, data), savedAt: today, submittedAt: today };
    const f = formDef(formId);
    const task = f.taskKey ? (hire.tasks || []).find((t) => t.key === f.taskKey) : null;
    if (task && !task.done) Object.assign(task, { done: true, doneAt: today, doneBy: byId || hire.id });
    return { ...r, task };
  }
  // Read-only rows for a submitted form: [{ label, value }], sensitive numbers masked.
  function formViewRows(formId, data) {
    const f = formDef(formId);
    if (!f || !data) return [];
    return f.fields
      .filter((fl) => !fl.confirmOnly)
      .map((fl) => {
        const raw = data[fl.name];
        let value;
        if (fl.kind === "checkbox") value = raw ? "Yes" : "No";
        else if (fl.sensitive) value = raw ? maskNumber(raw) : "—";
        else if (fl.kind === "money") value = raw ? `$${raw}` : "None";
        else value = raw ? String(raw) : "—";
        return { label: fl.kind === "checkbox" ? "Accepted" : fl.label.replace(/ \(.*\)$/, ""), value, sensitive: !!fl.sensitive };
      });
  }

  // Mock submitted forms for seed hires whose linked tasks are already done (so "View" has something to show).
  function seedForms(hire) {
    const out = {};
    const done = new Set((hire.tasks || []).filter((t) => t.done).map((t) => t.key));
    const doneAt = (k) => ((hire.tasks || []).find((t) => t.key === k) || {}).doneAt || null;
    const mock = {
      offer: { signature: hire.name, agree: true },
      w4: { filingStatus: "Single or married filing separately", extra: "" },
      deposit: { bank: "Demo Credit Union", routing: "011000015", account: "000123456789" },
    };
    for (const f of OB.FORMS || []) {
      if (f.taskKey && done.has(f.taskKey) && mock[f.id]) out[f.id] = { status: "submitted", data: mock[f.id], savedAt: doneAt(f.taskKey), submittedAt: doneAt(f.taskKey) };
    }
    return out;
  }

  // ---------- Older saves ----------
  // Hires saved before round 4 get buddyId (the team default if "Assign an onboarding buddy" is done),
  // learning {} and forms {}. Malformed values are replaced. Mutates and returns the hire.
  function migrateHireExtras(h) {
    if (!h || typeof h !== "object") return h;
    if (h.buddyId === undefined || (h.buddyId !== null && typeof h.buddyId !== "string")) {
      const t = (h.tasks || []).find((x) => x.key === "c-buddy");
      h.buddyId = t && t.done ? defaultBuddyId(h.department) : null;
    }
    if (!h.learning || typeof h.learning !== "object" || Array.isArray(h.learning)) h.learning = {};
    if (!h.forms || typeof h.forms !== "object" || Array.isArray(h.forms)) h.forms = {};
    for (const k of Object.keys(h.forms)) {
      const r = h.forms[k];
      if (!r || typeof r !== "object" || (r.status !== "draft" && r.status !== "submitted")) delete h.forms[k];
      else if (!r.data || typeof r.data !== "object") r.data = {};
    }
    return h;
  }

  Object.assign(OB, {
    teamFor, defaultBuddyId, buddyFor, teamView, assignBuddyOnTask,
    firstWeekDates, firstWeekAgenda, weekState, agendaEvents, addMinutes,
    learningItems, learningModel, learningSummary, minutesLabel, setLearningStatus, syncLearningFromTask, todayLearningSlot,
    formDef, formForTask, maskNumber, validateForm, cleanFormData, formStatus, formsSummary, saveFormDraft, submitForm, formViewRows, seedForms,
    migrateHireExtras,
  });
})();
