import {
  Navigate,
  Route,
  Routes as RouterRoutes,
  useLocation,
} from "react-router-dom";
import { useSession } from "./session";
import { ServerLogin } from "../features/auth/ServerLogin";
import { AuthPage, LoginPage } from "../features/auth/AuthPages";
import { Onboarding } from "../features/company/CompanyEditor";
import { Administration } from "../features/bank/Administration";
import { sessionHome } from "../shared/api/identity";
import { AppShell } from "../components/layout/AppShell";
import { Dashboard } from "../features/applications/Dashboard";
import { ApplicationList } from "../features/applications/ApplicationList";
import { ApplicationDetail } from "../features/applications/ApplicationDetail";
import { Wizard } from "../features/applications/Wizard";
import { Products } from "../features/products/Products";
import { Company } from "../features/company/Company";
import { Documents } from "../features/documents/Documents";
import { News } from "../features/news/News";
import { Settings } from "./Settings";
import { UIStates } from "./UIStates";
import { Panel, PageTitle } from "../components/ui/common";
function Guard({ bank = false }: { bank?: boolean }) {
  const { session } = useSession();
  const { pathname } = useLocation();
  if (!session) return <Navigate to="/login" replace />;
  if ((session.role !== "CLIENT") !== bank)
    return <Navigate to={sessionHome(session)} replace />;
  if (
    !bank &&
    session.onboardingComplete === false &&
    pathname !== "/client/onboarding"
  )
    return <Navigate to="/client/onboarding" replace />;
  if (
    !bank &&
    session.onboardingComplete !== false &&
    pathname === "/client/onboarding"
  )
    return <Navigate to="/client/dashboard" replace />;
  if (
    bank &&
    pathname.startsWith("/bank/administration") &&
    session.role !== "BANK_ADMIN"
  )
    return <Navigate to="/bank/applications" replace />;
  return <AppShell />;
}
export function Routes() {
  return (
    <RouterRoutes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/demo-login" element={<Navigate to="/login" replace />} />
      <Route path="/server-login" element={<ServerLogin />} />
      <Route
        path="/register"
        element={<AuthPage key="register" mode="register" />}
      />
      <Route
        path="/verify-email"
        element={<AuthPage key="verify" mode="verify" />}
      />
      <Route
        path="/forgot-password"
        element={<AuthPage key="forgot" mode="forgot" />}
      />
      <Route
        path="/reset-password"
        element={<AuthPage key="reset" mode="reset" />}
      />
      <Route
        path="/accept-invitation"
        element={<AuthPage key="invitation" mode="invitation" />}
      />
      <Route path="/demo-mailbox" element={<Navigate to="/login" replace />} />
      <Route path="/client" element={<Guard />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="onboarding" element={<Onboarding />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="applications" element={<ApplicationList />} />
        <Route path="applications/new" element={<Wizard />} />
        <Route path="applications/:id" element={<ApplicationDetail />} />
        <Route path="products" element={<Products />} />
        <Route path="company" element={<Company />} />
        <Route path="documents" element={<Documents />} />
        <Route path="news" element={<News />} />
        <Route path="settings" element={<Settings />} />
        <Route path="ui-states" element={<UIStates />} />
      </Route>
      <Route path="/bank" element={<Guard bank />}>
        <Route index element={<Navigate to="applications" replace />} />
        <Route path="applications" element={<ApplicationList bank />} />
        <Route path="applications/:id" element={<ApplicationDetail bank />} />
        <Route path="settings" element={<Settings />} />
        <Route path="administration" element={<Administration />} />
        <Route path="administration/staff" element={<Administration />} />
        <Route path="administration/invitations" element={<Administration />} />
        <Route path="administration/audit" element={<Administration />} />
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route
        path="*"
        element={
          <>
            <PageTitle title="Страница не найдена" />
            <Panel>
              <a href="/">Вернуться в кабинет</a>
            </Panel>
          </>
        }
      />
    </RouterRoutes>
  );
}
