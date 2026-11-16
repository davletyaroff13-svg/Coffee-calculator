/* Coffee Control 5.0 inventory engine. Pure functions, no network or browser storage. */
export function assertQuantity(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Количество должно быть неотрицательным числом');
  return value;
}
export function ingredientUsage(recipes, sales) {
  const used = new Map();
  for (const sale of sales) {
    assertQuantity(sale.quantity);
    const recipe = recipes.find(r => r.name === sale.name);
    if (!recipe) throw new Error('Не найдена техкарта: ' + sale.name);
    for (const [ingredientIndex, quantity] of recipe.lines) {
      assertQuantity(quantity);
      used.set(ingredientIndex, (used.get(ingredientIndex) || 0) + quantity * sale.quantity);
    }
  }
  return used;
}
export function stockReport({ingredients, recipes, sales = [], receipts = [], writeoffs = [], opening = [], minimums = []}) {
  const used = ingredientUsage(recipes, sales);
  const totals = ingredients.map((ingredient, index) => {
    const openingQty = assertQuantity(opening[index] || 0);
    const incoming = receipts.filter(x => x.ingredientIndex === index).reduce((n,x) => n + assertQuantity(x.quantity), 0);
    const writtenOff = writeoffs.filter(x => x.ingredientIndex === index).reduce((n,x) => n + assertQuantity(x.quantity), 0);
    const theoreticalUsage = used.get(index) || 0;
    const balance = openingQty + incoming - writtenOff - theoreticalUsage;
    const minimum = assertQuantity(minimums[index] || 0);
    return {ingredient: ingredient.name, unit: ingredient.unit, opening: openingQty, incoming, writtenOff, theoreticalUsage, balance, minimum, lowStock: balance < minimum, negativeStock: balance < 0};
  });
  for (const movement of [...receipts, ...writeoffs]) {
    if (!Number.isInteger(movement.ingredientIndex) || movement.ingredientIndex < 0 || movement.ingredientIndex >= ingredients.length) throw new Error('Неизвестный ингредиент');
  }
  return totals;
}
export function purchasingPlan({report, projectedDailySales, leadDays, safetyDays = 0}) {
  assertQuantity(leadDays); assertQuantity(safetyDays);
  return report.map((item, index) => {
    const demand = assertQuantity(projectedDailySales[index] || 0) * (leadDays + safetyDays);
    return {...item, orderQuantity: Math.max(0, Math.ceil(demand + item.minimum - item.balance))};
  });
}

