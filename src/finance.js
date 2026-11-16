/* Pure financial calculations for Coffee Control 5.0.
   These are managerial estimates, not tax declarations. */
const nonnegative = (n, label) => {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw new Error(label + ': требуется неотрицательное число');
  return n;
};
export function recipeCost(recipe, ingredients) {
  return recipe.lines.reduce((sum, [index, quantity]) => {
    if (!Number.isInteger(index) || !ingredients[index]) throw new Error('Неизвестный ингредиент в техкарте');
    return sum + nonnegative(quantity, 'Количество') * nonnegative(ingredients[index].price, 'Цена ингредиента');
  }, 0);
}
export function menuEconomics({recipes, ingredients, acquiringPercent = 0}) {
  nonnegative(acquiringPercent, 'Эквайринг');
  if (acquiringPercent > 100) throw new Error('Эквайринг не может превышать 100%');
  return recipes.map(recipe => {
    const price = nonnegative(recipe.price, 'Цена продажи');
    const units = nonnegative(recipe.qty, 'Продажи');
    const unitCost = recipeCost(recipe, ingredients);
    const contribution = price * (1 - acquiringPercent / 100) - unitCost;
    return {name: recipe.name, price, units, unitCost, contribution, revenue: price * units,
      cost: unitCost * units, marginPercent: price ? 100 * contribution / price : null};
  });
}
export function financialReport({recipes, ingredients, days = 30, rent = 0, payroll = 0, otherFixed = 0, acquiringPercent = 0, taxPercent = 0}) {
  nonnegative(days, 'Дней'); nonnegative(rent, 'Аренда'); nonnegative(payroll, 'ФОТ'); nonnegative(otherFixed, 'Прочие расходы'); nonnegative(taxPercent, 'Условный налог');
  if (days > 366 || taxPercent > 100) throw new Error('Недопустимый период или налог');
  const menu = menuEconomics({recipes, ingredients, acquiringPercent});
  const dailyRevenue = menu.reduce((sum, r) => sum + r.revenue, 0);
  const dailyCost = menu.reduce((sum, r) => sum + r.cost, 0);
  const dailyUnits = menu.reduce((sum, r) => sum + r.units, 0);
  const revenue = dailyRevenue * days;
  const ingredientCost = dailyCost * days;
  const acquiring = revenue * acquiringPercent / 100;
  const fixed = rent + payroll + otherFixed;
  const profitBeforeTax = revenue - ingredientCost - acquiring - fixed;
  const estimatedTax = Math.max(0, profitBeforeTax) * taxPercent / 100;
  const estimatedProfit = profitBeforeTax - estimatedTax;
  const contributionPerCup = dailyUnits ? (dailyRevenue - dailyCost - dailyRevenue * acquiringPercent / 100) / dailyUnits : null;
  const breakevenCupsPerDay = days > 0 && contributionPerCup > 0 ? Math.ceil(fixed / days / contributionPerCup) : null;
  return {menu, dailyRevenue, revenue, ingredientCost, acquiring, fixed, profitBeforeTax, estimatedTax, estimatedProfit, breakevenCupsPerDay, assumptions:'Продажи в техкартах считаются дневным прогнозом; налог условный, не налоговый учёт.'};
}

