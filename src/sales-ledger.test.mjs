import {recordSale,availableAfterSales} from './sales-ledger.js';
const recipes=[{name:'Капучино',lines:[[0,18],[1,180]]}];
const sale={id:'s1',recipeName:'Капучино',quantity:2,timestamp:'2026-11-16T09:00:00+03:00'};
const result=recordSale({sales:[],sale,recipes,opening:[100,500],ledger:[],ingredientCount:2});
if(result.balances[0]!==64||result.balances[1]!==140)throw Error('Wrong consumption');
const balances=availableAfterSales({opening:[100,500],ledger:[{type:'receipt',ingredientIndex:1,quantity:100}],sales:result.sales,recipes,ingredientCount:2});
if(balances[1]!==240)throw Error('Receipt not applied');
let errors=0;
for(const invalid of [{...sale,id:'s1'}, {...sale,id:'s2',quantity:4}]){
try{recordSale({sales:result.sales,sale:invalid,recipes,opening:[100,500],ledger:[],ingredientCount:2});}catch{errors++}
}
if(errors!==2)throw Error('Duplicate or stock guard failed');
console.log('Sales ledger tests passed');
