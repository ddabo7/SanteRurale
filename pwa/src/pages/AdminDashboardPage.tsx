import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface GlobalStats {
  total_tenants: number
  active_tenants: number
  new_tenants_this_month: number
  total_sites: number
  active_sites: number
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
  const { t } = useTranslation()
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
        setError(t('admin.dashboard.errors.accessDenied'))
        return
      }

      if (!response.ok) {
        throw new Error(t('admin.dashboard.errors.loadError'))
      }

      const data = await response.json()
      setStats(data)
    } catch (err: any) {
      console.error('Erreur:', err)
      setError(err.message || t('admin.dashboard.errors.loadError'))
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
        <div className="text-gray-500">{t('common.loading')}</div>
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
          {t('admin.dashboard.backToHome')}
        </button>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">📊 {t('admin.dashboard.title')}</h1>
        <p className="text-gray-600 mt-1">
          {t('admin.dashboard.subtitle')}
        </p>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {/* Total Organisations */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('admin.dashboard.stats.totalOrganizations')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total_tenants}</p>
              <p className="text-xs text-green-600 mt-1">
                {t('admin.dashboard.stats.newThisMonth', { count: stats.new_tenants_this_month })}
              </p>
            </div>
            <div className="text-4xl">🏢</div>
          </div>
        </div>

        {/* Total Sites */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('admin.dashboard.stats.totalSites')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total_sites}</p>
              <p className="text-xs text-green-600 mt-1">
                {stats.active_sites} {t('admin.dashboard.stats.active')}
              </p>
            </div>
            <div className="text-4xl">🏥</div>
          </div>
        </div>

        {/* MRR */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('admin.dashboard.stats.mrr')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats.mrr)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{t('admin.dashboard.stats.monthlyRevenue')}</p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </div>

        {/* ARR */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('admin.dashboard.stats.arr')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats.arr)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{t('admin.dashboard.stats.annualRevenue')}</p>
            </div>
            <div className="text-4xl">📈</div>
          </div>
        </div>

        {/* Organisations actives */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('admin.dashboard.stats.activeOrganizations')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.active_tenants}</p>
              <p className="text-xs text-gray-500 mt-1">{t('admin.dashboard.stats.thisMonth')}</p>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>
      </div>

      {/* Répartition par plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📋 {t('admin.dashboard.planDistribution.title')}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-4 h-4 bg-gray-400 rounded mr-3"></span>
                <span>{t('admin.dashboard.planDistribution.freePlan')}</span>
              </div>
              <span className="font-semibold">{stats.total_free_plan}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-4 h-4 bg-blue-500 rounded mr-3"></span>
                <span>{t('admin.dashboard.planDistribution.starterPlan')}</span>
              </div>
              <span className="font-semibold">{stats.total_starter_plan}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-4 h-4 bg-purple-500 rounded mr-3"></span>
                <span>{t('admin.dashboard.planDistribution.proPlan')}</span>
              </div>
              <span className="font-semibold">{stats.total_pro_plan}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-4 h-4 bg-yellow-500 rounded mr-3"></span>
                <span>{t('admin.dashboard.planDistribution.enterprisePlan')}</span>
              </div>
              <span className="font-semibold">{stats.total_enterprise_plan}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📊 {t('admin.dashboard.globalUsage.title')}
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{t('admin.dashboard.globalUsage.users')}</span>
                <span className="font-medium">{stats.total_users}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{t('admin.dashboard.globalUsage.patients')}</span>
                <span className="font-medium">{stats.total_patients}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{t('admin.dashboard.globalUsage.consultations')}</span>
                <span className="font-medium">{stats.total_encounters}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{t('admin.dashboard.globalUsage.storage')}</span>
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
            🏆 {t('admin.dashboard.topHospitals.title')}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('admin.dashboard.topHospitals.hospital')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('admin.dashboard.topHospitals.plan')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('admin.dashboard.topHospitals.users')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('admin.dashboard.topHospitals.patients')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('admin.dashboard.topHospitals.consultations')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('admin.dashboard.topHospitals.revenuePerMonth')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('admin.dashboard.topHospitals.registeredOn')}
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
