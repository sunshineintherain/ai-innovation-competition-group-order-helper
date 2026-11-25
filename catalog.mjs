const fields = {
  merchant: ['id', 'name', 'demo', 'point', 'open', 'close', 'cutoff', 'prep', 'fee', 'items', 'offers'],
  item: ['id', 'name', 'price'],
  offer: ['id', 'name', 'scope', 'thresholdBasis', 'threshold', 'discount', 'cap', 'eligible', 'start', 'end', 'stack'],
};
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const minuteStamp = /^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d$/;
function validStamp(value) {
  if (typeof value !== 'string' || !minuteStamp.test(value)) return false;
  const date = new Date(value + ':00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 16) === value;
}

export function validateCatalog(raw) {
  const issues = [];
  const issue = (path, message) => issues.push({path, message});
  function object(value, path, type) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      issue(path, 'Provide a JSON object.');
      return false;
    }
    for (const key of Object.keys(value)) {
      if (!fields[type].includes(key)) issue(path + '.' + key, 'Unrecognized field. Resolve this term before activation.');
    }
    return true;
  }
  function label(value, path) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 100 || /[\x00-\x1f\x7f]/.test(value)) {
      issue(path, 'Enter a public English label of 1–100 characters without surrounding spaces.');
    }
  }
  function identifier(value, path, used) {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(value) || ['constructor','prototype'].includes(value)) {
      issue(path, 'Use 1–40 lowercase letters, digits or hyphens, starting with a letter.');
      return;
    }
    if (used?.has(value)) issue(path, 'Use a unique identifier in this list.');
    used?.add(value);
  }
  function amount(value, path, min = 0, max = 1000000) {
    if (!Number.isSafeInteger(value) || value < min || value > max) issue(path, 'Enter an integer between ' + min + ' and ' + max + '. Money uses sen (100 sen = RM1).');
  }
  function list(value, path, min, max) {
    if (Array.isArray(value) && value.length >= min && value.length <= max) return true;
    issue(path, 'Provide a list with ' + min + '–' + max + ' entries.');
    return false;
  }
  if (!object(raw, '$', 'merchant')) return {issues, merchant:null};
  identifier(raw.id, '$.id');
  label(raw.name, '$.name');
  label(raw.point, '$.point');
  if (typeof raw.demo !== 'boolean') issue('$.demo', 'Set true for a demo merchant or false for an approved public merchant.');
  for (const key of ['open','close','cutoff']) {
    if (typeof raw[key] !== 'string' || !timePattern.test(raw[key])) issue('$.' + key, 'Enter a Malaysia local time in HH:mm format.');
  }
  if (raw.close <= raw.open) issue('$.close', 'Closing time must follow opening time on the same day.');
  if (raw.cutoff < raw.open || raw.cutoff > raw.close) issue('$.cutoff', 'Place the order cutoff within opening hours.');
  if (!Number.isInteger(raw.prep) || raw.prep < 0 || raw.prep > 1439) issue('$.prep', 'Enter preparation time in whole minutes from 0 to 1439.');
  amount(raw.fee, '$.fee');
  const items = new Set();
  if (list(raw.items, '$.items', 1, 100)) raw.items.forEach((item, i) => {
    const p = '$.items[' + i + ']';
    if (!object(item, p, 'item')) return;
    identifier(item.id, p + '.id', items);
    label(item.name, p + '.name');
    amount(item.price, p + '.price', 1);
  });
  const offers = new Set();
  if (list(raw.offers, '$.offers', 0, 8)) raw.offers.forEach((offer, i) => {
    const p = '$.offers[' + i + ']';
    if (!object(offer, p, 'offer')) return;
    identifier(offer.id, p + '.id', offers);
    label(offer.name, p + '.name');
    if (!['solo', 'group', 'any'].includes(offer.scope)) issue(p + '.scope', 'Specify solo, group or any.');
    if (offer.thresholdBasis !== 'eligible-subtotal') issue(p + '.thresholdBasis', 'Confirm the minimum spend counts eligible items before fees. Enter eligible-subtotal only if verified.');
    amount(offer.threshold, p + '.threshold');
    amount(offer.discount, p + '.discount', 1);
    amount(offer.cap, p + '.cap', 1);
    if (typeof offer.stack !== 'boolean') issue(p + '.stack', 'Set true if this rule may combine with other stackable rules, or false if exclusive.');
    if (list(offer.eligible, p + '.eligible', 1, 100)) {
      const seen = new Set();
      offer.eligible.forEach((id, j) => {
        if (!items.has(id) || seen.has(id)) issue(p + '.eligible[' + j + ']', 'Reference an existing item ID once.');
        seen.add(id);
      });
    }
    for (const key of ['start','end']) {
      if (!validStamp(offer[key])) issue(p + '.' + key, 'Confirm the validity ' + key + ' in Malaysia time (YYYY-MM-DDTHH:mm).');
    }
    if (validStamp(offer.start) && validStamp(offer.end) && offer.end <= offer.start) issue(p + '.end', 'Validity must end after the start time.');
  });
  return {issues, merchant:issues.length ? null : structuredClone(raw)};
}
