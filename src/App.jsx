import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import MaintenanceTypesPage from './pages/MaintenanceTypesPage';
import MaintenanceSchedulesPage from './pages/MaintenanceSchedulesPage';
import MaintenanceScheduleForm from './pages/MaintenanceScheduleForm';
import MaintenanceScheduleDetailPage from './pages/MaintenanceScheduleDetailPage';
import MaintenanceDraftsPage from './pages/MaintenanceDraftsPage';
import CategoriesPage from './pages/CategoriesPage';
import LocationsPage from './pages/LocationsPage';
import DepartmentsPage from './pages/DepartmentsPage';
import AssetResponsiblesPage from './pages/AssetResponsiblesPage';
import VendorsPage from './pages/VendorsPage';
import AssetsPage from './pages/AssetsPage';
import AssetDetailPage from './pages/AssetDetailPage';
import AssetFormPage from './pages/AssetFormPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import SystemNotificationTestPage from './pages/SystemNotificationTestPage';
import LoadingScreen from './components/LoadingScreen';
import { ROLES } from './lib/constants';
import ContractsPage from './pages/contracts/ContractsPage';
import ContractFormPage from './pages/contracts/ContractFormPage';
import ContractDetailPage from './pages/contracts/ContractDetailPage';
import ContractTypesPage from './pages/contracts/ContractTypesPage';
import EmployeesPage from './pages/contracts/EmployeesPage';

function LogoutButton() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <button
      onClick={handleLogout}
      className="text-primary-400 hover:text-primary-300 font-medium text-sm transition-colors"
    >
      Kembali ke Login
    </button>
  );
}

function ProtectedRoute({ children }) {
  const { profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!profile) return <Navigate to="/login" replace />;
  
  if (profile.account_status !== 'ACTIVE') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-950 p-4 relative overflow-hidden">
        {/* Ambient orbs */}
        <div className="orb w-[500px] h-[500px] bg-warning-600/15 top-[-200px] left-[-150px] animate-orbit pointer-events-none fixed"></div>
        <div className="orb w-[400px] h-[400px] bg-primary-600/10 bottom-[-100px] right-[10%] animate-orbit pointer-events-none fixed" style={{ animationDelay: '-10s' }}></div>
        <div className="absolute inset-0 dot-grid-bg opacity-30 pointer-events-none"></div>

        <div className="card max-w-md w-full text-center relative">
          <div className="w-16 h-16 bg-warning-500/10 border border-warning-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 1112 3a9 9 0 017.364 4.636z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Akun Belum Aktif</h2>
          <p className="text-ink-300 mb-2">
            Status akun Anda: <span className="font-medium text-white font-mono">{profile.account_status}</span>
          </p>
          {profile.account_status === 'PENDING' && (
            <p className="text-sm text-ink-400 mb-4">
              Akun Anda masih menunggu persetujuan dari Super Admin.
            </p>
          )}
          {profile.account_status === 'REJECTED' && (
            <p className="text-sm text-danger-300 mb-4">
              Pendaftaran Anda ditolak. Silakan hubungi Super Admin.
            </p>
          )}
          {profile.account_status === 'DISABLED' && (
            <p className="text-sm text-ink-400 mb-4">
              Akun Anda dinonaktifkan. Silakan hubungi Super Admin.
            </p>
          )}
          <LogoutButton />
        </div>
      </div>
    );
  }

  return children;
}

function AdminRoute({ children }) {
  const { role, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!profile) return <Navigate to="/login" replace />;
  if (!role || role.role_name !== ROLES.SUPER_ADMIN) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function HRDRoute({ children }) {
  const { role, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!profile) return <Navigate to="/login" replace />;
  if (!role || !['super_admin', 'hrd'].includes(role.role_name)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  const { profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={!profile ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="users" element={
          <AdminRoute>
            <UsersPage />
          </AdminRoute>
        } />
        <Route path="roles" element={
          <AdminRoute>
            <RolesPage />
          </AdminRoute>
        } />
        <Route path="categories" element={
          <HRDRoute>
            <CategoriesPage />
          </HRDRoute>
        } />
        <Route path="locations" element={
          <HRDRoute>
            <LocationsPage />
          </HRDRoute>
        } />
        <Route path="departments" element={
          <HRDRoute>
            <DepartmentsPage />
          </HRDRoute>
        } />
        <Route path="asset-responsibles" element={
          <HRDRoute>
            <AssetResponsiblesPage />
          </HRDRoute>
        } />
        <Route path="vendors" element={
          <HRDRoute>
            <VendorsPage />
          </HRDRoute>
        } />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="assets/new" element={<AssetFormPage />} />
        <Route path="assets/:id" element={<AssetDetailPage />} />
        <Route path="assets/:id/edit" element={<AssetFormPage />} />
        <Route path="maintenance/types" element={
          <HRDRoute>
            <MaintenanceTypesPage />
          </HRDRoute>
        } />
        <Route path="maintenance/schedules" element={<MaintenanceSchedulesPage />} />
        <Route path="maintenance/schedules/new" element={
          <HRDRoute>
            <MaintenanceScheduleForm />
          </HRDRoute>
        } />
        <Route path="maintenance/schedules/:id" element={<MaintenanceScheduleDetailPage />} />
        <Route path="maintenance/drafts" element={
          <HRDRoute>
            <MaintenanceDraftsPage />
          </HRDRoute>
        } />
        <Route path="maintenance/schedules/:id/edit" element={
          <HRDRoute>
            <MaintenanceScheduleForm />
          </HRDRoute>
        } />
        <Route path="employees" element={
          <HRDRoute>
            <EmployeesPage />
          </HRDRoute>
        } />
        <Route path="contracts" element={<ContractsPage />} />
        <Route path="contracts/types" element={
          <HRDRoute>
            <ContractTypesPage />
          </HRDRoute>
        } />
        <Route path="contracts/new" element={
          <HRDRoute>
            <ContractFormPage />
          </HRDRoute>
        } />
        <Route path="contracts/:id" element={<ContractDetailPage />} />
        <Route path="contracts/:id/edit" element={
          <HRDRoute>
            <ContractFormPage />
          </HRDRoute>
        } />
        <Route path="settings" element={
          <AdminRoute>
            <SettingsPage />
          </AdminRoute>
        } />
        <Route path="settings/system-notification-test" element={
          <AdminRoute>
            <SystemNotificationTestPage />
          </AdminRoute>
        } />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
