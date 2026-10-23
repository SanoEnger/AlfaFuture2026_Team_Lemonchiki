import { Navigate, Route, Routes as RouterRoutes } from "react-router-dom";
import { useSession } from "./session";
import { Login } from "./Login";
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
  if (!session) return <Navigate to="/login" replace />;
  if ((session.role === "BANK_EMPLOYEE") !== bank)
    return (
      <Navigate
        to={
          session.role === "CLIENT" ? "/client/dashboard" : "/bank/applications"
        }
        replace
      />
    );
  return <AppShell />;
}
export function Routes() {
  return (
    <RouterRoutes>
      <Route path="/login" element={<Login />} />
      <Route path="/client" element={<Guard />}>
        <Route index element={<Navigate to="dashboard" replace />} />
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
