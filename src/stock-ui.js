import {stockReport,purchasingPlan} from './inventory.js';
import {recordMovement} from './ledger.js';
import {recordSale} from './sales-ledger.js';
const key='coffee-control-v5-inventory-draft';
const $=id=>document.getElementById(id);
const read=()=>{try{const v=JSON.parse(localStorage.getItem(key));return v&&Array.isArray(v.opening)&&Array.isArray(v.ledger)?v:null}catch{return null}};
let state=read()||{opening:[],minimums:[],ledger:[],sales:[]};
if(!Array.isArray(state.sales))state.sales=[];
const salePanel=document.createElement('div');salePanel.className='panel';salePanel.innerHTML='<h2>Фактические продажи</h2><p class="note">Продажи списывают ингредиенты по текущей техкарте. Изменение техкарты задним числом пересчитает старые продажи. Для бухгалтерского учёта пока не использовать.</p><div class="grid"><div><label>Напиток</label><select id="actualSaleRecipe"></select></div><div><label>Количество, шт.</label><input id="actualSaleQty" type="number" min="1" step="1" value="1"></div></div><button id="actualSaleSave">Записать продажу</button><p id="actualSaleStatus" role="status"></p><h3>Последние продажи</h3><div id="actualSaleHistory"></div>';
$('stock').appendChild(salePanel);
const save=()=>{try{localStorage.setItem(key,JSON.stringify(state));return true}catch{return false}};
const model=()=>window.coffeeModelV5();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>Number.isFinite(n)?n.toLocaleString('ru-RU',{maximumFractionDigits:2}):'—';
function render(){
const d=model(), ingredients=d.ingredients;
const saleSelect=$('actualSaleRecipe'),previous=saleSelect.value;
saleSelect.innerHTML=d.recipes.map((r,i)=>'<option value="'+i+'">'+esc(r.name)+'</option>').join('');
if(previous!==''&&d.recipes[+previous])saleSelect.value=previous;
$('actualSaleHistory').innerHTML=state.sales.slice(-20).reverse().map(s=>'<p>'+esc(s.timestamp.slice(0,16))+' · '+esc(s.recipeName)+' · '+number(s.quantity)+' шт.</p>').join('')||'<p>Продаж пока нет.</p>';
$('stockIngredient').innerHTML=ingredients.map((i,n)=>'<option value="'+n+'">'+esc(i.name)+' ('+esc(i.unit)+')</option>').join('');
const receipts=state.ledger.filter(m=>m.type==='receipt');
const writeoffs=state.ledger.filter(m=>m.type==='writeoff');
const report=stockReport({ingredients,recipes:d.recipes,sales:state.sales.map(s=>({name:s.recipeName,quantity:s.quantity})),opening:state.opening,minimums:state.minimums,receipts,writeoffs});
$('stockRows').innerHTML=report.map((r,i)=>'<tr><td>'+esc(r.ingredient)+'</td><td>'+number(r.balance)+' '+esc(r.unit)+'</td><td><input aria-label="Начальный остаток" data-open="'+i+'" type="number" min="0" value="'+(state.opening[i]||0)+'"></td><td><input aria-label="Минимум" data-min="'+i+'" type="number" min="0" value="'+(state.minimums[i]||0)+'"></td><td>'+(r.negativeStock?'⚠️ Минус':r.lowStock?'⚠️ Мало':'—')+'</td></tr>').join('');
const plan=purchasingPlan({report,projectedDailySales:ingredients.map((_,i)=>d.recipes.reduce((sum,r)=>sum+r.qty*r.lines.filter(([j])=>j===i).reduce((a,[,q])=>a+q,0),0)),leadDays:2,safetyDays:1});
$('stockPlan').innerHTML=plan.filter(r=>r.orderQuantity>0).map(r=>'<p>'+esc(r.ingredient)+': '+number(r.orderQuantity)+' '+esc(r.unit)+'</p>').join('')||'<p>По расчётному плану закупки не требуются.</p>';
$('stockHistory').innerHTML=state.ledger.slice().reverse().map(m=>'<p>'+esc(m.timestamp.slice(0,16))+' · '+(m.type==='receipt'?'Приход':'Списание')+' · '+esc(ingredients[m.ingredientIndex]?.name||'?')+' · '+number(m.quantity)+' · '+esc(m.reason)+'</p>').join('')||'<p>Операций пока нет.</p>';
$('stockRows').querySelectorAll('[data-open],[data-min]').forEach(el=>el.onchange=()=>{
const v=Number(el.value);if(!Number.isFinite(v)||v<0){$('stockStatus').textContent='Количество не может быть отрицательным';return}
const field=el.hasAttribute('data-open')?'opening':'minimums';const index=Number(el.dataset.open??el.dataset.min);
state[field][index]=v;save();render();
});
}
$('stockSave').onclick=()=>{
const d=model(),index=Number($('stockIngredient').value),quantity=Number($('stockQuantity').value),type=$('stockType').value,reason=$('stockReason').value.trim();
if(!Number.isFinite(quantity)||quantity<=0||!reason){$('stockStatus').textContent='Укажи положительное количество и причину.';return}
try{
const movement={id:crypto.randomUUID(),type,ingredientIndex:index,quantity,timestamp:new Date().toISOString(),reason};
const balances=stockReport({ingredients:d.ingredients,recipes:d.recipes,sales:state.sales.map(s=>({name:s.recipeName,quantity:s.quantity})),opening:state.opening,receipts:state.ledger.filter(m=>m.type==='receipt'),writeoffs:state.ledger.filter(m=>m.type==='writeoff')}).map(x=>x.balance);
const result=recordMovement({ledger:state.ledger,opening:state.opening,ingredientCount:d.ingredients.length,movement,allowNegative:true});
if(type==='writeoff'&&balances[index]<quantity)throw Error('Недостаточный остаток для списания');
state.ledger=result.ledger;
$('stockStatus').textContent=save()?'Операция записана локально.':'⚠️ Не удалось сохранить. Экспортируй данные.';
render();
}catch(e){$('stockStatus').textContent=e.message}
};
$('stockExport').onclick=()=>{
const blob=new Blob([JSON.stringify({schema:1,...state},null,2)],{type:'application/json'});
const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='coffee-control-v5-stock.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('actualSaleSave').onclick=()=>{
const d=model(),recipe=d.recipes[Number($('actualSaleRecipe').value)],quantity=Number($('actualSaleQty').value);
if(!recipe||!Number.isSafeInteger(quantity)||quantity<=0){$('actualSaleStatus').textContent='Укажи напиток и целое положительное количество.';return}
try{
const sale={id:crypto.randomUUID(),recipeName:recipe.name,quantity,timestamp:new Date().toISOString()};
const result=recordSale({sales:state.sales,sale,recipes:d.recipes,opening:state.opening,ledger:state.ledger,ingredientCount:d.ingredients.length});
state.sales=result.sales;
$('actualSaleStatus').textContent=save()?'Продажа записана, ингредиенты списаны.':'⚠️ Не удалось сохранить данные';render();
}catch(e){$('actualSaleStatus').textContent=e.message}
};
$('stockRefresh').onclick=render;
render();
