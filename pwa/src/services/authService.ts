/**
 * Service d'authentification basé sur l'API PostgreSQL
 */

import { db } from '../db'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export const authService = {
  /**
   * Authentifie un utilisateur avec email et mot de passe
   * Les tokens sont stockés dans des cookies HttpOnly par le serveur
   * Note: IndexedDB est vidé AVANT le login dans AuthContext pour éviter les données fantômes
   */
  login: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important : permet d'envoyer et recevoir les cookies
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erreur de connexion')
    }

    return await response.json()
  },

  /**
   * Déconnecte l'utilisateur et vide toutes les données locales
   */
  logout: async () => {
    // Vider IndexedDB
    try {
      await db.clearAllData()
      console.log('[Auth] IndexedDB vidé lors de la déconnexion')
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

    // Appeler l'endpoint de déconnexion pour invalider les cookies
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.warn('[Auth] Erreur lors de la déconnexion serveur:', error)
    }
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
    role: string  // Obligatoire: medecin, infirmier, major, soignant, pharmacien
    // Informations du site/CSCOM
    site_nom: string
    site_type: string
    site_ville?: string
    site_pays: string
    site_adresse?: string
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

  /**
   * Met à jour le profil de l'utilisateur
   * Les tokens sont automatiquement envoyés via les cookies HttpOnly
   */
  updateProfile: async (data: {
    nom?: string
    prenom?: string
    telephone?: string
    email?: string
    avatar_url?: string
  }) => {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Envoie automatiquement les cookies (dont access_token)
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erreur lors de la mise à jour du profil')
    }

    return await response.json()
  },

  /**
   * Change le mot de passe de l'utilisateur
   * Les tokens sont automatiquement envoyés via les cookies HttpOnly
   */
  changePassword: async (data: {
    current_password: string
    new_password: string
  }) => {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Envoie automatiquement les cookies (dont access_token)
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erreur lors du changement de mot de passe')
    }

    return await response.json()
  },
}
