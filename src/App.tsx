import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/auth-provider';
import { ProtectedRoute } from './components/protected-route';

import Login from './pages/login';
import PublicDashboard from './pages/public-dashboard';
import CertificatePreview from './pages/admin/certificate-preview';
import VerificationPage from './pages/verification-page';
import StaffLayout from './layouts/staff-layout';
import StaffEventList from './pages/staff/event-list';
import EventDetails from './pages/staff/event-details';
import OfftrackLayout from './layouts/offtrack-layout';
import OfftrackDashboard from './pages/offtrack/dashboard';
import OfftrackEvents from './pages/offtrack/events';
import OfftrackParticipants from './pages/offtrack/participants';
import OfftrackResults from './pages/offtrack/results';
import OfftrackEventDetails from './pages/offtrack/event-details';
import AdminLayout from './layouts/admin-layout';
import AdminDashboard from './pages/admin/dashboard';
import ManageResources from './pages/admin/resources';
import AdminEvents from './pages/admin/events';
import AdminEventDetails from './pages/admin/event-details';
import AdminRequests from './pages/admin/requests';
import AdminSettings from './pages/admin/settings';


function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>

          {/* Public Routes */}
          <Route path="/" element={<PublicDashboard />} />

          <Route path="/login" element={<Login />} />
          <Route path="/verify/:registerNumber" element={<VerificationPage />} />

          {/* Ontrack Staff Routes (Mobile) */}
          <Route path="/ontrack" element={<ProtectedRoute allowedRoles={['staff']} />}>
            <Route element={<StaffLayout />}>
              <Route index element={<StaffEventList />} />
            </Route>
            {/* Full screen event details (No Bottom Nav) */}
            <Route path="events/:eventId" element={<EventDetails />} />
          </Route>

          {/* Offtrack Staff Routes (Desktop) */}
          <Route path="/offtrack" element={<ProtectedRoute allowedRoles={['staff']} />}>
            <Route element={<OfftrackLayout />}>
              <Route index element={<OfftrackDashboard />} />
              <Route path="events" element={<OfftrackEvents />} />
              <Route path="events/:eventId" element={<OfftrackEventDetails />} />
              <Route path="participants" element={<OfftrackParticipants />} />
              <Route path="results" element={<OfftrackResults />} />
            </Route>
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="resources" element={<ManageResources />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="certificates" element={<CertificatePreview />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            <Route path="events/:eventId" element={<AdminEventDetails />} />

          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
