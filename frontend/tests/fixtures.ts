import type { Application, Product } from "../shared/api/types";
export const product: Product = {
  id: "product-1",
  code: "WORKING_CAPITAL",
  name: "Оборотный",
  purpose: "WORKING_CAPITAL",
  description: "Текущие расходы",
  min_amount: "50000",
  max_amount: "5000000",
  min_term: 3,
  max_term: 36,
  annual_rate: "18",
};
export function application(): Application {
  return {
    id: "case-1042",
    owner: "client",
    status: "UNDER_REVIEW",
    requested_terms: {
      product_id: product.id,
      amount: "1800000",
      term_months: 24,
      purpose: product.purpose,
    },
    company: {
      id: "company",
      inn: "7701234567",
      legal_name: "Компания",
      form: "ООО",
      industry: "TRADE",
      revenue: "2000000",
      expenses: "700000",
      debt_payment: "10000",
      months_active: 60,
    },
    updated_at: "2026-10-24T00:00:00Z",
    next_action: "Ожидайте решения",
    latest_offer: null,
    documents: [],
    information_requests: [],
    events: [],
    risk: null,
  };
}
