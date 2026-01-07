import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../utils/currency'
import { getCachedOrDetectCurrency } from '../utils/geolocation'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

interface Plan {
  id: string
  code: string
  name: string
  description: string
  price_monthly: number
  price_yearly: number | null
  max_users: number | null
  max_patients_total: number | null  // Limite totale (plan gratuit)
  max_patients_per_month: number | null  // Limite mensuelle (plans payants)
  max_sites: number | null
  max_storage_gb: number | null
  features: string[]
}

interface Subscription {
  id: string
  plan: Plan
  status: string
  start_date: string
  end_date: string | null
  auto_renew: boolean
  canceled_at: string | null
}

interface UsageStats {
  active_users: number
  patients_this_month: number
  encounters_this_month: number
  storage_used_mb: number
  quotas: {
    max_users: number | null
    max_patients_per_month: number | null
    max_sites: number | null
    max_storage_gb: number | null
  }
}

export const SubscriptionPage = () => {
  const { t } = useTranslation()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [currency, setCurrency] = useState<string>('XOF')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showPlansModal, setShowPlansModal] = useState(false)
  const [showSubscribeModal, setShowSubscribeModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'usage'>('overview')

  const fetchData = async () => {
    try {
      const headers = {
        'Content-Type': 'application/json',
      }

      // Détecter automatiquement la devise basée sur la localisation de l'utilisateur
      // TOUJOURS utiliser la devise détectée (pas celle du tenant) 
      const detectedCurrency = await getCachedOrDetectCurrency()
      setCurrency(detectedCurrency)

      // Récupérer les infos du tenant
      const tenantResponse = await fetch(`${API_BASE_URL}/tenants/me`, {
        headers,
        credentials: 'include',
      })

      // Récupérer l'abonnement actuel
      const subResponse = await fetch(`${API_BASE_URL}/tenants/me/subscription`, {
        headers,
        credentials: 'include',
      })

      if (subResponse.ok) {
        const subData = await subResponse.json()
        setSubscription(subData)
      } else if (subResponse.status === 401 || subResponse.status === 403) {
        setError(t('subscription.mustBeLoggedIn'))
        return
      } else if (subResponse.status === 404) {
        console.log('Aucun abonnement actif')
      }

      // Récupérer les statistiques d'utilisation
      const usageResponse = await fetch(`${API_BASE_URL}/tenants/me/usage`, {
        headers,
        credentials: 'include',
      })

      if (usageResponse.ok) {
        const usageData = await usageResponse.json()

        // Récupérer aussi les stats de stockage réelles
        const storageResponse = await fetch(`${API_BASE_URL}/attachments/storage-stats`, {
          headers,
          credentials: 'include',
        })

        if (storageResponse.ok) {
          const storageData = await storageResponse.json()
          usageData.storage_used_mb = Math.round(storageData.total_gb * 1024)
          usageData.quotas.max_storage_gb = storageData.quota_gb
        }

        setUsage(usageData)
      }

      // Récupérer les plans disponibles
      const plansResponse = await fetch(`${API_BASE_URL}/tenants/plans`, {
        headers,
        credentials: 'include',
      })

      if (plansResponse.ok) {
        const plansData = await plansResponse.json()
        setPlans(plansData)
      }
    } catch (err: any) {
      setError(err.message || t('subscription.loadingError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showSubscribeModal) {
          setShowSubscribeModal(false)
          setSelectedPlan(null)
        }
        if (showPlansModal) {
          setShowPlansModal(false)
        }
      }
    }

    document.addEventListener('keydown', handleEscKey)
    return () => document.removeEventListener('keydown', handleEscKey)
  }, [showSubscribeModal, showPlansModal])

  const handleConfirmSubscription = async () => {
    if (!selectedPlan) return

    setActionLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const headers = {
        'Content-Type': 'application/json',
      }

      if (subscription) {
        const response = await fetch(
          `${API_BASE_URL}/tenants/me/subscription/upgrade?new_plan_code=${selectedPlan.code}`,
          {
            method: 'POST',
            headers,
            credentials: 'include',
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.detail || t('subscription.messages.planChangeError'))
        }

        setSuccess(t('subscription.messages.planChangedSuccess', { planName: selectedPlan.name }))
      } else {
        const response = await fetch(`${API_BASE_URL}/tenants/me/subscribe`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ plan_code: selectedPlan.code }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.detail || t('subscription.messages.subscriptionError'))
        }

        setSuccess(t('subscription.messages.welcomeToPlan', { planName: selectedPlan.name }))
      }

      setShowSubscribeModal(false)
      setShowPlansModal(false)
      setSelectedPlan(null)
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm(t('subscription.messages.confirmCancelQuestion'))) {
      return
    }

    setActionLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`${API_BASE_URL}/tenants/me/subscription/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || t('subscription.messages.cancelError'))
      }

      setSuccess(t('subscription.messages.cancelSuccess'))
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const getUsagePercentage = (current: number, max: number | null) => {
    if (!max) return 0
    return Math.min((current / max) * 100, 100)
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-emerald-500'
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('subscription.title')}</h1>
            <p className="mt-2 text-gray-600">{t('subscription.subtitle')}</p>
          </div>
          {subscription?.plan.code === 'free' && (
            <button
              onClick={() => setShowPlansModal(true)}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              {t('subscription.upgradeToAnyPlan')}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
          <div className="flex">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="ml-3 text-sm text-green-700 font-medium">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="ml-3 text-sm text-red-700 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('subscription.tabs.overview')}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'usage'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {t('subscription.tabs.usage')}
            </div>
          </button>
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && subscription && (
        <div className="space-y-6">
          {/* Current Plan Card */}
          <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-8 text-white">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-white/80">{t('subscription.currentPlan')}</span>
                      <h2 className="text-3xl font-bold">{subscription.plan.name}</h2>
                    </div>
                  </div>

                  <p className="text-white/90 text-lg mb-6">{subscription.plan.description}</p>

                  <div className="flex items-baseline space-x-3">
                    <span className="text-5xl font-bold">{formatCurrency(subscription.plan.price_monthly, currency)}</span>
                    <span className="text-xl text-white/80">{t('subscription.perMonth')}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end space-y-3">
                  <span
                    className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
                      subscription.status === 'active'
                        ? 'bg-white text-emerald-600'
                        : 'bg-white/20 backdrop-blur-sm text-white'
                    }`}
                  >
                    {subscription.status === 'active' ? `✓ ${t('subscription.active')}` : subscription.status}
                  </span>

                  {subscription.plan.code === 'free' && (
                    <span className="inline-flex items-center px-4 py-2 rounded-full text-xs font-medium bg-yellow-400 text-yellow-900">
                      {t('subscription.pilotPhase')}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="mt-8 grid grid-cols-3 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <p className="text-white/70 text-sm">{t('subscription.stats.users')}</p>
                  <p className="text-2xl font-bold mt-1">
                    {subscription.plan.max_users === null ? t('subscription.stats.unlimited') : subscription.plan.max_users}
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <p className="text-white/70 text-sm">{t('subscription.stats.patients')}</p>
                  <p className="text-2xl font-bold mt-1">
                    {subscription.plan.max_patients_total !== null
                      ? subscription.plan.max_patients_total
                      : subscription.plan.max_patients_per_month !== null
                        ? `${subscription.plan.max_patients_per_month}${t('subscription.perMonth')}`
                        : t('subscription.stats.unlimited')}
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <p className="text-white/70 text-sm">{t('subscription.stats.storage')}</p>
                  <p className="text-2xl font-bold mt-1">{subscription.plan.max_storage_gb} GB</p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex items-center space-x-4">
                {subscription.plan.code === 'free' ? (
                  <button
                    onClick={() => setShowPlansModal(true)}
                    className="bg-white text-emerald-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg"
                  >
                    {t('subscription.upgradeToHigherPlan')}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setShowPlansModal(true)}
                      className="bg-white text-emerald-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                    >
                      {t('subscription.changePlan')}
                    </button>
                    {subscription.status === 'active' && !subscription.canceled_at && (
                      <button
                        onClick={handleCancel}
                        disabled={actionLoading}
                        className="bg-white/10 backdrop-blur-sm text-white px-6 py-3 rounded-lg font-medium hover:bg-white/20 transition-colors disabled:opacity-50"
                      >
                        {t('subscription.cancelSubscription')}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Usage Tab */}
      {activeTab === 'usage' && usage && (
        <div className="space-y-6">
          {/* Phase Pilote Warning */}
          {subscription?.plan.code === 'free' && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-400 rounded-r-xl p-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-semibold text-amber-900 mb-2">
                    {t('subscription.usage.freePlanLimitations')}
                  </h3>
                  <p className="text-amber-800 mb-3">
                    {t('subscription.usage.freePlanMessage')}
                  </p>
                  <button
                    onClick={() => setShowPlansModal(true)}
                    className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium transition-colors"
                  >
                    {t('subscription.usage.viewPlans')}
                    <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Usage Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Utilisateurs */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 rounded-lg p-3">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('subscription.stats.activeUsers')}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {usage.active_users}
                      {usage.quotas.max_users && (
                        <span className="text-base text-gray-500 font-normal"> / {usage.quotas.max_users}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              {usage.quotas.max_users && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>{t('subscription.stats.usage')}</span>
                    <span className="font-semibold">{getUsagePercentage(usage.active_users, usage.quotas.max_users).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getUsageColor(getUsagePercentage(usage.active_users, usage.quotas.max_users))}`}
                      style={{ width: `${getUsagePercentage(usage.active_users, usage.quotas.max_users)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Patients */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-100 rounded-lg p-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('subscription.stats.patientsThisMonth')}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {usage.patients_this_month}
                      {usage.quotas.max_patients_per_month && (
                        <span className="text-base text-gray-500 font-normal"> / {usage.quotas.max_patients_per_month}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              {usage.quotas.max_patients_per_month && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>{t('subscription.stats.usage')}</span>
                    <span className="font-semibold">{getUsagePercentage(usage.patients_this_month, usage.quotas.max_patients_per_month).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getUsageColor(getUsagePercentage(usage.patients_this_month, usage.quotas.max_patients_per_month))}`}
                      style={{ width: `${getUsagePercentage(usage.patients_this_month, usage.quotas.max_patients_per_month)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Consultations */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-100 rounded-lg p-3">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('subscription.stats.consultationsThisMonth')}</p>
                    <p className="text-2xl font-bold text-gray-900">{usage.encounters_this_month}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stockage */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-orange-100 rounded-lg p-3">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('subscription.stats.storageUsed')}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(usage.storage_used_mb / 1024).toFixed(1)} GB
                      {usage.quotas.max_storage_gb && (
                        <span className="text-base text-gray-500 font-normal"> / {usage.quotas.max_storage_gb} GB</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              {usage.quotas.max_storage_gb && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>{t('subscription.stats.usage')}</span>
                    <span className="font-semibold">{getUsagePercentage(usage.storage_used_mb / 1024, usage.quotas.max_storage_gb).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getUsageColor(getUsagePercentage(usage.storage_used_mb / 1024, usage.quotas.max_storage_gb))}`}
                      style={{ width: `${getUsagePercentage(usage.storage_used_mb / 1024, usage.quotas.max_storage_gb)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plans Modal */}
      {showPlansModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 overflow-y-auto"
          onClick={() => setShowPlansModal(false)}
        >
          {/* Bouton fermer flottant pour mobile - toujours visible */}
          <button
            onClick={() => setShowPlansModal(false)}
            className="fixed top-4 right-4 z-[60] sm:hidden bg-white/90 backdrop-blur-sm text-gray-700 p-3 rounded-full shadow-lg hover:bg-white transition-colors"
            aria-label={t('subscription.modal.close')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div
            className="bg-white rounded-none sm:rounded-2xl shadow-2xl max-w-6xl w-full min-h-screen sm:min-h-0 sm:my-8 sm:mx-4 max-h-none sm:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-teal-50 sticky top-0 z-10">
              <div>
                <h2 className="text-xl sm:text-3xl font-bold text-gray-900">{t('subscription.modal.choosePlan')}</h2>
                <p className="text-gray-600 mt-1 text-sm sm:text-base">{t('subscription.modal.selectPlanDescription')}</p>
              </div>
              <button
                onClick={() => setShowPlansModal(false)}
                className="hidden sm:block text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors p-3 rounded-lg"
                aria-label={t('subscription.modal.close')}
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Plans Grid */}
            <div className="p-4 sm:p-8 pb-20 sm:pb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => {
                  const isCurrentPlan = subscription?.plan.code === plan.code
                  const isPilot = subscription?.plan.code === 'free'
                  const isPaidPlan = plan.price_monthly > 0
                  const isDisabled = isPaidPlan && isPilot

                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-xl border-2 p-6 transition-all hover:shadow-xl ${
                        isCurrentPlan
                          ? 'border-emerald-500 bg-emerald-50 shadow-lg'
                          : isDisabled
                          ? 'border-gray-200 bg-gray-50 opacity-60'
                          : 'border-gray-200 bg-white hover:border-emerald-300'
                      }`}
                    >
                      {isCurrentPlan && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                            {t('subscription.modal.currentPlanBadge')}
                          </span>
                        </div>
                      )}

                      {isPaidPlan && isPilot && (
                        <div className="absolute -top-3 right-3">
                          <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                            {t('subscription.modal.phase2Badge')}
                          </span>
                        </div>
                      )}

                      <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                        <p className="text-sm text-gray-600 mb-4 h-10">{plan.description}</p>
                        <div className="mb-4">
                          <span className="text-4xl font-bold text-gray-900">
                            {formatCurrency(plan.price_monthly, currency)}
                          </span>
                          <span className="text-gray-500 text-sm">{t('subscription.perMonth')}</span>
                        </div>
                      </div>

                      <ul className="space-y-3 mb-6">
                        {plan.max_users && (
                          <li className="flex items-start text-sm">
                            <svg className="w-5 h-5 text-emerald-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-gray-700">
                              {plan.max_users === -1 ? t('subscription.modal.usersUnlimited') : t('subscription.modal.usersCount', { count: plan.max_users })}
                            </span>
                          </li>
                        )}
                        {(plan.max_patients_total || plan.max_patients_per_month) && (
                          <li className="flex items-start text-sm">
                            <svg className="w-5 h-5 text-emerald-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-gray-700">
                              {plan.max_patients_total
                                ? t('subscription.modal.patientsTotal', { count: plan.max_patients_total })
                                : plan.max_patients_per_month
                                  ? t('subscription.modal.patientsPerMonth', { count: plan.max_patients_per_month })
                                  : t('subscription.modal.patientsUnlimited')}
                            </span>
                          </li>
                        )}
                        {!plan.max_patients_total && !plan.max_patients_per_month && (
                          <li className="flex items-start text-sm">
                            <svg className="w-5 h-5 text-emerald-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-gray-700">{t('subscription.modal.patientsUnlimited')}</span>
                          </li>
                        )}
                        {plan.max_storage_gb && (
                          <li className="flex items-start text-sm">
                            <svg className="w-5 h-5 text-emerald-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-gray-700">{t('subscription.modal.storageGB', { count: plan.max_storage_gb })}</span>
                          </li>
                        )}
                      </ul>

                      <button
                        onClick={() => {
                          if (!isCurrentPlan && !isDisabled) {
                            setSelectedPlan(plan)
                            setShowSubscribeModal(true)
                          }
                        }}
                        disabled={isCurrentPlan || isDisabled || actionLoading}
                        className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                          isCurrentPlan
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            : isDisabled
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-lg hover:shadow-xl'
                        }`}
                      >
                        {isCurrentPlan
                          ? t('subscription.currentLabel')
                          : isDisabled
                          ? t('subscription.modal.comingSoon')
                          : subscription
                          ? t('subscription.modal.change')
                          : t('subscription.modal.choose')}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Confirmation Modal */}
      {showSubscribeModal && selectedPlan && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 overflow-y-auto"
          onClick={() => {
            setShowSubscribeModal(false)
            setSelectedPlan(null)
          }}
        >
          {/* Bouton fermer flottant pour mobile */}
          <button
            onClick={() => {
              setShowSubscribeModal(false)
              setSelectedPlan(null)
            }}
            className="fixed top-4 right-4 z-[60] sm:hidden bg-white/90 backdrop-blur-sm text-gray-700 p-3 rounded-full shadow-lg hover:bg-white transition-colors"
            aria-label={t('subscription.modal.close')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div
            className="bg-white rounded-none sm:rounded-2xl shadow-2xl max-w-2xl w-full min-h-screen sm:min-h-0 sm:my-8 sm:mx-4 max-h-none sm:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50 sticky top-0 z-10 flex justify-between items-center">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                {subscription ? t('subscription.confirmModal.title') : t('subscription.confirmModal.titleSubscribe')}
              </h2>
              <button
                onClick={() => {
                  setShowSubscribeModal(false)
                  setSelectedPlan(null)
                }}
                className="hidden sm:block text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors p-2 rounded-lg"
                aria-label={t('subscription.modal.close')}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-4 sm:px-8 py-4 sm:py-6">
              {/* Plan Summary */}
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 sm:p-6 mb-6 text-white">
                <h3 className="text-2xl font-bold mb-2">{selectedPlan.name}</h3>
                <p className="text-white/90 mb-4">{selectedPlan.description}</p>
                <div className="flex items-baseline space-x-2">
                  <span className="text-5xl font-bold">{formatCurrency(selectedPlan.price_monthly, currency)}</span>
                  <span className="text-xl">{t('subscription.perMonth')}</span>
                </div>
              </div>

              {/* Change Info */}
              {subscription && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-1">{t('subscription.confirmModal.title')}</h4>
                      <p className="text-sm text-blue-800">
                        {t('subscription.confirmModal.changingFrom')} <strong>{subscription.plan.name}</strong> {t('subscription.confirmModal.changingTo')} <strong>{selectedPlan.name}</strong>.
                        {selectedPlan.price_monthly > 0 && ` ${t('subscription.confirmModal.immediateEffect')}`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Free Plan Note */}
              {selectedPlan.price_monthly === 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-700">
                    {t('subscription.confirmModal.freeNote')}
                  </p>
                </div>
              )}

              {/* Payment Info for Paid Plans */}
              {selectedPlan.price_monthly > 0 && (
                <div className="border border-gray-200 rounded-lg p-6 mb-6">
                  <h4 className="font-semibold text-gray-900 mb-4">{t('subscription.confirmModal.paymentInfo')}</h4>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h5 className="font-semibold text-yellow-900 mb-1">{t('subscription.confirmModal.stripeIntegration')}</h5>
                        <p className="text-sm text-yellow-800">
                          {t('subscription.confirmModal.stripeMessage')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Terms */}
              <div className="text-sm text-gray-600">
                <p>
                  {t('subscription.confirmModal.termsAccept')}{' '}
                  <a href="#" className="text-emerald-600 hover:text-emerald-700 underline">
                    {t('subscription.confirmModal.termsOfUse')}
                  </a>
                  .
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gray-50 border-t border-gray-200 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:space-x-3 sticky bottom-0">
              <button
                onClick={() => {
                  setShowSubscribeModal(false)
                  setSelectedPlan(null)
                }}
                disabled={actionLoading}
                className="w-full sm:w-auto px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-semibold disabled:opacity-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmSubscription}
                disabled={actionLoading}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-semibold disabled:opacity-50 shadow-lg transition-all"
              >
                {actionLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('subscription.confirmModal.processing')}
                  </span>
                ) : (
                  subscription ? t('subscription.confirmModal.confirmChange') : t('subscription.confirmModal.confirmSubscription')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
