// Pure planning logic: no DOM, no network. Fully unit-tested.
const DAY_MS = 86_400_000;
const MAX_GUESTS = 5000;
const MAX_BUDGET = 1_000_000_000;
const MAX_THEME = 60;

export const EVENT_TYPES = Object.freeze({
  wedding: {
    label: 'Wedding',
    split: { Venue: 30, Catering: 30, 'Photo & Video': 10, 'Attire & Beauty': 10, 'Decor & Flowers': 8, Music: 5, Contingency: 7 },
    tasks: [[52, 'Set date and total budget'], [48, 'Book venue'], [40, 'Book photographer and caterer'], [26, 'Send save-the-dates'], [16, 'Order attire and finalise decor'], [8, 'Send invitations and collect RSVPs'], [2, 'Confirm final headcount with vendors'], [0, 'Wedding day']],
    vendors: ['Venue contract signed', 'Caterer tasting done', 'Photographer booked', 'Florist and decorator confirmed', 'DJ or band booked', 'Officiant or priest confirmed'],
    ideas: ['Personalised welcome sign and seating story', 'Live music during the ceremony', 'Memory table honouring loved ones'],
  },
  birthday: {
    label: 'Birthday',
    split: { Venue: 25, 'Food & Cake': 35, Decor: 12, Entertainment: 15, 'Return Gifts': 6, Contingency: 7 },
    tasks: [[8, 'Set date, budget and guest list'], [6, 'Book venue or plan home setup'], [4, 'Order cake and send invitations'], [2, 'Book entertainment and buy decor'], [1, 'Confirm RSVPs and finalise menu'], [0, 'Party day']],
    vendors: ['Venue or home layout ready', 'Cake order confirmed', 'Caterer or menu finalised', 'Entertainer or games arranged', 'Decor and balloons purchased'],
    ideas: ['Photo booth with themed props', 'Treasure hunt matching the theme', 'Video wishes from friends and family'],
  },
  community: {
    label: 'Community event',
    split: { 'Venue & Permits': 25, 'Food & Water': 25, 'Sound & Stage': 15, 'Marketing & Printing': 10, 'Volunteers & Safety': 15, Contingency: 10 },
    tasks: [[10, 'Define purpose, budget and permits'], [8, 'Book venue and recruit volunteers'], [5, 'Start publicity and sponsor outreach'], [2, 'Brief volunteers and confirm vendors'], [1, 'Run site check and safety walkthrough'], [0, 'Event day']],
    vendors: ['Venue and permits approved', 'Sound system and stage booked', 'Food and water supplier confirmed', 'First-aid and safety plan ready', 'Volunteer roster shared'],
    ideas: ['Local-artist showcase slot', 'Collect donations for a community cause', 'Feedback wall to plan the next event'],
  },
});

/** Parse a strict YYYY-MM-DD string to a UTC timestamp, or null if invalid. */
export function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const t = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== value ? null : t;
}

const toIso = (t) => new Date(t).toISOString().slice(0, 10);

/** Validate raw form values. Returns { ok, errors, value }. */
export function validateInput(raw, today) {
  const errors = {};
  const type = String(raw?.type ?? '');
  if (!Object.hasOwn(EVENT_TYPES, type)) errors.type = 'Choose an event type.';
  const guests = Number(raw?.guests);
  if (!Number.isInteger(guests) || guests < 1 || guests > MAX_GUESTS) errors.guests = `Guests must be a whole number from 1 to ${MAX_GUESTS}.`;
  const budget = Number(raw?.budget);
  if (!Number.isFinite(budget) || budget < 1 || budget > MAX_BUDGET) errors.budget = 'Enter a budget greater than 0.';
  const date = parseDate(raw?.date);
  const todayT = parseDate(today);
  if (date === null) errors.date = 'Enter a valid date.';
  else if (todayT !== null && date < todayT) errors.date = 'Date cannot be in the past.';
  const theme = String(raw?.theme ?? '').trim();
  if (theme.length > MAX_THEME) errors.theme = `Theme must be at most ${MAX_THEME} characters.`;
  const ok = Object.keys(errors).length === 0;
  return { ok, errors, value: ok ? { type, guests, budget: Math.round(budget), date: toIso(date), theme } : null };
}

/** Split a total budget by percentage; amounts are whole numbers summing exactly to total. */
export function allocateBudget(type, total) {
  const entries = Object.entries(EVENT_TYPES[type].split);
  const rows = entries.map(([category, percent]) => ({ category, percent, amount: Math.floor((total * percent) / 100) }));
  rows[rows.length - 1].amount += total - rows.reduce((s, r) => s + r.amount, 0);
  return rows;
}

/** Dated task list; tasks already overdue are moved to today and flagged. */
export function buildTimeline(type, eventDate, today) {
  const event = parseDate(eventDate);
  const now = parseDate(today);
  return EVENT_TYPES[type].tasks
    .map(([weeks, task]) => {
      const due = event - weeks * 7 * DAY_MS;
      return { task, due: toIso(Math.max(due, now)), late: due < now };
    })
    .sort((a, b) => a.due.localeCompare(b.due));
}

export function buildChecklist(type, guests) {
  const items = [...EVENT_TYPES[type].vendors, `Confirm catering headcount of ${guests}`];
  if (guests > 150) items.push('Arrange crowd management and extra seating');
  return items.map((label) => ({ label, done: false }));
}

export function buildIdeas(type, theme) {
  const base = EVENT_TYPES[type].ideas;
  return theme ? [`Build the whole look around the "${theme}" theme`, ...base] : [...base];
}

/** Score planning readiness from 0 to 100 with reasons users can act on. */
export function evaluatePlan(input, today) {
  const timeline = buildTimeline(input.type, input.date, today);
  const eventTime = parseDate(input.date);
  const todayTime = parseDate(today);
  const daysToEvent = Math.max(0, Math.round((eventTime - todayTime) / DAY_MS));
  const lateTasks = timeline.filter((task) => task.late).length;
  const reasons = [];
  let score = 25;

  if (daysToEvent >= 90) score += 20;
  else if (daysToEvent >= 30) score += 15;
  else if (daysToEvent >= 14) score += 10;
  else score += 5;

  if (input.theme) score += 10;
  else reasons.push('Add a theme to make design and vendor decisions easier.');
  if (input.budget >= input.guests * 1000) score += 15;
  else if (input.budget >= input.guests * 500) score += 10;
  else reasons.push('Review the budget per guest and keep a contingency reserve.');
  if (lateTasks === 0) score += 20;
  else if (lateTasks <= 2) score += 10;
  else reasons.push('Several timeline tasks are already due, so start them now.');
  if (input.guests <= 500) score += 10;
  else reasons.push('Large events benefit from extra volunteer and crowd-management planning.');

  if (daysToEvent < 30) reasons.push('The event is less than 30 days away; prioritise essential bookings.');
  return { score: Math.min(100, score), daysToEvent, lateTasks, reasons };
}

export function buildPlan(input, today) {
  return {
    input,
    perGuest: Math.floor(input.budget / input.guests),
    budget: allocateBudget(input.type, input.budget),
    timeline: buildTimeline(input.type, input.date, today),
    checklist: buildChecklist(input.type, input.guests),
    ideas: buildIdeas(input.type, input.theme),
    evaluation: evaluatePlan(input, today),
  };
}
