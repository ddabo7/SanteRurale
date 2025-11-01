/**
 * Client API avec Axios
 *
 * Fonctionnalités:
 * - Gestion automatique du JWT (access token)
 * - Refresh automatique du token expiré
 * - Intercepteurs pour logging et erreurs
 * - Support offline (retry avec queue)
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { db } from '../db'

// ===========================================================================
// CONFIGURATION
// ===========================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

// ===========================================================================
// CLIENT AXIOS
// ===========================================================================

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 secondes
  headers: {
    'Content-Type': 'application/json',
  },
})

// ===========================================================================
// INTERCEPTEURS REQUEST
// ===========================================================================

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Ajouter le token JWT si disponible
    const session = await db.user_session.toCollection().first()

    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// ===========================================================================
// INTERCEPTEURS RESPONSE
// ===========================================================================

let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb)
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token))
  refreshSubscribers = []
}

apiClient.interceptors.response.use(
  (response) => {
    // Log en développement
    if (import.meta.env.DEV) {
      console.log('✅ API Response:', {
        url: response.config.url,
        status: response.status,
        data: response.data,
      })
    }

    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // 401 Unauthorized - Token expiré
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Attendre que le refresh soit terminé
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(apiClient(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const session = await db.user_session.toCollection().first()

        if (!session?.refresh_token) {
          throw new Error('No refresh token available')
        }

        // Appeler /auth/refresh
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: session.refresh_token,
        })

        const { access_token, refresh_token, expires_in } = response.data

        // Mettre à jour la session locale
        const expiresAt = new Date()
        expiresAt.setSeconds(expiresAt.getSeconds() + expires_in)

        await db.user_session.put({
          ...session,
          access_token,
          refresh_token,
          expires_at: expiresAt.toISOString(),
        })

        isRefreshing = false
        onRefreshed(access_token)

        // Retry la requête originale
        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        isRefreshing = false

        // Échec du refresh -> déconnexion
        await db.user_session.clear()
        window.location.href = '/login'

        return Promise.reject(refreshError)
      }
    }

    // Autres erreurs
    if (import.meta.env.DEV) {
      console.error('❌ API Error:', {
        url: error.config?.url,
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      })
    }

    return Promise.reject(error)
  }
)

// ===========================================================================
// SERVICES API
// ===========================================================================

export const authService = {
  async login(email: string, password: string) {
    const response = await apiClient.post('/auth/login', { email, password })
    return response.data
  },

  async logout(refreshToken: string) {
    await apiClient.post('/auth/logout', { refresh_token: refreshToken })
  },

  async getMe() {
    const response = await apiClient.get('/auth/me')
    return response.data
  },
}

export const patientsService = {
  async list(params?: { search?: string; village?: string; cursor?: string; limit?: number }) {
    const response = await apiClient.get('/patients', { params })
    return response.data
  },

  async get(id: string) {
    const response = await apiClient.get(`/patients/${id}`)
    return response.data
  },

  async create(data: any) {
    const response = await apiClient.post('/patients', data)
    return response.data
  },

  async update(id: string, data: any, etag?: string) {
    const response = await apiClient.patch(`/patients/${id}`, data, {
      headers: etag ? { 'If-Match': etag } : {},
    })
    return response.data
  },
}

export const encountersService = {
  async list(params?: { patient_id?: string; from_date?: string; to_date?: string }) {
    const response = await apiClient.get('/encounters', { params })
    return response.data
  },

  async get(id: string) {
    const response = await apiClient.get(`/encounters/${id}`)
    return response.data
  },

  async create(data: any) {
    const response = await apiClient.post('/encounters', data)
    return response.data
  },
}

export const conditionsService = {
  async create(data: any) {
    const response = await apiClient.post('/conditions', data)
    return response.data
  },
}

export const medicationsService = {
  async create(data: any) {
    const response = await apiClient.post('/medication-requests', data)
    return response.data
  },
}

export const proceduresService = {
  async create(data: any) {
    const response = await apiClient.post('/procedures', data)
    return response.data
  },
}

export const referencesService = {
  async create(data: any) {
    const response = await apiClient.post('/references', data)
    return response.data
  },

  async update(id: string, data: any) {
    const response = await apiClient.patch(`/references/${id}`, data)
    return response.data
  },
}

export const reportsService = {
  async getOverview(params: { from: string; to: string; site_id?: string }) {
    const response = await apiClient.get('/reports/overview', { params })
    return response.data
  },
}

export const dhis2Service = {
  async export(data: { period: string; site_id: string; dry_run?: boolean }) {
    const response = await apiClient.post('/dhis2/export', data)
    return response.data
  },

  async getExportStatus(jobId: string) {
    const response = await apiClient.get(`/dhis2/export/${jobId}`)
    return response.data
  },
}
