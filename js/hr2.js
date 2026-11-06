// Round 4, pass C2: pure logic for HR part 2: compliance tracking (C2b) and the document library (C2c).
// (Offboarding and moves, C2a, were dropped by the user.) No DOM access (tested in tests.html). Loaded after hr.js.
//
// Shapes (saved in localStorage, filled for older saves by OB.migrateC2State):
//   task.required    true: a compliance item (acknowledge tasks always are)
//   task.docId       a document in state.documents; the task's Open link uses the document's link
//   task.doneBy      who ticked it (a person id); older saves get the owner (see migrateDoneBy)
//   state.documents  [{ id, title, category, desc, link, audience: { kind: everyone | department | level, value }, updated }]
window.OB = window.OB || {};

(function () {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const md = (iso) => {
    const d = OB.parseDate(iso);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  };
  // "Fri, Nov 20" (fixed English, so tests don't depend on the browser's locale)
  const dayMd = (iso) => `${DAYS[OB.parseDate(iso).getDay()]}, ${md(iso)}`;
  const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

  // ---------- C2b. Compliance ----------
  const isComplianceTask = (t) => !!t && (OB.taskType(t) === "acknowledge" || t.required === true);
  // A name for any id that can tick a task: HR, managers, new hires, teammates. Unknown ids say "Unknown".
  function whoName(id, hires) {
    if (!id) return "Unknown";
    const p = (OB.PEOPLE || []).find((x) => x.id === id) || (hires || []).find((x) => x.id === id);
    if (p) return p.name;
    for (const t of Object.values(OB.TEAMS || {})) {
      const m = t.members.find((x) => x.id === id);
      if (m) return m.name;
    }
    return "Unknown";
  }
  // Rows = everyone with an onboarding plan (state.hires; finished hires in the archive aren't listed), columns =
  // every compliance item in their plans (by template key; custom tasks only when required). Cells:
  //   { state: "done", doneAt, doneBy, taskId } | { state: "open", dueDate, taskId } | { state: "na" }
  // signed: people whose items are all done. A person with no compliance items isn't a row.
  // today (optional): completion dates are capped at it (OB.shownDoneAt), so a demo date never shows a later date.
  function complianceMatrix(hires, today) {
    const list = (hires || []).filter((h) => h && !h.archived);
    const cols = new Map();
    for (const h of list) {
      for (const t of h.tasks || []) {
        if (!isComplianceTask(t)) continue;
        const key = t.key || `custom:${t.title.toLowerCase()}`;
        const c = cols.get(key);
        if (!c) cols.set(key, { key, title: t.title, type: OB.taskType(t), ack: OB.taskType(t) === "acknowledge", dayOffset: t.dayOffset });
        else c.dayOffset = Math.min(c.dayOffset, t.dayOffset);
      }
    }
    const columns = [...cols.values()].sort((a, b) => a.dayOffset - b.dayOffset || a.title.localeCompare(b.title));
    const rows = list
      .map((h) => {
        const cells = {};
        let open = 0;
        let applicable = 0;
        for (const c of columns) {
          const t = (h.tasks || []).find((x) => isComplianceTask(x) && (x.key || `custom:${x.title.toLowerCase()}`) === c.key);
          if (!t) cells[c.key] = { state: "na" };
          else {
            applicable += 1;
            if (t.done) cells[c.key] = { state: "done", doneAt: OB.shownDoneAt(t.doneAt, today) || null, doneBy: t.doneBy || null, taskId: t.id };
            else {
              open += 1;
              cells[c.key] = { state: "open", dueDate: t.dueDate, taskId: t.id };
            }
          }
        }
        return { hire: h, cells, open, applicable, allDone: applicable > 0 && open === 0 };
      })
      .filter((r) => r.applicable > 0)
      .sort((a, b) => a.hire.startDate.localeCompare(b.hire.startDate) || a.hire.name.localeCompare(b.hire.name));
    const signed = rows.filter((r) => r.allDone).length;
    const total = rows.length;
    const headline = total ? `${signed} of ${total} ${total === 1 ? "person has" : "people have"} everything signed` : "Nobody has an onboarding plan yet";
    return { columns, rows, signed, total, headline };
  }
  // Display text and the words for screen readers. The symbol is never the only cue.
  function cellText(cell) {
    if (cell.state === "done") return `✓ ${cell.doneAt ? md(cell.doneAt) : "Done"}`;
    if (cell.state === "open") return "○ Not yet";
    return "—";
  }
  function cellWords(cell, col, hire) {
    const who = `${hire.name}, ${col.title}`;
    if (cell.state === "done") return `${who}: ${col.ack ? "acknowledged" : "done"}${cell.doneAt ? ` ${dayMd(cell.doneAt)}` : ""}`;
    if (cell.state === "open") return `${who}: not yet, planned for ${dayMd(cell.dueDate)}`;
    return `${who}: not applicable`;
  }
  // Who completed an item and when: [{ hireId, hireName, byId, byName, at, verb, text }], newest first,
  // plus the people who haven't yet. Acknowledge tasks say "acknowledged".
  function auditTrail(matrix, key, hires) {
    const col = matrix.columns.find((c) => c.key === key);
    if (!col) return { column: null, entries: [], notYet: [] };
    const entries = [];
    const notYet = [];
    for (const r of matrix.rows) {
      const c = r.cells[key];
      if (c.state === "done") {
        const byName = whoName(c.doneBy, hires);
        const self = c.doneBy === r.hire.id;
        const verb = col.ack ? "acknowledged" : "completed";
        const text = self ? `${r.hire.name} ${verb} it` : `${byName} ${col.ack ? "recorded the acknowledgement" : "marked it done"} for ${r.hire.name}`;
        entries.push({ hireId: r.hire.id, hireName: r.hire.name, byId: c.doneBy || null, byName, at: c.doneAt || null, verb, text });
      } else if (c.state === "open") notYet.push({ hireId: r.hire.id, hireName: r.hire.name, dueDate: c.dueDate });
    }
    entries.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")) || a.hireName.localeCompare(b.hireName));
    return { column: col, entries, notYet };
  }
  // One CSV cell: quoted when it holds a comma, quote or line break; a leading = + - @ (a spreadsheet formula) gets a '.
  function csvCell(v) {
    let s = String(v == null ? "" : v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const csvLine = (cells) => cells.map(csvCell).join(",");
  // The matrix, a blank line, then the audit log of every item. CRLF line ends.
  function complianceCsv(matrix, hires) {
    const lines = [];
    lines.push(csvLine(["Compliance matrix"]));
    lines.push(csvLine(["Person", "Department", "Manager", ...matrix.columns.map((c) => c.title)]));
    for (const r of matrix.rows) {
      lines.push(
        csvLine([
          r.hire.name, r.hire.department, whoName(r.hire.managerId, hires),
          ...matrix.columns.map((c) => {
            const x = r.cells[c.key];
            if (x.state === "done") return `${c.ack ? "Acknowledged" : "Done"} ${x.doneAt || ""}`.trim();
            if (x.state === "open") return "Not yet";
            return "Not applicable";
          }),
        ])
      );
    }
    lines.push("");
    lines.push(csvLine(["Audit log"]));
    lines.push(csvLine(["Item", "Person", "What happened", "By", "Date"]));
    for (const c of matrix.columns) {
      for (const e of auditTrail(matrix, c.key, hires).entries) lines.push(csvLine([c.title, e.hireName, c.ack ? "Acknowledged" : "Done", e.byName, e.at || ""]));
    }
    return lines.join("\r\n") + "\r\n";
  }

  // Older saves: a done task without doneBy gets its owner (the same rule as the seed data): the new hire, the
  // manager who owns it, or HR (who also covers IT here). Tasks that aren't done have no doneBy.
  function migrateDoneBy(h) {
    for (const t of h.tasks || []) {
      if (!t.done) {
        if (t.doneBy === undefined) t.doneBy = null;
        continue;
      }
      if (typeof t.doneBy === "string" && t.doneBy) continue;
      t.doneBy = t.owner === "newhire" ? h.id : t.owner === "manager" ? h.managerId || null : "sarah";
    }
    return h;
  }

  // ---------- C2c. Documents ----------
  function cleanAudience(a) {
    const x = a && typeof a === "object" ? a : {};
    if (x.kind === "department" && OB.DEPARTMENTS.includes(x.value)) return { kind: "department", value: x.value };
    if (x.kind === "level" && OB.JOB_LEVELS.includes(x.value)) return { kind: "level", value: x.value };
    return { kind: "everyone" };
  }
  const LEVEL_PLURAL = { "Individual contributor": "Individual contributors", "People manager": "People managers", Intern: "Interns" };
  function audienceLabel(a) {
    const x = cleanAudience(a);
    if (x.kind === "department") return x.value;
    if (x.kind === "level") return LEVEL_PLURAL[x.value] || x.value;
    return "Everyone";
  }
  // "everyone" | "department:Engineering" | "level:Intern" (the audience <select> value) and back.
  const audienceValue = (a) => {
    const x = cleanAudience(a);
    return x.kind === "everyone" ? "everyone" : `${x.kind}:${x.value}`;
  };
  function parseAudience(v) {
    const s = String(v || "");
    const i = s.indexOf(":");
    if (i < 0) return { kind: s === "everyone" ? "everyone" : "" };
    return { kind: s.slice(0, i), value: s.slice(i + 1) };
  }
  function cleanDoc(d) {
    if (!d || typeof d !== "object" || !ID_RE.test(String(d.id || "")) || typeof d.title !== "string" || !d.title.trim()) return null;
    if (!(OB.DOC_CATEGORIES || []).includes(d.category) || !OB.isValidLink(d.link)) return null;
    return {
      id: d.id, title: d.title.trim().slice(0, 100), category: d.category, desc: typeof d.desc === "string" ? d.desc.slice(0, 240) : "",
      link: d.link.trim(), audience: cleanAudience(d.audience), updated: OB.isValidISO(d.updated) ? d.updated : "",
    };
  }
  const seedDocuments = () => (OB.DOCUMENTS || []).map((d) => JSON.parse(JSON.stringify(d)));
  // Does this document go to this person? Everyone, their department, or their job level.
  function docForHire(d, hire) {
    const a = cleanAudience(d.audience);
    if (a.kind === "department") return a.value === hire.department;
    if (a.kind === "level") return a.value === OB.hireProfile(hire).jobLevel;
    return true;
  }
  const catIndex = (c) => {
    const i = (OB.DOC_CATEGORIES || []).indexOf(c);
    return i < 0 ? 99 : i;
  };
  const sortDocs = (list) => list.slice().sort((a, b) => catIndex(a.category) - catIndex(b.category) || a.title.localeCompare(b.title));
  function docsFor(hire, docs) {
    return sortDocs((docs || []).filter((d) => docForHire(d, hire)));
  }
  // Search: every word must appear in the title, description, category or audience (any case). category: "all" or one.
  function searchDocs(docs, query, category) {
    const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
    return sortDocs(
      (docs || []).filter((d) => {
        if (category && category !== "all" && d.category !== category) return false;
        const hay = `${d.title} ${d.desc || ""} ${d.category} ${audienceLabel(d.audience)}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
    );
  }
  function validateDoc(input, docs, selfId) {
    const errors = {};
    const title = (input.title || "").trim();
    if (!title) errors.title = "Enter a title.";
    else if (title.length > 100) errors.title = "Keep the title to 100 characters or fewer.";
    else if ((docs || []).some((d) => d.id !== selfId && d.title.trim().toLowerCase() === title.toLowerCase())) errors.title = `There's already a document called ${title}.`;
    if (!(OB.DOC_CATEGORIES || []).includes(input.category)) errors.category = "Pick a category.";
    if ((input.desc || "").trim().length > 240) errors.desc = "Keep the description to 240 characters or fewer.";
    const link = (input.link || "").trim();
    if (!link) errors.link = "Enter the document's web address.";
    else if (!OB.isValidLink(link)) errors.link = "Enter a full web address that starts with https://";
    const a = typeof input.audience === "string" ? parseAudience(input.audience) : input.audience || {};
    const ok = a.kind === "everyone" || (a.kind === "department" && OB.DEPARTMENTS.includes(a.value)) || (a.kind === "level" && OB.JOB_LEVELS.includes(a.value));
    if (!ok) errors.audience = "Pick who should see it.";
    return { errors, ok: Object.keys(errors).length === 0 };
  }
  function makeDoc(input, today, docs, id) {
    const used = new Set((docs || []).map((d) => d.id));
    let newId = id;
    if (!newId) do newId = OB.newId("doc"); while (used.has(newId));
    const a = typeof input.audience === "string" ? parseAudience(input.audience) : input.audience;
    return { id: newId, title: input.title.trim(), category: input.category, desc: (input.desc || "").trim(), link: input.link.trim(), audience: cleanAudience(a), updated: today };
  }
  // A task's Open link: its library document's link when it has one (and the document still exists), else its own link.
  // Returns { href, doc } or null.
  function taskLinkFor(t, docs) {
    if (t && t.docId) {
      const d = (docs || []).find((x) => x.id === t.docId);
      if (d && OB.isValidLink(d.link)) return { href: d.link.trim(), doc: d };
    }
    if (t && OB.isValidLink(t.link)) return { href: t.link.trim(), doc: null };
    return null;
  }

  // ---------- Older saves ----------
  // required / docId on plan tasks (from the default templates by key), doneBy, and the document library.
  function migrateC2State(s) {
    const byKey = {};
    const add = (t) => {
      if (t && t.key) byKey[t.key] = t;
    };
    Object.values(OB.TEMPLATES || {}).flat().forEach(add);
    (OB.ROLE_TEMPLATES || []).forEach((r) => (r.tasks || []).forEach(add));
    (Array.isArray(s.roles) ? s.roles : []).forEach((r) => (r.tasks || []).forEach(add));
    s.hires = Array.isArray(s.hires) ? s.hires : [];
    for (const h of s.hires) {
      for (const t of h.tasks || []) {
        const d = t.key ? byKey[t.key] : null;
        if (t.required === undefined && d && d.required) t.required = true;
        if (t.docId === undefined && d && d.docId) t.docId = d.docId;
        if (t.docId !== undefined && !(typeof t.docId === "string" && ID_RE.test(t.docId))) delete t.docId;
      }
      migrateDoneBy(h);
    }
    for (const h of s.archive || []) migrateDoneBy(h);
    s.documents = Array.isArray(s.documents) ? s.documents.map(cleanDoc).filter(Boolean) : seedDocuments();
    return s;
  }

  Object.assign(OB, {
    isComplianceTask, whoName, complianceMatrix, cellText, cellWords, auditTrail, csvCell, complianceCsv, migrateDoneBy,
    cleanAudience, audienceLabel, audienceValue, parseAudience, cleanDoc, seedDocuments, docForHire, docsFor, searchDocs,
    validateDoc, makeDoc, taskLinkFor, migrateC2State, dayMd,
  });
})();
