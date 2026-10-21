import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_TYPES, parseDate, validateInput, allocateBudget, buildTimeline, buildChecklist, buildIdeas, buildPlan, evaluatePlan } from '../src/planner.js';
import { sanitizeText, buildPrompt, requestIdeas } from '../src/ai.js';

const TODAY = '2026-10-21';
const good = { type: 'wedding', guests: '120', budget: '500000', date: '2027-03-01', theme: 'Rustic' };

test('parseDate accepts real dates only', () => {
  assert.ok(parseDate('2027-02-28'));
  assert.equal(parseDate('2027-02-30'), null);
  assert.equal(parseDate('01/02/2027'), null);
  assert.equal(parseDate(undefined), null);
});

test('validateInput accepts good input and normalises it', () => {
  const r = validateInput(good, TODAY);
  assert.equal(r.ok, true);
  assert.equal(r.value.guests, 120);
});

test('validateInput rejects bad values', () => {
  const r = validateInput({ type: 'x', guests: '0', budget: '-5', date: '2020-01-01', theme: 'a'.repeat(61) }, TODAY);
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['budget', 'date', 'guests', 'theme', 'type']);
  assert.equal(validateInput({ ...good, type: '__proto__' }, TODAY).ok, false);
  assert.equal(validateInput({ ...good, guests: '2.5' }, TODAY).ok, false);
});

test('every event type budget split totals 100%', () => {
  for (const [name, cfg] of Object.entries(EVENT_TYPES)) {
    assert.equal(Object.values(cfg.split).reduce((a, b) => a + b, 0), 100, name);
  }
});

test('allocateBudget sums exactly to the total', () => {
  for (const total of [1, 7, 999, 100001, 123457]) {
    for (const type of Object.keys(EVENT_TYPES)) {
      assert.equal(allocateBudget(type, total).reduce((s, r) => s + r.amount, 0), total);
    }
  }
});

test('buildTimeline is sorted, ends on event day and flags late tasks', () => {
  const t = buildTimeline('wedding', '2026-12-01', TODAY);
  assert.deepEqual(t.map((x) => x.due), [...t.map((x) => x.due)].sort());
  assert.equal(t.at(-1).due, '2026-12-01');
  assert.ok(t.some((x) => x.late));
  assert.ok(t.every((x) => x.due >= TODAY));
});

test('checklist scales with guest count', () => {
  assert.ok(buildChecklist('birthday', 20).some((c) => c.label.includes('20')));
  assert.ok(buildChecklist('community', 300).some((c) => c.label.includes('crowd')));
  assert.ok(!buildChecklist('community', 100).some((c) => c.label.includes('crowd')));
});

test('ideas include theme when given', () => {
  assert.ok(buildIdeas('birthday', 'Space')[0].includes('Space'));
  assert.equal(buildIdeas('birthday', '').length, 3);
});

test('buildPlan computes per-guest cost', () => {
  const plan = buildPlan(validateInput(good, TODAY).value, TODAY);
  assert.equal(plan.perGuest, Math.floor(500000 / 120));
});

test('evaluatePlan returns an actionable readiness score', () => {
  const input = validateInput(good, TODAY).value;
  const evaluation = evaluatePlan(input, TODAY);
  assert.ok(evaluation.score >= 0 && evaluation.score <= 100);
  assert.equal(evaluation.daysToEvent, 131);
  assert.ok(Array.isArray(evaluation.reasons));
  assert.equal(buildPlan(input, TODAY).evaluation.score, evaluation.score);
});

test('sanitizeText strips control chars and truncates', () => {
  assert.equal(sanitizeText('a\u0000b\u0007c'), 'abc');
  assert.equal(sanitizeText('x'.repeat(50), 10).length, 10);
  assert.equal(sanitizeText(null), '');
});

test('buildPrompt handles empty theme', () => {
  assert.ok(buildPrompt({ ...good, theme: '' }).includes('no specific theme'));
});

test('requestIdeas returns sanitised text from the API', async () => {
  const fetchImpl = async (_url, opts) => {
    assert.ok(opts.headers['x-goog-api-key']);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: ' 1. Idea\u0000 ' }] } }] }) };
  };
  assert.equal(await requestIdeas({ apiKey: 'k', input: good, fetchImpl }), '1. Idea');
});

test('requestIdeas throws on missing key, HTTP error and empty reply', async () => {
  await assert.rejects(requestIdeas({ apiKey: '', input: good }), /required/);
  await assert.rejects(requestIdeas({ apiKey: 'k', input: good, fetchImpl: async () => ({ ok: false, status: 500 }) }), /500/);
  await assert.rejects(requestIdeas({ apiKey: 'k', input: good, fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /empty/);
});
