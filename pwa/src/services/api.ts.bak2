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
  withCredentials: true, // IMPORTANT: Envoie les cookies HttpOnly automatiquement
  headers: {
    'Content-Type': 'application/json',
  },
})

// ===========================================================================
// INTERCEPTEURS REQUEST
// ===========================================================================

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Les tokens sont maintenant dans des cookies HttpOnly
    // Ils sont automatiquement envoyés grâce à withCredentials: true
    // Plus besoin d'ajouter le header Authorization manuellement
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// ===========================================================================
// INTERCEPTEURS RESPONSE
// ===========================================================================

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
    // 401 Unauthorized - Session expirée, rediriger vers login
    if (error.response?.status === 401) {
      // Les cookies HttpOnly ont expiré, le backend gère le refresh automatiquement
      // Si on reçoit un 401, c'est que la session est vraiment expirée
      await db.user_session.clear()
      window.location.href = '/login'
      return Promise.reject(error)
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

  async logout() {
    // Les cookies HttpOnly seront automatiquement supprimés par le backend
    await apiClient.post('/auth/logout')
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
    const response = await apiClient.post('/encounters/conditions', data)
    return response.data
  },
}

export const medicationsService = {
  async create(data: any) {
    const response = await apiClient.post('/encounters/medication-requests', data)
    return response.data
  },
}

export const proceduresService = {
  async create(data: any) {
    const response = await apiClient.post('/encounters/procedures', data)
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

export const attachmentsService = {
  async upload(file: File, patientId?: string, encounterId?: string) {
    const formData = new FormData()
    formData.append('file', file)

    const params = new URLSearchParams()
    if (patientId) params.append('patient_id', patientId)
    if (encounterId) params.append('encounter_id', encounterId)

    const response = await apiClient.post(`/attachments/upload?${params.toString()}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  async list(patientId?: string, encounterId?: string) {
    const params = new URLSearchParams()
    if (patientId) params.append('patient_id', patientId)
    if (encounterId) params.append('encounter_id', encounterId)

    const response = await apiClient.get(`/attachments?${params.toString()}`)
    return response.data
  },

  async getStorageStats() {
    const response = await apiClient.get('/attachments/storage-stats')
    return response.data
  },

  getDownloadUrl(attachmentId: string) {
    return `${apiClient.defaults.baseURL}/attachments/${attachmentId}/download`
  },

  async delete(attachmentId: string) {
    const response = await apiClient.delete(`/attachments/${attachmentId}`)
    return response.data
  },
}
