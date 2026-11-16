import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,WORKSPACE_KEY,newWorkspace,makeCafe,balances,sell,moveStock,cancelSale,validateWorkspace,clone,recipeLines,unitCost} from './workspace.js';
import {initial} from './seed.js';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),map};};
const stocked=()=>{const c=makeCafe();c.stock.opening=[1000,10000,100,100,1000];return c;};

test('legacy migration preserves menu, IDs and old keys without merging cafes',()=>{
 const memory=storage(),model=initial();model.recipes[0].price=555;
 memory.setItem('coffee-control-model-v1',JSON.stringify(model));
 memory.setItem('coffee-control-v5-inventory-draft',JSON.stringify({opening:[2000],minimums:[],ledger:[],sales:[{id:'s1',recipeName:'Американо',quantity:2,timestamp:'2026-11-15T08:00:00Z'}]}));
 const store=createStore(memory),w=store.get(),c=w.cafes[0];
 assert.equal(c.model.recipes[0].price,555);assert.equal(c.stock.sales[0].unitPrice,190);assert.equal(balances(c)[0],1964);
 assert.ok(memory.getItem('coffee-control-model-v1'));assert.equal(createStore(memory).get().id,w.id);
 const other=makeCafe('Другая',c.model);store.update(w=>w.cafes.push(other));
 assert.equal(store.get().cafes[1].stock.sales.length,0);assert.equal(store.get().cafes[0].stock.sales.length,1);
});
test('sold quantities, cost, price and recipe name survive recipe changes and deletion',()=>{
 let c=stocked(),r=c.model.recipes[0];c=sell(c,{recipeId:r.id,quantity:2,timestamp:'2026-11-15T09:00:00Z'});
 const original=balances(c),sale=clone(c.stock.sales[0]);
 c.model.recipes[0].lines=[[0,999]];c.model.recipes[0].price=999;c.model.ingredients[0].price=99;c.model.recipes[0].name='Переименован';
 assert.deepEqual(balances(c),original);assert.deepEqual(c.stock.sales[0],sale);
 c.model.recipes.splice(0,1);assert.deepEqual(balances(c),original);assert.doesNotThrow(()=>validateWorkspace({...newWorkspace(),activeCafeId:c.id,cafes:[c]}));
});
test('sale cannot overdraw stock; failure leaves original untouched',()=>{
 const c=stocked(),before=clone(c);assert.throws(()=>sell(c,{recipeId:c.model.recipes[0].id,quantity:1000}),/Недостаточно/);assert.deepEqual(c,before);
 for(const quantity of [0,-1,1.5,NaN,Infinity])assert.throws(()=>sell(c,{recipeId:c.model.recipes[0].id,quantity}));
});
test('cancelled sale restores exact snapshot and cannot be cancelled twice',()=>{
 let c=stocked(),original=balances(c);c=sell(c,{recipeId:c.model.recipes[0].id,quantity:2});const s=c.stock.sales[0];
 c.model.recipes[0].lines=[];c=cancelSale(c,s.id,'Ошибка бариста');assert.deepEqual(balances(c),original);assert.equal(c.stock.sales.length,1);assert.throws(()=>cancelSale(c,s.id,'Ещё раз'));
});
test('loss affects food quantities, not disposable packaging',()=>{
 const c=stocked(),r=c.model.recipes[0];r.lossPercent=10;const lines=recipeLines(r,c.model);
 assert.equal(lines[0][1],20);assert.equal(lines[1][1],200);assert.equal(lines[2][1],1);assert.equal(unitCost(r,c.model),20*2.1+200*.105+10);
});
test('inventory count can adjust negative stock; writeoff cannot overdraw',()=>{
 let c=stocked();c=sell(c,{recipeId:c.model.recipes[0].id,quantity:1});
 assert.throws(()=>moveStock(c,{ingredientIndex:0,quantity:1000,type:'writeoff',reason:'Порча'}));
 c=moveStock(c,{ingredientIndex:0,quantity:-82,type:'adjustment',reason:'Пересчёт'});assert.equal(balances(c)[0],900);
});
test('persistence is atomic on quota error; stale tab cannot overwrite a newer revision',()=>{
 const memory=storage(),a=createStore(memory),b=createStore(memory);a.update(w=>w.cafes[0].name='Обновлено');
 assert.throws(()=>b.update(w=>w.cafes[0].name='Потеря обновления'),/другой вкладке/);assert.equal(a.get().cafes[0].name,'Обновлено');
 const before=a.get();memory.setItem=()=>{throw Error('QuotaExceededError');};assert.throws(()=>a.update(w=>w.cafes[0].name='Не сохранено'),/Quota/);assert.deepEqual(a.get(),before);
});
test('invalid restore is rejected without overwriting data',()=>{
 const memory=storage(),store=createStore(memory),before=store.get();
 const invalid=clone(before);invalid.cafes[0].stock.sales.push({id:'corrupt'});assert.throws(()=>store.replace(invalid));assert.deepEqual(store.get(),before);
 for(const mutate of [w=>w.cafes[0].model.days=0,w=>w.cafes[0].model.recipes[0].price=NaN,w=>w.cafes.push(clone(w.cafes[0])),w=>w.cafes[0].model.recipes[1].name=w.cafes[0].model.recipes[0].name]){const bad=clone(before);mutate(bad);assert.throws(()=>validateWorkspace(bad));}
});
test('broken legacy migration keeps all original bytes for recovery',()=>{
 const memory=storage();memory.setItem('coffee-control-model-v1','{bad-json');assert.throws(()=>createStore(memory));assert.equal(memory.getItem('coffee-control-model-v1'),'{bad-json');assert.equal(memory.getItem(WORKSPACE_KEY),null);
});
