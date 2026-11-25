// Wall-clock values use the merchant's Malaysia service day, with minute precision.
const minute = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const clock = minutes => [Math.floor(minutes / 60), minutes % 60].map(n => String(n).padStart(2, '0')).join(':');
const rm = sen => 'RM' + (sen / 100).toFixed(2);
const sum = numbers => numbers.reduce((total, n) => total + n, 0);
const byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

function allocate(total, lines) {
  const gross = sum(lines.map(line => line.amount));
  // A catalogue with free items can still charge an order fee.
  const divisor = BigInt(gross || lines.length);
  const shares = lines.map(({id, amount}, index) => {
    const product = BigInt(total) * BigInt(gross ? amount : 1);
    return {id, index, pay: Number(product / divisor), remainder: product % divisor};
  });
  const spare = total - sum(shares.map(share => share.pay));
  shares.sort((a, b) => a.remainder === b.remainder ? byId(a, b) : a.remainder > b.remainder ? -1 : 1);
  for (let i = 0; i < spare; i++) shares[i].pay++;
  return shares.sort((a, b) => a.index - b.index).map(share => share.pay);
}

// Assign stackable fixed discounts to eligible goods. Residual paths allow a
// broad voucher to move to another item when a narrower voucher needs its item.
function stackDiscount(rules, lines) {
  if (!rules.length) return {value: 0, offers: []};
  const end = 1 + rules.length + lines.length;
  const edges = Array.from({length: end + 1}, () => []);
  function edge(from, to, capacity) {
    const forward = {to, left: capacity, reverse: edges[to].length};
    edges[to].push({to: from, left: 0, reverse: edges[from].length});
    edges[from].push(forward);
    return forward;
  }
  const vouchers = rules.map(({offer, value}, j) => {
    const source = edge(0, j + 1, value);
    lines.forEach((line, i) => {
      if (offer.eligible.includes(line.item)) edge(j + 1, 1 + rules.length + i, line.amount);
    });
    return source;
  });
  lines.forEach((line, i) => edge(1 + rules.length + i, end, line.amount));
  let value = 0;
  while (true) {
    const path = new Map([[0, null]]);
    const queue = [0];
    for (let i = 0; i < queue.length && !path.has(end); i++) {
      const from = queue[i];
      for (const arc of edges[from]) {
        if (arc.left > 0 && !path.has(arc.to)) {
          path.set(arc.to, {from, arc});
          queue.push(arc.to);
        }
      }
    }
    if (!path.has(end)) break;
    let flow = Infinity;
    for (let at = end; at !== 0; at = path.get(at).from) flow = Math.min(flow, path.get(at).arc.left);
    for (let at = end; at !== 0; at = path.get(at).from) {
      const arc = path.get(at).arc;
      arc.left -= flow;
      edges[at][arc.reverse].left += flow;
    }
    value += flow;
  }
  return {value, offers: rules.filter((rule, i) => vouchers[i].left < rule.value).map(rule => rule.offer)};
}

function quote(merchant, lines, now) {
  const scope = lines.length === 1 ? 'solo' : 'group';
  const applicable = merchant.offers.filter(offer => offer.scope === 'any' || offer.scope === scope);
  const active = applicable.filter(offer => offer.start <= now && now <= offer.end);
  let shortfall = Infinity;
  const qualified = [];
  for (const offer of active) {
    const eligible = sum(lines.filter(line => offer.eligible.includes(line.item)).map(line => line.amount));
    if (eligible < offer.threshold) {
      shortfall = Math.min(shortfall, offer.threshold - eligible);
      continue;
    }
    const value = Math.min(eligible, offer.discount, offer.cap ?? Infinity);
    if (value > 0) qualified.push({offer, value});
  }
  let best = {value: 0, offers: []};
  for (const {offer, value} of qualified) {
    if (value > best.value) best = {value, offers: [offer]};
  }
  const combinable = qualified.filter(rule => rule.offer.stack);
  if (combinable.length > 1) {
    const stack = stackDiscount(combinable, lines);
    if (stack.value > best.value) best = stack;
  }
  return {
    total: sum(lines.map(line => line.amount)) - best.value + merchant.fee,
    offers: best.offers,
    shortfall,
    expired: applicable.length > 0 && applicable.every(offer => offer.end < now),
  };
}

function inspect(request, merchant, now) {
  if (!merchant) return 'This merchant is unavailable.';
  const item = merchant.items.find(item => item.id === request.item);
  if (!item) return 'This item is unavailable.';
  if (request.point !== merchant.point) return 'This pickup point is incompatible with the merchant.';
  if (request.date < now.slice(0,10)) return 'Your pickup window has expired.';
  if (request.date > now.slice(0,10)) return 'Waiting for the merchant to accept orders on your pickup date.';
  if (now.slice(11) < merchant.open) return 'Waiting for the merchant to open.';
  if (now.slice(11) > merchant.cutoff) return 'The order cutoff has passed.';
  if (request.earliest > request.latest) return 'The pickup window ends before it starts.';
  if (now.slice(11) > request.latest) return 'Your pickup window has expired.';
  const from = Math.max(minute(request.earliest), minute(now.slice(11)) + merchant.prep);
  const to = Math.min(minute(request.latest), minute(merchant.close));
  if (from > to) return 'Merchant preparation or closing time falls outside your pickup window.';
  const line = {...request, amount: item.price * request.qty, from, to};
  line.solo = quote(merchant, [line], now);
  return line;
}

