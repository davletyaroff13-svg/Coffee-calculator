import {ingredientUsage, stockReport, purchasingPlan} from './inventory.js';
const ingredients=[{name:'Кофе',unit:'г'},{name:'Молоко',unit:'мл'}];
const recipes=[{name:'Капучино',lines:[[0,18],[1,180]]}];
function equal(actual, expected){if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(JSON.stringify({actual,expected}));}
equal([...ingredientUsage(recipes,[{name:'Капучино',quantity:2}])],[[0,36],[1,360]]);
const report=stockReport({ingredients,recipes,sales:[{name:'Капучино',quantity:2}],opening:[100,500],receipts:[{ingredientIndex:1,quantity:200}],writeoffs:[{ingredientIndex:0,quantity:4}],minimums:[50,400]});
equal(report.map(x=>x.balance),[60,340]);
equal(report.map(x=>x.lowStock),[false,true]);
equal(purchasingPlan({report,projectedDailySales:[18,180],leadDays:2}).map(x=>x.orderQuantity),[26,420]);
console.log('Inventory tests passed');

