import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "../shared/api/types";
import { identity } from "../shared/api/identity";
import { hasAccessToken, setAccessToken } from "../shared/api/http";
import { restoreServerSession } from "../shared/api/server";
import { LoadingState } from "../components/ui/states";
const key = "smart-credit-demo-session";
function read(): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(key) || "null");
    if (
      !s ||
      !["CLIENT", "BANK_EMPLOYEE", "BANK_OFFICER", "BANK_ADMIN"].includes(
        s.role,
      )
    )
      return null;
    if (s.issuedAt && Date.now() - s.issuedAt > 12 * 60 * 60 * 1000)
      return null;
    if (s.mode === "api") return hasAccessToken() ? s : null;
    return s.demoAccount || identity.validate(s) ? s : null;
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
  const [checking, setChecking] = useState(() => session?.mode === "api");
  const qc = useQueryClient();
  useEffect(() => {
    if (!checking) return;
    let active = true;
    restoreServerSession()
      .then((s) => {
        if (active) setSession(s);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    let lastActivity = Date.now();
    const activity = () => {
      lastActivity = Date.now();
    };
    const validate = () => {
      if (
        (session.mode !== "api" &&
          !session.demoAccount &&
          !identity.validate(session)) ||
        Date.now() - lastActivity > 30 * 60 * 1000 ||
        (session.issuedAt &&
          Date.now() - session.issuedAt > 12 * 60 * 60 * 1000)
      )
        setSession(null);
    };
    const timer = setInterval(validate, 15000);
    window.addEventListener("storage", validate);
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", validate);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
    };
  }, [session]);
  useEffect(() => {
    const expired = () => setSession(null);
    window.addEventListener("credit-auth-expired", expired);
    return () => window.removeEventListener("credit-auth-expired", expired);
  }, []);
  function setSession(s: Session | null) {
    qc.clear();
    if (s) sessionStorage.setItem(key, JSON.stringify(s));
    else {
      sessionStorage.removeItem(key);
      setAccessToken(null);
    }
    set(s);
  }
  return (
    <Context.Provider value={{ session, setSession }}>
      {checking ? <LoadingState /> : children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
