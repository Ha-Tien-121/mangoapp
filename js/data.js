// Mock data for MangoApps (the scenario customer was BrightPath Technologies).
// Templates are layered: every hire gets the "Company" tasks, plus the tasks for their department.
// dayOffset is days relative to the start date (negative = before Day 1).
window.OB = window.OB || {};

OB.DEPARTMENTS = ["Engineering", "Sales", "Marketing", "Customer Support"];

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
    { key: "c-offer", title: "Sign offer letter and employment agreement", owner: "newhire", dayOffset: -10, desc: "Sign in the HR portal. Ask HR if anything in the agreement is unclear." },
    { key: "c-tax", title: "Complete I-9 and W-4 tax forms", owner: "newhire", dayOffset: -5, desc: "Bring an ID document on Day 1 so HR can verify your I-9." },
    { key: "c-deposit", title: "Set up direct deposit", owner: "newhire", dayOffset: -5, desc: "Needed for your first paycheck to arrive on time." },
    { key: "c-welcome", title: "Read the welcome guide and Day 1 logistics", owner: "newhire", dayOffset: -2, desc: "Where to go, when to arrive, and who will meet you." },
    { key: "c-laptop", title: "Prepare and ship laptop", owner: "it", dayOffset: -3, desc: "Laptop arrives at the new hire's home address before Day 1.", hireTitle: "Your laptop is shipped to your home address", hireDesc: "It should arrive before Day 1. IT will let you know when it ships." },
    { key: "c-accounts", title: "Create email and Slack accounts", owner: "it", dayOffset: -2, desc: "Login details are sent to the new hire's personal email.", hireTitle: "Your email and Slack accounts are created", hireDesc: "Login details are sent to your personal email." },
    { key: "c-note", title: "Send welcome note and first-week schedule", owner: "manager", dayOffset: -3, desc: "A short personal note plus the Week 1 calendar.", hireTitle: "Your manager sends a welcome note and first-week schedule", hireDesc: "A short personal note plus your Week 1 calendar." },
    { key: "c-buddy", title: "Assign an onboarding buddy", owner: "manager", dayOffset: -1, desc: "Someone on the team the new hire can ask anything.", hireTitle: "You're assigned an onboarding buddy", hireDesc: "Someone on the team you can ask anything." },
    { key: "c-orient", isEvent: true, title: "Attend Day 1 orientation", owner: "newhire", dayOffset: 0, desc: "9:30am with HR. Covers tools, policies and a building tour." },
    { key: "c-1on1", isEvent: true, title: "Hold first 1:1 with your new hire", owner: "manager", dayOffset: 0, desc: "Talk through the role, the team, and what the first month looks like.", hireTitle: "Your first 1:1 with your manager", hireDesc: "Talk through the role, the team, and what the first month looks like." },
    { key: "c-security", title: "Complete security awareness training", owner: "newhire", dayOffset: 3, desc: "About 30 minutes in the learning portal." },
    { key: "c-handbook", title: "Read and acknowledge the employee handbook", owner: "newhire", dayOffset: 4, desc: "Covers time off, expenses and code of conduct." },
    { key: "c-benefits", title: "Enroll in health benefits", owner: "newhire", dayOffset: 14, desc: "You have 30 days from your start date. Enrolling early means coverage starts sooner." },
    { key: "c-goals", isEvent: true, title: "Set 30/60/90-day goals together", owner: "manager", dayOffset: 14, desc: "Agree on what success looks like for the first three months.", hireTitle: "Set your 30/60/90-day goals with your manager", hireDesc: "Agree on what success looks like for your first three months." },
    { key: "c-harass", title: "Complete harassment prevention training", owner: "newhire", dayOffset: 21, desc: "Required by state law within the first month." },
    { key: "c-checkin", isEvent: true, title: "30-day check-in", owner: "hr", dayOffset: 27, desc: "A short conversation about how onboarding went.", hireTitle: "Your 30-day check-in with HR", hireDesc: "A short conversation about how onboarding went." },
  ],
  Engineering: [
    { key: "e-access", title: "Grant GitHub, Jira and AWS sandbox access", owner: "it", dayOffset: -2, desc: "Add to the engineering GitHub org and the team's Jira project.", hireTitle: "Your GitHub, Jira and AWS sandbox access is set up", hireDesc: "You're added to the engineering GitHub org and your team's Jira project." },
    { key: "e-devenv", title: "Set up your local dev environment", owner: "newhire", dayOffset: 2, desc: "Follow the setup guide in the eng-handbook repo. Ask your buddy if you get stuck." },
    { key: "e-arch", title: "Read the architecture overview", owner: "newhire", dayOffset: 3, desc: "Start with the system diagram, then the service READMEs." },
    { key: "e-pr", title: "Ship your first small pull request", owner: "newhire", dayOffset: 10, desc: "Pick a ticket labelled good-first-issue." },
    { key: "e-oncall", title: "Shadow an on-call shift", owner: "newhire", dayOffset: 21, desc: "Watch how incidents are handled before joining the rotation." },
  ],
  Sales: [
    { key: "s-access", title: "Grant Salesforce and Gong access", owner: "it", dayOffset: -2, desc: "Sales Rep profile in Salesforce.", hireTitle: "Your Salesforce and Gong access is set up", hireDesc: "You get a Sales Rep profile in Salesforce." },
    { key: "s-demo", title: "Pass the product demo certification", owner: "newhire", dayOffset: 5, desc: "Record a 15-minute demo and submit it in the learning portal." },
    { key: "s-territory", title: "Assign territory and account list", owner: "manager", dayOffset: 7, desc: "Hand over accounts and introduce the new hire to key contacts.", hireTitle: "You get your territory and account list", hireDesc: "Your manager hands over accounts and introduces you to key contacts." },
    { key: "s-shadow", title: "Shadow 5 customer calls", owner: "newhire", dayOffset: 10, desc: "Gong has recordings if live calls clash with training." },
  ],
  Marketing: [
    { key: "m-access", title: "Grant HubSpot, Figma and Canva access", owner: "it", dayOffset: -2, desc: "Editor seats on the marketing team workspace.", hireTitle: "Your HubSpot, Figma and Canva access is set up", hireDesc: "Editor seats on the marketing team workspace." },
    { key: "m-brand", title: "Review brand guidelines", owner: "newhire", dayOffset: 3, desc: "Logo use, tone of voice and templates." },
    { key: "m-meet", isEvent: true, title: "Meet the Sales and Product leads", owner: "newhire", dayOffset: 8, desc: "Your manager will book these intros." },
    { key: "m-campaign", title: "Own your first campaign task", owner: "newhire", dayOffset: 20, desc: "A small, well-defined piece of an active campaign." },
  ],
  "Customer Support": [
    { key: "cs-access", title: "Grant Zendesk access", owner: "it", dayOffset: -2, desc: "Agent seat, Tier 1 queue.", hireTitle: "Your Zendesk access is set up", hireDesc: "An agent seat on the Tier 1 queue." },
    { key: "cs-product", title: "Complete product training", owner: "newhire", dayOffset: 4, desc: "Self-paced course in the learning portal." },
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
};
// Per-department overrides, merged over OB.DAY1.
OB.DAY1_BY_DEPT = {
  "Customer Support": { time: "08:30", end: "12:30" },
};

