import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export const UserMenu = () => {
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLogout = async () => {
    setIsOpen(false)
    await logout()
    navigate('/login')
  }

  if (!user) return null

  return (
    <div className="relative" ref={menuRef}>
      {/* Bouton menu hamburger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 px-3 py-2 rounded-md hover:bg-emerald-500 transition-colors"
        aria-label="Menu utilisateur"
      >
        <div className="text-left">
          <div className="font-medium text-sm">{user.prenom} {user.nom}</div>
          <div className="text-emerald-200 text-xs">{user.role}</div>
        </div>
        <div className="flex flex-col space-y-1">
          <div className="w-5 h-0.5 bg-white"></div>
          <div className="w-5 h-0.5 bg-white"></div>
          <div className="w-5 h-0.5 bg-white"></div>
        </div>
      </button>

      {/* Menu dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            {/* Info utilisateur */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">
                {user.prenom} {user.nom}
              </p>
              <p className="text-xs text-gray-500">{user.role}</p>
              {user.site && (
                <p className="text-xs text-gray-500 mt-1">📍 {user.site.nom}</p>
              )}
            </div>

            {/* Liens du menu */}
            <Link
              to="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <span className="mr-3">👤</span>
              Mon profil
            </Link>

            <Link
              to="/subscription"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <span className="mr-3">💳</span>
              Abonnement
            </Link>

            {/* Lien Admin - visible uniquement pour les admins */}
            {user.role === 'admin' && (
              <>
                <div className="border-t border-gray-100"></div>
                <Link
                  to="/admin"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 transition-colors font-medium"
                >
                  <span className="mr-3">📊</span>
                  Dashboard Admin
                </Link>
              </>
            )}

            <div className="border-t border-gray-100"></div>

            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <span className="mr-3">🚪</span>
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
