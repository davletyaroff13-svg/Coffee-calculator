import {recipeCost,menuEconomics,financialReport} from './finance.js';
const ingredients=[{name:'Кофе',price:2},{name:'Молоко',price:0.1}];
const recipes=[{name:'Капучино',price:200,qty:10,lines:[[0,18],[1,180]]}];
const check=(actual,expected)=>{if(actual!==expected)throw new Error('Expected '+expected+' but got '+actual);};
check(recipeCost(recipes[0],ingredients),54);
const menu=menuEconomics({recipes,ingredients,acquiringPercent:2});
check(menu[0].contribution,142);
check(menu[0].revenue,2000);
const report=financialReport({recipes,ingredients,days:30,rent:20000,payroll:10000,acquiringPercent:2,taxPercent:10});
check(report.revenue,60000);
check(report.ingredientCost,16200);
check(report.acquiring,1200);
check(report.fixed,30000);
check(report.profitBeforeTax,12600);
check(report.estimatedTax,1260);
check(report.estimatedProfit,11340);
check(report.breakevenCupsPerDay,8);
let rejected=false;
try{recipeCost({lines:[[3,1]]},ingredients)}catch{rejected=true}
check(rejected,true);
console.log('Finance tests passed');