function plan(candidates, size) {
  const memo = new Map([[0, {saving: 0, groups: [], times: []}]]);
  function best(mask) {
    if (memo.has(mask)) return memo.get(mask);
    const bit = mask & -mask;
    let winner = best(mask ^ bit);
    for (let rest = mask ^ bit; rest; rest = (rest - 1) & (mask ^ bit)) {
      const key = rest | bit;
      const group = candidates.get(key);
      if (!group) continue;
      const others = best(mask ^ key);
      const saving = group.saving + others.saving;
      if (saving < winner.saving) continue;
      const times = [...others.times, group.pickup].sort();
      if (saving === winner.saving && times.join(',') >= winner.times.join(',')) continue;
      winner = {saving, groups: [group, ...others.groups], times};
    }
    memo.set(mask, winner);
    return winner;
  }
  return best((1 << size) - 1).groups;
}

export function evaluate({merchants, requests, now}) {
  if (requests.length > 12) throw new RangeError('This board supports up to 12 active requests.');
  if (new Set(requests.map(r => r.id)).size !== requests.length) throw new Error('Request IDs must be unique.');
  const waiting = Object.create(null);
  const pools = new Map();
  const groups = [];
  const activity = [`Checked ${requests.length} pickup request${requests.length === 1 ? '' : 's'} against the catalog.`];
  let checked = 0, conflicting = 0, priced = 0;
  for (const request of [...requests].sort(byId)) {
    const merchant = merchants.find(merchant => merchant.id === request.merchant);
    const line = inspect(request, merchant, now);
    if (typeof line === 'string') {
      waiting[request.id] = line;
      continue;
    }
    if (!pools.has(merchant)) pools.set(merchant, []);
    pools.get(merchant).push(line);
  }
  for (const [merchant, pool] of pools) {
    const candidates = new Map();
    const reasons = new Map();
    function note(lines, rank, text) {
      for (const {id} of lines) if (!reasons.has(id) || rank > reasons.get(id).rank) reasons.set(id, {rank, text});
    }
    for (let mask = 1; mask < (1 << pool.length); mask++) {
      if ((mask & (mask - 1)) === 0) continue;
      const lines = pool.filter((_, i) => mask & (1 << i));
      const from = Math.max(...lines.map(line => line.from));
      const to = Math.min(...lines.map(line => line.to));
      checked++;
      if (from > to) {
        conflicting++;
        note(lines, 1, 'Your pickup windows do not overlap.');
        continue;
      }
      priced++;
      const bill = quote(merchant, lines, now);
      const payments = allocate(bill.total, lines);
      const rows = lines.map((line, i) => ({
        id: line.id, solo: line.solo.total, pay: payments[i], saving: line.solo.total - payments[i],
      }));
      const saving = sum(rows.map(row => row.saving));
      const losing = rows.find(row => row.saving < 0);
      const under = rows.find((row, i) => row.saving < lines[i].minSaving);
      if (losing || under || saving <= 0) {
        if (losing) {
          const index = rows.indexOf(losing);
          note(lines, 5, `${lines[index].alias} would pay ${rm(-losing.saving)} more than ordering alone.`);
        } else if (under && saving > 0) {
          note(lines, 4, `The split falls below ${lines[rows.indexOf(under)].alias}'s minimum saving.`);
        } else if (Number.isFinite(bill.shortfall)) {
          note(lines, 3 + 1 / (1 + bill.shortfall), `${rm(bill.shortfall)} more in eligible items would unlock an offer.`);
        } else {
          note(lines, 2, bill.expired ? 'The offer has expired. This group would have no net saving.' : 'This group would have no net saving over the best solo prices.');
        }
        continue;
      }
      const pickup = clock(from);
      const deadline = Math.min(minute(merchant.cutoff), from - merchant.prep, ...bill.offers
        .filter(offer => offer.end.slice(0,10) === now.slice(0,10)).map(offer => minute(offer.end.slice(11))));
      const offer = bill.offers.map(offer => offer.name).join(' + ') || 'Shared order fee';
      candidates.set(mask, {ids: rows.map(row => row.id), pickup, until: clock(to), deadline: clock(deadline),
        offer, offerIds: bill.offers.map(rule => rule.id), total: bill.total, saving, rows,
        reason: `All ${lines.length} can collect at ${pickup} and together save ${rm(saving)} against their best solo prices.`});
      note(lines, 6, 'Another feasible group was selected for the board’s best total saving and pickup time.');
    }
    const selected = plan(candidates, pool.length);
    groups.push(...selected);
    const matched = new Set(selected.flatMap(group => group.ids));
    for (const line of pool) if (!matched.has(line.id)) waiting[line.id] = reasons.get(line.id)?.text ?? 'Waiting for another request at this merchant and pickup point.';
  }
  if (checked) activity.push(`Checked ${checked} candidate combination${checked === 1 ? '' : 's'} for a common pickup window.`);
  if (conflicting) activity.push(`Excluded ${conflicting} combination${conflicting === 1 ? '' : 's'} with incompatible pickup times.`);
  if (priced) activity.push(`Compared ${priced} shared quote${priced === 1 ? '' : 's'} with the best solo prices, including fees.`);
  for (const group of groups) activity.push(`Proposed ${group.ids.length} members at ${group.pickup} with ${group.offer} and ${rm(group.saving)} net savings.`);
  return {groups, waiting, activity};
}
