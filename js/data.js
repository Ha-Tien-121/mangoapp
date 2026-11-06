// Mock data for MangoApps (the scenario customer was BrightPath Technologies).
// Templates are layered: every hire gets the "Company" tasks, plus the tasks for their department.
// dayOffset is days relative to the start date (negative = before Day 1).
window.OB = window.OB || {};

OB.DEPARTMENTS = ["Engineering", "Sales", "Marketing", "Customer Support"];

// Who a template task applies to (fixed lists; see OB.taskApplies in plan.js).
// The first item in each list is the default for hires saved before these fields existed.
OB.WORK_TYPES = ["Onsite", "Hybrid", "Remote"];
OB.JOB_LEVELS = ["Individual contributor", "People manager", "Intern"];

// Task types. "task" is the default and has no icon. "meeting" replaces the older isEvent flag.
OB.TASK_TYPES = {
  task: "Task",
  read: "Read",
  watch: "Watch",
  acknowledge: "Acknowledge",
  meeting: "Meeting",
  form: "Form",
};

OB.OWNERS = {
  newhire: "You",
  manager: "Manager",
  it: "IT",
  hr: "HR",
};

OB.PHASES = [
  { id: "before", label: "Before Day 1", hint: "Paperwork and setup so Day 1 is smooth" },
  { id: "week1", label: "Week 1", hint: "Get settled, meet people, get access working" },
  { id: "month1", label: "Weeks 2–4", hint: "Start contributing and set goals" },
];

