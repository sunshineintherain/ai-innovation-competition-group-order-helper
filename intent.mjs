const normalize = s => s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const has = (sentence, fragment) => sentence.includes(normalize(fragment));
export const aliases = 'Aster Birch Clover Dune Echo Fern Grove Hazel Iris Jade Kite Lark'.split(' ');
export function localFields(text, merchants, now, selected) {
  const line = normalize(text);
  const fields = {};
  const matches = merchants.filter(m => has(line,m.name));
  const from = line.match(/\bfrom\s+(.+?)(?:[.!?,;]|\s+(?:between|at|today|tomorrow)|$)/);
  const shop = matches.length === 1 ? matches[0] : matches.length || from ? null : merchants.find(m => m.id === selected) || (merchants.length === 1 && merchants[0]);
  if(shop) {
    fields.merchant = shop.id;
    const price = line.match(/\brm\s*(\d+(?:\.\d{1,2})?)/);
    const named = shop.items.filter(item => has(line,item.name) || new RegExp('\\b'+item.id.replace(/[^a-z0-9-]/gi,'')+'\\b').test(line));
    const candidates = named.length ? named : price ? shop.items.filter(i=>i.price===Math.round(Number(price[1])*100)) : [];
    if(candidates.length === 1 && (!price || candidates[0].price===Math.round(Number(price[1])*100))) fields.item = candidates[0].id;
    if(!/\b(?:at|from)\s+(?:the\s+)?[^.,]*\b(?:counter|gate|lobby|hall)\b/.test(line) || has(line,shop.point)) fields.point=shop.point;
  }
  const times=[...line.matchAll(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/g)].map(([,h,m,p])=>{
    let hour=Number(h);
    if(Number(m)>59 || hour>(p?12:23) || (p && hour===0)) return null;
    if(p) hour=hour%12+(p==='pm'?12:0);
    return String(hour).padStart(2,'0')+':'+m;
  });
  if(times.length===2 && times.every(Boolean)) [fields.earliest,fields.latest]=times;
  const day=line.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if(day) fields.date=day[0];
  else if(line.includes('tomorrow')) fields.date=new Date(Date.parse(now.slice(0,10)+'T00:00:00Z')+86400000).toISOString().slice(0,10);
  else if(line.includes('today')) fields.date=now.slice(0,10);
  const qty=line.match(/\b(\d+|one|two|three|four|five)\s*(?:x\b|portions?\b|servings?\b|sets?\b|bowls?\b|lunch\b|rice\b|of\b)/);
  fields.qty=qty ? ({one:1,two:2,three:3,four:4,five:5}[qty[1]] || Number(qty[1])) : 1;
  const saving=line.match(/(?:save at least|minimum saving(?:s)?(?: of)?)\s*rm\s*(\d+(?:\.\d{1,2})?)/);
  if(saving) fields.minSaving=Math.round(Number(saving[1])*100);
  return fields;
}
export async function interpret({text,merchant},state,model) {
  if(typeof text !== 'string' || !text.trim() || text.length>700) throw Error('Enter a fictional lunch request of 1 to 700 characters.');
  let fields=localFields(text,state.merchants,state.now,merchant);
  let mode='Local English parser';
  if(model){
    try {
      const catalog=state.merchants.map(({id,name,point,items})=>({id,name,point,items}));
      const response=await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(6000),body:JSON.stringify({model,stream:false,format:'json',prompt:'Extract only explicitly stated pickup intent fields as JSON. Use merchant and item IDs. Omit unknowns. Keys: merchant,item,qty,point,date,earliest,latest,minSaving (integer sen). Time HH:mm in Malaysia. Today '+state.now.slice(0,10)+'. Catalog '+JSON.stringify(catalog)+'\nStudent input: '+text})});
      if(!response.ok) throw Error();
      const parsed=JSON.parse((await response.json()).response);
      const clean=Object.fromEntries(Object.entries(parsed).filter(([k,v])=>['merchant','item','qty','point','date','earliest','latest','minSaving'].includes(k)&&['string','number'].includes(typeof v)));
      fields={...fields,...clean};
      mode='Local model · '+model;
    } catch {mode='Model unavailable · local English parser';}
  }
  const shop=state.merchants.find(m=>m.id===fields.merchant);
  if(!shop) delete fields.merchant;
  if(!shop?.items.some(i=>i.id===fields.item)) delete fields.item;
  if(fields.point!==shop?.point) delete fields.point;
  const prompts={merchant:'Which merchant?',item:'Which menu item?',date:'Which pickup date?',earliest:'When can you first collect?',latest:'When must you leave?',point:'Which listed public pickup point works for you?'};
  return {fields,questions:Object.keys(prompts).filter(k=>!fields[k]).map(k=>prompts[k]),mode};
}
