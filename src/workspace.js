import {initial} from './seed.js';
import {ledgerBalances, validateMovement} from './ledger.js';

export const WORKSPACE_KEY = 'coffee-control-workspace-v5';
export const id = () => crypto.randomUUID();
export const clone = value => structuredClone(value);
const check = (condition, message) => { if (!condition) throw Error(message); };
const amount = (n, label, max=1e12) => check(typeof n==='number' && Number.isFinite(n) && n>=0 && n<=max, 'Некорректное значение: '+label);
const name = (v, label) => check(typeof v==='string' && v.trim().length>0 && v.length<=200, 'Нужно название: '+label);
const date = v => check(typeof v==='string' && Number.isFinite(Date.parse(v)), 'Некорректная дата');
const unique = (items, label) => { const ids=new Set(); for(const item of items){name(item.id,label);check(!ids.has(item.id),'Повтор ID: '+label);ids.add(item.id);} };

export function validModel(m) {
  check(m && typeof m==='object', 'Нет модели');
  check(Array.isArray(m.ingredients)&&m.ingredients.length>0&&m.ingredients.length<=1000,'Некорректный список ингредиентов');
  check(Array.isArray(m.recipes)&&m.recipes.length>0&&m.recipes.length<=1000,'Некорректное меню');
  for(const x of m.ingredients){ name(x.name,'ингредиент'); check(['г','мл','шт'].includes(x.unit),'Неизвестная единица'); amount(x.price,'цена'); amount(x.old,'старая цена'); }
  const names=new Set();
  for(const r of m.recipes){
    name(r.name,'напиток'); const key=r.name.trim().toLocaleLowerCase('ru');check(!names.has(key),'Названия напитков должны отличаться'); names.add(key);
    amount(r.price,'цена напитка');amount(r.qty,'план продаж',1e7);amount(r.lossPercent??0,'потери',99);
    check(Array.isArray(r.lines)&&r.lines.length<=1000,'Некорректный состав');
    for(const line of r.lines){check(Array.isArray(line)&&line.length===2&&Number.isInteger(line[0])&&m.ingredients[line[0]],'Неизвестный ингредиент');amount(line[1],'количество');}
  }
  for(const k of ['fixed','days','tax','acquiring'])amount(m[k],k);
  check(m.days>0&&m.days<=366&&m.tax<=100&&m.acquiring<=100,'Проверь дни, налог и эквайринг');
  if(m.recipes.every(r=>r.id))unique(m.recipes,'техкарта');
  return m;
}

export const recipeLines = (r,model) => r.lines.map(([i,q])=>[i,q*(model?.ingredients[i]?.unit!=='шт' && r.lossPercent>0 ? 1/(1-r.lossPercent/100):1)]);
export const unitCost = (r,m) => recipeLines(r,m).reduce((s,[i,q])=>s+q*m.ingredients[i].price,0);

export function snapshotSale(s, model) {
  const r=model.recipes.find(r=>r.id===s.recipeId || (!s.recipeId&&r.name===s.recipeName));
  check(r,'Техкарта не найдена');
  check(Number.isSafeInteger(s.quantity)&&s.quantity>0&&s.quantity<=1e7,'Количество продажи должно быть целым и положительным');
  check(recipeLines(r,model).some(([,q])=>q>0),'Заполни состав напитка перед продажей');
  return {...s, recipeId:r.id, recipeName:r.name, lines:recipeLines(r,model), unitPrice:r.price, unitCost:unitCost(r,model), acquiringPercent:model.acquiring};
}

export function validateStock(stock, m) {
  check(stock&&['opening','minimums','ledger','sales','voids'].every(k=>Array.isArray(stock[k])),'Некорректный склад');
  check(stock.opening.length<=m.ingredients.length&&stock.minimums.length<=m.ingredients.length,'Несовместимые остатки');
  stock.opening.forEach(n=>amount(n,'начальный остаток'));stock.minimums.forEach(n=>amount(n,'минимум'));
  check(stock.ledger.length<=100000&&stock.sales.length<=100000&&stock.voids.length<=100000,'Слишком большой журнал');
  unique(stock.ledger,'движение');unique(stock.sales,'продажа');unique(stock.voids,'отмена');
  stock.ledger.forEach(movement=>validateMovement(movement,m.ingredients.length));
  for(const s of stock.sales){
    name(s.recipeName,'продажа');date(s.timestamp);check(Number.isSafeInteger(s.quantity)&&s.quantity>0,'Некорректная продажа');
    amount(s.unitPrice,'цена продажи');amount(s.unitCost,'себестоимость');amount(s.acquiringPercent,'эквайринг',100);
    check(Array.isArray(s.lines)&&s.lines.length<=1000,'Нет снимка техкарты');
    for(const line of s.lines){check(Array.isArray(line)&&line.length===2&&Number.isInteger(line[0])&&m.ingredients[line[0]],'Неизвестный ингредиент продажи');amount(line[1],'расход');}
  }
  const cancelled=new Set();
  for(const v of stock.voids){check(stock.sales.some(s=>s.id===v.saleId)&&!cancelled.has(v.saleId),'Некорректная отмена');name(v.reason,'причина отмены');date(v.timestamp);cancelled.add(v.saleId);}
  return stock;
}