OB.TEMPLATES = {
  Company: [
    { key: "c-offer", type: "form", required: true, link: "https://hr.example.com/offer", title: "Sign offer letter and employment agreement", owner: "newhire", dayOffset: -10, desc: "Sign in the HR portal. Ask HR if anything in the agreement is unclear." },
    { key: "c-tax", type: "form", required: true, link: "https://hr.example.com/tax-forms", title: "Complete I-9 and W-4 tax forms", owner: "newhire", dayOffset: -5, desc: "Bring an ID document on Day 1 so HR can verify your I-9." },
    { key: "c-deposit", type: "form", title: "Set up direct deposit", owner: "newhire", dayOffset: -5, desc: "Needed for your first paycheck to arrive on time." },
    { key: "c-welcome", type: "read", link: "https://intranet.example.com/welcome", title: "Read the welcome guide and Day 1 logistics", owner: "newhire", dayOffset: -2, desc: "When to start, how to join, and who will meet you." },
    { key: "c-laptop", title: "Prepare and ship laptop", owner: "it", dayOffset: -3, desc: "Laptop arrives at the new hire's home address before Day 1.", hireTitle: "Your laptop is shipped to your home address", hireDesc: "It should arrive before Day 1. IT will let you know when it ships." },
    { key: "c-accounts", title: "Create email and Slack accounts", owner: "it", dayOffset: -2, desc: "Login details are sent to the new hire's personal email.", hireTitle: "Your email and Slack accounts are created", hireDesc: "Login details are sent to your personal email." },
    { key: "c-note", title: "Send welcome note and first-week schedule", owner: "manager", dayOffset: -3, desc: "A short personal note plus the Week 1 calendar.", hireTitle: "Your manager sends a welcome note and first-week schedule", hireDesc: "A short personal note plus your Week 1 calendar." },
    { key: "c-buddy", title: "Assign an onboarding buddy", owner: "manager", dayOffset: -1, desc: "Someone on the team the new hire can ask anything.", hireTitle: "You're assigned an onboarding buddy", hireDesc: "Someone on the team you can ask anything." },
    { key: "c-orient", type: "meeting", title: "Attend Day 1 orientation", owner: "newhire", dayOffset: 0, desc: "9:30am with HR. Covers tools and policies." },
    { key: "c-1on1", type: "meeting", title: "Hold first 1:1 with your new hire", owner: "manager", dayOffset: 0, desc: "Talk through the role, the team, and what the first month looks like.", hireTitle: "Your first 1:1 with your manager", hireDesc: "Talk through the role, the team, and what the first month looks like." },
    { key: "c-security", type: "watch", required: true, link: "https://learn.example.com/security-awareness", title: "Complete security awareness training", owner: "newhire", dayOffset: 3, desc: "About 30 minutes in the learning portal." },
    { key: "c-handbook", type: "acknowledge", docId: "doc-handbook", link: "https://intranet.example.com/handbook", title: "Read and acknowledge the employee handbook", owner: "newhire", dayOffset: 4, desc: "Covers time off, expenses and code of conduct." },
    { key: "c-benefits", type: "form", link: "https://benefits.example.com/enroll", title: "Enroll in health benefits", owner: "newhire", dayOffset: 14, desc: "You have 30 days from your start date. Enrolling early means coverage starts sooner." },
    { key: "c-goals", type: "meeting", title: "Set 30/60/90-day goals together", owner: "manager", dayOffset: 14, desc: "Agree on what success looks like for the first three months.", hireTitle: "Set your 30/60/90-day goals with your manager", hireDesc: "Agree on what success looks like for your first three months." },
    { key: "c-harass", type: "watch", required: true, link: "https://learn.example.com/harassment-prevention", title: "Complete harassment prevention training", owner: "newhire", dayOffset: 21, desc: "Required by state law within the first month." },
    { key: "c-checkin", type: "meeting", title: "30-day check-in", owner: "hr", dayOffset: 27, desc: "A short conversation about how onboarding went.", hireTitle: "Your 30-day check-in with HR", hireDesc: "A short conversation about how onboarding went." },
    // Only for some hires (appliesTo). A missing or empty list means everyone.
    { key: "c-ship-home", appliesTo: { workTypes: ["Remote"] }, title: "Ship monitor, keyboard and headset", owner: "it", dayOffset: -5, desc: "Monitor, keyboard and headset, sent to the new hire's home address.", hireTitle: "Your monitor, keyboard and headset are shipped to your home", hireDesc: "A monitor, keyboard and headset. IT will let you know when it ships." },
    { key: "c-home-desk", appliesTo: { workTypes: ["Remote"] }, type: "read", link: "https://intranet.example.com/remote/home-workspace", title: "Set up your home workspace", owner: "newhire", dayOffset: 1, desc: "A short guide to a comfortable desk, good light and a steady connection." },
    { key: "c-remote-meet", appliesTo: { workTypes: ["Remote"] }, type: "meeting", title: "Remote team meet-and-greet", owner: "newhire", dayOffset: 1, desc: "A relaxed video call to meet the other remote folks." },
    { key: "c-badge", appliesTo: { workTypes: ["Onsite", "Hybrid"] }, title: "Collect your building badge", owner: "newhire", dayOffset: 0, desc: "At the front desk after orientation. Bring your photo ID." },
    { key: "c-desk", appliesTo: { workTypes: ["Onsite", "Hybrid"] }, title: "Set up desk and parking", owner: "hr", dayOffset: -2, desc: "Assign a desk and, if needed, a parking spot.", hireTitle: "Your desk and parking are set up", hireDesc: "Facilities will show you where everything is on Day 1." },
    { key: "c-mgr-training", appliesTo: { jobLevels: ["People manager"] }, type: "watch", link: "https://learn.example.com/manager-essentials", title: "Manager essentials training", owner: "newhire", dayOffset: 9, desc: "About an hour: 1:1s, feedback and time-off approvals." },
    { key: "c-team-goals", appliesTo: { jobLevels: ["People manager"] }, title: "Review your team's open goals", owner: "newhire", dayOffset: 13, desc: "Read each person's current goals before your first round of 1:1s." },
    { key: "c-intern-mentor", appliesTo: { jobLevels: ["Intern"] }, type: "meeting", title: "Meet your intern mentor", owner: "newhire", dayOffset: 0, desc: "Your mentor helps you plan your internship project." },
  ],
  Engineering: [
    { key: "e-access", title: "Grant GitHub, Jira and AWS sandbox access", owner: "it", dayOffset: -2, desc: "Add to the engineering GitHub org and the team's Jira project.", hireTitle: "Your GitHub, Jira and AWS sandbox access is set up", hireDesc: "You're added to the engineering GitHub org and your team's Jira project." },
    { key: "e-devenv", title: "Set up your local dev environment", owner: "newhire", dayOffset: 2, desc: "Follow the setup guide in the eng-handbook repo. Ask your buddy if you get stuck." },
    { key: "e-arch", type: "read", link: "https://wiki.example.com/eng/architecture", title: "Read the architecture overview", owner: "newhire", dayOffset: 3, desc: "Start with the system diagram, then the service READMEs." },
    { key: "e-pr", title: "Ship your first small pull request", owner: "newhire", dayOffset: 10, desc: "Pick a ticket labelled good-first-issue." },
    { key: "e-oncall", title: "Shadow an on-call shift", owner: "newhire", dayOffset: 21, desc: "Watch how incidents are handled before joining the rotation." },
  ],
  Sales: [
    { key: "s-access", title: "Grant Salesforce and Gong access", owner: "it", dayOffset: -2, desc: "Sales Rep profile in Salesforce.", hireTitle: "Your Salesforce and Gong access is set up", hireDesc: "You get a Sales Rep profile in Salesforce." },
    { key: "s-demo", type: "form", title: "Pass the product demo certification", owner: "newhire", dayOffset: 5, desc: "Record a 15-minute demo and submit it in the learning portal." },
    { key: "s-territory", title: "Assign territory and account list", owner: "manager", dayOffset: 7, desc: "Hand over accounts and introduce the new hire to key contacts.", hireTitle: "You get your territory and account list", hireDesc: "Your manager hands over accounts and introduces you to key contacts." },
    { key: "s-shadow", title: "Shadow 5 customer calls", owner: "newhire", dayOffset: 10, desc: "Gong has recordings if live calls clash with training." },
  ],
  Marketing: [
    { key: "m-access", title: "Grant HubSpot, Figma and Canva access", owner: "it", dayOffset: -2, desc: "Editor seats on the marketing team workspace.", hireTitle: "Your HubSpot, Figma and Canva access is set up", hireDesc: "Editor seats on the marketing team workspace." },
    { key: "m-brand", type: "read", link: "https://brand.example.com/guidelines", title: "Review brand guidelines", owner: "newhire", dayOffset: 3, desc: "Logo use, tone of voice and templates." },
    { key: "m-meet", type: "meeting", title: "Meet the Sales and Product leads", owner: "newhire", dayOffset: 8, desc: "Your manager will book these intros." },
    { key: "m-campaign", title: "Own your first campaign task", owner: "newhire", dayOffset: 20, desc: "A small, well-defined piece of an active campaign." },
  ],
  "Customer Support": [
    { key: "cs-access", title: "Grant Zendesk access", owner: "it", dayOffset: -2, desc: "Agent seat, Tier 1 queue.", hireTitle: "Your Zendesk access is set up", hireDesc: "An agent seat on the Tier 1 queue." },
    { key: "cs-product", type: "watch", title: "Complete product training", owner: "newhire", dayOffset: 4, desc: "Self-paced course in the learning portal." },
    { key: "cs-shadow", title: "Shadow live support tickets", owner: "newhire", dayOffset: 6, desc: "Sit with a senior agent for a day." },
    { key: "cs-first", title: "Handle your first tickets (with review)", owner: "newhire", dayOffset: 12, desc: "A senior agent reviews your replies before they're sent." },
  ],
};

