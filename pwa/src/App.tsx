import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-email" element={<EmailVerificationPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/debug-env" element={<DebugEnvPage />} />
          <Route path="/debug" element={<DebugPage />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Navigate to="/patients" replace />
                </Layout>
              </ProtectedRoute>
            }
          />

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

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
