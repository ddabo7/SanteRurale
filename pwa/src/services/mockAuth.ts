/**
 * Service d'authentification mock pour environnement de développement
 * En production, ce service sera remplacé par l'authentification API réelle
 */

interface MockUser {
  id: string
  email: string
  password: string
  nom: string
  prenom: string
  role: 'admin' | 'medecin' | 'major' | 'soignant'
  site_id: string
  site_nom: string
  created_at: string
  email_verified: boolean
  verification_token?: string
  verification_token_expires?: string
}

// Clé pour le localStorage
const USERS_STORAGE_KEY = 'sante_rurale_users'

// Base de données mock des utilisateurs par défaut
const DEFAULT_USERS: MockUser[] = [
  {
    id: '1',
    email: 'admin@cscom-koulikoro.ml',
    password: 'Admin2024!',
    nom: 'DIARRA',
    prenom: 'Mamadou',
    role: 'admin',
    site_id: 'site-1',
    site_nom: 'CSCOM Koulikoro',
    created_at: new Date().toISOString(),
    email_verified: true, // Comptes par défaut déjà vérifiés
  },
  {
    id: '2',
    email: 'dr.traore@cscom-koulikoro.ml',
    password: 'Medecin2024!',
    nom: 'TRAORÉ',
    prenom: 'Amadou',
    role: 'medecin',
    site_id: 'site-1',
    site_nom: 'CSCOM Koulikoro',
    created_at: new Date().toISOString(),
    email_verified: true,
  },
  {
    id: '3',
    email: 'major.kone@cscom-koulikoro.ml',
    password: 'Major2024!',
    nom: 'KONÉ',
    prenom: 'Fatimata',
    role: 'major',
    site_id: 'site-1',
    site_nom: 'CSCOM Koulikoro',
    created_at: new Date().toISOString(),
    email_verified: true,
  },
  {
    id: '4',
    email: 'soignant.coulibaly@cscom-koulikoro.ml',
    password: 'Soignant2024!',
    nom: 'COULIBALY',
    prenom: 'Ibrahim',
    role: 'soignant',
    site_id: 'site-1',
    site_nom: 'CSCOM Koulikoro',
    created_at: new Date().toISOString(),
    email_verified: true,
  },
]

// Récupérer tous les utilisateurs (défaut + créés)
const getAllUsers = (): MockUser[] => {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
    // Initialiser avec les utilisateurs par défaut
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS))
    return DEFAULT_USERS
  } catch {
    return DEFAULT_USERS
  }
}

// Sauvegarder les utilisateurs
const saveUsers = (users: MockUser[]) => {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
}

