import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeCafe,sell,cancelSale,unitCost} from './workspace.js';
import {dayKey,shiftDay,periodDays,actualReport,menuAnalysis,purchasing,insights} from './analytics.js';
const cafe=()=>{const c=makeCafe();c.stock.opening=[10000,100000,1000,1000,10000];return c;};
test('Moscow midnight and inclusive calendar periods',()=>{
 assert.equal(dayKey('2026-11-15T21:30:00Z'),'2026-11-16');assert.equal(shiftDay('2026-03-01',-1),'2026-02-28');assert.equal(periodDays('2026-11-01','2026-11-07'),7);
 assert.throws(()=>periodDays('2026-11-07','2026-11-01'));assert.throws(()=>periodDays('2026-02-30','2026-03-01'));
});
test('actual revenue and consumption use original snapshots, include zero-sale days, exclude voids',()=>{
 let c=cafe(),r=c.model.recipes[0];const cost=unitCost(r,c.model);c=sell(c,{recipeId:r.id,quantity:10,timestamp:'2026-11-15T22:00:00Z'});c.model.recipes[0].price=999;c.model.ingredients[0].price=100;
 let report=actualReport(c,'2026-11-15','2026-11-16');assert.equal(report.revenue,2500);assert.equal(report.cost,cost*10);assert.equal(report.averageDailyRevenue,1250);assert.equal(report.fees,50);assert.equal(report.series[0].revenue,0);assert.equal(report.series[1].revenue,2500);
 c=cancelSale(c,c.stock.sales[0].id,'Ошибка');assert.equal(actualReport(c,'2026-11-15','2026-11-16').units,0);
});
test('purchasing subtracts current stock, adds minimum and rounds units correctly',()=>{
 const c=makeCafe();c.stock.opening=[1.1,0,1.5,0,0];c.stock.minimums=[10];c.model.recipes.forEach(r=>r.qty=0);c.model.recipes[0].qty=1;
 const p=purchasing(c,{leadDays:2,safetyDays:1});assert.equal(p.rows[0].orderQuantity,62.9);assert.equal(p.rows[2].orderQuantity,2);assert.equal(p.rows[1].orderQuantity,540);
});
test('historical purchasing uses completed days and freezes historical quantities',()=>{
 let c=cafe(),r=c.model.recipes[0];c=sell(c,{recipeId:r.id,quantity:7,timestamp:'2026-11-15T08:00:00Z'});c.model.recipes[0].lines=[[0,999]];
 const p=purchasing(c,{source:'history',today:'2026-11-16',historyDays:7});assert.equal(p.rows[0].dailyUsage,18);assert.equal(p.rows[1].dailyUsage,180);assert.equal(p.recordedSales,1);
 const noHistory=purchasing(c,{source:'history',today:'2026-11-15',historyDays:7});assert.equal(noHistory.rows[0].dailyUsage,0);
});
test('menu contribution and local signals flag negative unit economics and missing prices',()=>{
 const c=cafe();c.model.recipes[0].price=1;c.model.ingredients[4].price=0;
 assert.ok(menuAnalysis(c).find(r=>r.id===c.model.recipes[0].id).contribution<0);const notes=insights(c);assert.ok(notes.some(r=>r.title.includes('минус')));assert.ok(notes.some(r=>r.title.includes('цены')));
});