// Day 1 logistics for the new hire's countdown card and the "Add to calendar" (.ics) download.
// Times are local wall-clock "HH:MM". greeterId is someone in OB.PEOPLE; lunch is with the hire's manager.
OB.DAY1 = {
  time: "09:30",
  end: "13:30",
  place: "Front desk, 2nd floor",
  address: "500 Pine St",
  greeterId: "sarah",
  bring: "a photo ID for your I-9 check",
  // Remote hires join Day 1 on a video call instead (no address). LOCATION in the .ics is the link.
  remote: {
    place: "Video call",
    link: "https://meet.example.com/mangoapps-day1",
    note: "Camera on for the welcome session",
    // Read as "Keep <bring>." in the banner and the .ics description.
    bring: "a photo ID nearby for your I-9 check on camera",
  },
};
// Per-department overrides, merged over OB.DAY1.
OB.DAY1_BY_DEPT = {
  "Customer Support": { time: "08:30", end: "12:30" },
};

OB.PEOPLE = [
  { id: "sarah", name: "Sarah Kim", role: "hr", title: "HR Manager", department: "People", pronouns: "she/her", ask: "paperwork, benefits, time off and policies" },
  { id: "david", name: "David Okafor", role: "manager", title: "Engineering Manager", department: "Engineering", pronouns: "he/him", ask: "the roadmap, career growth and how the team works" },
  { id: "priya", name: "Priya Shah", role: "manager", title: "Sales Manager", department: "Sales", pronouns: "she/her", ask: "territories, quotas and our best customer stories" },
  { id: "lena", name: "Lena Novak", role: "manager", title: "Marketing Manager", department: "Marketing", ask: "campaign plans and how marketing works with sales" },
  { id: "omar", name: "Omar Haddad", role: "manager", title: "Support Manager", department: "Customer Support", pronouns: "he/him", ask: "support tiers, escalations and our tone of voice" },
];

// ---- Round 4, pass A: the new hire's team, first week, learning path and pre-boarding forms ----

// Meet your team (A1). One team per department: the manager (from OB.PEOPLE) plus 4 teammates.
// defaultBuddyId: the teammate who becomes the buddy when the manager ticks "Assign an onboarding buddy"
// (see OB.defaultBuddyId). A hire's buddy is saved on the hire as buddyId.
OB.TEAMS = {
  Engineering: {
    managerId: "david",
    defaultBuddyId: "nina",
    members: [
      { id: "nina", name: "Nina Alvarez", title: "Senior Software Engineer", pronouns: "she/her", ask: "code reviews, our dev setup and the best lunch spots" },
      { id: "raj", name: "Raj Mehta", title: "Staff Engineer", pronouns: "he/him", ask: "the architecture and why it looks the way it does" },
      { id: "kenji", name: "Kenji Watanabe", title: "Software Engineer", ask: "testing, CI and keyboard shortcuts" },
      { id: "maya", name: "Maya Brooks", title: "QA Engineer", pronouns: "they/them", ask: "how we test and ship releases" },
    ],
  },
  Sales: {
    managerId: "priya",
    defaultBuddyId: "carlos",
    members: [
      { id: "carlos", name: "Carlos Mendes", title: "Senior Account Executive", pronouns: "he/him", ask: "discovery calls and handling objections" },
      { id: "hannah", name: "Hannah Lee", title: "Sales Development Rep", pronouns: "she/her", ask: "outreach sequences and Salesforce tips" },
      { id: "ben", name: "Ben Okoro", title: "Sales Engineer", ask: "product demos and technical questions" },
      { id: "grace", name: "Grace Liu", title: "Sales Operations", ask: "Gong, dashboards and the deal desk" },
    ],
  },
  Marketing: {
    managerId: "lena",
    defaultBuddyId: "sofia",
    members: [
      { id: "sofia", name: "Sofia Rossi", title: "Content Lead", pronouns: "she/her", ask: "our voice, the blog and the editorial calendar" },
      { id: "daniel", name: "Daniel Park", title: "Brand Designer", pronouns: "he/him", ask: "Figma files, brand assets and templates" },
      { id: "amara", name: "Amara Nwosu", title: "Marketing Operations", ask: "HubSpot, lists and campaign reports" },
      { id: "jake", name: "Jake Turner", title: "Social Media Manager", ask: "social channels and community events" },
    ],
  },
  "Customer Support": {
    managerId: "omar",
    defaultBuddyId: "fatima",
    members: [
      { id: "fatima", name: "Fatima Ali", title: "Senior Support Specialist", pronouns: "she/her", ask: "tricky tickets and Zendesk macros" },
      { id: "luis", name: "Luis Romero", title: "Support Specialist", pronouns: "he/him", ask: "the product, end to end" },
      { id: "emma", name: "Emma Walsh", title: "Support Specialist", ask: "the help center and writing clear replies" },
      { id: "noah", name: "Noah Kim", title: "Support Team Lead", ask: "schedules, shifts and escalations" },
    ],
  },
};

