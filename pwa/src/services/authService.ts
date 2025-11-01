/**
 * Service d'authentification basé sur l'API PostgreSQL
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
console.log('🔍 DEBUG authService - API_BASE_URL:', API_BASE_URL)
console.log('🔍 DEBUG authService - VITE_API_URL:', import.meta.env.VITE_API_URL)

export const authService = {
  /**
   * Authentifie un utilisateur avec email et mot de passe
   */
  login: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erreur de connexion')
    }

    return await response.json()
  },

  /**
   * Inscrit un nouvel utilisateur
   */
  signup: async (data: {
    email: string
    password: string
    nom: string
    prenom: string
    telephone?: string
  }) => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erreur lors de la création du compte')
    }

    return await response.json()
  },

  /**
   * Vérifie l'email avec le token
   */
  verifyEmail: async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erreur lors de la vérification')
    }

    return await response.json()
  },

  /**
   * Demande un lien de réinitialisation de mot de passe
   */
  forgotPassword: async (email: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erreur lors de l\'envoi')
    }

    return await response.json()
  },

  /**
   * Réinitialise le mot de passe avec le token
   */
  resetPassword: async (token: string, newPassword: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, new_password: newPassword }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erreur lors de la réinitialisation')
    }

    return await response.json()
  },
}
