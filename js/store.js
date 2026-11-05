// App state, saved in the browser's localStorage. No backend.
window.OB = window.OB || {};

(function () {
  const KEY = "brightpath-onboarding-v1";

  function seedState() {
    const today = OB.todayISO();
    const hires = OB.SEED_HIRES.map((s) => {
      const startDate = OB.addDays(today, s.startOffset);
      const tasks = OB.buildPlan(s.department, startDate, s.skip);
      const done = new Set(s.doneKeys);
      for (const t of tasks) {
        if (done.has(t.key)) {
          t.done = true;
          t.doneAt = t.dueDate < today ? t.dueDate : today;
          t.doneBy = t.owner === "newhire" ? s.id : t.owner === "manager" ? s.managerId : "sarah";
        }
      }
      return { id: s.id, name: s.name, title: s.title, department: s.department, managerId: s.managerId, startDate, tasks };
    });
    return { version: 1, viewerId: "emily", demoToday: null, hires };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.version === 1 && Array.isArray(s.hires)) return s;
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
