// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { PatientDataProvider } from './PatientDataContext';
import { ToastProvider } from './Toast';
import { RealtimeProvider } from './context/RealtimeProvider'; // ← This is now .jsx
import RoleSelection from './pages/RoleSelection';
import CredentialPage from './pages/CredentialPage';
import ReceptionistDashboard from './pages/ReceptionistDashboard';
import TriageDashboard from './pages/TriageDashboard';
import ClinicianDashboard from './pages/ClinicianDashboard';
import LabDashboard from './pages/LabDashboard';
import PharmacyDashboard from './pages/PharmacyDashboard';
import SeedPage from './pages/SeedPage';
import { ROLES } from './roles';

function ProtectedRoute({ roleKey, children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/seed" element={<SeedPage />} />
      <Route path="/login" element={<RoleSelection />} />
      <Route path="/login/receptionist" element={<CredentialPage roleKey="receptionist" />} />
      <Route path="/login/triage" element={<CredentialPage roleKey="triage" />} />
      <Route path="/login/clinician" element={<CredentialPage roleKey="clinician" />} />
      <Route path="/login/lab" element={<CredentialPage roleKey="lab" />} />
      <Route path="/login/pharmacy" element={<CredentialPage roleKey="pharmacy" />} />
      <Route
        path="/dashboard/receptionist"
        element={
          <ProtectedRoute roleKey="receptionist">
            <ReceptionistDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/triage"
        element={
          <ProtectedRoute roleKey="triage">
            <TriageDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/clinician"
        element={
          <ProtectedRoute roleKey="clinician">
            <ClinicianDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/lab"
        element={
          <ProtectedRoute roleKey="lab">
            <LabDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/pharmacy"
        element={
          <ProtectedRoute roleKey="pharmacy">
            <PharmacyDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <RealtimeProvider>
      <AuthProvider>
        <ToastProvider>
          <PatientDataProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </PatientDataProvider>
        </ToastProvider>
      </AuthProvider>
    </RealtimeProvider>
  );
}