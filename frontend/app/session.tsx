import { createContext, useContext, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "../shared/api/types";
const key = "smart-credit-demo-session";
function read(): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(key) || "null");
    return s && ["CLIENT", "BANK_EMPLOYEE"].includes(s.role) ? s : null;
  } catch {
    return null;
  }
}
const Context = createContext<{
  session: Session | null;
  setSession: (s: Session | null) => void;
}>({ session: null, setSession: () => {} });
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, set] = useState(read);
  const qc = useQueryClient();
  function setSession(s: Session | null) {
    qc.clear();
    if (s) sessionStorage.setItem(key, JSON.stringify(s));
    else sessionStorage.removeItem(key);
    set(s);
  }
  return (
    <Context.Provider value={{ session, setSession }}>
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
