import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { SyncIndicator } from './SyncIndicator'
import { UserMenu } from './UserMenu'

interface LayoutProps {
  children: ReactNode
}

export const Layout = ({ children }: LayoutProps) => {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Header avec gradient moderne */}
      <header className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 text-white shadow-2xl sticky top-0 z-50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center group">
                <span className="text-2xl font-bold flex items-center gap-2 transition-transform group-hover:scale-105">
                  <span className="text-3xl">🏥</span>
                  <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg">Santé Rurale</span>
                </span>
              </Link>

              {isAuthenticated && (
                <nav className="ml-10 flex space-x-2">
                  <Link
                    to="/patients"
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all transform hover:scale-105 ${
                      isActive('/patients')
                        ? 'bg-white/30 backdrop-blur-md shadow-lg'
                        : 'hover:bg-white/20 backdrop-blur-sm'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-lg">👥</span>
                      Patients
                    </span>
                  </Link>
                  <Link
                    to="/consultations"
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all transform hover:scale-105 ${
                      isActive('/consultations')
                        ? 'bg-white/30 backdrop-blur-md shadow-lg'
                        : 'hover:bg-white/20 backdrop-blur-sm'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-lg">🩺</span>
                      Consultations
                    </span>
                  </Link>
                  <Link
                    to="/rapports"
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all transform hover:scale-105 ${
                      isActive('/rapports')
                        ? 'bg-white/30 backdrop-blur-md shadow-lg'
                        : 'hover:bg-white/20 backdrop-blur-sm'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-lg">📊</span>
                      Rapports
                    </span>
                  </Link>
                </nav>
              )}
            </div>

            {isAuthenticated && <UserMenu />}
          </div>
        </div>
      </header>

      {/* Main content avec padding et background amélioré */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-fadeIn">
          {children}
        </div>
      </main>

      {/* Footer moderne avec gradient */}
      <footer className="bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 mt-auto backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏥</span>
              <div>
                <p className="text-sm font-semibold text-gray-700">© 2025 Santé Rurale</p>
                <p className="text-xs text-gray-500">Plateforme de gestion de santé</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isAuthenticated && (
                <Link
                  to="/feedback"
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full shadow-md hover:shadow-lg transition-all transform hover:scale-105"
                >
                  <span>💬</span>
                  <span className="text-sm font-medium">Feedback</span>
                </Link>
              )}
              <span className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200">
                <span className={`inline-block w-2 h-2 rounded-full animate-pulse ${
                  navigator.onLine ? 'bg-green-500' : 'bg-orange-500'
                }`}></span>
                <span className="text-sm font-medium text-gray-700">
                  {navigator.onLine ? '✓ En ligne' : '⚠ Hors-ligne'}
                </span>
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
