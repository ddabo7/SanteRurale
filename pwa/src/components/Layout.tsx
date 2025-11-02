import { ReactNode } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { SyncIndicator } from './SyncIndicator'

interface LayoutProps {
  children: ReactNode
}

export const Layout = ({ children }: LayoutProps) => {
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-emerald-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <span className="text-2xl font-bold">🏥 Santé Rurale</span>
              </Link>

              {isAuthenticated && (
                <nav className="ml-10 flex space-x-4">
                  <Link
                    to="/patients"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive('/patients')
                        ? 'bg-emerald-700'
                        : 'hover:bg-emerald-500'
                    }`}
                  >
                    👥 Patients
                  </Link>
                  <Link
                    to="/consultations"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive('/consultations')
                        ? 'bg-emerald-700'
                        : 'hover:bg-emerald-500'
                    }`}
                  >
                    🩺 Consultations
                  </Link>
                  <Link
                    to="/rapports"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive('/rapports')
                        ? 'bg-emerald-700'
                        : 'hover:bg-emerald-500'
                    }`}
                  >
                    📊 Rapports
                  </Link>
                </nav>
              )}
            </div>

            {isAuthenticated && user && (
              <div className="flex items-center space-x-4">
                <div className="text-sm">
                  <div className="font-medium">{user.prenom} {user.nom}</div>
                  <div className="text-emerald-200 text-xs">{user.role}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 rounded-md text-sm font-medium transition-colors"
                >
                  🚪 Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <p>© 2025 Santé Rurale</p>
            <div className="flex space-x-4">
              <span className="flex items-center">
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                  navigator.onLine ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
                {navigator.onLine ? 'En ligne' : 'Hors-ligne'}
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Indicateur de synchronisation */}
      {isAuthenticated && <SyncIndicator />}
    </div>
  )
}
