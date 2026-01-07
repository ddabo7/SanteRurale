import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SyncProvider } from './contexts/SyncContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { InactivityWarningModal } from './components/InactivityWarningModal'
import { useInactivityDetection } from './hooks/useInactivityDetection'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { EmailVerificationPage } from './pages/EmailVerificationPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { DebugEnvPage } from './pages/DebugEnvPage'
import { DebugPage } from './pages/DebugPage'
import { PatientsPage } from './pages/PatientsPage'
import { PatientFormPage } from './pages/PatientFormPage'
import { ConsultationsPage } from './pages/ConsultationsPage'
import { ConsultationFormPage } from './pages/ConsultationFormPage'
import { ConsultationDetailsPage } from './pages/ConsultationDetailsPage'
import { RapportsPage } from './pages/RapportsPage'
import { ProfilePage } from './pages/ProfilePage'
import { SubscriptionPage } from './pages/SubscriptionPage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminFeedbackPage } from './pages/AdminFeedbackPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { PharmaciePage } from './pages/PharmaciePage'
import { MedicamentsPage } from './pages/MedicamentsPage'
import { StockPage } from './pages/StockPage'
import { FournisseursPage } from './pages/FournisseursPage'
import { BonsCommandePage } from './pages/BonsCommandePage'

// Inner component that has access to AuthContext
function AppRoutes() {
  const { isAuthenticated, logout } = useAuth()

  // Inactivity detection - only enabled when authenticated
  const { showWarning, remainingSeconds, dismissWarning, forceLogout } = useInactivityDetection({
    warningTimeout: 14 * 60 * 1000, // 14 minutes
    logoutTimeout: 15 * 60 * 1000, // 15 minutes
    onLogout: logout,
    enabled: isAuthenticated
  })

  return (
    <>
      {/* Inactivity Warning Modal */}
      <InactivityWarningModal
        isOpen={showWarning}
        remainingSeconds={remainingSeconds}
        onStayConnected={dismissWarning}
        onLogout={forceLogout}
      />

      {/* Routes */}
      <Routes>
        {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-email" element={<EmailVerificationPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/debug-env" element={<DebugEnvPage />} />
          <Route path="/debug" element={<DebugPage />} />

          {/* Protected routes */}

          <Route
            path="/patients"
            element={
              <ProtectedRoute>
                <Layout>
                  <PatientsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/patients/nouveau"
            element={
              <ProtectedRoute>
                <Layout>
                  <PatientFormPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/patients/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <PatientFormPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/consultations"
            element={
              <ProtectedRoute>
                <Layout>
                  <ConsultationsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/consultations/nouvelle"
            element={
              <ProtectedRoute>
                <Layout>
                  <ConsultationFormPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/consultations/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <ConsultationDetailsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/rapports"
            element={
              <ProtectedRoute>
                <Layout>
                  <RapportsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Layout>
                  <ProfilePage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/subscription"
            element={
              <ProtectedRoute>
                <Layout>
                  <SubscriptionPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Layout>
                  <AdminDashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/feedback"
            element={
              <ProtectedRoute>
                <FeedbackPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/feedbacks"
            element={
              <ProtectedRoute>
                <AdminFeedbackPage />
              </ProtectedRoute>
            }
          />

          {/* Pharmacy routes */}
          <Route
            path="/pharmacie"
            element={
              <ProtectedRoute>
                <Layout>
                  <PharmaciePage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/medicaments"
            element={
              <ProtectedRoute>
                <Layout>
                  <MedicamentsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/stock"
            element={
              <ProtectedRoute>
                <Layout>
                  <StockPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/fournisseurs"
            element={
              <ProtectedRoute>
                <Layout>
                  <FournisseursPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/bons-commande"
            element={
              <ProtectedRoute>
                <Layout>
                  <BonsCommandePage />
                </Layout>
              </ProtectedRoute>
            }
          />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <SyncProvider>
          <AppRoutes />
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