export const mockAuthService = {
  /**
   * Authentifie un utilisateur avec email et mot de passe
   */
  login: async (email: string, password: string) => {
    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 800))

    const users = getAllUsers()
    const user = users.find(u => u.email === email && u.password === password)

    if (!user) {
      throw new Error('Email ou mot de passe incorrect')
    }

    // Vérifier si l'email est vérifié
    if (!user.email_verified) {
      throw new Error('Veuillez vérifier votre email avant de vous connecter. Consultez votre boîte de réception.')
    }

    // Générer un token mock
    const token = btoa(JSON.stringify({ userId: user.id, timestamp: Date.now() }))

    return {
      access_token: token,
      refresh_token: token,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        site_id: user.site_id,
        site_nom: user.site_nom,
      },
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
  }) => {
    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 800))

    const users = getAllUsers()

    // Vérifier si l'email existe déjà
    if (users.find(u => u.email === data.email)) {
      throw new Error('Cet email est déjà utilisé')
    }

    // Valider le format du mot de passe
    if (data.password.length < 8) {
      throw new Error('Le mot de passe doit contenir au moins 8 caractères')
    }
    if (!/[A-Z]/.test(data.password)) {
      throw new Error('Le mot de passe doit contenir au moins une majuscule')
    }
    if (!/[0-9]/.test(data.password)) {
      throw new Error('Le mot de passe doit contenir au moins un chiffre')
    }
    if (!/[!@#$%^&*]/.test(data.password)) {
      throw new Error('Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*)')
    }

    // Générer un token de vérification unique
    const verificationToken = btoa(JSON.stringify({
      email: data.email,
      timestamp: Date.now(),
      random: Math.random()
    }))

    // Expiration dans 24 heures
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    // Créer le nouvel utilisateur (non vérifié)
    const newUser: MockUser = {
      id: `user-${Date.now()}`,
      email: data.email,
      password: data.password,
      nom: data.nom,
      prenom: data.prenom,
      role: 'soignant', // Par défaut, les nouveaux utilisateurs sont soignants
      site_id: 'site-1',
      site_nom: 'CSCOM Koulikoro',
      created_at: new Date().toISOString(),
      email_verified: false,
      verification_token: verificationToken,
      verification_token_expires: expiresAt,
    }

    // Ajouter et sauvegarder
    users.push(newUser)
    saveUsers(users)

    // Envoyer l'email de vérification via l'API
    try {
      const response = await fetch('http://localhost:8000/api/auth/send-verification-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          verification_token: verificationToken,
          user_name: `${data.prenom} ${data.nom}`,
        }),
      })

      if (!response.ok) {
        console.error('Erreur lors de l\'envoi de l\'email de vérification')
      }
    } catch (error) {
      console.error('Erreur réseau lors de l\'envoi de l\'email:', error)
    }

    return {
      message: 'Compte créé ! Consultez votre email pour vérifier votre compte.',
      email: newUser.email,
    }
  },

  /**
   * Réinitialise le mot de passe (envoie un email)
   */
  forgotPassword: async (email: string) => {
    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 1000))

    const users = getAllUsers()
    const user = users.find(u => u.email === email)

    if (!user) {
      // Pour des raisons de sécurité, on ne dit pas si l'email existe ou non
      return {
        success: true,
        message: 'Si cet email existe dans notre système, un lien de réinitialisation a été envoyé.',
      }
    }

    // Générer un token de réinitialisation unique
    const resetToken = btoa(JSON.stringify({
      email: email,
      timestamp: Date.now(),
      random: Math.random()
    }))

    // Envoyer l'email de réinitialisation via l'API
    try {
      const response = await fetch('http://localhost:8000/api/auth/send-password-reset-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          reset_token: resetToken,
          user_name: `${user.prenom} ${user.nom}`,
        }),
      })

      if (!response.ok) {
        console.error('Erreur lors de l\'envoi de l\'email de réinitialisation')
      }
    } catch (error) {
      console.error('Erreur réseau lors de l\'envoi de l\'email:', error)
    }

    return {
      success: true,
      message: 'Un lien de réinitialisation a été envoyé à votre adresse email.',
    }
  },

  /**
   * Valide un token
   */
  validateToken: async (token: string) => {
    try {
      const decoded = JSON.parse(atob(token))
      const users = getAllUsers()
      const user = users.find(u => u.id === decoded.userId)
      return !!user
    } catch {
      return false
    }
  },

  /**
   * Vérifie l'email d'un utilisateur avec le token
   */
  verifyEmail: async (token: string) => {
    try {
      const decoded = JSON.parse(atob(token))
      const users = getAllUsers()
      const userIndex = users.findIndex(u =>
        u.email === decoded.email &&
        u.verification_token === token
      )

      if (userIndex === -1) {
        throw new Error('Token de vérification invalide')
      }

      const user = users[userIndex]

      // Vérifier si le token a expiré
      if (user.verification_token_expires && new Date(user.verification_token_expires) < new Date()) {
        throw new Error('Le lien de vérification a expiré')
      }

      // Marquer l'email comme vérifié
      users[userIndex] = {
        ...user,
        email_verified: true,
        verification_token: undefined,
        verification_token_expires: undefined,
      }

      saveUsers(users)

      return {
        success: true,
        message: 'Email vérifié avec succès ! Vous pouvez maintenant vous connecter.',
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Erreur lors de la vérification de l\'email')
    }
  },

  /**
   * Réinitialise le mot de passe avec le token
   */
  resetPassword: async (token: string, newPassword: string) => {
    try {
      const decoded = JSON.parse(atob(token))
      const users = getAllUsers()
      const userIndex = users.findIndex(u => u.email === decoded.email)

      if (userIndex === -1) {
        throw new Error('Token de réinitialisation invalide')
      }

      // Valider le nouveau mot de passe
      if (newPassword.length < 8) {
        throw new Error('Le mot de passe doit contenir au moins 8 caractères')
      }
      if (!/[A-Z]/.test(newPassword)) {
        throw new Error('Le mot de passe doit contenir au moins une majuscule')
      }
      if (!/[0-9]/.test(newPassword)) {
        throw new Error('Le mot de passe doit contenir au moins un chiffre')
      }
      if (!/[!@#$%^&*]/.test(newPassword)) {
        throw new Error('Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*)')
      }

      // Mettre à jour le mot de passe
      users[userIndex] = {
        ...users[userIndex],
        password: newPassword,
      }

      saveUsers(users)

      return {
        success: true,
        message: 'Mot de passe réinitialisé avec succès !',
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Erreur lors de la réinitialisation du mot de passe')
    }
  },
}
