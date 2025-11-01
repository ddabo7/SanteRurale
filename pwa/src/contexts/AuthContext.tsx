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
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

type JwtPayload = {
  exp?: number
  [key: string]: unknown
}

const getTokenExpiry = (token: string): string | null => {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4 || 4)) % 4, '=')
    const decoded = atob(padded)
    const data = JSON.parse(decoded) as JwtPayload

    if (typeof data.exp === 'number') {
      return new Date(data.exp * 1000).toISOString()
    }
  } catch (error) {
    console.warn('Impossible de décoder le token JWT', error)
  }

  return null
}

const normalizeUser = (rawUser: any): User => ({
  id: rawUser.id,
  email: rawUser.email,
  nom: rawUser.nom,
  prenom: rawUser.prenom || '',
  role: rawUser.role,
  site_id: rawUser.site_id,
  site_nom: rawUser.site_nom,
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
        const session = await db.user_session.toCollection().first()

        if (session?.access_token) {
          setUser(
            normalizeUser({
              id: session.id,
              email: session.email,
              nom: session.nom,
              prenom: session.prenom,
              role: session.role,
              site_id: session.site_id,
            })
          )
          return
        }

        // Migration depuis l'ancien stockage localStorage si nécessaire
        const legacyToken = localStorage.getItem('access_token')
        const legacyUser = localStorage.getItem('user')
        if (legacyToken && legacyUser) {
          const normalizedUser = normalizeUser(JSON.parse(legacyUser))
          setUser(normalizedUser)

          const expiry =
            getTokenExpiry(legacyToken) ??
            new Date(Date.now() + 25 * 60 * 1000).toISOString()

          await db.user_session.clear()
          await db.user_session.put({
            id: normalizedUser.id,
            email: normalizedUser.email,
            nom: normalizedUser.nom,
            prenom: normalizedUser.prenom,
            role: normalizedUser.role,
            site_id: normalizedUser.site_id,
            access_token: legacyToken,
            refresh_token: localStorage.getItem('refresh_token') || '',
            expires_at: expiry,
          })
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
      const response = await authService.login(email, password)

      const { access_token, refresh_token, user: userData } = response
      const expiresAt =
        getTokenExpiry(access_token) ??
        new Date(Date.now() + 25 * 60 * 1000).toISOString()

      const normalizedUser = normalizeUser(userData)

      // Stocker le token et les infos utilisateur
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('refresh_token', refresh_token)
      localStorage.setItem('user', JSON.stringify(normalizedUser))

      await db.user_session.clear()
      await db.user_session.put({
        id: normalizedUser.id,
        email: normalizedUser.email,
        nom: normalizedUser.nom,
        prenom: normalizedUser.prenom,
        role: normalizedUser.role,
        site_id: normalizedUser.site_id,
        access_token,
        refresh_token,
        expires_at: expiresAt,
      })

      setUser(normalizedUser)
    } catch (error) {
      console.error('Erreur de connexion:', error)
      throw error
    }
  }

  const logout = async () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUser(null)
    try {
      await db.user_session.clear()
    } catch (error) {
      console.error('Erreur lors de la suppression de la session utilisateur:', error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
