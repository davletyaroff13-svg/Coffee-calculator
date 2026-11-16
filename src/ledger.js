/* Append-only stock ledger: movements are immutable records, corrections use reversal entries. */
export function validateMovement(m, ingredientCount) {
  if (!m || typeof m !== 'object' || !['receipt','writeoff','adjustment'].includes(m.type)) throw Error('Неизвестный тип движения');
  if (typeof m.id !== 'string' || !m.id.trim() || m.id.length > 120) throw Error('Некорректный ID');
  if (!Number.isInteger(m.ingredientIndex) || m.ingredientIndex < 0 || m.ingredientIndex >= ingredientCount) throw Error('Неизвестный ингредиент');
  if (typeof m.quantity !== 'number' || !Number.isFinite(m.quantity) || (m.type !== 'adjustment' && m.quantity <= 0)) throw Error('Некорректное количество');
  if (typeof m.timestamp !== 'string' || !Number.isFinite(Date.parse(m.timestamp))) throw Error('Некорректная дата');
  if (typeof m.reason !== 'string' || !m.reason.trim() || m.reason.length > 500) throw Error('Нужна причина операции');
  return m;
}
export function appendMovement(ledger, movement, ingredientCount) {
  validateMovement(movement, ingredientCount);
  if (ledger.some(m => m.id === movement.id)) throw Error('Дублирующийся ID операции');
  return [...ledger, Object.freeze({...movement})];
}
export function ledgerBalances(ledger, opening, ingredientCount) {
  const balances = Array.from({length: ingredientCount}, (_,i) => {
    const n = opening[i] ?? 0;
    if (!Number.isFinite(n) || n < 0) throw Error('Некорректный начальный остаток');
    return n;
  });
  const ids = new Set();
  for (const m of ledger) {
    validateMovement(m, ingredientCount);
    if (ids.has(m.id)) throw Error('Повтор операции');
    ids.add(m.id);
    balances[m.ingredientIndex] += m.type === 'receipt' ? m.quantity : m.type === 'writeoff' ? -m.quantity : m.quantity;
  }
  return balances;
}
export function recordMovement({ledger, opening, ingredientCount, movement, allowNegative = false}) {
  const next = appendMovement(ledger, movement, ingredientCount);
  const balances = ledgerBalances(next, opening, ingredientCount);
  if (!allowNegative && balances.some(n => n < -1e-9)) throw Error('Операция создаёт отрицательный остаток');
  return {ledger:next, balances};
}
export function reverseMovement(ledger, originalId, reversalId, timestamp, reason, opening, ingredientCount) {
  const original = ledger.find(m => m.id === originalId);
  if (!original) throw Error('Исходная операция не найдена');
  const type = original.type === 'receipt' ? 'writeoff' : original.type === 'writeoff' ? 'receipt' : 'adjustment';
  const quantity = original.type === 'adjustment' ? -original.quantity : original.quantity;
  return recordMovement({ledger,opening,ingredientCount,movement:{id:reversalId,type,ingredientIndex:original.ingredientIndex,quantity,timestamp,reason:'Отмена '+originalId+': '+reason}});
}