// First-week schedule (A2). day: 0–4 = the hire's first five working days. Times are local "HH:MM".
// with: "manager" | "buddy" | "hr" | "team" | "it" (resolved to names) or plain text.
// where: shown to onsite/hybrid hires; remote hires see whereRemote (default "Video call").
// taskKey (optional): the plan task this item is, so the two never show twice.
// Day 1's orientation and lunch follow OB.DAY1 times (see OB.firstWeekAgenda), so they're marked day1: "start" / "end".
OB.AGENDA_KINDS = { meeting: "Meeting", focus: "Focus time", social: "Social", training: "Training" };
OB.AGENDA = {
  Company: [
    { id: "a-orient", day: 0, day1: "start", minutes: 120, title: "Welcome and orientation", with: "hr", where: "Front desk, 2nd floor", kind: "meeting", taskKey: "c-orient" },
    { id: "a-lunch", day: 0, day1: "end", minutes: 60, title: "Lunch with your manager", titleRemote: "Video coffee with your manager", with: "manager", where: "Cafe on the 1st floor", kind: "social" },
    { id: "a-1on1", day: 0, start: "14:00", end: "14:30", title: "Your first 1:1 with your manager", with: "manager", where: "Small meeting room", kind: "meeting", taskKey: "c-1on1" },
    { id: "a-it", day: 0, start: "15:00", end: "16:00", title: "Laptop and accounts setup", with: "it", where: "IT help desk, 2nd floor", kind: "training" },
    { id: "a-buddy", day: 1, start: "11:00", end: "11:30", title: "Coffee with your buddy", with: "buddy", where: "Kitchen, 3rd floor", kind: "social" },
    { id: "a-security", day: 2, start: "10:00", end: "10:30", title: "Security basics, live Q&A", with: "it", where: "Room Atlas", kind: "training" },
    { id: "a-allhands", day: 3, start: "16:00", end: "17:00", title: "Company all-hands", with: "Everyone at MangoApps", where: "Main hall", kind: "meeting" },
    { id: "a-lunch2", day: 4, start: "12:00", end: "13:00", title: "Team lunch", with: "team", where: "Cafe on the 1st floor", whereRemote: "Video call (lunch is on us)", kind: "social" },
    { id: "a-wk1", day: 4, start: "15:00", end: "15:30", title: "End-of-week chat with your manager", with: "manager", where: "Small meeting room", kind: "meeting" },
  ],
  Engineering: [
    { id: "a-e-standup", day: 1, start: "09:30", end: "09:45", title: "Team stand-up", with: "team", where: "Team area, 3rd floor", kind: "meeting" },
    { id: "a-e-devenv", day: 1, start: "13:00", end: "16:00", title: "Set up your dev environment", with: "buddy", where: "Your desk", whereRemote: "From home", kind: "focus" },
    { id: "a-e-arch", day: 2, start: "11:00", end: "12:00", title: "Architecture walkthrough", with: "Raj Mehta", where: "Room Atlas", kind: "training" },
    { id: "a-e-pair", day: 3, start: "10:00", end: "12:00", title: "Pair programming", with: "buddy", where: "Your desk", whereRemote: "Video call", kind: "focus" },
  ],
  Sales: [
    { id: "a-s-sfdc", day: 1, start: "10:00", end: "12:00", title: "Salesforce and Gong training", with: "Grace Liu", where: "Room Summit", kind: "training" },
    { id: "a-s-calls", day: 2, start: "13:00", end: "15:00", title: "Listen in on customer calls", with: "buddy", where: "Sales floor", kind: "focus" },
    { id: "a-s-demo", day: 3, start: "10:00", end: "11:30", title: "Demo practice", with: "Ben Okoro", where: "Room Summit", kind: "training" },
  ],
  Marketing: [
    { id: "a-m-brand", day: 1, start: "10:00", end: "11:00", title: "Brand walkthrough", with: "Daniel Park", where: "Studio, 4th floor", kind: "training" },
    { id: "a-m-review", day: 2, start: "14:00", end: "15:00", title: "Campaign review", with: "team", where: "Room Harbor", kind: "meeting" },
    { id: "a-m-write", day: 3, start: "09:30", end: "11:30", title: "Read the last quarter's campaigns", with: "", where: "Your desk", whereRemote: "From home", kind: "focus" },
  ],
  "Customer Support": [
    { id: "a-cs-zendesk", day: 1, start: "09:00", end: "11:00", title: "Zendesk training", with: "Noah Kim", where: "Support room", kind: "training" },
    { id: "a-cs-shadow", day: 2, start: "09:00", end: "12:00", title: "Sit in on live tickets", with: "buddy", where: "Support room", kind: "focus" },
    { id: "a-cs-product", day: 3, start: "13:00", end: "15:00", title: "Product deep dive", with: "Luis Romero", where: "Room Harbor", kind: "training" },
  ],
};

