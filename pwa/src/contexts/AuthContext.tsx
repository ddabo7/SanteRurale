import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authService } from '../services/authService'
import { db } from '../db'

interface User {
  id: string
  email: string
  nom: string
  prenom: string
  role: string
  site_id: string
  site_nom?: string
  telephone?: string
  avatar_url?: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateUser: (userData: Partial<User>) => Promise<void>
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const normalizeUser = (rawUser: any): User => ({
  id: rawUser.id,
  email: rawUser.email,
  nom: rawUser.nom,
  prenom: rawUser.prenom || '',
  role: rawUser.role,
  site_id: rawUser.site_id,
  site_nom: rawUser.site_nom,
  telephone: rawUser.telephone,
  avatar_url: rawUser.avatar_url,
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadSession = async () => {
      try {
        // Charger la session depuis IndexedDB (sans les tokens)
        const session = await db.user_session.toCollection().first()

        if (session) {
          setUser(
            normalizeUser({
              id: session.id,
              email: session.email,
              nom: session.nom,
              prenom: session.prenom,
              role: session.role,
              site_id: session.site_id,
              telephone: session.telephone,
              avatar_url: session.avatar_url,
            })
          )
        }
      } catch (error) {
        console.error('Erreur lors du chargement de la session utilisateur:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSession()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      // DOUBLE SÉCURITÉ: Vider IndexedDB AVANT le login
      // (au cas où le logout précédent n'aurait pas fonctionné)
      console.log('[Auth] Vidage de sécurité d\'IndexedDB avant login...')
      await db.clearAllData()

      const response = await authService.login(email, password)

      const { user: userData } = response
      const normalizedUser = normalizeUser(userData)

      // Les tokens sont maintenant dans des cookies HttpOnly (gérés automatiquement par le navigateur)
      // On stocke uniquement les données utilisateur dans IndexedDB (sans les tokens)
      await db.user_session.put({
        id: normalizedUser.id,
        email: normalizedUser.email,
        nom: normalizedUser.nom,
        prenom: normalizedUser.prenom,
        telephone: normalizedUser.telephone,
        role: normalizedUser.role,
        site_id: normalizedUser.site_id,
        avatar_url: normalizedUser.avatar_url,
      })

      setUser(normalizedUser)
    } catch (error) {
      console.error('Erreur de connexion:', error)
      throw error
    }
  }

  const logout = async () => {
    // CRITIQUE: Vider TOUTES les données IndexedDB lors de la déconnexion
    // Cela évite qu'un autre utilisateur voit les données du précédent
    console.log('[Auth] Vidage complet d\'IndexedDB lors de la déconnexion...')
    try {
      await db.clearAllData()
      console.log('[Auth] IndexedDB complètement vidé')
    } catch (error) {
      console.error('[Auth] Erreur lors du vidage d\'IndexedDB:', error)
    }

    // Vider le localStorage
    try {
      localStorage.clear()
      console.log('[Auth] localStorage vidé')
    } catch (error) {
      console.warn('[Auth] Impossible de vider localStorage:', error)
    }

    // Nettoyer l'état React
    setUser(null)

    // Appeler l'endpoint backend pour supprimer les cookies HttpOnly
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('[Auth] Erreur lors de la déconnexion serveur:', error)
    }
  }

  const updateUser = async (userData: Partial<User>) => {
    if (!user) return

    const updatedUser = { ...user, ...userData }
    setUser(updatedUser)

    // Mettre à jour IndexedDB uniquement (pas de localStorage)
    try {
      const session = await db.user_session.toCollection().first()
      if (session) {
        await db.user_session.update(session.id, {
          nom: updatedUser.nom,
          prenom: updatedUser.prenom,
          telephone: updatedUser.telephone,
          email: updatedUser.email,
          avatar_url: updatedUser.avatar_url,
        })
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la session utilisateur:', error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        updateUser,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
