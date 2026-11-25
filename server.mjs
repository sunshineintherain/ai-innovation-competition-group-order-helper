import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {seed,tick,transact,view} from './board.mjs';
import {validateCatalog} from './catalog.mjs';
import {interpret} from './intent.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const store=resolve(process.env.CAMPUS_STATE || resolve(root,'.local','board.json'));
mkdirSync(dirname(store),{recursive:true});
let state=existsSync(store)?JSON.parse(readFileSync(store,'utf8')):seed();
function commit(next){
  writeFileSync(store+'.tmp',JSON.stringify(next));renameSync(store+'.tmp',store);state=next;
}
function advance(){const next=structuredClone(state);if(tick(next)) commit(next);}
const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json'};
const staticNames=new Set(['/','/app.mjs','/style.css','/import.mjs','/fixtures/demo.json','/fixtures/needs-review.json','/slides.html']);
const server=http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  function json(status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
  try {
    if(req.method==='GET' && path==='/api/state'){advance();return json(200,view(state));}
    if(req.method==='GET' && staticNames.has(path)){
      const name=path.startsWith('/fixtures/')?path.slice(1):'public'+(path==='/'?'/index.html':path);
      const data=readFileSync(resolve(root,name));res.writeHead(200,{'Content-Type':types[extname(name)]+'; charset=utf-8','Cache-Control':'no-cache'});res.end(data);return;
    }
    if(req.method!=='POST'||!['/api/action','/api/preview','/api/parse'].includes(path)) return json(404,{error:'Page not found.'});
    if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host) return json(403,{error:'Use the local board to change a request.'});
    let data='';for await(const chunk of req){data+=chunk.toString('latin1');if(data.length>128*1024) return json(413,{error:'Use a JSON file smaller than 128 KB.'});}
    let body;try{body=JSON.parse(Buffer.from(data,'latin1').toString('utf8'));}catch{return json(400,{error:'Enter valid JSON.'});}
    advance();
    if(path==='/api/preview') return json(200,validateCatalog(body.raw));
    if(path==='/api/parse'){
      const snapshot=view(state);
      const draft=await interpret(body,snapshot,process.env.CAMPUS_MODEL);
      if(snapshot.version===state.version){
        const next=structuredClone(state);
        const result=draft.questions.length?'Requested clarification for '+draft.questions.length+' missing fields.':'Prepared an editable lunch request.';
        next.activity=['Checked an English intent against '+snapshot.merchants.length+' catalog entries. '+result,...next.activity].slice(0,32);
        commit(next);
      }
      return json(200,draft);
    }
    // Synchronous validation, evaluation and atomic rename form one transaction in this process.
    const next=transact(structuredClone(state),body);
    commit(next);return json(200,view(state));
  } catch(error){return json(400,{error:error.code?'The local board could not complete this operation.':error.message});}
});
const timer=setInterval(advance,15000);timer.unref();
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Campus Group Order Assistant: http://127.0.0.1:'+server.address().port));

