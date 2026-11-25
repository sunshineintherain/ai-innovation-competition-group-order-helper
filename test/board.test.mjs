import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,transact,view,localNow} from '../board.mjs';
import {interpret} from '../intent.mjs';

test('partial consent expires after a price change, stale clicks fail, and repeated save is idempotent',()=>{
 const s=seed(),old=s.groups[0].key;
 transact(s,{type:'confirm',key:old,id:'a'});
 const raw=structuredClone(s.directories.demo[0]);raw.items[0].price=1300;
 transact(s,{type:'catalog',raw});
 assert.notEqual(s.groups[0].key,old);assert.deepEqual(s.groups[0].confirmed,[]);
 assert.throws(()=>transact(s,{type:'confirm',key:old,id:'b'}),/changed/);
 const updated=s.groups[0].key;
 transact(s,{type:'save',request:{...s.requests[0]}});
 assert.equal(s.groups[0].key,updated);
 assert.equal(s.groups[0].total,1900);
});
test('withdrawal releases a confirmed group, a compatible newcomer rematches',()=>{
 const s=seed(),key=s.groups[0].key;
 for(const id of ['a','b']) transact(s,{type:'confirm',id,key});
 transact(s,{type:'clock',now:'2026-12-01T12:11'});
 assert.equal(s.groups[0].status,'complete');
 const copy={...s.requests[1],alias:'Clover',id:'c'};
 transact(s,{type:'withdraw',id:'b'});assert.equal(s.groups.length,0);
 transact(s,{type:'save',request:copy});assert.deepEqual(s.groups[0].ids,['a','c']);
 assert.deepEqual(s.groups[0].confirmed,[]);
});
test('changed window clears consent and an incompatible student remains waiting',()=>{
 const s=seed();transact(s,{type:'confirm',key:s.groups[0].key,id:'a'});
 transact(s,{type:'save',request:{...s.requests[1],earliest:'12:55'}});
 assert.match(s.waiting.a,/overlap/);
 transact(s,{type:'save',request:{...s.requests[1],id:'c',alias:'Clover',earliest:'12:35',latest:'12:50'}});
 assert.deepEqual(s.groups[0].ids,['a','c']);assert.ok(s.waiting.b);
});
test('expired offer and elapsed proposal deadline invalidate old confirmation keys',()=>{
 const s=seed(),old=s.groups[0].key;
 transact(s,{type:'confirm',key:old,id:'a'});
 transact(s,{type:'clock',now:'2026-12-01T12:26'});
 assert.notEqual(s.groups[0].key,old);assert.deepEqual(s.groups[0].confirmed,[]);
 const raw=structuredClone(s.directories.demo[0]);raw.offers[0].end='2026-12-01T12:27';
 transact(s,{type:'catalog',raw});transact(s,{type:'clock',now:'2026-12-01T12:28'});
 assert.equal(s.groups.length,0);assert.match(s.waiting.a,/expired/);
});
test('public and demo catalogs and requests remain isolated across resets',()=>{
 let s=seed();
 const raw={...structuredClone(s.directories.demo[0]),id:'sample-public',name:'Sample Public Fixture',demo:false};
 transact(s,{type:'catalog',raw});
 assert.equal(view(s).merchants.length,1);transact(s,{type:'live'});assert.equal(s.requests.length,0);
 const req={...seed().requests[0],merchant:raw.id,date:localNow().slice(0,10)};
 transact(s,{type:'save',request:req});
 s=transact(s,{type:'reset'});assert.equal(view(s).merchants[0].id,'cafe');
 transact(s,{type:'live'});assert.equal(s.requests.length,1);assert.equal(s.requests[0].merchant,raw.id);
});
test('language parsing grounds the sample in catalog and asks for missing times',async()=>{
 const state=view(seed());
 const r=await interpret({text:'I want the RM12 lunch set from Demo Café. I can pick it up between 12:20 and 12:50 today.'},state);
 assert.deepEqual(r.fields,{merchant:'cafe',item:'lunch',point:'Atrium counter',earliest:'12:20',latest:'12:50',date:'2026-12-01',qty:1});assert.deepEqual(r.questions,[]);
 const q=await interpret({text:'Two rice bowls from Demo Café today.'},state);
 assert.equal(q.fields.qty,2);assert.equal(q.questions.length,2);
 const u=await interpret({text:'Lunch from Unknown Café today.'},state);assert.equal(u.fields.merchant,undefined);
});
test('unreachable local model returns a usable structured draft',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Offline');});
 const r=await interpret({text:'Lunch set today'},view(seed()),'test-model');
 assert.match(r.mode,/unavailable/);assert.equal(r.fields.item,'lunch');
});