// Learning path (A3): Company basics first, then the department's items. Suggested order, not enforced.
// kind: watch | read | practice. taskKey (optional) links to a plan task: finishing one finishes the other.
OB.LEARNING_KINDS = { watch: "Watch", read: "Read", practice: "Practice" };
OB.LEARNING = {
  Company: [
    { id: "l-welcome", title: "Welcome to MangoApps", kind: "watch", minutes: 10, link: "https://learn.example.com/welcome" },
    { id: "l-values", title: "How we work: our values", kind: "read", minutes: 10, link: "https://intranet.example.com/values" },
    { id: "l-security", title: "Security awareness training", kind: "watch", minutes: 30, link: "https://learn.example.com/security-awareness", taskKey: "c-security" },
    { id: "l-tools", title: "A tour of MangoApps tools", kind: "practice", minutes: 15 },
  ],
  Engineering: [
    { id: "l-e-arch", title: "Architecture overview", kind: "read", minutes: 25, link: "https://wiki.example.com/eng/architecture", taskKey: "e-arch" },
    { id: "l-e-review", title: "How we review code", kind: "read", minutes: 15, link: "https://wiki.example.com/eng/code-review" },
    { id: "l-e-devenv", title: "Set up your local dev environment", kind: "practice", minutes: 45, taskKey: "e-devenv" },
  ],
  Sales: [
    { id: "l-s-product", title: "Product overview for sellers", kind: "watch", minutes: 20, link: "https://learn.example.com/sales/product" },
    { id: "l-s-pitch", title: "Our pitch, step by step", kind: "read", minutes: 15, link: "https://learn.example.com/sales/pitch" },
    { id: "l-s-demo", title: "Record a practice demo", kind: "practice", minutes: 30 },
  ],
  Marketing: [
    { id: "l-m-brand", title: "Brand guidelines", kind: "read", minutes: 20, link: "https://brand.example.com/guidelines", taskKey: "m-brand" },
    { id: "l-m-persona", title: "Who our customers are", kind: "watch", minutes: 15, link: "https://learn.example.com/marketing/personas" },
    { id: "l-m-hubspot", title: "HubSpot basics", kind: "practice", minutes: 25 },
  ],
  "Customer Support": [
    { id: "l-cs-product", title: "Product training", kind: "watch", minutes: 40, link: "https://learn.example.com/support/product", taskKey: "cs-product" },
    { id: "l-cs-tone", title: "Writing friendly, clear replies", kind: "read", minutes: 15, link: "https://learn.example.com/support/tone" },
    { id: "l-cs-macros", title: "Practice with Zendesk macros", kind: "practice", minutes: 20 },
  ],
};

// Pre-boarding forms (A4). Mock only: values are saved in this browser's localStorage, never sent anywhere.
// taskKey: submitting the form completes this plan task. sensitive fields are masked when viewed (••••6789).
// Field kinds: text | tel | select | secret (masked input, digits) | money | checkbox.
OB.FORMS = [
  {
    id: "offer", title: "Offer letter e-signature", short: "Offer letter", taskKey: "c-offer",
    desc: "Read the summary of your offer, then sign by typing your name.",
    fields: [
      { name: "signature", label: "Type your full name to sign", kind: "text", autocomplete: "off" },
      { name: "agree", label: "I've read the offer summary and accept it", kind: "checkbox" },
    ],
  },
  {
    id: "personal", title: "Personal details", short: "Personal details", taskKey: null,
    desc: "How you'd like to be addressed, and how we can reach you.",
    fields: [
      { name: "preferredName", label: "Preferred name", kind: "text", optional: true, autocomplete: "off" },
      { name: "pronouns", label: "Pronouns", kind: "select", optional: true, options: ["she/her", "he/him", "they/them", "Prefer to self-describe", "Prefer not to say"] },
      { name: "phone", label: "Mobile phone", kind: "tel" },
      { name: "street", label: "Street address", kind: "text", autocomplete: "off" },
      { name: "city", label: "City", kind: "text", autocomplete: "off" },
      { name: "zip", label: "ZIP code", kind: "text", inputmode: "numeric", autocomplete: "off" },
    ],
  },
  {
    id: "emergency", title: "Emergency contact", short: "Emergency contact", taskKey: null,
    desc: "Someone we can call if something happens at work.",
    fields: [
      { name: "name", label: "Contact's full name", kind: "text", autocomplete: "off" },
      { name: "relationship", label: "Relationship to you", kind: "select", options: ["Partner or spouse", "Parent", "Sibling", "Friend", "Other"] },
      { name: "phone", label: "Contact's phone", kind: "tel" },
    ],
  },
  {
    id: "w4", title: "Tax form (W-4)", short: "Tax form (W-4)", taskKey: "c-tax",
    desc: "A simplified W-4 for this demo. HR checks your I-9 documents in person on Day 1.",
    fields: [
      { name: "filingStatus", label: "Filing status", kind: "select", options: ["Single or married filing separately", "Married filing jointly", "Head of household"] },
      { name: "extra", label: "Extra withholding per paycheck (optional)", kind: "money", optional: true },
    ],
  },
  {
    id: "deposit", title: "Direct deposit", short: "Direct deposit", taskKey: "c-deposit",
    desc: "Where your paycheck goes. You'll find both numbers at the bottom of a check or in your banking app.",
    fields: [
      { name: "bank", label: "Bank name", kind: "text", autocomplete: "off" },
      { name: "routing", label: "Routing number (9 digits)", kind: "secret", sensitive: true },
      { name: "account", label: "Account number", kind: "secret", sensitive: true },
      { name: "accountConfirm", label: "Account number again", kind: "secret", sensitive: true, confirmOnly: true },
    ],
  },
];

