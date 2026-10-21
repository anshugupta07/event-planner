import { buildPlan, validateInput } from './planner.js';
import { requestIdeas } from './ai.js';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'celebration-event-planner-draft';
const todayIso = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text; // textContent: never parsed as HTML
  if (className) node.className = className;
  return node;
}

const fill = (container, nodes) => container.replaceChildren(...nodes);
const setStatus = (message) => { $('status').textContent = message; };

function showErrors(errors) {
  for (const field of ['type', 'guests', 'budget', 'date', 'theme']) {
    $(`${field}-error`).textContent = errors[field] ?? '';
    if (errors[field]) $(field).setAttribute('aria-invalid', 'true');
    else $(field).removeAttribute('aria-invalid');
  }
}

function renderPlan(plan) {
  const money = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  $('summary').textContent = `Budget ${money.format(plan.input.budget)} for ${plan.input.guests} guests (about ${money.format(plan.perGuest)} per guest).`;
  $('plan-score').textContent = plan.evaluation.score;
  $('score-title').textContent = plan.evaluation.score >= 80 ? 'You are in great shape' : plan.evaluation.score >= 60 ? 'A solid start' : 'A few priorities need attention';
  $('score-detail').textContent = `${plan.evaluation.daysToEvent} days until the event · ${plan.evaluation.lateTasks} timeline task${plan.evaluation.lateTasks === 1 ? '' : 's'} behind`;
  fill($('score-reasons'), plan.evaluation.reasons.map((reason) => el('li', reason)));
  fill($('budget-body'), plan.budget.map((r) => {
    const tr = el('tr');
    const th = el('th', r.category);
    th.scope = 'row';
    tr.append(th, el('td', `${r.percent}%`), el('td', money.format(r.amount)));
    return tr;
  }));
  fill($('timeline'), plan.timeline.map((t) => el('li', `${t.due}: ${t.task}${t.late ? ' (start now, behind schedule)' : ''}`)));
  fill($('checklist'), plan.checklist.map((c, i) => {
    const li = el('li');
    const box = el('input');
    box.type = 'checkbox';
    box.id = `vendor-${i}`;
    const label = el('label', c.label);
    label.htmlFor = box.id;
    li.append(box, label);
    return li;
  }));
  fill($('ideas'), plan.ideas.map((i) => el('li', i)));
  $('results').hidden = false;
}

function updateProgress() {
  const fields = ['type', 'guests', 'budget', 'date', 'theme'];
  const complete = fields.filter((field) => String($(field).value).trim()).length;
  $('form-progress').textContent = `${complete}/${fields.length} complete`;
}

function saveDraft() {
  const data = Object.fromEntries(new FormData($('planner-form')));
  delete data.apikey;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    $('draft-status').textContent = 'Draft saved automatically.';
  } catch {
    $('draft-status').textContent = 'Draft could not be saved in this browser.';
  }
  updateProgress();
}

function restoreDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return;
    for (const field of ['type', 'guests', 'budget', 'date', 'theme']) {
      if (typeof saved[field] === 'string') $(field).value = saved[field];
    }
    $('draft-status').textContent = 'Saved draft restored.';
  } catch {
    $('draft-status').textContent = 'Start a new plan below.';
  }
  updateProgress();
}

function downloadPlan() {
  const plan = window.currentPlan;
  if (!plan) return;
  const lines = [
    'CELEBRATION & EVENT PLANNER',
    `Event: ${plan.input.type} | Date: ${plan.input.date} | Guests: ${plan.input.guests}`,
    `Readiness score: ${plan.evaluation.score}/100`,
    '',
    'BUDGET',
    ...plan.budget.map((row) => `${row.category}: ${row.percent}% (${row.amount})`),
    '',
    'TIMELINE',
    ...plan.timeline.map((task) => `${task.due}: ${task.task}${task.late ? ' (behind schedule)' : ''}`),
    '',
    'VENDOR CHECKLIST',
    ...plan.checklist.map((item) => `- ${item.label}`),
    '',
    'IDEAS',
    ...plan.ideas.map((idea) => `- ${idea}`),
  ];
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
  link.download = 'event-plan.txt';
  link.click();
  URL.revokeObjectURL(link.href);
}

async function onSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  const { ok, errors, value } = validateInput(data, todayIso());
  showErrors(errors);
  if (!ok) {
    setStatus('Please fix the highlighted fields.');
    document.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  window.currentPlan = buildPlan(value, todayIso());
  renderPlan(window.currentPlan);
  setStatus('Plan ready.');
  $('ai-ideas').textContent = '';
  const apiKey = String(data.apikey ?? '').trim(); // in memory only, never stored
  if (!apiKey) return;
  setStatus('Asking AI for extra ideas...');
  try {
    $('ai-ideas').textContent = await requestIdeas({ apiKey, input: value });
    setStatus('Plan ready with AI ideas.');
  } catch {
    $('ai-ideas').textContent = 'AI ideas are unavailable right now. Your plan above is still complete.';
    setStatus('Plan ready (AI unavailable).');
  }
}

for (const field of ['type', 'guests', 'budget', 'date', 'theme']) $(field).addEventListener('input', saveDraft);
$('download-plan').addEventListener('click', downloadPlan);
$('print-plan').addEventListener('click', () => window.print());
$('date').min = todayIso();
restoreDraft();
$('planner-form').addEventListener('submit', onSubmit);