OB.PEOPLE = [
  { id: "sarah", name: "Sarah Kim", role: "hr", title: "HR Manager", department: "People" },
  { id: "david", name: "David Okafor", role: "manager", title: "Engineering Manager", department: "Engineering" },
  { id: "priya", name: "Priya Shah", role: "manager", title: "Sales Manager", department: "Sales" },
  { id: "lena", name: "Lena Novak", role: "manager", title: "Marketing Manager", department: "Marketing" },
  { id: "omar", name: "Omar Haddad", role: "manager", title: "Support Manager", department: "Customer Support" },
];

// Seed new hires at different stages, relative to "today" so the demo always looks fresh.
// doneKeys: template tasks already completed. skip: template tasks left out of this plan.
OB.SEED_HIRES = [
  { id: "emily", name: "Emily Chen", title: "Software Engineer", department: "Engineering", managerId: "david", startOffset: 4,
    doneKeys: ["c-offer", "c-tax", "c-laptop"] },
  { id: "marcus", name: "Marcus Johnson", title: "Backend Engineer", department: "Engineering", managerId: "david", startOffset: -6,
    doneKeys: ["c-offer", "c-tax", "c-deposit", "c-welcome", "c-laptop", "c-accounts", "c-note", "c-orient", "c-1on1", "e-access", "e-devenv"] },
  { id: "aisha", name: "Aisha Patel", title: "Account Executive", department: "Sales", managerId: "priya", startOffset: -12,
    doneKeys: ["c-offer", "c-tax", "c-deposit", "c-welcome", "c-laptop", "c-accounts", "c-note", "c-buddy", "c-orient", "c-1on1", "c-security", "c-handbook", "s-access", "s-demo", "s-territory", "s-shadow"] },
  { id: "tom", name: "Tom Rivera", title: "Marketing Coordinator", department: "Marketing", managerId: "lena", startOffset: 10,
    doneKeys: [] },
];
