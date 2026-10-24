import type { Draft, Product } from "./api/types";
export function minorUnits(value: string): bigint | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function validateDraft(
  draft: Draft,
  product?: Product,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const amount = minorUnits(draft.amount);
  if (
    !product ||
    amount === null ||
    amount < minorUnits(product.min_amount)! ||
    amount > minorUnits(product.max_amount)!
  )
    errors.amount = "Сумма вне диапазона продукта";
  if (
    !product ||
    !Number.isInteger(draft.term_months) ||
    draft.term_months < product.min_term ||
    draft.term_months > product.max_term
  )
    errors.term_months = "Срок вне диапазона продукта";
  if (!draft.purpose.trim()) errors.purpose = "Укажите цель кредита";
  for (const key of ["revenue", "expenses", "debt_payment"] as const)
    if (minorUnits(draft.company_financials[key]) === null)
      errors[key] =
        "Укажите неотрицательное денежное значение с точностью до копеек";
  if (
    !Number.isInteger(draft.company_financials.months_active) ||
    draft.company_financials.months_active < 0 ||
    draft.company_financials.months_active > 1200
  )
    errors.months_active = "Укажите возраст бизнеса от 0 до 1200 месяцев";
  return errors;
}
