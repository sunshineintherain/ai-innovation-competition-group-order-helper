const rm = sen => 'RM' + (sen / 100).toFixed(2);
const el = (tag, text) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
};
const pretty = obj => JSON.stringify(obj, null, 2);
let draft = '';
let approvedSource = false;

export function renderImport(container, state, act) {
  container.innerHTML = `
    <section class="catalog-import" aria-label="Catalog review">
      <style>
        .catalog-import{max-width:1050px;margin:auto;color:inherit}
        .catalog-import *{box-sizing:border-box;min-width:0}
        .catalog-import h2{margin:0 0 .5rem;font-size:clamp(26px,4vw,38px)}
        .catalog-import h3,.catalog-import h4{margin:0 0 .55rem}
        .catalog-import p{line-height:1.55;margin:.4rem 0 .85rem}
        .catalog-import .ci-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;margin-top:18px}
        .catalog-import .ci-pane,.catalog-import .ci-directory{border:1px solid #d6ded4;background:white;border-radius:16px;padding:clamp(16px,2vw,25px)}
        .catalog-import .ci-directory{margin-top:16px}
        .catalog-import .ci-tools,.catalog-import .ci-dirrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .catalog-import .ci-dirrow{justify-content:space-between;padding:6px 0}
        .catalog-import button,.catalog-import .ci-file{font:inherit;cursor:pointer;border:1px solid #becdc3;background:#fff;color:#173c32;border-radius:8px;padding:.5rem .75rem;line-height:1.35}
        .catalog-import .ci-primary{background:#184d3d;color:white;border-color:#184d3d}
        .catalog-import button:disabled{opacity:.45;cursor:default}
        .catalog-import .ci-path{display:block;font:11px/1.5 monospace;color:#496055;overflow-wrap:anywhere}
        .catalog-import .ci-entry{padding:.55rem 0;border-bottom:1px solid #e4e8e4;overflow-wrap:anywhere}
        .catalog-import .ci-review{color:#855014;font-weight:650}
        .catalog-import label{display:block;font:inherit}
        .catalog-import textarea{width:100%;display:block;background:#fbfcfa;color:#172f26;border:1px solid #b9c9bf;border-radius:8px;padding:.7rem;font:13px/1.5 monospace;margin:.35rem 0 .7rem;resize:vertical}
        .catalog-import .ci-public{display:flex;gap:8px;align-items:flex-start;margin:.8rem 0;line-height:1.45}
        .catalog-import .ci-public input{width:auto;margin:.3rem 0 0}
        .catalog-import .ci-fix{width:100%;font:inherit;color:inherit;border:1px solid #b9c9bf;border-radius:6px;padding:.45rem;margin:.3rem 0 .6rem;background:white}
        .catalog-import input[type=file]{width:100%;font:inherit;font-size:.85rem;margin:.4rem 0 .7rem}
        .catalog-import .ci-download{display:inline-block;margin:.55rem 1rem .2rem 0;font-size:.85rem;color:#275744;text-decoration:underline}
        @media(max-width:720px){.catalog-import .ci-grid{grid-template-columns:1fr}}
      </style>
      <div class="ci-directory" data-directory></div>
      <div class="ci-grid">
        <section class="ci-pane">
          <h3>Import a merchant</h3>
          <p>Upload one public or fictional merchant as JSON. Prices and fees use integer sen. Times use Malaysia local time.</p>
          <label>Merchant JSON file<input data-upload type="file" accept=".json,application/json"></label>
          <div class="ci-tools"><button type="button" data-sample>Load review example</button></div>
          <a class="ci-download" href="/fixtures/demo.json" download="demo.json">Download valid sample</a>
          <a class="ci-download" href="/fixtures/needs-review.json" download="needs-review.json">Download review sample</a>
          <label>Editable source JSON<textarea data-source rows="13" spellcheck="false" placeholder="Paste or upload merchant JSON"></textarea></label>
          <button class="ci-primary" type="button" data-preview>Check terms</button>
        </section>
        <section class="ci-pane"><h3>Import preview</h3>
          <div data-result aria-live="polite"></div>
          <label class="ci-public" data-approval hidden><input type="checkbox">I have verified these are approved public merchant terms.</label>
          <button class="ci-primary" type="button" data-activate disabled>Confirm and activate</button>
          <p data-status role="status"></p>
        </section>
      </div>
    </section>`;
  const get = selector => container.querySelector(selector);
  const source = get('[data-source]');
  const result = get('[data-result]');
  const status = get('[data-status]');
  const activate = get('[data-activate]');
  const approval = get('[data-approval]');
  const check = approval.querySelector('input');
  let accepted = null;
  let revision = 0;
  source.value = draft;

  function invalidate(clearApproval = true) {
    revision++;
    accepted = null;
    activate.disabled = true;
    approval.style.display = 'none';
    if (clearApproval) approvedSource = false;
    check.checked = approvedSource;
    status.textContent = '';
    result.replaceChildren(el('p', 'Check the source to preview each term and its location.'));
  }
  function setSource(text) {
    draft = text;
    source.value = text;
    invalidate();
  }
  function entry(box, text, path) {
    const row = el('div', text);
    row.className = 'ci-entry';
    const key = el('small', path);
    key.className = 'ci-path';
    row.append(key);
    box.append(row);
  }
  function showMerchant(m) {
    result.replaceChildren(el('h4', 'Ready for confirmation'));
    entry(result, m.name + ' · ' + (m.demo ? 'Demo merchant' : 'Public merchant'), '$.name · $.demo');
    entry(result, 'Counter pickup at ' + m.point, '$.point');
    entry(result, 'Open ' + m.open + '–' + m.close + ' · order by ' + m.cutoff + ' · preparation ' + m.prep + ' min', '$.open · $.close · $.cutoff · $.prep');
    entry(result, 'Fee per order ' + rm(m.fee), '$.fee');
    m.items.forEach((item,i) => entry(result, item.name + ' · ' + rm(item.price), '$.items[' + i + '].name · $.items[' + i + '].price'));
    m.offers.forEach((o,i) => {
      const base = '$.offers[' + i + ']';
      entry(result, (m.demo ? 'Simulated offer · ' : 'Offer · ') + o.name + ' · ' + o.scope + ' orders', base + '.name · ' + base + '.scope');
      entry(result, 'Spend ' + rm(o.threshold) + ' in eligible items for ' + rm(o.discount) + ' off, capped at ' + rm(o.cap) + '.', base + '.thresholdBasis · .threshold · .discount · .cap');
      entry(result, 'Eligible items: ' + o.eligible.map(id => m.items.find(item => item.id === id).name).join(', '), base + '.eligible');
      entry(result, o.start.replace('T',' ') + ' to ' + o.end.replace('T',' ') + ' MYT · ' + (o.stack ? 'Stackable with compatible offers' : 'Exclusive offer'), base + '.start · .end · .stack');
    });
    if (!m.offers.length) entry(result, 'No offers', '$.offers');
    approval.style.display = m.demo ? 'none' : 'flex';
    activate.disabled = !m.demo && !check.checked;
  }
  async function preview() {
    invalidate(false);
    const token = revision;
    try {
      let raw;
      try { raw = JSON.parse(source.value); }
      catch { throw new Error('Needs review. Correct the JSON syntax and check the terms again.'); }
      const response = await fetch('/api/preview', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({raw})});
      if (!response.ok) throw new Error('The preview service could not check the file. Please retry.');
      const data = await response.json();
      if (token !== revision) return;
      if (data.issues.length || !data.merchant) {
        const title = el('h4','Needs review');
        title.className = 'ci-review';
        result.replaceChildren(title, el('p','Correct these terms in the source, then check again.'));
        const fixes = [];
        for (const x of data.issues) {
          entry(result, x.message, x.path);
          const match = /^\$\.offers\[(\d+)\]\.(thresholdBasis|start|end)$/.exec(x.path);
          if (!match) continue;
          const i = Number(match[1]);
          const key = match[2];
          const label = el('label', key === 'thresholdBasis' ? 'Verified threshold basis' : 'Verified validity ' + key + ' (MYT)');
          const control = el(key === 'thresholdBasis' ? 'select' : 'input');
          control.className = 'ci-fix';
          if (key === 'thresholdBasis') {
            const empty = el('option', 'Choose the verified basis');
            empty.value = '';
            const option = el('option', 'Eligible item subtotal before fees');
            option.value = 'eligible-subtotal';
            control.append(empty, option);
          } else control.type = 'datetime-local';
          label.append(control);
          result.append(label);
          fixes.push({i, key, control});
        }
        if (fixes.length) {
          const apply = el('button', 'Apply corrections and recheck');
          apply.type = 'button';
          apply.onclick = () => {
            for (const {i,key,control} of fixes) if (control.value) raw.offers[i][key] = control.value;
            setSource(pretty(raw));
            preview();
          };
          result.append(apply);
        }
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const details = el('details');
          details.append(el('summary', 'Inspect supplied terms'));
          for (const [field, value] of Object.entries(raw)) {
            if (field === 'items' || field === 'offers') {
              if (Array.isArray(value)) value.forEach((item,i) => {
                entry(details, JSON.stringify(item), '$.' + field + '[' + i + ']');
              });
            } else entry(details, String(value), '$.' + field);
          }
          result.append(details);
        }
      } else {
        accepted = data.merchant;
        showMerchant(accepted);
      }
    } catch (err) { if (revision === token) status.textContent = err.message; }
  }
  const directory = get('[data-directory]');
  const directories = state.mode ? [state.mode === 'demo'] : [true, false];
  for (const demo of directories) {
    directory.append(el('h4', demo ? 'Demo directory' : 'Public directory'));
    const members = (state.merchants || []).filter(m => m.demo === demo);
    if (!members.length) directory.append(el('p', demo ? 'No demo merchants.' : 'No public merchants have been activated.'));
    for (const m of members) {
      const row = el('div');
      row.className = 'ci-dirrow';
      const edit = el('button', 'Review terms');
      edit.type = 'button';
      edit.setAttribute('aria-label', 'Review terms for ' + m.name);
      edit.onclick = () => { setSource(pretty(m)); preview(); };
      row.append(el('span', m.name + ' · ' + m.point), edit);
      directory.append(row);
    }
  }
  source.oninput = () => { draft = source.value; invalidate(); };
  check.onchange = () => { approvedSource = check.checked; activate.disabled = !accepted || !check.checked; };
  get('[data-preview]').onclick = preview;
  get('[data-sample]').onclick = async () => {
    try {
      const res = await fetch('/fixtures/needs-review.json');
      if (!res.ok) throw new Error();
      setSource(await res.text());
      await preview();
    } catch { status.textContent = 'The example could not be loaded. Retry or upload a JSON file.'; }
  };
  get('[data-upload]').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 128 * 1024) { setSource(''); status.textContent = 'Select a JSON file of 128 KB or less.'; return; }
    try { setSource(await file.text()); await preview(); }
    catch { status.textContent = 'The file could not be read.'; }
  };
  activate.onclick = async () => {
    if (!accepted || activate.disabled) return;
    const raw = accepted;
    activate.disabled = true;
    try {
      await act('catalog', {raw});
      const activeStatus = status.isConnected ? status : document.querySelector('.catalog-import [data-status]');
      if (activeStatus) activeStatus.textContent = 'Catalog activated. Matching has been recalculated.';
    } catch (err) { status.textContent = err.message || 'Activation failed. Check the terms and retry.'; activate.disabled = false; }
  };
  invalidate(false);
}
