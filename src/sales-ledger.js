/* Recorded sales are separate from forecast quantities in recipes. */
export function validateSale(sale, recipes) {
  if (!sale || typeof sale.id !== 'string' || !sale.id.trim()) throw Error('Нужен ID продажи');
  if (typeof sale.recipeName !== 'string' || !recipes.some(r=>r.name===sale.recipeName)) throw Error('Нет техкарты продажи');
  if (!Number.isFinite(sale.quantity) || sale.quantity <= 0) throw Error('Некорректное количество продажи');
  if (typeof sale.timestamp !== 'string' || !Number.isFinite(Date.parse(sale.timestamp))) throw Error('Некорректная дата продажи');
  return sale;
}
export function appendSale(sales, sale, recipes) {
  validateSale(sale, recipes);
  if (sales.some(s=>s.id===sale.id)) throw Error('Дубликат продажи');
  return [...sales, {...sale}];
}
export function salesConsumption(sales, recipes, ingredientCount) {
  const quantities=Array(ingredientCount).fill(0);
  for(const sale of sales) {
    validateSale(sale, recipes);
    const recipe=recipes.find(r=>r.name===sale.recipeName);
    for(const [index,amount] of recipe.lines) {
      if(!Number.isInteger(index)||index<0||index>=ingredientCount||!Number.isFinite(amount)||amount<0)throw Error('Некорректная техкарта');
      quantities[index]+=amount*sale.quantity;
    }
  }
  return quantities;
}
export function availableAfterSales({opening, ledger, sales, recipes, ingredientCount}) {
  const balances=Array.from({length:ingredientCount},(_,i)=>opening[i]??0);
  for(const m of ledger){
    if(!Number.isInteger(m.ingredientIndex)||m.ingredientIndex<0||m.ingredientIndex>=ingredientCount)throw Error('Неизвестный ингредиент');
    balances[m.ingredientIndex]+=(m.type==='receipt'?1:m.type==='writeoff'?-1:1)*m.quantity;
  }
  const used=salesConsumption(sales,recipes,ingredientCount);
  return balances.map((n,i)=>n-used[i]);
}
export function recordSale({sales, sale, recipes, opening, ledger, ingredientCount, allowNegative=false}) {
  const next=appendSale(sales,sale,recipes);
  const balances=availableAfterSales({opening,ledger,sales:next,recipes,ingredientCount});
  if(!allowNegative&&balances.some(n=>n< -1e-9))throw Error('Недостаточный остаток для продажи');
  return {sales:next,balances};
}
