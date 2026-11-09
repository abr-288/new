/** Marge brute = contribution du donateur − (budget d'exécution + frais prestataires + autres frais). */
export function margin(r: { totalAmount: number; executionBudget: number; otherFees: number }, providerFees: number) {
  const cost = r.executionBudget + providerFees + r.otherFees;
  const gross = r.totalAmount - cost;
  return { cost, gross, pct: r.totalAmount > 0 ? (gross / r.totalAmount) * 100 : 0 };
}
