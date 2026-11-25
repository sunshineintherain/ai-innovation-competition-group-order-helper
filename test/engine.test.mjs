import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate} from '../engine.mjs';

const day = '2026-11-25';
const now = day + 'T12:10';
const rule = {
  id: 'lunch', name: 'Simulated lunch offer', scope: 'group', threshold: 2000, discount: 400,
  cap: null, eligible: ['set', 'bowl'], start: day + 'T11:00', end: day + 'T13:00', stack: false,
};
const cafe = {
  id: 'demo', name: 'Demo Café', point: 'Commons counter', open: '10:00', close: '15:00',
  cutoff: '14:00', prep: 10, fee: 0,
  items: [{id: 'set', name: 'Lunch set', price: 1200}, {id: 'bowl', name: 'Rice bowl', price: 1000}],
  offers: [rule],
};
const a = {id: 'a', alias: 'Panda', merchant: cafe.id, item: 'set', qty: 1, point: cafe.point,
  date: day, earliest: '12:20', latest: '12:50', minSaving: 0};
const b = {...a, id: 'b', alias: 'Finch', item: 'bowl', earliest: '12:35', latest: '13:00'};
const run = (requests = [a,b], merchant = cafe, at = now) => evaluate({requests, merchants: [merchant], now: at});

test('two lunch requests have a common slot, fair split and checkable deadline', () => {
  const {groups: [g], waiting, activity} = run();
  assert.equal(g.pickup, '12:35');
  assert.equal(g.until, '12:50');
  assert.equal(g.deadline, '12:25');
  assert.equal(g.offer, rule.name);
  assert.equal(g.total, 1800);
  assert.equal(g.saving, 400);
  assert.deepEqual(g.rows, [{id:'a', solo:1200, pay:982, saving:218}, {id:'b', solo:1000, pay:818, saving:182}]);
  assert.equal(Object.keys(waiting).length, 0);
  assert.match(activity.join(' '), /Compared 1 shared quote/);
});

test('editing or withdrawing a request releases it and enables a different pair', () => {
  const late = {...b, earliest:'12:55'};
  assert.match(run([a,late]).waiting.a, /do not overlap/);
  const c = {...b, id:'c', earliest:'12:30', latest:'12:45'};
  assert.deepEqual(run([a,late,c]).groups[0].ids, ['a','c']);
  assert.equal(run([a]).groups.length, 0);
});

test('threshold is inclusive to the sen; ineligible goods never count', () => {
  const exact = {...cafe, offers: [{...rule, threshold:2200}]};
  assert.equal(run([a,b], exact).groups[0].total, 1800);
  const oneShort = {...exact, items:[cafe.items[0], {...cafe.items[1],price:999}]};
  assert.match(run([a,b], oneShort).waiting.a, /RM0.01 more/);
  assert.match(run([a,b], {...cafe,offers:[{...rule,eligible:['set']}]}).waiting.a, /RM8.00 more/);
});

test('a third existing intention unlocks an otherwise unreachable offer', () => {
  const m = {...cafe,offers:[{...rule, threshold:3000}]};
  assert.equal(run([a,b],m).groups.length, 0);
  const g = run([b,{...b,id:'c'},a],m).groups[0];
  assert.deepEqual(g.ids,['a','b','c']);
  assert.equal(g.total,2800);
  assert.equal(g.rows.reduce((n,r) => n+r.pay,0),g.total);
});

test('solo discounts, per-person minimum savings and order fees affect the decision', () => {
  const solo = {...rule,id:'solo',scope:'solo',threshold:0,discount:300,eligible:['set']};
  assert.match(run([a,b], {...cafe,offers:[solo,rule]}).waiting.a, /RM0.82 more/);
  assert.match(run([{...a,minSaving:219},b]).waiting.a,/minimum saving/);
  const g = run([a,b],{...cafe,offers:[],fee:100}).groups[0];
  assert.deepEqual(g.rows.map(r=>r.pay),[1255,1045]);
  assert.equal(g.saving,100);
});

test('offer expiry, order cutoff and kitchen preparation constrain a proposal separately', () => {
  const m = {...cafe,cutoff:'12:24',offers:[{...rule,end:day+'T12:18'}]};
  assert.equal(run([a,b],m,day+'T12:18').groups[0].deadline,'12:18');
  assert.match(run([a,b],m,day+'T12:19').waiting.a,/expired/);
  assert.match(run([a,b],m,day+'T12:25').waiting.a,/cutoff/);
  assert.match(run([a,b],{...cafe,prep:45}).waiting.a,/preparation/);
  assert.equal(run([a,b],{...cafe,cutoff:'12:15'}).groups[0].deadline,'12:15');
});

test('discounts respect caps, stacking and eligible item capacities', () => {
  const one = {...rule, id:'one', name:'One', eligible:['set'], threshold:0, discount:1000, cap:900, stack:true};
  const two = {...one,id:'two', name:'Two'};
  assert.equal(run([a,b],{...cafe,offers:[one]}).groups[0].total,1300);
  assert.equal(run([a,b],{...cafe,offers:[one,two]}).groups[0].total,1000);
  assert.equal(run([a,b],{...cafe,offers:[one,{...two,stack:false}]}).groups[0].total,1300);
  const general = {...one,eligible:['set','bowl'],cap:null,discount:1500};
  const stacked = run([a,b],{...cafe,offers:[general,two]}).groups[0];
  assert.equal(stacked.total,0);
  assert.equal(stacked.offer,'One + Two');
});

test('the board selects disjoint pairs when separate discounts save more', () => {
  const all = [a,b,{...a,id:'c'},{...b,id:'d'}];
  const result = run(all).groups;
  assert.equal(result.length,2);
  assert.equal(new Set(result.flatMap(g=>g.ids)).size,4);
  assert.equal(result.reduce((total,g)=>total+g.saving,0),800);
  assert.deepEqual(result,run(all.reverse()).groups);
});

test('equal-saving plans choose earlier pickup when the pairs cannot coexist', () => {
  const later = {...b,id:'later',earliest:'12:45',latest:'12:50'};
  const earlier = {...b,id:'earlier',earliest:'12:25',latest:'12:30'};
  const groups = run([a,later,earlier]).groups;
  assert.equal(groups.length,1);
  assert.deepEqual(groups[0].ids,['a','earlier']);
  assert.equal(groups[0].pickup,'12:25');
});

test('point, service date, merchant and operating hours gate matching', () => {
  assert.match(run([a,{...b,point:'Library'}]).waiting.b,/pickup point/);
  assert.match(run([a,{...b,date:'2026-11-26'}]).waiting.b,/pickup date/);
  assert.match(run([a,{...b,date:'2026-11-24'}]).waiting.b,/expired/);
  assert.match(run([a,{...b,merchant:'other'}]).waiting.b,/merchant/);
  assert.match(run([a,b],cafe,day+'T09:00').waiting.a,/open/);
  assert.match(run([a,b],{...cafe,close:'12:32'}).waiting.b,/closing/);
});

test('largest-remainder ties are assigned in stable request ID order', () => {
  const m = {...cafe,offers:[{...rule,discount:1}]};
  const g = run([{...b,item:'set'},a],m).groups[0];
  assert.deepEqual(g.rows.map(r=>r.pay),[1200,1199]);
  assert.equal(g.rows.reduce((n,r)=>n+r.pay,0),2399);
});
