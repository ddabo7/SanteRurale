import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'

interface UserMenuProps {
  onNavigate?: () => void
}

export const UserMenu = ({ onNavigate }: UserMenuProps) => {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Fonction pour formater le rôle selon le sexe
  const formatRole = (role: string, sexe?: string): string => {
    const genderKey = sexe === 'F' ? 'female' : 'male'

    switch (role) {
      case 'infirmier':
        return t(`userMenu.roles.nurse.${genderKey}`)
      case 'major':
        return t(`userMenu.roles.major.${genderKey}`)
      case 'soignant':
        return t(`userMenu.roles.caregiver.${genderKey}`)
      case 'pharmacien':
        return t(`userMenu.roles.pharmacist.${genderKey}`)
      case 'medecin':
        return t('userMenu.roles.doctor')
      case 'admin':
        return t('userMenu.roles.admin')
      default:
        return role
    }
  }

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
    onNavigate?.()
    await logout()
    navigate('/login')
  }

  if (!user) return null

  return (
    <div className="relative" ref={menuRef}>
      {/* Bouton menu avec avatar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 px-3 py-2 rounded-md hover:bg-emerald-500 transition-colors"
        aria-label="Menu utilisateur"
      >
        {/* Avatar */}
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={`${user.prenom} ${user.nom}`}
            className="w-10 h-10 rounded-full object-cover border-2 border-white"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center text-white font-semibold border-2 border-white">
            {user.prenom?.[0]}{user.nom?.[0]}
          </div>
        )}
        <div className="text-left">
          <div className="font-medium text-sm">{user.prenom} {user.nom}</div>
          <div className="text-emerald-200 text-xs">{formatRole(user.role, user.sexe)}</div>
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
              <p className="text-xs text-gray-500">{formatRole(user.role, user.sexe)}</p>
              {user.site_nom && (
                <p className="text-xs text-gray-500 mt-1">📍 {user.site_nom}</p>
              )}
            </div>

            {/* Liens du menu */}
            <Link
              to="/profile"
              onClick={() => {
                setIsOpen(false)
                onNavigate?.()
              }}
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <span className="mr-3">👤</span>
              {t('userMenu.myProfile')}
            </Link>

            <Link
              to="/subscription"
              onClick={() => {
                setIsOpen(false)
                onNavigate?.()
              }}
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <span className="mr-3">💳</span>
              {t('userMenu.subscription')}
            </Link>

            {/* Lien Admin - visible uniquement pour les admins */}
            {user.role === 'admin' && (
              <>
                <div className="border-t border-gray-100"></div>
                <Link
                  to="/admin"
                  onClick={() => {
                    setIsOpen(false)
                    onNavigate?.()
                  }}
                  className="flex items-center px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 transition-colors font-medium"
                >
                  <span className="mr-3">📊</span>
                  {t('userMenu.adminDashboard')}
                </Link>
                <Link
                  to="/admin/feedbacks"
                  onClick={() => {
                    setIsOpen(false)
                    onNavigate?.()
                  }}
                  className="flex items-center px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 transition-colors font-medium"
                >
                  <span className="mr-3">💬</span>
                  {t('userMenu.userFeedbacks')}
                </Link>
              </>
            )}

            <div className="border-t border-gray-100"></div>

            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <span className="mr-3">🚪</span>
              {t('userMenu.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