// Seed new hires at different stages, relative to "today" so the demo always looks fresh.
// startWeek (round 4): the hire starts on a Monday, this many weeks from the Monday of the current week
// (0 = this week's Monday, 1 = next Monday), so every seed hire starts on a weekday whatever day the demo is
// opened (OB.seedStartDate). With the harness demo date, Thu 2026-11-05: Emily Mon Nov 9 (in 4 days),
// Marcus Mon Oct 26 (Day 11), Aisha Mon Oct 19 (Day 18), Tom Mon Nov 16 (in 11 days).
// doneKeys: template tasks already completed. skip: template tasks left out of this plan.
// workType / jobLevel decide which conditional template tasks (appliesTo) each hire gets.
// oneOnOnes / goals (round 4, pass B): seeded 1:1 notes and 30/60/90 goals (OB.seedManagerExtras, js/manager.js).
OB.SEED_HIRES = [
  { id: "emily", name: "Emily Chen", title: "Software Engineer", department: "Engineering", managerId: "david", startWeek: 1, workType: "Onsite", jobLevel: "Individual contributor",
    // Emily's buddy is already picked (Nina); Marcus and Tom don't have one yet (see OB.TEAMS / buddyId).
    doneKeys: ["c-offer", "c-tax", "c-laptop", "c-buddy"], buddyId: "nina", learningDone: ["l-welcome"] },
  // Marcus has a role (C1b): the Backend Engineer role template adds its tasks to his plan. His Day 7 check-in is open.
  { id: "marcus", name: "Marcus Johnson", title: "Backend Engineer", department: "Engineering", managerId: "david", startWeek: -1, workType: "Hybrid", jobLevel: "Individual contributor", role: "role-backend",
    doneKeys: ["c-offer", "c-tax", "c-deposit", "c-welcome", "c-laptop", "c-accounts", "c-note", "c-orient", "c-1on1", "c-badge", "c-desk", "e-access", "e-devenv", "r-be-db"],
    learningDone: ["l-welcome", "l-values", "l-e-devenv"],
    // dayOffset: days from the start date. covered: indexes of the template's talking points already ticked.
    oneOnOnes: [
      { id: "oo-marcus-1", templateId: "first", dayOffset: 0, time: "14:00", covered: [0, 1, 2, 3], notes: "Keen on the payments service. Would like a buddy who knows the CI setup.", followUps: ["Share the on-call rota doc"] },
      { id: "oo-marcus-2", templateId: "week1", dayOffset: 4, time: "15:00", covered: [0, 1, 2, 3, 4], notes: "Dev environment works. Pairing with Kenji helped.", followUps: [] },
      { id: "oo-marcus-3", templateId: "day30", dayOffset: 29, time: "14:00", covered: [], notes: "", followUps: [] },
    ],
    goals: [
      { suggestedId: "g-e-devenv", status: "done" },
      { suggestedId: "g-e-pr", status: "doing", note: "My first PR is in review." },
      { suggestedId: "g-c-meet", status: "todo" },
      { suggestedId: "g-e-feature", status: "todo" },
    ] },
  { id: "aisha", name: "Aisha Patel", title: "Sales Team Lead", department: "Sales", managerId: "priya", startWeek: -2, workType: "Onsite", jobLevel: "People manager",
    pulses: { d7: ["great", "Shadowing calls with Carlos was the best part of the week."] },
    doneKeys: ["c-offer", "c-tax", "c-deposit", "c-welcome", "c-laptop", "c-accounts", "c-note", "c-buddy", "c-orient", "c-1on1", "c-security", "c-handbook", "c-badge", "c-desk", "c-mgr-training", "c-team-goals", "c-benefits", "c-goals", "c-harass", "s-access", "s-demo", "s-territory", "s-shadow"] },
  { id: "tom", name: "Tom Rivera", title: "Marketing Coordinator", department: "Marketing", managerId: "lena", startWeek: 2, workType: "Remote", jobLevel: "Individual contributor",
    doneKeys: [] },
];

// ---- Round 4, pass B: manager tools (js/manager.js) ----

// 1:1 agenda templates (B2). dayOffset: the suggested date in days from the start date (moved to a weekday).
OB.ONE_ON_ONE_TEMPLATES = [
  { id: "first", title: "First 1:1 (Day 1)", dayOffset: 0, points: [
    "Welcome, and how the first morning went",
    "What the role is, and what success looks like",
    "How the team works: rituals, channels, who to ask",
    "The first week's plan and the buddy",
    "How you like to get feedback",
  ] },
  { id: "week1", title: "End of week 1", dayOffset: 4, points: [
    "What went well this week",
    "Anything confusing or still blocked",
    "Access and tools: is everything working?",
    "People met so far, and who to meet next",
    "Plan for week 2",
  ] },
  { id: "day30", title: "30-day check-in", dayOffset: 29, points: [
    "How the first month felt",
    "Progress on the 30-day goals",
    "What support would help most",
    "Set or adjust the 60-day goals",
  ] },
  { id: "review", title: "60/90-day review", dayOffset: 59, points: [
    "Wins since the last check-in",
    "Progress on the 60/90-day goals",
    "Feedback, both ways",
    "Growth areas and next projects",
    "Anything about the role to change",
    "Goals for the next quarter",
  ] },
];

// 30/60/90-day goals (B3). Statuses always show an icon and a word.
OB.GOAL_HORIZONS = [30, 60, 90];
OB.GOAL_STATUS = { todo: "Not started", doing: "In progress", done: "Done" };
// Suggested starter goals: the Company ones for everyone, plus the department's. One click adds one.
OB.SUGGESTED_GOALS = {
  Company: [
    { id: "g-c-meet", horizon: 30, title: "Meet everyone on the team 1:1", desc: "A short coffee or call with each teammate." },
    { id: "g-c-tools", horizon: 30, title: "Get comfortable with our everyday tools", desc: "MangoApps, email, calendar and the team's channels." },
    { id: "g-c-feedback", horizon: 90, title: "Give and ask for feedback in a 1:1", desc: "One piece of feedback each way, written down." },
  ],
  Engineering: [
    { id: "g-e-devenv", horizon: 30, title: "Set up the dev environment and run the app locally", desc: "Run the app and the tests on your own machine." },
    { id: "g-e-pr", horizon: 30, title: "Ship your first pull request to production", desc: "A small, well-scoped ticket." },
    { id: "g-e-feature", horizon: 60, title: "Own a small feature end to end", desc: "From ticket to release, with review from your buddy." },
    { id: "g-e-oncall", horizon: 90, title: "Join the on-call rotation", desc: "After shadowing at least one shift." },
  ],
  Sales: [
    { id: "g-s-demo", horizon: 30, title: "Give the product demo with confidence", desc: "Pass the demo certification." },
    { id: "g-s-pipeline", horizon: 60, title: "Build a pipeline of 10 qualified opportunities", desc: "In your territory, logged in Salesforce." },
    { id: "g-s-close", horizon: 90, title: "Close your first deal", desc: "With support from your manager on pricing." },
  ],
  Marketing: [
    { id: "g-m-brand", horizon: 30, title: "Know the brand guidelines well", desc: "Voice, logo use and templates." },
    { id: "g-m-campaign", horizon: 60, title: "Run one campaign task end to end", desc: "From brief to report." },
    { id: "g-m-report", horizon: 90, title: "Share a campaign results report", desc: "Presented at the team meeting." },
  ],
  "Customer Support": [
    { id: "g-cs-tickets", horizon: 30, title: "Handle Tier 1 tickets with review", desc: "A senior agent reviews your replies." },
    { id: "g-cs-solo", horizon: 60, title: "Handle tickets on your own", desc: "With a quality score you're happy with." },
    { id: "g-cs-macro", horizon: 90, title: "Write or improve one help-center article", desc: "Pick a question customers ask often." },
  ],
};

