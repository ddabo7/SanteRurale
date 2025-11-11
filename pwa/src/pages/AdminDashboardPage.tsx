import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface GlobalStats {
  total_tenants: number
  active_tenants: number
  new_tenants_this_month: number
  total_free_plan: number
  total_starter_plan: number
  total_pro_plan: number
  total_enterprise_plan: number
  mrr: number
  arr: number
  total_users: number
  total_patients: number
  total_encounters: number
  total_storage_bytes: number
  top_tenants: TenantStats[]
}

interface TenantStats {
  id: string
  name: string
  created_at: string
  total_users: number
  total_patients: number
  total_encounters: number
  plan_name: string
  plan_code: string
  subscription_status: string
  monthly_revenue: number
}

export const AdminDashboardPage = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
      const response = await fetch(`${API_BASE_URL}/admin/stats`, {
        credentials: 'include',
      })

      if (response.status === 403) {
        setError('Accès réservé aux administrateurs')
        return
      }

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des statistiques')
      }

      const data = await response.json()
      setStats(data)
    } catch (err: any) {
      console.error('Erreur:', err)
      setError(err.message || 'Erreur lors du chargement des statistiques')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatStorage = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          ← Retour à l'accueil
        </button>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">📊 Dashboard Administrateur</h1>
        <p className="text-gray-600 mt-1">
          Vue d'ensemble de la plateforme Santé Rurale
        </p>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total tenants */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Hôpitaux</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total_tenants}</p>
              <p className="text-xs text-green-600 mt-1">
                +{stats.new_tenants_this_month} ce mois
              </p>
            </div>
            <div className="text-4xl">🏥</div>
          </div>
        </div>

        {/* MRR */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">MRR</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats.mrr)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Revenu mensuel</p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </div>

        {/* ARR */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ARR</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats.arr)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Revenu annuel</p>
            </div>
            <div className="text-4xl">📈</div>
          </div>
        </div>

        {/* Hôpitaux actifs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Hôpitaux Actifs</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.active_tenants}</p>
              <p className="text-xs text-gray-500 mt-1">Ce mois</p>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>
      </div>

      {/* Répartition par plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📋 Répartition par Plan
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-4 h-4 bg-gray-400 rounded mr-3"></span>
                <span>Plan Gratuit (Pilote)</span>
              </div>
              <span className="font-semibold">{stats.total_free_plan}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-4 h-4 bg-blue-500 rounded mr-3"></span>
                <span>Plan Starter</span>
              </div>
              <span className="font-semibold">{stats.total_starter_plan}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-4 h-4 bg-purple-500 rounded mr-3"></span>
                <span>Plan Pro</span>
              </div>
              <span className="font-semibold">{stats.total_pro_plan}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-4 h-4 bg-yellow-500 rounded mr-3"></span>
                <span>Plan Enterprise</span>
              </div>
              <span className="font-semibold">{stats.total_enterprise_plan}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📊 Utilisation Globale
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Utilisateurs</span>
                <span className="font-medium">{stats.total_users}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Patients</span>
                <span className="font-medium">{stats.total_patients}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Consultations</span>
                <span className="font-medium">{stats.total_encounters}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Stockage</span>
                <span className="font-medium">{formatStorage(stats.total_storage_bytes)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-orange-600 h-2 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 10 hôpitaux */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            🏆 Top 10 Hôpitaux les Plus Actifs
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Hôpital
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Utilisateurs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Patients
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Consultations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Revenu/mois
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Inscrit le
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.top_tenants.map((tenant, index) => (
                <tr key={tenant.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-2">#{index + 1}</span>
                      <span className="font-medium text-gray-900">{tenant.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      tenant.plan_code === 'free'
                        ? 'bg-gray-100 text-gray-800'
                        : tenant.plan_code === 'starter'
                        ? 'bg-blue-100 text-blue-800'
                        : tenant.plan_code === 'pro'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {tenant.plan_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tenant.total_users}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tenant.total_patients}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {tenant.total_encounters}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(tenant.monthly_revenue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(tenant.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
