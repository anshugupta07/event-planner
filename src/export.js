/** Plain-text export of a plan, kept pure so it can be unit-tested. */

const LATE_MARKER = ' (behind schedule)';

const formatBudget = (rows) => rows.map((row) => `${row.category}: ${row.percent}% (${row.amount})`);
const formatTimeline = (tasks) => tasks.map((task) => (
  `${task.due}: ${task.task}${task.late ? LATE_MARKER : ''}`
));
const formatList = (items) => items.map((item) => `- ${item}`);

/**
 * @param {import('./planner.js').Plan} plan
 * @returns {string}
 */
export function formatPlanText(plan) {
  const { input, evaluation } = plan;
  return [
    'CELEBRATION & EVENT PLANNER',
    `Event: ${input.type} | Date: ${input.date} | Guests: ${input.guests}`,
    `Readiness score: ${evaluation.score}/100`,
    '',
    'BUDGET',
    ...formatBudget(plan.budget),
    '',
    'TIMELINE',
    ...formatTimeline(plan.timeline),
    '',
    'VENDOR CHECKLIST',
    ...formatList(plan.checklist.map((item) => item.label)),
    '',
    'IDEAS',
    ...formatList(plan.ideas),
  ].join('\n');
}