export function normalizeModel(raw) {
  const m=clone(validModel(raw));
  m.recipes.forEach(r=>{r.id ||= id();r.lossPercent??=0;});
  return m;
}
export const emptyStock=()=>({opening:[],minimums:[],ledger:[],sales:[],voids:[]});
export function makeCafe(name='Моя кофейня', model=initial(), stock=emptyStock()) {
  const normalized=normalizeModel(model), s=clone(stock);
  s.voids ||= [];s.sales ||= [];
  s.sales=s.sales.map(sale=>sale.lines?sale:snapshotSale(sale,normalized));
  validateStock(s,normalized);
  return {id:id(),name,model:normalized,stock:s};
}
export function newWorkspace(model=initial(),stock=emptyStock()) {
  const cafe=makeCafe('Моя кофейня',model,stock);
  return {schema:5,id:id(),revision:0,updatedAt:new Date().toISOString(),activeCafeId:cafe.id,cafes:[cafe]};
}
export function validateWorkspace(w) {
  check(w?.schema===5,'Нужна резервная копия Coffee Control 5.0');name(w.id,'пространство');
  check(Number.isSafeInteger(w.revision)&&w.revision>=0,'Некорректная версия данных');date(w.updatedAt);
  check(Array.isArray(w.cafes)&&w.cafes.length>0&&w.cafes.length<=50,'Нужно от 1 до 50 кофеен');unique(w.cafes,'кофейня');
  check(w.cafes.some(c=>c.id===w.activeCafeId),'Не найдена активная кофейня');
  for(const c of w.cafes){if(c.imports!==undefined)check(Array.isArray(c.imports)&&c.imports.length<=100000&&c.imports.every(s=>typeof s==='string'&&/^[a-f0-9]{64}:(plan|actual)$/.test(s)),'Некорректный журнал импортов');name(c.name,'кофейня');validModel(c.model);check(c.model.recipes.every(r=>typeof r.id==='string'),'Нет ID техкарты');validateStock(c.stock,c.model);}
  return w;
}
export function activeSales(cafe) {
  const voided=new Set(cafe.stock.voids.map(v=>v.saleId));return cafe.stock.sales.filter(s=>!voided.has(s.id));
}
export function balances(cafe) {
  const result=ledgerBalances(cafe.stock.ledger,cafe.stock.opening,cafe.model.ingredients.length);
  for(const s of activeSales(cafe))for(const [i,q] of s.lines)result[i]-=q*s.quantity;
  return result.map(n=>Math.abs(n)<1e-8?0:n);
}
export function sell(cafe,{recipeId,quantity,timestamp=new Date().toISOString()}) {
  const sale=snapshotSale({id:id(),recipeId,quantity,timestamp},cafe.model);
  date(timestamp); const next=clone(cafe);next.stock.sales.push(sale);
  check(balances(next).every(n=>n>=-1e-8),'Недостаточно ингредиентов. Сначала внеси приход или начальные остатки.');
  return next;
}
export function moveStock(cafe, movement) {
  const next=clone(cafe), m={...movement,id:id(),timestamp:new Date().toISOString()};
  validateMovement(m,cafe.model.ingredients.length);next.stock.ledger.push(m);
  const before=balances(cafe),after=balances(next);
  check(after.every((n,i)=>n>=-1e-8||n>=before[i]),'Недостаточно остатка для списания');
  return next;
}
export function cancelSale(cafe,saleId,reason) {
  name(reason,'причина отмены');check(cafe.stock.sales.some(s=>s.id===saleId),'Продажа не найдена');check(!cafe.stock.voids.some(v=>v.saleId===saleId),'Продажа уже отменена');
  const next=clone(cafe);next.stock.voids.push({id:id(),saleId,reason,timestamp:new Date().toISOString()});return next;
}

export function createStore(storage) {
  let state;
  const raw=storage.getItem(WORKSPACE_KEY);
  if(raw)state=validateWorkspace(JSON.parse(raw));
  else {
    const legacy=storage.getItem('coffee-control-model-v1'),oldStock=storage.getItem('coffee-control-v5-inventory-draft');
    const model=legacy?JSON.parse(legacy):initial();
    state=newWorkspace(model,oldStock?JSON.parse(oldStock):emptyStock());
    // Keep both legacy keys untouched. Write only after the full migration validates.
    storage.setItem(WORKSPACE_KEY,JSON.stringify(state));
  }
  const current=()=>clone(state);
  const persist=next=>{
    validateWorkspace(next);
    const disk=storage.getItem(WORKSPACE_KEY);
    if(disk){const latest=JSON.parse(disk);check(latest.id===state.id&&latest.revision===state.revision,'Данные изменены в другой вкладке. Обнови страницу перед записью.');}
    check(state.revision<Number.MAX_SAFE_INTEGER,'Достигнут предел версий данных');
    next.revision=state.revision+1;next.updatedAt=new Date().toISOString();
    storage.setItem(WORKSPACE_KEY,JSON.stringify(next));state=next;return current();
  };
  return {get:current, update(fn){const next=current();fn(next);return persist(next);},replace(value){return persist(clone(validateWorkspace(value)));},reload(){state=validateWorkspace(JSON.parse(storage.getItem(WORKSPACE_KEY)));return current();}};
}
