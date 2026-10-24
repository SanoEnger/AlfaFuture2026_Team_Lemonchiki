import type { Company } from "./types";
const key = "smart-credit-demo-companies";
export function readCompanies(): Record<string, Company> {
  return JSON.parse(localStorage.getItem(key) || "{}");
}
export function saveCompany(owner: string, company: Company) {
  const companies = readCompanies();
  companies[owner] = structuredClone(company);
  localStorage.setItem(key, JSON.stringify(companies));
  return company;
}
