/** DOM rendering. Every function receives the document, so it can be tested with a fake. */
import { FIELDS } from './draft.js';
import { scoreTitle } from './planner.js';

/** Create an element; text is set via textContent so it is never parsed as HTML. */
function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

const fill = (container, nodes) => container.replaceChildren(...nodes);
const byId = (doc, id) => doc.getElementById(id);
const moneyFormat = () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

/**
 * Show or clear the validation message and aria-invalid flag for every field.
 * @param {Document} doc
 * @param {Record<string, string>} errors
 */
export function showErrors(doc, errors) {
  for (const field of FIELDS) {
    byId(doc, `${field}-error`).textContent = errors[field] ?? '';
    const input = byId(doc, field);
    if (errors[field]) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
}

function renderSummary(doc, plan, money) {
  const { budget, guests } = plan.input;
  byId(doc, 'summary').textContent =
    `Budget ${money.format(budget)} for ${guests} guests (about ${money.format(plan.perGuest)} per guest).`;
}

function renderScore(doc, evaluation) {
  const plural = evaluation.lateTasks === 1 ? '' : 's';
  byId(doc, 'plan-score').textContent = evaluation.score;
  byId(doc, 'score-title').textContent = scoreTitle(evaluation.score);
  byId(doc, 'score-detail').textContent =
    `${evaluation.daysToEvent} days until the event · ${evaluation.lateTasks} timeline task${plural} behind`;
  fill(byId(doc, 'score-reasons'), evaluation.reasons.map((reason) => el(doc, 'li', reason)));
}

function renderBudget(doc, rows, money) {
  fill(byId(doc, 'budget-body'), rows.map((row) => {
    const tr = el(doc, 'tr');
    const th = el(doc, 'th', row.category);
    th.scope = 'row';
    tr.append(th, el(doc, 'td', `${row.percent}%`), el(doc, 'td', money.format(row.amount)));
    return tr;
  }));
}

function renderTimeline(doc, timeline) {
  const line = (t) => `${t.due}: ${t.task}${t.late ? ' (start now, behind schedule)' : ''}`;
  fill(byId(doc, 'timeline'), timeline.map((t) => el(doc, 'li', line(t))));
}

function renderChecklist(doc, checklist) {
  fill(byId(doc, 'checklist'), checklist.map((item, i) => {
    const li = el(doc, 'li');
    const box = el(doc, 'input');
    box.type = 'checkbox';
    box.id = `vendor-${i}`;
    const label = el(doc, 'label', item.label);
    label.htmlFor = box.id;
    li.append(box, label);
    return li;
  }));
}

/**
 * Render the whole plan and reveal the results section.
 * @param {Document} doc
 * @param {import('./planner.js').Plan} plan
 */
export function renderPlan(doc, plan) {
  const money = moneyFormat();
  renderSummary(doc, plan, money);
  renderScore(doc, plan.evaluation);
  renderBudget(doc, plan.budget, money);
  renderTimeline(doc, plan.timeline);
  renderChecklist(doc, plan.checklist);
  fill(byId(doc, 'ideas'), plan.ideas.map((idea) => el(doc, 'li', idea)));
  byId(doc, 'results').hidden = false;
}

/**
 * Count how many form fields have a value.
 * @param {Document} doc
 * @returns {string} e.g. "3/5 complete"
 */
export function progressText(doc) {
  const complete = FIELDS.filter((field) => String(byId(doc, field).value).trim()).length;
  return `${complete}/${FIELDS.length} complete`;
}
