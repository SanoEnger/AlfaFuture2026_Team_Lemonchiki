export type Role = "CLIENT" | "BANK_EMPLOYEE" | "BANK_OFFICER" | "BANK_ADMIN";
export type Status =
  | "DRAFT"
  | "SUBMITTED"
  | "VERIFYING"
  | "NEEDS_INFO"
  | "UNDER_REVIEW"
  | "OFFERED"
  | "REJECTED"
  | "ACCEPTED"
  | "DECLINED"
  | "COMPLETED";
export interface Session {
  role: Role;
  username: string;
  displayName?: string;
  email?: string;
  onboardingComplete?: boolean;
  sessionVersion?: number;
  issuedAt?: number;
  demoAccount?: boolean;
  mode?: "demo" | "api";
}
export interface Financials {
  revenue: string;
  expenses: string;
  debt_payment: string;
  months_active: number;
}
export interface Company extends Financials {
  id: string;
  inn: string;
  legal_name: string;
  form: string;
  industry: string;
}
export interface Product {
  id: string;
  code: string;
  name: string;
  purpose: string;
  description: string;
  min_amount: string;
  max_amount: string;
  min_term: number;
  max_term: number;
  annual_rate: string;
}
export interface Terms {
  product_id: string;
  amount: string;
  term_months: number;
  purpose: string;
  comment?: string;
}
export interface Offer {
  amount: string;
  term_months: number;
  annual_rate: string;
  reason: string;
  created_at: string;
}
export interface Event {
  id: string;
  to_status: Status;
  reason: string;
  occurred_at: string;
}
export interface Document {
  id: string;
  file_name: string;
  size_bytes: number;
  created_at: string;
}
export interface InfoRequest {
  id: string;
  message: string;
  status: "OPEN" | "RESOLVED";
  created_at: string;
}
export interface Risk {
  score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  recommendation: string;
  rules_version: string;
  calculated_at?: string;
  factors: {
    code: string;
    direction: string;
    points: number;
    explanation: string;
  }[];
}
export interface Application {
  id: string;
  owner: string;
  status: Status;
  requested_terms: Terms;
  company: Company;
  updated_at: string;
  next_action: string;
  latest_offer: Offer | null;
  documents: Document[];
  information_requests: InfoRequest[];
  events: Event[];
  risk: Risk | null;
  version?: number;
  assigned_officer_id?: string | null;
  submitted_at?: string;
}
export interface News {
  id: string;
  title: string;
  body: string;
  category: string;
  industry: string;
  date: string;
}
export interface Draft extends Terms {
  company_financials: Financials;
}
