import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCatalog} from '../catalog.mjs';

const fixture = name => JSON.parse(readFileSync(new URL('../fixtures/' + name + '.json', import.meta.url), 'utf8'));
const paths = raw => validateCatalog(raw).issues.map(x => x.path);

test('demo and public sources share validation and remain distinguishable', () => {
  const demo = fixture('demo');
  const imported = validateCatalog(demo);
  assert.deepEqual(imported.issues, []);
  assert.deepEqual(imported.merchant, demo);
  demo.items[0].price = 700;
  assert.equal(imported.merchant.items[0].price, 1200);
  demo.demo = false;
  assert.equal(validateCatalog(demo).merchant.demo, false);
});
test('ambiguous threshold and absent end return precise source locations; verified repair activates', () => {
  const raw = fixture('needs-review');
  assert.deepEqual(paths(raw), ['$.offers[0].thresholdBasis','$.offers[0].end']);
  assert.equal(validateCatalog(raw).merchant, null);
  raw.offers[0].thresholdBasis = 'eligible-subtotal';
  raw.offers[0].end = '2026-12-01T14:00';
  assert.deepEqual(validateCatalog(raw), validateCatalog(fixture('demo')));
});
test('missing fees, fractional prices, unknown fee conditions and unknown eligible items fail closed', () => {
  const raw = fixture('demo');
  delete raw.fee;
  raw.items[0].price = 12.5;
  raw.offers[0].eligible.push('soup');
  raw.additionalFee = 'At peak hours';
  assert.deepEqual(new Set(paths(raw)), new Set(['$.fee','$.items[0].price','$.offers[0].eligible[2]','$.additionalFee']));
});
test('hours, impossible dates, reversed validity and undeclared stacking remain reviewable', () => {
  const raw = fixture('demo');
  raw.open = '08:65';
  raw.offers[0].start = '2026-02-30T10:00';
  delete raw.offers[0].stack;
  assert.ok(paths(raw).includes('$.open'));
  assert.ok(paths(raw).includes('$.offers[0].start'));
  assert.ok(paths(raw).includes('$.offers[0].stack'));
  raw.offers[0].start = raw.offers[0].end;
  assert.ok(paths(raw).includes('$.offers[0].end'));
});
test('identifiers are unique and malformed structures produce review findings', () => {
  const raw = fixture('demo');
  raw.items.push(structuredClone(raw.items[0]));
  raw.offers.push(null);
  assert.deepEqual(paths(raw), ['$.items[2].id', '$.offers[1]']);
  for (const malformed of [null, [], 'menu', 0]) assert.deepEqual(paths(malformed), ['$']);
});
