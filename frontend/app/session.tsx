import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "../shared/api/types";
import { restoreServerSession } from "../shared/api/server";
import { LoadingState } from "../components/ui/states";
const Context = createContext<{
  session: Session | null;
  setSession: (s: Session | null) => void;
}>({ session: null, setSession: () => {} });
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, set] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const qc = useQueryClient();
  function setSession(s: Session | null) {
    qc.clear();
    set(s);
  }
  useEffect(() => {
    let active = true;
    restoreServerSession()
      .then((s) => {
        if (active) set(s);
      })
      .catch(() => {
        if (active) set(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const expired = () => setSession(null);
    window.addEventListener("credit-auth-expired", expired);
    return () => window.removeEventListener("credit-auth-expired", expired);
  }, []);
  return (
    <Context.Provider value={{ session, setSession }}>
      {checking ? <LoadingState /> : children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
