import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from '@/lib/store';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Employees from '@/pages/Employees';
import Attendance from '@/pages/Attendance';
import Projects from '@/pages/Projects';
import Sites from '@/pages/Sites';
import Zones from '@/pages/Zones';
import Roles from '@/pages/Roles';
import Requests from '@/pages/Requests';
import Patrols from '@/pages/Patrols';
import Handovers from '@/pages/Handovers';
import Reports from '@/pages/Reports';
import SmartReports from '@/pages/SmartReports';
import Settings from '@/pages/Settings';
import SitesCapacity from '@/pages/SitesCapacity';
import FieldVisits from '@/pages/FieldVisits';
import Violations from '@/pages/Violations';
import Finance from '@/pages/Finance';
import HrLeaves from '@/pages/hr/Leaves';
import HrPayroll from '@/pages/hr/Payroll';
import HrEmployees from '@/pages/hr/HrEmployees';
import HrAudit from '@/pages/hr/Audit';
import HrDashboard from '@/pages/hr/HrDashboard';
import Recruitment from '@/pages/Recruitment';
import ImportEmployees from '@/pages/hr/ImportEmployees';
import ImportPayroll from '@/pages/hr/ImportPayroll';
import MobileApp from '@/pages/MobileApp';
import MapCenter from '@/pages/MapCenter';
import AuthReturn from '@/pages/AuthReturn';
import Alerts from '@/pages/Alerts';
import AuditLog from '@/pages/AuditLog';

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/app" element={<MobileApp />} />
    <Route path="/auth/callback" element={<AuthReturn />} />
    <Route element={<Layout />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/employees" element={<Employees />} />
      <Route path="/attendance" element={<Attendance />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/sites" element={<Sites />} />
      <Route path="/zones" element={<Zones />} />
      <Route path="/roles" element={<Roles />} />
      <Route path="/requests" element={<Requests />} />
      <Route path="/patrols" element={<Patrols />} />
      <Route path="/handovers" element={<Handovers />} />
      <Route path="/alerts" element={<Alerts />} />
      <Route path="/audit" element={<AuditLog />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/smart-reports" element={<SmartReports />} />
      <Route path="/sites-capacity" element={<SitesCapacity />} />
      <Route path="/field-visits" element={<FieldVisits />} />
      <Route path="/violations" element={<Violations />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/finance" element={<Finance />} />
      <Route path="/hr/leaves" element={<HrLeaves />} />
      <Route path="/hr/payroll" element={<HrPayroll />} />
      <Route path="/hr/employees" element={<HrEmployees />} />
      <Route path="/hr/employees/:code" element={<HrEmployees />} />
      <Route path="/hr/audit" element={<HrAudit />} />
      <Route path="/hr/dashboard" element={<HrDashboard />} />
      <Route path="/recruitment" element={<Recruitment />} />
      <Route path="/hr/import-employees" element={<ImportEmployees />} />
      <Route path="/hr/import-payroll" element={<ImportPayroll />} />
      <Route path="/map-center" element={<MapCenter />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <StoreProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </StoreProvider>
  </QueryClientProvider>
);

export default App;
export { AppRoutes };