// Notifications (B4). Demo only: nothing is ever sent. "In-app only" can't be combined with the others.
OB.NOTIFY_CHANNELS = { inapp: "In-app only", email: "Email", slack: "Slack", teams: "Teams" };
OB.NOTIFY_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// ---- Round 4, pass C1: HR (js/hr.js) ----

// Role templates (C1b). A role belongs to one department and adds its tasks to the Company + department plan.
// HR edits these in Templates (saved as state.roles). Task fields are the same as in OB.TEMPLATES.
OB.ROLE_TEMPLATES = [
  { id: "role-backend", name: "Backend Engineer", department: "Engineering", tasks: [
    { key: "r-be-runbook", type: "read", link: "https://wiki.example.com/eng/payments-runbook", title: "Read the payments service runbook", owner: "newhire", dayOffset: 11, desc: "How the service is deployed, monitored and rolled back." },
    { key: "r-be-db", title: "Get read access to the staging database", owner: "it", dayOffset: 2, desc: "Read-only role on the staging cluster.", hireTitle: "Your staging database access is set up", hireDesc: "A read-only role on the staging cluster." },
    { key: "r-be-review", title: "Pair on a code review with your buddy", owner: "newhire", dayOffset: 15, desc: "Review a real pull request together and talk through the conventions." },
    { key: "r-be-guild", type: "meeting", title: "Join the backend guild sync", owner: "newhire", dayOffset: 17, desc: "A fortnightly meeting about shared services and tooling." },
  ] },
  { id: "role-ae", name: "Account Executive", department: "Sales", tasks: [
    { key: "r-ae-pricing", type: "read", link: "https://sales.example.com/pricing-guide", title: "Learn the pricing and discount guide", owner: "newhire", dayOffset: 4, desc: "List prices, approval levels and common bundles." },
    { key: "r-ae-forecast", type: "meeting", title: "Sit in on the weekly forecast call", owner: "newhire", dayOffset: 9, desc: "Listen in and see how deals are reviewed." },
    { key: "r-ae-sequences", title: "Set up your email sequences", owner: "newhire", dayOffset: 12, desc: "Copy the team's starter sequences into your own account." },
  ] },
  { id: "role-support", name: "Support Specialist", department: "Customer Support", tasks: [
    { key: "r-cs-macros", type: "read", title: "Learn the top 20 support macros", owner: "newhire", dayOffset: 3, desc: "Saved replies for the questions customers ask most." },
    { key: "r-cs-escalation", type: "acknowledge", docId: "doc-escalation", title: "Read and acknowledge the escalation policy", owner: "newhire", dayOffset: 5, desc: "When and how to hand a ticket to Tier 2." },
  ] },
];

