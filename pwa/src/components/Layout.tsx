import { ReactNode, useState } from 'react'
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const isActive = (path: string) => location.pathname === path

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Header avec gradient moderne */}
      <header className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-2xl sticky top-0 z-50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center group" onClick={closeMobileMenu}>
                <span className="text-xl sm:text-2xl font-bold flex items-center gap-1 sm:gap-2 transition-transform group-hover:scale-105">
                  <span className="text-2xl sm:text-3xl">🏥</span>
                  <span className="bg-white/20 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-lg text-sm sm:text-base">Santé Rurale</span>
                </span>
              </Link>

              {/* Desktop Navigation */}
              {isAuthenticated && (
                <nav className="hidden lg:flex ml-10 space-x-2">
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
                    to="/pharmacie"
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all transform hover:scale-105 ${
                      isActive('/pharmacie')
                        ? 'bg-white/30 backdrop-blur-md shadow-lg'
                        : 'hover:bg-white/20 backdrop-blur-sm'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-lg">💊</span>
                      Pharmacie
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

            <div className="flex items-center gap-2">
              {/* Desktop User Menu */}
              {isAuthenticated && (
                <div className="hidden sm:block">
                  <UserMenu />
                </div>
              )}

              {/* Mobile menu button */}
              {isAuthenticated && (
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="lg:hidden p-2 rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Menu"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {isMobileMenuOpen ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    )}
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Mobile Navigation */}
          {isAuthenticated && isMobileMenuOpen && (
            <div className="lg:hidden pb-4 border-t border-white/20 mt-2 pt-2">
              <nav className="flex flex-col space-y-2">
                <Link
                  to="/patients"
                  onClick={closeMobileMenu}
                  className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
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
                  onClick={closeMobileMenu}
                  className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
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
                  to="/pharmacie"
                  onClick={closeMobileMenu}
                  className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive('/pharmacie')
                      ? 'bg-white/30 backdrop-blur-md shadow-lg'
                      : 'hover:bg-white/20 backdrop-blur-sm'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">💊</span>
                    Pharmacie
                  </span>
                </Link>
                <Link
                  to="/rapports"
                  onClick={closeMobileMenu}
                  className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
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
                {/* Mobile User Menu */}
                <div className="sm:hidden pt-2 border-t border-white/20">
                  <UserMenu />
                </div>
              </nav>
            </div>
          )}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <span className="text-2xl">🏥</span>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-gray-700">© 2025 Santé Rurale. Tous droits réservés.</p>
                <p className="text-xs text-gray-500 hidden sm:block">Plateforme de gestion de santé en zones rurales</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              {isAuthenticated && (
                <Link
                  to="/feedback"
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full shadow-md hover:shadow-lg transition-all transform hover:scale-105 text-sm"
                >
                  <span>💬</span>
                  <span className="font-medium">Feedback</span>
                </Link>
              )}
              <span className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200">
                <span className={`inline-block w-2 h-2 rounded-full animate-pulse ${
                  navigator.onLine ? 'bg-green-500' : 'bg-orange-500'
                }`}></span>
                <span className="text-xs sm:text-sm font-medium text-gray-700">
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
