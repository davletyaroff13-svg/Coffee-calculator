import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCoffeeServer} from './server.mjs';
import {newWorkspace,clone} from '../src/workspace.js';
import {createRemote,readRemote,openRemote,pushRemote,syncDecision,backendStatus,askAI,serverOrigin} from '../src/sync.js';
const setupToken='test-setup-token-for-coffee-control-only';
async function server(t,extra={}){
 const directory=await mkdtemp(join(tmpdir(),'coffee-server-'));const app=createCoffeeServer({directory,setupToken,origins:['https://coffee.example'],...extra});await new Promise(r=>app.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>app.close(r));await rm(directory,{recursive:true,force:true});});
 return {origin:'http://127.0.0.1:'+app.address().port,directory};
}
test('real HTTP sync creates encrypted workspace and another device can decrypt',async t=>{
 const {origin,directory}=await server(t),workspace=newWorkspace();const config=await createRemote(workspace,origin,setupToken);
 const remote=await readRemote(config);assert.equal(remote.revision,1);assert.deepEqual(await openRemote(config,remote),workspace);
 const raw=await readFile(join(directory,config.pairing.spaceId+'.json'),'utf8');assert.equal(raw.includes('Капучино'),false);assert.equal(raw.includes(config.pairing.secret),false);
 assert.equal(syncDecision(config,workspace,1),'idle');const changed=clone(workspace);changed.revision++;changed.cafes[0].name='Вторая версия';assert.equal(syncDecision(config,changed,1),'push');
 const written=await pushRemote(config,changed);assert.equal(written.revision,2);assert.equal((await openRemote(config,await readRemote(config))).cafes[0].name,'Вторая версия');assert.equal(syncDecision(config,workspace,2),'pull');assert.equal(syncDecision(config,changed,2),'conflict');
});
test('optimistic concurrency rejects a second device write with a stale remote version',async t=>{
 const {origin}=await server(t),w=newWorkspace(),c=await createRemote(w,origin,setupToken);const results=await Promise.allSettled([pushRemote(c,w),pushRemote(c,w)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);assert.equal((await readRemote(c)).revision,2);
});
test('missing setup key and incorrect pairing cannot create/read spaces',async t=>{
 const {origin}=await server(t),w=newWorkspace();await assert.rejects(createRemote(w,origin,'incorrect'),e=>e.status===401);const c=await createRemote(w,origin,setupToken),bad=clone(c);bad.pairing.secret='a'.repeat(64);await assert.rejects(readRemote(bad),e=>e.status===401);await assert.rejects(askAI(bad,'Данные'),e=>e.status===401);
});
test('CORS allowlist is exact and status never reveals keys',async t=>{
 const {origin}=await server(t,{aiURL:'https://provider.example/v1/chat/completions',aiModel:'test-model',aiKey:'private-api-key'});
 assert.equal((await fetch(origin+'/v1/status',{headers:{Origin:'https://evil.example'}})).status,403);
 const allowed=await fetch(origin+'/v1/status',{headers:{Origin:'https://coffee.example'}});assert.equal(allowed.headers.get('access-control-allow-origin'),'https://coffee.example');const text=await allowed.text();assert.equal(text.includes('private-api-key'),false);assert.equal(text.includes(setupToken),false);
});
test('AI request uses server-only key and explicit prompt; response has no HTML interpretation',async t=>{
 let sent;const {origin}=await server(t,{aiURL:'https://provider.example/v1/chat/completions',aiModel:'test-model',aiKey:'server-key',fetcher:async(url,options)=>{sent={url,options};return Response.json({choices:[{message:{content:'Проверь закупочную цену молока.'}}]});}});
 const c=await createRemote(newWorkspace(),origin,setupToken);const status=await backendStatus(c);assert.equal(status.ai.configured,true);const answer=await askAI(c,'Проанализируй себестоимость');assert.equal(answer.answer,'Проверь закупочную цену молока.');assert.equal(sent.options.headers.Authorization,'Bearer server-key');assert.equal(JSON.parse(sent.options.body).store,false);assert.equal(JSON.stringify(answer).includes('server-key'),false);
});
test('AI disabled or upstream failure returns a clear error without leaking response',async t=>{
 const disabled=await server(t),c=await createRemote(newWorkspace(),disabled.origin,setupToken);await assert.rejects(askAI(c,'Проверь'),e=>e.status===503);
 const failed=await server(t,{aiURL:'https://provider.example/v1/chat/completions',aiModel:'model',aiKey:'secret',fetcher:async()=>new Response('secret',{status:500})});const config=await createRemote(newWorkspace(),failed.origin,setupToken);await assert.rejects(askAI(config,'Проверь'),e=>e.status===502&&!e.message.includes('secret'));
});
test('sync configuration rejects insecure public origins and credentials embedded in URLs',()=>{
 for(const origin of ['http://coffee.example','https://user:pass@coffee.example','https://coffee.example/path','https://coffee.example/?key=secret'])assert.throws(()=>serverOrigin(origin));assert.equal(serverOrigin('https://coffee.example/'),'https://coffee.example');
});

test('AI daily request budget is persisted and survives workspace updates',async t=>{
 let calls=0;const fixture=await server(t,{aiURL:'https://provider.example/v1/chat/completions',aiModel:'m',aiKey:'k',aiDailyLimit:1,fetcher:async()=>{calls++;return Response.json({choices:[{message:{content:'Ответ'}}]});}});
 const w=newWorkspace(),c=await createRemote(w,fixture.origin,setupToken);await askAI(c,'Первый');await pushRemote(c,w);await assert.rejects(askAI(c,'Второй'),e=>e.status===429);assert.equal(calls,1);
 const persisted=JSON.parse(await readFile(join(fixture.directory,c.pairing.spaceId+'.json'),'utf8'));assert.equal(persisted.aiUsage.count,1);
});
