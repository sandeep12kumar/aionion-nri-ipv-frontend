import { Navigate, Route, Routes } from 'react-router-dom';
import { getStaffUser } from './shared/api';
import StaffLayout, { RequireRole } from './shared/StaffLayout';
import Login from './portals/Login';
import Dashboard from './portals/admin/Dashboard';
import Applications from './portals/admin/Applications';
import ApplicationForm from './portals/admin/ApplicationForm';
import ApplicationDetail from './portals/admin/ApplicationDetail';
import Users from './portals/admin/Users';
import AuditLogs from './portals/admin/AuditLogs';
import Outbox from './portals/admin/Outbox';
import Cases from './portals/agent/Cases';
import SessionRoom from './portals/agent/SessionRoom';
import CustomerFlow from './portals/customer/CustomerFlow';

function Home() {
  const user = getStaffUser();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/agent'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/invite/:token" element={<CustomerFlow />} />

      <Route path="/admin" element={<RequireRole role="ADMIN"><StaffLayout /></RequireRole>}>
        <Route index element={<Dashboard />} />
        <Route path="applications" element={<Applications />} />
        <Route path="applications/new" element={<ApplicationForm />} />
        <Route path="applications/:id" element={<ApplicationDetail />} />
        <Route path="applications/:id/edit" element={<ApplicationForm />} />
        <Route path="users" element={<Users />} />
        <Route path="audit" element={<AuditLogs />} />
        <Route path="outbox" element={<Outbox />} />
      </Route>

      <Route path="/agent" element={<RequireRole role="AGENT"><StaffLayout /></RequireRole>}>
        <Route index element={<Cases />} />
      </Route>
      <Route path="/agent/session/:sessionId" element={<RequireRole role="AGENT"><SessionRoom /></RequireRole>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
