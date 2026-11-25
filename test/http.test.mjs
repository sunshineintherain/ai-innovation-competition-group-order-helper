import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
test('HTTP concurrent confirmations, duplicate submits and restart produce one durable summary',async(t)=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'campus-http-'));
 const file=path.join(dir,'board.json');
 let child;
 async function stop(){if(child && child.exitCode===null && !child.killed){const done=once(child,'exit');child.kill();await done;}}
 t.after(async()=>{await stop();await rm(dir,{recursive:true,force:true});});
 async function start(){
   child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',CAMPUS_STATE:file},stdio:['ignore','pipe','pipe']});
   const [data]=await once(child.stdout,'data');return data.toString().trim().split(' ').at(-1);
 }
 let url=await start();
 const snapshot=async()=>await (await fetch(url+'/api/state')).json();
 const group=(await snapshot()).groups[0];
 await Promise.all(['a','b','b','a'].map(async id=>{
   const res=await fetch(url+'/api/action',{method:'POST',body:JSON.stringify({type:'confirm',key:group.key,id})});assert.equal(res.status,200);
 }));
 await stop();url=await start();const s=await snapshot();
 assert.equal(s.groups.length,1);assert.equal(s.groups[0].status,'complete');assert.deepEqual(s.groups[0].confirmed.sort(),['a','b']);
 assert.equal(s.groups[0].total,1800);
 assert.equal(s.activity.filter(a=>a.includes('Created one group summary')).length,1);
 assert.ok(JSON.parse(await readFile(file,'utf8')).groups.length===1);
});

