// App state, saved in the browser's localStorage. No backend.
window.OB = window.OB || {};

(function () {
  const KEY = "mangoapps-onboarding-v1";

  function seedState() {
    const today = OB.todayISO();
    const hires = OB.SEED_HIRES.map((s) => {
      // Round 4: seed hires start on a Monday (startWeek), never on a weekend.
      const startDate = OB.seedStartDate(s, today);
      // The seed carries department, workType and jobLevel, so conditional template tasks match.
      const tasks = OB.buildPlan(s, startDate, s.skip);
      const done = new Set(s.doneKeys);
      for (const t of tasks) {
        if (done.has(t.key)) {
          t.done = true;
          t.doneAt = t.dueDate < today ? t.dueDate : today;
          t.doneBy = t.owner === "newhire" ? s.id : t.owner === "manager" ? s.managerId : "sarah";
        }
      }
      const p = OB.hireProfile(s);
      const hire = { id: s.id, name: s.name, title: s.title, department: s.department, workType: p.workType, jobLevel: p.jobLevel, role: s.role || null, managerId: s.managerId, startDate, tasks };
      // Round 4: buddy (seeded, or the team default once "Assign an onboarding buddy" is done), learning, forms.
      hire.buddyId = s.buddyId || (done.has("c-buddy") ? OB.defaultBuddyId(s.department) : null);
      hire.learning = {};
      for (const id of s.learningDone || []) hire.learning[id] = { status: "done", at: OB.addDays(today, -1) };
      hire.forms = OB.seedForms(hire);
      // Round 4, pass B: seeded 1:1 notes and 30/60/90 goals.
      OB.seedManagerExtras(hire, s, today);
      // Round 4, pass C1: pulse check-ins already answered (seed: [answer, comment]).
      hire.pulses = {};
      for (const [id, v] of Object.entries(s.pulses || {})) hire.pulses[id] = { answer: v[0], comment: v[1] || "", at: OB.addDays(startDate, OB.PULSES[id].from) };
      return hire;
    });
    // reminders: banner snooze / "Got it" / milestone-seen flags (cleared by Reset demo data).
    // templates: HR's edited copies of OB.TEMPLATES, by template name (empty = all defaults).
    // notify: each manager's notification preferences; outbox: the demo outbox (nothing is ever sent).
    // roles: role templates (C1b); archive: finished hires from earlier months, for Insights only (C1a).
    // Round 4, pass C2: documents: the document library.
    return {
      version: 1, viewerId: "emily", demoToday: null, hires, reminders: { hide: {}, seen: {} }, templates: {}, notify: {}, outbox: [],
      roles: OB.ROLE_TEMPLATES.map((r) => JSON.parse(JSON.stringify(r))), archive: OB.seedArchive(today),
      documents: OB.seedDocuments(),
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.version === 1 && Array.isArray(s.hires)) {
          // Older saves: tasks without isEvent/type/link, hires without workType/jobLevel get defaults.
          OB.migrateState(s);
          // Saved before templates were editable (or corrupt): use the defaults.
          if (!s.templates || typeof s.templates !== "object" || Array.isArray(s.templates)) s.templates = {};
          return s;
        }
      }
    } catch (e) {
      /* storage blocked or corrupt: fall back to seed data */
    }
    return seedState();
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* private mode etc. App still works for this session. */
    }
  }

  function reset() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
    return seedState();
  }

  // Keep two open tabs in sync (e.g. manager in one tab, new hire in another).
  function onExternalChange(cb) {
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) cb(load());
    });
  }

  OB.store = { load, save, reset, onExternalChange };
})();
