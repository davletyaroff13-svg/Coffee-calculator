import {activeSales, balances, recipeLines, unitCost} from './workspace.js';

export const dayKey = (date=new Date()) => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
export const shiftDay = (day,n) => new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export function periodDays(from,to){
  const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
  if(!valid(from)||!valid(to)||to<from)throw Error('Проверь даты периода');
  const days=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
  if(days>3660)throw Error('Период не должен превышать 10 лет');return days;
}
export function actualReport(cafe,from,to){
  const days=periodDays(from,to), sales=activeSales(cafe).filter(s=>{const day=dayKey(s.timestamp);return day>=from&&day<=to;});
  const rows=new Map(),series=new Map();let units=0,revenue=0,cost=0,fees=0;
  for(const s of sales){
    const r=s.unitPrice*s.quantity,c=s.unitCost*s.quantity,f=r*s.acquiringPercent/100,key=s.recipeId||s.recipeName;
    const row=rows.get(key)||{id:key,name:s.recipeName,units:0,revenue:0,cost:0,fees:0};
    row.units+=s.quantity;row.revenue+=r;row.cost+=c;row.fees+=f;rows.set(key,row);
    const date=dayKey(s.timestamp);series.set(date,(series.get(date)||0)+r);
    units+=s.quantity;revenue+=r;cost+=c;fees+=f;
  }
  const menu=[...rows.values()].sort((a,b)=>b.revenue-a.revenue);let cumulative=0;
  for(const r of menu){r.share=revenue?r.revenue/revenue:0;r.abc=cumulative<.8?'A':cumulative<.95?'B':'C';cumulative+=r.share;r.contribution=r.revenue-r.cost-r.fees;r.margin=r.revenue?r.contribution/r.revenue*100:null;}
  return {days,units,revenue,cost,fees,contribution:revenue-cost-fees,menu,averageDailyRevenue:revenue/days,series:Array.from({length:days},(_,i)=>{const date=shiftDay(from,i);return {date,revenue:series.get(date)||0};})};
}
export function menuAnalysis(cafe){
  const m=cafe.model,rows=m.recipes.map(r=>{const cost=unitCost(r,m),contribution=r.price*(1-m.acquiring/100)-cost;return {id:r.id,name:r.name,units:r.qty,unitCost:cost,price:r.price,contribution,revenue:r.qty*r.price,margin:r.price?contribution/r.price*100:null};});
  const total=rows.reduce((s,r)=>s+r.revenue,0);let cumulative=0;
  const avgUnits=rows.length?rows.reduce((s,r)=>s+r.units,0)/rows.length:0,avgContribution=rows.length?rows.reduce((s,r)=>s+r.contribution,0)/rows.length:0;
  return rows.sort((a,b)=>b.revenue-a.revenue).map(r=>{const abc=total?(cumulative<.8?'A':cumulative<.95?'B':'C'):'—';cumulative+=total?r.revenue/total:0;return {...r,abc,category:r.units>=avgUnits?(r.contribution>=avgContribution?'Лидер':'Популярный, низкий вклад'):(r.contribution>=avgContribution?'Высокий вклад, мало продаж':'Слабая позиция')};});
}
export function purchasing(cafe,{source='plan',leadDays=2,safetyDays=1,historyDays=7,today=dayKey()}={}){
  if(![leadDays,safetyDays].every(n=>Number.isFinite(n)&&n>=0&&n<=365)||!Number.isInteger(historyDays)||historyDays<1||historyDays>366)throw Error('Проверь горизонт закупок');
  const m=cafe.model,demand=Array(m.ingredients.length).fill(0),end=shiftDay(today,-1),start=shiftDay(end,1-historyDays);
  const sales=activeSales(cafe).filter(s=>{const date=dayKey(s.timestamp);return date>=start&&date<=end;});
  if(source==='history')for(const s of sales)for(const [i,q] of s.lines)demand[i]+=q*s.quantity/historyDays;
  else for(const r of m.recipes)for(const [i,q] of recipeLines(r,m))demand[i]+=q*r.qty;
  const stock=balances(cafe);
  return {source,observationDays:historyDays,recordedSales:sales.length,start,end,rows:m.ingredients.map((ingredient,i)=>{
    const need=demand[i]*(leadDays+safetyDays)+(cafe.stock.minimums[i]||0)-stock[i];
    const precision=ingredient.unit==='шт'?1:100;
    const quantity=Math.ceil(Math.max(0,need)*precision-1e-9)/precision;
    return {index:i,...ingredient,balance:stock[i],dailyUsage:demand[i],daysLeft:demand[i]>0?stock[i]/demand[i]:null,orderQuantity:quantity,orderCost:quantity*ingredient.price};
  })};
}
export function insights(cafe,options={}){
  const menu=menuAnalysis(cafe),plan=purchasing(cafe,options),notes=[];
  for(const r of menu)if(r.contribution<0)notes.push({level:'bad',title:r.name+' продаётся в минус',text:'Цена не покрывает ингредиенты и эквайринг. Вклад с порции: '+r.contribution.toFixed(2)+' ₽.'});
  const free=cafe.model.ingredients.filter(i=>i.price===0);if(free.length)notes.push({level:'warn',title:'Не заполнены закупочные цены: '+free.length,text:free.map(i=>i.name).join(', ')+'. Себестоимость и прибыль занижены/завышены соответственно.'});
  const negative=plan.rows.filter(r=>r.balance<0);if(negative.length)notes.push({level:'bad',title:'Отрицательные остатки',text:negative.map(i=>i.name).join(', ')+'. Проверь начальные остатки и журнал.'});
  const order=plan.rows.filter(r=>r.orderQuantity>0);if(order.length)notes.push({level:'warn',title:'Нужна закупка: '+order.length+' позиций',text:'Сумма по текущим ценам: '+order.reduce((s,r)=>s+r.orderCost,0).toFixed(0)+' ₽. Горизонт: '+(Number(options.leadDays??2)+Number(options.safetyDays??1))+' дней.'});
  const weak=menu.filter(r=>r.category==='Высокий вклад, мало продаж'&&r.contribution>0);if(weak.length)notes.push({level:'good',title:'Кандидаты для продвижения',text:weak.map(r=>r.name).join(', ')+'. Вклад выше среднего по меню, спрос ниже среднего.'});
  if(!activeSales(cafe).length)notes.push({level:'warn',title:'Пока нет фактических продаж',text:'Прогнозы основаны на плане из техкарт. Запиши продажи, чтобы сравнить план с фактом.'});
  if(!notes.length)notes.push({level:'good',title:'Критических сигналов нет',text:'В пределах введённых данных. Сверь расчётные остатки с инвентаризацией.'});
  return notes;
}
