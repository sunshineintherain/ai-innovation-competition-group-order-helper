import { renderImport } from './import.mjs';

const main = document.querySelector('#main');
const notice = document.querySelector('#notice');
const aliases = 'Aster Birch Clover Dune Echo Fern Grove Hazel Iris Jade Kite Lark'.split(' ');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => 'RM' + (value / 100).toFixed(2);
const itemName = (merchant, id) => merchant?.items.find(i => i.id === id)?.name || id;
const fmtDate = date => new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' }).format(new Date(date.slice(0,10) + 'T00:00:00Z'));
const dateTime = value => fmtDate(value) + ' · ' + value.slice(11,16) + ' MYT';
const options = (values, selected) => values.map(([value,label]) => `<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(label)}</option>`).join('');
const lookupMerchant = id => state.merchants.find(m => m.id === id);
const lookupRequest = id => state.requests.find(r => r.id === id);
let state, version = 0, busy = false, noticeTimer, draft, questions = [], parseMode = '', editing = false;
let page = '', parseText = '';
const view = () => ['board','catalog','controls','request'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'board';

async function api(path, body) {
  const res = await fetch(path, body === undefined ? {cache:'no-store'} : {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'The request could not be completed.');
  return data;
}
function notify(message, error = false) {
  notice.textContent = message;
  notice.className = error ? 'show error' : 'show';
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notice.className = '', error ? 8500 : 4500);
}
async function act(type, payload = {}) {
  version++;
  state = await api('/api/action', { type, ...payload });
  version++;
  render();
  return state;
}
function go(next) {
  if (view() === next) render();
  else location.hash = next;
}
function stamp() {
  return `<div class="dateline"><span class="dot"></span>${state.mode === 'demo' ? 'Demo session' : 'Live session'} <span class="rule"></span> ${escape(dateTime(state.now))}</div>`;
}
function card(group) {
  const first = lookupRequest(group.ids[0]);
  const merchant = lookupMerchant(first.merchant);
  const rules = merchant.offers.filter(rule => group.offerIds ? group.offerIds.includes(rule.id) : group.offer === rule.name);
  const done = group.status === 'complete';
  return `<article class="match ${done ? 'complete' : ''}" aria-label="${done ? 'Confirmed group summary' : 'Proposed group'}">
    <div class="match-head"><div><div class="eyebrow">${done ? 'Confirmed group summary' : 'Group recommendation'}</div><h3>${escape(merchant.name)}</h3></div><span class="pill">${done ? '✓ Confirmed' : 'Awaiting confirmation'}</span></div>
    <div class="meta">${merchant.demo ? 'Demo merchant · ' : ''}${escape(merchant.point)} · ${escape(fmtDate(first.date))}</div>
    <div class="group-facts"><div><small>Shared pickup window</small><strong>${escape(group.pickup)}–${escape(group.until)}</strong></div><div><small>Confirm by (MYT)</small><strong>${escape(group.deadline)}</strong></div></div>
    <div class="offer"><span class="offer-mark" aria-hidden="true">%</span><div><small>${merchant.demo ? 'Simulated offer' : 'Applied offer'}</small><b>${escape(group.offer || 'Shared order fees')}</b>${rules.map(rule => `<small>${money(rule.discount)} off when eligible items reach ${money(rule.threshold)} · cap ${money(rule.cap ?? rule.discount)}</small>`).join('')}</div></div>
    <div class="table-wrap"><table><caption class="sr">Price comparison in Malaysian ringgit</caption><thead><tr><th>Member</th><th>Best solo</th><th>Group pay</th><th>Saved</th></tr></thead><tbody>${group.rows.map(row => `<tr><th>${escape(lookupRequest(row.id).alias)}${done ? `<small class="line-item">${escape(lookupRequest(row.id).qty)} × ${escape(itemName(merchant,lookupRequest(row.id).item))}</small>` : ''}</th><td>${money(row.solo)}</td><td>${money(row.pay)}</td><td class="positive">${money(row.saving)}</td></tr>`).join('')}<tr class="total"><th>Total</th><td>${money(group.total+group.saving)}</td><td>${money(group.total)}</td><td>${money(group.saving)}</td></tr></tbody></table></div>
    <p class="reason">${escape(group.reason)}</p>
    <details><summary>How the split works</summary><p>Each member’s solo price includes their best eligible discount and order fee. The group total is shared in proportion to item subtotals. Remaining sen go to the largest fractional shares, with request ID breaking ties.</p></details>
    <div class="confirm-zone"><div class="eyebrow">${done ? 'Pickup summary' : 'Member confirmations'} · ${group.confirmed.length}/${group.ids.length}</div>${done ? `<p>Meet at <b>${escape(merchant.point)}</b> at <b>${escape(group.pickup)} MYT</b>. Order fee <b>${money(merchant.fee)}</b>. Group total <b>${money(group.total)}</b>. This summary records the agreement only.</p>` : ''}<div class="button-row">${group.ids.map(id => group.confirmed.includes(id) ? `<span class="signed">✓ ${escape(lookupRequest(id).alias)} confirmed</span>` : `<button class="btn small" data-cmd="confirm" data-key="${escape(group.key)}" data-id="${escape(id)}">Confirm for ${escape(lookupRequest(id).alias)}</button>`).join('')}</div></div>
  </article>`;
}
function requestCard(r) {
  const m = lookupMerchant(r.merchant);
  const reason = state.waiting[r.id];
  return `<li class="request-card"><div class="request-top"><span class="avatar">${escape(r.alias.slice(0,1))}</span><div><h4>${escape(r.alias)}</h4><small>${reason ? 'Waiting' : 'In a group'}</small></div><button class="edit-link" data-cmd="edit" data-id="${escape(r.id)}" aria-label="Edit ${escape(r.alias)}">Edit</button></div><p>${escape(r.qty)} × ${escape(itemName(m,r.item))}</p><small>${escape(m?.name || r.merchant)} · ${escape(fmtDate(r.date))}</small><div class="window">${escape(r.earliest)}–${escape(r.latest)} MYT</div>${reason ? `<p class="wait-reason">${escape(reason)}</p>` : ''}</li>`;
}
function board() {
  const totalSavings = state.groups.reduce((sum,g) => sum + g.saving, 0);
  return `<section class="hero"><div class="hero-content">${stamp()}<h1>The <em>lunch</em> board<span>.</span></h1><p>Find a shared pickup time and see what each student saves.</p><button class="btn citrus" data-cmd="new">New request <span aria-hidden="true">↗</span></button></div>
    <div class="ticket-art" aria-label="${escape(state.mode === 'demo' ? 'Simulated' : 'Current')} board totals"><div class="back-ticket" aria-hidden="true"></div><div class="ticket"><div class="ticket-cap">GROUP SAVINGS <span>MYR</span></div><div class="ticket-amount">${money(totalSavings)}</div><div class="ticket-perf"></div><div class="ticket-bottom"><div><small>${state.mode === 'demo' ? 'Simulated results' : 'Current results'}</small><strong>${state.groups.length} matched group${state.groups.length === 1 ? '' : 's'}</strong></div><span class="barcode" aria-hidden="true"></span></div></div></div></section>
    <div class="board-layout"><section><div class="section-title"><h2>Group matches</h2><span class="count">${state.groups.length}</span></div>${state.groups.length ? state.groups.map(card).join('') : `<div class="empty"><h3>Waiting for a match</h3><p>${state.requests.length ? 'The assistant will check again as requests or merchant rules change. See each request for its current status.' : 'Add a lunch request to start checking pickup times and savings.'}</p></div>`}</section>
    <aside><div class="section-title"><h2>Requests</h2><span class="count">${state.requests.length}</span></div><ol class="request-list">${state.requests.map(requestCard).join('')}</ol>${state.requests.length ? '' : '<p class="empty">No requests on this board yet.</p>'}<button class="add-row" data-cmd="new">+ Add a request</button>
    <section class="activity"><div class="eyebrow"><span class="dot"></span> Agent activity</div><ol>${state.activity.slice(0,5).map(x => `<li>${escape(x)}</li>`).join('') || '<li>Waiting for a request.</li>'}</ol>${state.activity.length > 5 ? `<details><summary>Earlier actions (${state.activity.length - 5})</summary><ol>${state.activity.slice(5).map(x => `<li>${escape(x)}</li>`).join('')}</ol></details>` : ''}</section></aside></div>`;
}
function newDraft(r) {
  editing = Boolean(r);
  const m = state.merchants[0];
  draft = r ? {...r} : {id:crypto.randomUUID(), alias:aliases.find(name => !state.requests.some(i => i.alias === name)) || aliases[0], merchant:m?.id || '', item:'', qty:1,point:m?.point || '',date:state.now.slice(0,10),earliest:'',latest:'',minSaving:0};
  questions = []; parseText = ''; parseMode = '';
}
function requestForm() {
  if (!draft) newDraft();
  const m = lookupMerchant(draft.merchant);
  if (!state.merchants.length) return `<div class="page-head"><h1>New request</h1><p>Activate a merchant in the catalog before publishing a request.</p><a class="btn solid" href="#catalog">Open merchant catalog</a></div>`;
  return `<div class="page-head"><a class="back" href="#board">← Board</a><h1>${editing ? 'Edit request' : 'New request'}</h1><p>Choose your lunch and the time you can collect it.</p></div><div class="form-layout"><section class="panel"><h2>Lunch request</h2><label for="intent">Describe your lunch in English</label><small id="intent-hint">Use a fictional alias and public pickup details only.</small><textarea aria-describedby="intent-hint" maxlength="700" id="intent" placeholder="I want the RM12 lunch set from Demo Café. I can pick it up between 12:20 and 12:50 today.">${escape(parseText)}</textarea><div class="parse-tools"><button class="btn" data-cmd="parse">Read my request</button><small>${escape(parseMode || state.language)}</small></div>${questions.length ? `<div class="question" role="status">${questions.map(q => `<p>${escape(q)}</p>`).join('')}</div>` : ''}
    <form id="request-form"><h3>Review the details</h3><div class="fields"><label>Student alias<select name="alias">${options(aliases.map(x=>[x,x]),draft.alias)}</select></label><label>Merchant<select name="merchant" required><option value="">Choose a merchant</option>${options(state.merchants.map(v=>[v.id,v.name]),draft.merchant)}</select></label><label class="wide">Menu item<select name="item" required><option value="">Choose an item</option>${options((m?.items || []).map(i=>[i.id,i.name+' · '+money(i.price)]),draft.item)}</select></label><label>Quantity<input name="qty" type="number" min="1" max="20" required value="${escape(draft.qty)}"></label><label>Minimum saving (RM)<input name="minimum" type="number" min="0" max="10000" step=".01" required value="${(draft.minSaving/100).toFixed(2)}"></label><label>Pickup point<select name="point" required><option value="">Choose a point</option>${options(m ? [[m.point,m.point]] : [],draft.point)}</select></label><label>Pickup date<input name="date" type="date" required value="${escape(draft.date)}"></label><label>Earliest pickup (MYT)<input type="time" name="earliest" required value="${escape(draft.earliest)}"></label><label>Latest pickup (MYT)<input type="time" name="latest" required value="${escape(draft.latest)}"></label></div><div class="form-actions"><button class="btn solid" type="submit">${editing ? 'Save changes' : 'Publish request'}</button>${editing ? '<button type="button" class="edit-link" data-cmd="withdraw">Withdraw request</button>' : '<a class="edit-link" href="#board">Cancel</a>'}</div></form></section>
    <aside class="panel info">${m ? `<div class="eyebrow">Merchant timings</div><h2>${escape(m.name)}</h2><p>${m.demo ? 'Demo merchant · ' : ''}${escape(m.point)}</p><dl><dt>Opening hours</dt><dd>${escape(m.open)}–${escape(m.close)}</dd><dt>Order cutoff</dt><dd>${escape(m.cutoff)} MYT</dd><dt>Preparation time</dt><dd>${escape(m.prep)} min</dd><dt>Fee per order</dt><dd>${money(m.fee)}</dd></dl><p>Pickup windows describe when students can arrive. The assistant checks whether the merchant can prepare the order in time.</p>` : '<h2>Merchant timings</h2><p>Select a merchant to see opening hours, the order cutoff and preparation time.</p>'}</aside></div>`;
}
function controls() {
  return `<div class="page-head"><h1>Demo controls</h1><p>Replay the lunch scenario or change the time used to check offers and deadlines.</p></div><div class="panel control"><h2>Lunch scenario</h2><p>Reset the simulated board to 1 December 2026 at 12:10 MYT. Aster and Birch have overlapping pickup windows at Demo Café.</p><div class="button-row"><button class="btn solid" data-cmd="reset">Reset demo</button><a class="btn" href="/slides.html">Presentation slides</a></div><hr><h2>Board clock</h2><p>${escape(dateTime(state.now))} · ${escape(state.mode)} mode</p>${state.mode === 'demo' ? `<form id="clock-form"><label>Simulated Malaysia time<input type="datetime-local" required name="now" value="${escape(state.now.slice(0,16))}"></label><button class="btn" type="submit">Update time</button></form>` : ''}<hr><h2>Public merchant board</h2><p>Open the separate board for approved public merchants. It uses the current Malaysia time and restores its own requests.</p><button class="btn" data-cmd="live">Open public board</button></div>`;
}
function render() {
  if (!state) return;
  const next = view();
  if (page === 'request' && next !== 'request') draft = null;
  page = next;
  document.querySelectorAll('[data-tab]').forEach(a => a.dataset.tab === page ? a.setAttribute('aria-current','page') : a.removeAttribute('aria-current'));
  document.querySelector('#board-status').textContent = state.mode === 'demo' ? 'Demo workspace' : 'Live workspace';
  main.innerHTML = page === 'board' ? board() : page === 'request' ? requestForm() : page === 'controls' ? controls() : '<div class="page-head"><h1>Merchant catalog</h1><p>Review the menu, fees and offer terms used to calculate a match.</p></div><div id="catalog-panel" class="panel catalog"></div>';
  if (page === 'catalog') renderImport(main.querySelector('#catalog-panel'),state,act);
}
function capture() {
  const form = main.querySelector('#request-form');
  if (!form) return;
  const f = Object.fromEntries(new FormData(form));
  const [rm, sen = ''] = f.minimum.split('.');
  Object.assign(draft, {alias:f.alias,merchant:f.merchant,item:f.item,point:f.point,qty:Number(f.qty),date:f.date,earliest:f.earliest,latest:f.latest,minSaving:Number(rm)*100 + Number(sen.padEnd(2,'0'))});
  parseText = main.querySelector('#intent').value;
}
main.addEventListener('change', e => {
  if (e.target.name !== 'merchant' || !main.querySelector('#request-form')?.contains(e.target)) return;
  capture();
  draft.item = ''; draft.point = lookupMerchant(draft.merchant)?.point || '';
  render();
});
async function run(fn) {
  if (busy) return;
  busy = true;
  try { await fn(); } catch(e) { notify(e.message, true); } finally { busy = false; }
}
main.addEventListener('click', e => {
  const btn = e.target.closest('[data-cmd]');
  if (!btn) return;
  run(async () => {
    const cmd = btn.dataset.cmd;
    if (cmd === 'new' || cmd === 'edit') { newDraft(cmd==='edit' ? lookupRequest(btn.dataset.id) : null); go('request'); }
    if (cmd === 'parse') {
      capture();
      if (!parseText.trim()) { main.querySelector('#intent').focus(); notify('Describe your lunch first, or fill in the details below.'); return; }
      const result = await api('/api/parse', {text:parseText,merchant:draft.merchant});
      const fields = result.fields || {};
      for (const key of ['merchant','item','point','date','earliest','latest']) draft[key] = fields[key] ?? '';
      draft.qty = fields.qty ?? 1;
      draft.minSaving = fields.minSaving ?? 0;
      questions = result.questions || []; parseMode = result.mode;
      render(); notify(questions.length ? 'Review the missing details.' : 'Request understood. Review the details before publishing.');
    }
    if (cmd === 'confirm') { await act('confirm',{id:btn.dataset.id,key:btn.dataset.key}); notify('Member confirmation recorded.'); }
    if (cmd === 'withdraw') { await act('withdraw',{id:draft.id}); go('board'); notify('Request withdrawn. The board has been checked again.'); }
    if (cmd === 'reset') { await act('reset'); go('board'); notify('Lunch demo restored.'); }
    if (cmd === 'live') { await act('live'); go('board'); }
  });
});
main.addEventListener('submit', e => {
  if (!['request-form','clock-form'].includes(e.target.id)) return;
  e.preventDefault();
  run(async () => {
    if (e.target.id === 'clock-form') {await act('clock',{now:new FormData(e.target).get('now')}); go('board'); return;}
    capture();
    if(draft.earliest > draft.latest) throw new Error('Latest pickup must be at or after earliest pickup.');
    await act('save',{request:{...draft}}); go('board'); notify('Request saved. Matches are up to date.');
  });
});
window.addEventListener('hashchange', () => {render(); window.scrollTo(0,0);});
async function refresh() {
  if (busy) return;
  const currentVersion = version;
  try {
    const next = await api('/api/state');
    if (version !== currentVersion || busy) return;
    const changed = JSON.stringify(state) !== JSON.stringify(next);
    state = next;
    if ((page === '' || page === 'board') && changed) render();
  } catch(e) {
    if (!state) main.innerHTML = '<div class="empty"><h2>The board could not open</h2><p>Check the local server and reload this page.</p></div>';
    notify(e.message,true);
  }
}
await refresh();
setInterval(refresh, 4000);

