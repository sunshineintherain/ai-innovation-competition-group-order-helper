import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {validateCatalog} from './catalog.mjs';
import {evaluate} from './engine.mjs';
import {aliases} from './intent.mjs';

export const localNow = () => new Date(Date.now()+8*3600000).toISOString().slice(0,16);
const dateOk = s => typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const timeOk = s => typeof s==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const uint = (v,max) => Number.isSafeInteger(v) && v>=0 && v<=max;
function requireValue(condition,message) {if(!condition) throw Error(message);}
function log(s,line){s.activity=[line,...s.activity].slice(0,32);}
export function seed(previous) {
  const raw=JSON.parse(readFileSync(new URL('./fixtures/demo.json',import.meta.url)));
  const {merchant,issues}=validateCatalog(raw);
  if(!merchant) throw Error('Invalid demo fixture: '+JSON.stringify(issues));
  const base={merchant:merchant.id,qty:1,point:merchant.point,date:'2026-12-01',minSaving:0};
  const s={mode:'demo',now:'2026-12-01T12:10',directories:{demo:[merchant],live:previous?.directories.live||[]},requests:[{...base,id:'a',alias:'Aster',item:'lunch',earliest:'12:20',latest:'12:50'},{...base,id:'b',alias:'Birch',item:'bowl',earliest:'12:35',latest:'13:00'}],groups:[],waiting:{},activity:[],version:randomUUID()};
  s.savedLive=previous?.mode==='live' ? {requests:previous.requests,groups:previous.groups,activity:previous.activity} : previous?.savedLive;
  refresh(s,'Loaded two fictional lunch requests.');
  return s;
}
export function view(s) {
  const {directories,savedLive,...rest}=s;
  return {...rest,groups:s.groups.map(({terms,...g})=>g),merchants:directories[s.mode],language:process.env.CAMPUS_MODEL?'Local model configured':'Local English parser'};
}
function refresh(s,event,invalid=new Set()){
  const old=s.groups;
  const pinned=old.filter(g=>g.status==='complete' && !g.ids.some(id=>invalid.has(id)));
  const pinnedIds=new Set(pinned.flatMap(g=>g.ids));
  const requests=s.requests.filter(r=>!pinnedIds.has(r.id));
  const result=evaluate({requests,merchants:s.directories[s.mode],now:s.now});
  s.groups=[...pinned,...result.groups.map(group=>{
    const terms=JSON.stringify([group.ids.map(id=>s.requests.find(r=>r.id===id)),group.pickup,group.until,group.deadline,group.offer,group.rows,group.total]);
    const prior=old.find(g=>g.terms===terms && !g.ids.some(id=>invalid.has(id)));
    return {...group,terms,key:prior?.key||randomUUID(),confirmed:prior?.confirmed||[],status:'proposed'};
  })];
  s.waiting=result.waiting;
  for(const line of result.activity) log(s,line);
  const retired=old.filter(g=>!s.groups.some(n=>n.key===g.key)).length;
  if(retired) log(s,'Released '+retired+' previous group proposal'+(retired===1?'':'s')+'.');
  log(s,event);
  s.version=randomUUID();
}
export function tick(s){
  if(s.mode==='live' && s.now!==localNow()){s.now=localNow();refresh(s,'Rechecked the board at '+s.now.slice(11)+' MYT.');return true;}
  return false;
}
function cleanRequest(s,input){
  requireValue(input && typeof input==='object','Enter a lunch request.');
  const r=Object.fromEntries(['id','alias','merchant','item','qty','point','date','earliest','latest','minSaving'].map(k=>[k,input[k]]));
  const merchant=s.directories[s.mode].find(m=>m.id===r.merchant);
  requireValue(typeof r.id==='string' && /^[a-zA-Z0-9-]{1,64}$/.test(r.id) && !Object.hasOwn(Object.prototype,r.id),'Invalid request identifier.');
  requireValue(aliases.includes(r.alias),'Choose a fictional alias from the list.');
  requireValue(!s.requests.some(other=>other.alias===r.alias && other.id!==r.id),'This alias already has a request. Edit that request or choose another alias.');
  requireValue(merchant?.items.some(i=>i.id===r.item),'Select a listed merchant and item.');
  requireValue(r.point===merchant.point,'Select the listed public pickup point.');
  requireValue(uint(r.qty,20) && r.qty>0,'Quantity must be between 1 and 20.');
  requireValue(uint(r.minSaving,1000000),'Enter a non-negative minimum saving up to RM10,000.');
  requireValue(dateOk(r.date)&&r.date>=s.now.slice(0,10),'Choose today or a future pickup date.');
  requireValue(timeOk(r.earliest)&&timeOk(r.latest)&&r.earliest<=r.latest,'Enter a valid pickup window in time order.');
  return r;
}
export function transact(s,a){
  switch(a.type){
    case 'reset': return seed(s);
    case 'live': {
      if(s.mode==='live') return s;
      s.mode='live';s.now=localNow();s.requests=s.savedLive?.requests||[];s.groups=s.savedLive?.groups||[];s.activity=s.savedLive?.activity||[];delete s.savedLive;refresh(s,'Opened the public merchant board.');break;
    }
    case 'clock':{
      requireValue(s.mode==='demo','The live board uses the current Malaysian time.');
      requireValue(typeof a.now==='string' && a.now.length===16 && a.now[10]==='T' && dateOk(a.now.slice(0,10)) && timeOk(a.now.slice(11)),'Enter a valid simulation date and time.');
      s.now=a.now;refresh(s,'Moved the simulation clock to '+a.now.replace('T',' ')+'.');break;
    }
    case 'catalog':{
      const {merchant,issues}=validateCatalog(a.raw);
      requireValue(merchant,'Needs review. '+(issues[0]?.message||'Review the catalog.'));
      const directory=merchant.demo?'demo':'live';
      requireValue(!s.directories[merchant.demo?'live':'demo'].some(m=>m.id===merchant.id),'Use a distinct ID for each directory.');
      const list=s.directories[directory];
      const i=list.findIndex(m=>m.id===merchant.id);
      if(i>=0 && JSON.stringify(list[i])===JSON.stringify(merchant)){
        refresh(s,'Verified existing terms for '+merchant.name+'.');return s;
      }
      if(i<0) list.push(merchant);else list[i]=merchant;
      if(directory==='live' && s.mode==='demo' && s.savedLive){
        const ids=new Set(s.savedLive.requests.filter(r=>r.merchant===merchant.id).map(r=>r.id));
        s.savedLive.groups=s.savedLive.groups.filter(g=>!g.ids.some(id=>ids.has(id)));
      }
      const affected=new Set(directory===s.mode?s.requests.filter(r=>r.merchant===merchant.id).map(r=>r.id):[]);
      refresh(s,'Activated reviewed catalog for '+merchant.name+'.',affected);break;
    }
    case 'save':{
      const request=cleanRequest(s,a.request);
      const index=s.requests.findIndex(r=>r.id===request.id);
      if(index<0){requireValue(s.requests.length<12,'The board supports 12 active requests.');s.requests.push(request);}
      else if(Object.keys(request).every(k=>s.requests[index][k]===request[k])) return s;
      else s.requests[index]=request;
      refresh(s,'Checked '+request.alias+'’s '+(index<0?'new':'updated')+' request.',new Set([request.id]));break;
    }
    case 'withdraw':{
      if(!s.requests.some(r=>r.id===a.id)) return s;
      s.requests=s.requests.filter(r=>r.id!==a.id);
      refresh(s,'Withdrew one request and checked the remaining requests.',new Set([a.id]));break;
    }
    case 'confirm':{
      const g=s.groups.find(g=>g.key===a.key);
      requireValue(g?.ids.includes(a.id),'This proposal has changed. Review the current match before confirming.');
      if(g.confirmed.includes(a.id)) return s;
      g.confirmed.push(a.id);
      const alias=s.requests.find(r=>r.id===a.id).alias;
      log(s,alias+' confirmed the displayed price and pickup time.');
      if(g.confirmed.length===g.ids.length){g.status='complete';log(s,'All members confirmed. Created one group summary.');}
      s.version=randomUUID();break;
    }
    default:throw Error('Unknown board action.');
  }
  return s;
}