// Finished hires from earlier months (C1a). They feed Insights only: never the active lists, the manager's Team
// view or "Viewing as". weeksAgo: started on the Monday this many weeks before this week's Monday.
// slip: { taskKey: days it was done after its date }. pulses: { d7 | d30: [answer, comment] }.
OB.ARCHIVED_HIRES = [
  { id: "p-lucas", name: "Lucas Moreau", title: "Frontend Engineer", department: "Engineering", managerId: "david", weeksAgo: 7, workType: "Hybrid", jobLevel: "Individual contributor",
    slip: { "c-security": 4, "e-arch": 2, "e-devenv": 1 }, pulses: { d7: ["great", "My buddy made the first week easy."], d30: ["great", ""] } },
  { id: "p-sofia", name: "Sofia Rossi", title: "Backend Engineer", department: "Engineering", managerId: "david", weeksAgo: 10, workType: "Remote", jobLevel: "Individual contributor", role: "role-backend",
    slip: { "c-security": 6, "c-handbook": 3, "e-arch": 4, "c-harass": 5 }, pulses: { d7: ["okay", "Setting up the dev environment took most of the week."], d30: ["great", "Things clicked once I shipped my first change."] } },
  { id: "p-ben", name: "Ben Carter", title: "QA Engineer", department: "Engineering", managerId: "david", weeksAgo: 14, workType: "Onsite", jobLevel: "Individual contributor",
    slip: { "c-security": 2, "c-benefits": 6 }, pulses: { d7: ["better", "GitHub access only came through on Wednesday."], d30: ["okay", ""] } },
  { id: "p-hana", name: "Hana Sato", title: "Account Executive", department: "Sales", managerId: "priya", weeksAgo: 6, workType: "Onsite", jobLevel: "Individual contributor", role: "role-ae",
    slip: { "s-demo": 3, "c-handbook": 1 }, pulses: { d7: ["great", "Loved shadowing real calls."], d30: ["great", ""] } },
  { id: "p-diego", name: "Diego Alvarez", title: "Account Executive", department: "Sales", managerId: "priya", weeksAgo: 12, workType: "Hybrid", jobLevel: "Individual contributor", role: "role-ae",
    slip: { "s-demo": 5, "c-security": 3, "c-benefits": 4 }, pulses: { d7: ["okay", "The demo certification felt rushed."], d30: ["okay", "More time with the product before the demo would help."] } },
  { id: "p-grace", name: "Grace Kim", title: "Content Marketer", department: "Marketing", managerId: "lena", weeksAgo: 9, workType: "Remote", jobLevel: "Individual contributor",
    slip: { "c-security": 1, "m-brand": 2 }, pulses: { d7: ["great", ""], d30: ["great", "Clear goals from the start."] } },
  { id: "p-owen", name: "Owen Price", title: "Marketing Lead", department: "Marketing", managerId: "lena", weeksAgo: 16, workType: "Onsite", jobLevel: "People manager",
    slip: { "c-mgr-training": 4, "c-handbook": 2, "c-harass": 3 }, pulses: { d7: ["okay", ""], d30: ["better", "Manager training earlier in the month would help."] } },
  { id: "p-rosa", name: "Rosa Mendes", title: "Support Specialist", department: "Customer Support", managerId: "omar", weeksAgo: 8, workType: "Onsite", jobLevel: "Individual contributor", role: "role-support",
    slip: { "cs-product": 3, "c-security": 2 }, pulses: { d7: ["great", "The team answered every question quickly."], d30: ["great", ""] } },
  { id: "p-ivan", name: "Ivan Petrov", title: "Support Specialist", department: "Customer Support", managerId: "omar", weeksAgo: 18, workType: "Remote", jobLevel: "Individual contributor", role: "role-support",
    slip: { "cs-product": 4, "c-security": 5, "c-benefits": 2 }, pulses: { d7: ["better", "The headset arrived after Day 1."], d30: ["okay", ""] } },
];

// ---- Round 4, pass C2: compliance and documents (js/hr2.js) ----

// Document library (C2c). audience: { kind: "everyone" } | { kind: "department", value } | { kind: "level", value }.
// Links are placeholders. HR edits these (saved as state.documents).
OB.DOC_CATEGORIES = ["Policies", "Benefits", "IT & security", "Team guides"];
OB.DOCUMENTS = [
  { id: "doc-handbook", title: "Employee handbook", category: "Policies", desc: "Time off, expenses, working hours and the code of conduct.", link: "https://intranet.example.com/handbook", audience: { kind: "everyone" }, updated: "2026-09-14" },
  { id: "doc-timeoff", title: "Time off and holidays", category: "Policies", desc: "How to book time off and this year's company holidays.", link: "https://intranet.example.com/time-off", audience: { kind: "everyone" }, updated: "2026-10-01" },
  { id: "doc-confidentiality", title: "Confidentiality and data handling", category: "Policies", desc: "What stays confidential, during and after your time here.", link: "https://intranet.example.com/confidentiality", audience: { kind: "everyone" }, updated: "2026-06-30" },
  { id: "doc-benefits", title: "Health benefits guide", category: "Benefits", desc: "Medical, dental and vision plans, and how to enroll.", link: "https://benefits.example.com/guide", audience: { kind: "everyone" }, updated: "2026-10-20" },
  { id: "doc-401k", title: "Retirement savings (401k)", category: "Benefits", desc: "Matching, vesting and how to change your contribution.", link: "https://benefits.example.com/401k", audience: { kind: "everyone" }, updated: "2026-08-05" },
  { id: "doc-intern", title: "Intern stipend and perks", category: "Benefits", desc: "Housing stipend, transit and the intern events calendar.", link: "https://benefits.example.com/interns", audience: { kind: "level", value: "Intern" }, updated: "2026-05-18" },
  { id: "doc-security", title: "Security basics", category: "IT & security", desc: "Passwords, phishing and how to report something odd.", link: "https://it.example.com/security-basics", audience: { kind: "everyone" }, updated: "2026-10-28" },
  { id: "doc-laptop", title: "Laptop and accounts FAQ", category: "IT & security", desc: "Getting set up, VPN, and who to ask when something breaks.", link: "https://it.example.com/laptop-faq", audience: { kind: "everyone" }, updated: "2026-09-02" },
  { id: "doc-eng", title: "Engineering handbook", category: "Team guides", desc: "Dev setup, code review, deploys and on-call.", link: "https://wiki.example.com/eng/handbook", audience: { kind: "department", value: "Engineering" }, updated: "2026-10-15" },
  { id: "doc-sales", title: "Sales playbook", category: "Team guides", desc: "Our sales stages, demo flow and deal desk rules.", link: "https://sales.example.com/playbook", audience: { kind: "department", value: "Sales" }, updated: "2026-10-09" },
  { id: "doc-escalation", title: "Support escalation policy", category: "Team guides", desc: "When and how to hand a ticket to Tier 2.", link: "https://support.example.com/escalation", audience: { kind: "department", value: "Customer Support" }, updated: "2026-07-21" },
  { id: "doc-managers", title: "Manager essentials guide", category: "Team guides", desc: "1:1s, feedback and approving time off.", link: "https://intranet.example.com/manager-essentials", audience: { kind: "level", value: "People manager" }, updated: "2026-09-25" },
];
