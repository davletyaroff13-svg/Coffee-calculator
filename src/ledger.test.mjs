import {recordMovement,reverseMovement,ledgerBalances} from './ledger.js';
const time='2026-11-16T09:00:00+03:00';
const receipt={id:'r1',type:'receipt',ingredientIndex:0,quantity:10,timestamp:time,reason:'Поставка'};
const first=recordMovement({ledger:[],opening:[5],ingredientCount:1,movement:receipt});
if(first.balances[0]!==15)throw Error('Receipt failed');
const writeoff={id:'w1',type:'writeoff',ingredientIndex:0,quantity:3,timestamp:time,reason:'Порча'};
const second=recordMovement({ledger:first.ledger,opening:[5],ingredientCount:1,movement:writeoff});
if(second.balances[0]!==12)throw Error('Writeoff failed');
const undone=reverseMovement(second.ledger,'w1','rev1',time,'Исправление',[5],1);
if(undone.balances[0]!==15)throw Error('Reversal failed');
if(ledgerBalances(second.ledger,[5],1)[0]!==12)throw Error('Ledger mutation');
let rejected=0;
for(const movement of [{...writeoff,id:'w2',quantity:100},{...receipt,id:'r1'}]){
try{recordMovement({ledger:second.ledger,opening:[5],ingredientCount:1,movement});}catch{rejected++;}
}
if(rejected!==2)throw Error('Validation failed');
console.log('Ledger tests passed');

