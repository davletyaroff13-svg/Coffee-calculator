import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCoffeeServer} from './server.mjs';
import {createStore} from '../src/workspace.js';
import {SyncController,readRemote,openRemote} from '../src/sync.js';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
async function setup(t){const dir=await mkdtemp(join(tmpdir(),'coffee-sync-'));const server=createCoffeeServer({directory:dir,setupToken:'long-setup-token-for-test-only'});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});const aMem=memory(),bMem=memory(),a=createStore(aMem),b=createStore(bMem),x=new SyncController({store:a,storage:aMem}),y=new SyncController({store:b,storage:bMem});await x.create('http://127.0.0.1:'+server.address().port,'long-setup-token-for-test-only');const preview=await y.preview(x.config.pairing);b.replace(preview.value);y.adopt(preview.syncCandidate);return {a,b,x,y};}
test('automatic controller pushes local changes, then pulls remote changes on second device',async t=>{
 const {a,b,x,y}=await setup(t);a.update(w=>w.cafes[0].name='Изменено на первом');await x.tick();await y.tick();assert.equal(b.get().cafes[0].name,'Изменено на первом');assert.equal(y.config.paused,false);
 b.update(w=>w.cafes[0].name='Изменено на втором');await y.tick();await x.tick();assert.equal(a.get().cafes[0].name,'Изменено на втором');
});
test('both-device conflict pauses sync and preserves both versions',async t=>{
 const {a,b,x,y}=await setup(t);a.update(w=>w.cafes[0].name='Версия A');b.update(w=>w.cafes[0].name='Версия B');await x.tick();await y.tick();assert.equal(y.config.paused,true);assert.equal(b.get().cafes[0].name,'Версия B');const remote=await openRemote(x.config,await readRemote(x.config));assert.equal(remote.cafes[0].name,'Версия A');
 const candidate=await y.preview(y.config.pairing);b.replace(candidate.value);y.adopt(candidate.syncCandidate);assert.equal(y.config.paused,false);assert.equal(b.get().cafes[0].name,'Версия A');
});
test('disconnect keeps local data and prevents future network requests',async t=>{
 const {a,x}=await setup(t),before=a.get();x.disconnect();await x.tick();assert.deepEqual(a.get(),before);assert.equal(x.config,null);
});
