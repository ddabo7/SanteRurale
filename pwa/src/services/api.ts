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
      console.debug('🔍 API Error:', {
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
    // Vérifier si on est online
    const isOnline = navigator.onLine

    if (isOnline) {
      try {
        const response = await apiClient.get('/patients', { params })
        const patients = response.data.data || response.data || []

        // Mettre en cache dans IndexedDB pour le mode offline
        if (Array.isArray(patients) && patients.length > 0) {
          try {
            // Marquer tous comme synchronisés et stocker
            const patientsToCache = patients.map((p: any) => ({
              ...p,
              _synced: true,
              _cached_at: new Date().toISOString()
            }))
            await db.patients.bulkPut(patientsToCache)
            console.log(`📦 ${patients.length} patients mis en cache pour le mode offline`)
          } catch (cacheError) {
            console.warn('⚠️ Erreur mise en cache IndexedDB:', cacheError)
          }
        }

        return response.data
      } catch (error: any) {
        // Si erreur réseau, fallback vers IndexedDB
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          console.log('📵 Erreur réseau, lecture depuis IndexedDB...')
          return this.listFromCache(params)
        }
        throw error
      }
    } else {
      // Mode offline : lire depuis IndexedDB
      console.log('📵 Mode offline, lecture depuis IndexedDB...')
      return this.listFromCache(params)
    }
  },

  async listFromCache(params?: { search?: string; village?: string; limit?: number }) {
    let patients = await db.patients.toArray()

    // Appliquer les filtres si présents
    if (params?.search) {
      const search = params.search.toLowerCase()
      patients = patients.filter(p =>
        p.nom?.toLowerCase().includes(search) ||
        p.prenom?.toLowerCase().includes(search) ||
        p.telephone?.includes(search)
      )
    }

    if (params?.village) {
      patients = patients.filter(p => p.village === params.village)
    }

    // Limiter les résultats
    if (params?.limit) {
      patients = patients.slice(0, params.limit)
    }

    console.log(`📦 ${patients.length} patients chargés depuis le cache IndexedDB`)

    return {
      data: patients,
      total: patients.length,
      _fromCache: true
    }
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
    const isOnline = navigator.onLine

    if (isOnline) {
      try {
        const response = await apiClient.get('/encounters', { params })
        const encounters = response.data.data || response.data || []

        // Mettre en cache dans IndexedDB
        if (Array.isArray(encounters) && encounters.length > 0) {
          try {
            const encountersToCache = encounters.map((e: any) => ({
              ...e,
              _synced: true,
              _cached_at: new Date().toISOString()
            }))
            await db.encounters.bulkPut(encountersToCache)
            console.log(`📦 ${encounters.length} consultations mises en cache`)
          } catch (cacheError) {
            console.warn('⚠️ Erreur mise en cache encounters:', cacheError)
          }
        }

        return response.data
      } catch (error: any) {
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          console.log('📵 Erreur réseau, lecture consultations depuis IndexedDB...')
          return this.listFromCache(params)
        }
        throw error
      }
    } else {
      console.log('📵 Mode offline, lecture consultations depuis IndexedDB...')
      return this.listFromCache(params)
    }
  },

  async listFromCache(params?: { patient_id?: string; from_date?: string; to_date?: string }) {
    let encounters = await db.encounters.toArray()

    if (params?.patient_id) {
      encounters = encounters.filter(e => e.patient_id === params.patient_id)
    }

    if (params?.from_date) {
      const fromDate = new Date(params.from_date)
      encounters = encounters.filter(e => new Date(e.date || e.created_at) >= fromDate)
    }

    if (params?.to_date) {
      const toDate = new Date(params.to_date)
      encounters = encounters.filter(e => new Date(e.date || e.created_at) <= toDate)
    }

    console.log(`📦 ${encounters.length} consultations chargées depuis le cache`)

    return {
      data: encounters,
      total: encounters.length,
      _fromCache: true
    }
  },

  async get(id: string) {
    const isOnline = navigator.onLine

    if (isOnline) {
      try {
        const response = await apiClient.get(`/encounters/${id}`)
        // Mettre en cache
        try {
          await db.encounters.put({ ...response.data, _synced: true })
        } catch {}
        return response.data
      } catch (error: any) {
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          const cached = await db.encounters.get(id)
          if (cached) return cached
        }
        throw error
      }
    } else {
      const cached = await db.encounters.get(id)
      if (cached) return cached
      throw new Error('Consultation non disponible en mode offline')
    }
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

// ===========================================================================
// PHARMACY INVENTORY SERVICES
// ===========================================================================

export const medicamentsService = {
  async list(params?: { search?: string; forme?: string; cursor?: string; limit?: number }) {
    const response = await apiClient.get('/medicaments', { params })
    return response.data
  },

  async get(id: string) {
    const response = await apiClient.get(`/medicaments/${id}`)
    return response.data
  },

  async create(data: any) {
    const response = await apiClient.post('/medicaments', data)
    return response.data
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/medicaments/${id}`, data)
    return response.data
  },

  async delete(id: string) {
    await apiClient.delete(`/medicaments/${id}`)
  },
}

export const stockService = {
  async listBySite(siteId: string, params?: { search?: string; en_alerte?: boolean; cursor?: string; limit?: number }) {
    const response = await apiClient.get(`/stock/sites/${siteId}`, { params })
    return response.data
  },

  async createMovement(data: any) {
    const response = await apiClient.post('/stock/mouvements', data)
    return response.data
  },

  async listMovements(params?: { site_id?: string; medicament_id?: string; cursor?: string; limit?: number }) {
    const response = await apiClient.get('/stock/mouvements', { params })
    return response.data
  },
}

export const fournisseursService = {
  async list(params?: { search?: string; type?: string; cursor?: string; limit?: number }) {
    const response = await apiClient.get('/fournisseurs', { params })
    return response.data
  },

  async get(id: string) {
    const response = await apiClient.get(`/fournisseurs/${id}`)
    return response.data
  },

  async create(data: any) {
    const response = await apiClient.post('/fournisseurs', data)
    return response.data
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/fournisseurs/${id}`, data)
    return response.data
  },

  async delete(id: string) {
    await apiClient.delete(`/fournisseurs/${id}`)
  },
}

export const bonsCommandeService = {
  async list(params?: { fournisseur_id?: string; statut?: string; cursor?: string; limit?: number }) {
    const response = await apiClient.get('/bons-commande', { params })
    return response.data
  },

  async get(id: string) {
    const response = await apiClient.get(`/bons-commande/${id}`)
    return response.data
  },

  async create(data: any) {
    const response = await apiClient.post('/bons-commande', data)
    return response.data
  },

  async valider(id: string) {
    const response = await apiClient.put(`/bons-commande/${id}/valider`)
    return response.data
  },
}
