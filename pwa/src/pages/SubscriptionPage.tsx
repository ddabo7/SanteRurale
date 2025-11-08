import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../utils/currency'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

interface Plan {
  id: string
  code: string
  name: string
  description: string
  price_monthly: number
  price_yearly: number | null
  max_users: number | null
  max_patients_per_month: number | null
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
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [currency, setCurrency] = useState<string>('XOF')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showSubscribeModal, setShowSubscribeModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)

  const fetchData = async () => {
    try {
      const accessToken = localStorage.getItem('access_token')
      if (!accessToken) {
        setError('Non authentifié')
        return
      }

      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }

      // Récupérer les infos du tenant (pour la devise)
      const tenantResponse = await fetch(`${API_BASE_URL}/tenants/me`, {
        headers,
        credentials: 'include',
      })

      if (tenantResponse.ok) {
        const tenantData = await tenantResponse.json()
        setCurrency(tenantData.currency || 'XOF')
      }

      // Récupérer l'abonnement actuel
      const subResponse = await fetch(`${API_BASE_URL}/tenants/me/subscription`, {
        headers,
        credentials: 'include',
      })

      if (subResponse.ok) {
        const subData = await subResponse.json()
        setSubscription(subData)
      }

      // Récupérer les statistiques d'utilisation
      const usageResponse = await fetch(`${API_BASE_URL}/tenants/me/usage`, {
        headers,
        credentials: 'include',
      })

      if (usageResponse.ok) {
        const usageData = await usageResponse.json()
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
      setError(err.message || 'Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleConfirmSubscription = async () => {
    if (!selectedPlan) return

    setActionLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const accessToken = localStorage.getItem('access_token')
      if (!accessToken) {
        setError('Non authentifié')
        return
      }

      // Si on a déjà un abonnement, on change de plan (upgrade)
      if (subscription) {
        const response = await fetch(
          `${API_BASE_URL}/tenants/me/subscription/upgrade?new_plan_code=${selectedPlan.code}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.detail || 'Erreur lors du changement de plan')
        }

        setSuccess(`Votre plan a été changé avec succès vers ${selectedPlan.name} !`)
      } else {
        // Sinon, on souscrit à un nouveau plan
        const response = await fetch(`${API_BASE_URL}/tenants/me/subscribe`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ plan_code: selectedPlan.code }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.detail || 'Erreur lors de la souscription')
        }

        setSuccess(`Bienvenue dans le plan ${selectedPlan.name} !`)
      }

      setShowSubscribeModal(false)
      setSelectedPlan(null)
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Êtes-vous sûr de vouloir annuler votre abonnement ?')) {
      return
    }

    setActionLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const accessToken = localStorage.getItem('access_token')
      if (!accessToken) {
        setError('Non authentifié')
        return
      }

      const response = await fetch(`${API_BASE_URL}/tenants/me/subscription/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Erreur lors de l\'annulation')
      }

      setSuccess('Abonnement annulé avec succès')
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }


  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Gestion de l'abonnement</h1>

      {/* Messages */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Abonnement actuel */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Abonnement actuel</h2>
        </div>
        <div className="p-6">
          {subscription ? (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-emerald-600">{subscription.plan.name}</h3>
                  <p className="text-gray-600 mt-1">{subscription.plan.description}</p>
                  <div className="mt-4 flex items-baseline space-x-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {formatCurrency(subscription.plan.price_monthly, currency)}
                    </span>
                    <span className="text-gray-500">/mois</span>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      subscription.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : subscription.status === 'canceled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {subscription.status === 'active' ? 'Actif' : subscription.status}
                  </span>
                  <p className="text-sm text-gray-500 mt-2">
                    Depuis le {new Date(subscription.start_date).toLocaleDateString('fr-FR')}
                  </p>
                  {subscription.end_date && (
                    <p className="text-sm text-gray-500">
                      Jusqu'au {new Date(subscription.end_date).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              </div>

              {subscription.status === 'active' && !subscription.canceled_at && (
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="mt-4 text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                >
                  Annuler l'abonnement
                </button>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Aucun abonnement actif</p>
          )}
        </div>
      </div>

      {/* Statistiques d'utilisation */}
      {usage && subscription && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Utilisation</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Utilisateurs actifs</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {usage.active_users}
                  {usage.quotas.max_users && (
                    <span className="text-sm text-gray-500 font-normal">
                      {' '}
                      / {usage.quotas.max_users}
                    </span>
                  )}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Patients ce mois</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {usage.patients_this_month}
                  {usage.quotas.max_patients_per_month && (
                    <span className="text-sm text-gray-500 font-normal">
                      {' '}
                      / {usage.quotas.max_patients_per_month}
                    </span>
                  )}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Consultations ce mois</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {usage.encounters_this_month}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Stockage</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {(usage.storage_used_mb / 1024).toFixed(1)} GB
                  {usage.quotas.max_storage_gb && (
                    <span className="text-sm text-gray-500 font-normal">
                      {' '}
                      / {usage.quotas.max_storage_gb} GB
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plans disponibles */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Plans disponibles</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`border rounded-lg p-6 ${
                  subscription?.plan.code === plan.code
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200'
                }`}
              >
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-gray-600 mt-2 text-sm">{plan.description}</p>

                <div className="mt-4 flex items-baseline space-x-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {formatCurrency(plan.price_monthly, currency)}
                  </span>
                  <span className="text-gray-500">/mois</span>
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.max_users && (
                    <li className="flex items-center text-sm text-gray-600">
                      <svg
                        className="w-5 h-5 text-emerald-500 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {plan.max_users === -1 ? 'Utilisateurs illimités' : `${plan.max_users} utilisateurs`}
                    </li>
                  )}
                  {plan.max_patients_per_month && (
                    <li className="flex items-center text-sm text-gray-600">
                      <svg
                        className="w-5 h-5 text-emerald-500 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {plan.max_patients_per_month === -1
                        ? 'Patients illimités'
                        : `${plan.max_patients_per_month} patients/mois`}
                    </li>
                  )}
                  {plan.max_storage_gb && (
                    <li className="flex items-center text-sm text-gray-600">
                      <svg
                        className="w-5 h-5 text-emerald-500 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {plan.max_storage_gb} GB stockage
                    </li>
                  )}
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center text-sm text-gray-600">
                      <svg
                        className="w-5 h-5 text-emerald-500 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                {subscription?.plan.code === plan.code ? (
                  <button
                    disabled
                    className="mt-6 w-full bg-gray-300 text-gray-600 px-4 py-2 rounded-lg font-medium cursor-not-allowed"
                  >
                    Plan actuel
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedPlan(plan)
                      setShowSubscribeModal(true)
                    }}
                    disabled={actionLoading}
                    className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 transition-colors"
                  >
                    {subscription ? 'Changer de plan' : 'Souscrire'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modale de souscription */}
      {showSubscribeModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {subscription ? 'Changer de plan' : 'Souscrire à un plan'}
              </h2>
              <button
                onClick={() => {
                  setShowSubscribeModal(false)
                  setSelectedPlan(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-6">
              {/* Résumé du plan sélectionné */}
              <div className="bg-emerald-50 rounded-lg p-6 mb-6">
                <h3 className="text-xl font-bold text-emerald-900 mb-2">{selectedPlan.name}</h3>
                <p className="text-emerald-700 mb-4">{selectedPlan.description}</p>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-bold text-emerald-900">
                    {formatCurrency(selectedPlan.price_monthly, currency)}
                  </span>
                  <span className="text-emerald-700">/mois</span>
                </div>

                {/* Fonctionnalités incluses */}
                <div className="mt-6">
                  <h4 className="font-semibold text-emerald-900 mb-3">Ce qui est inclus :</h4>
                  <ul className="space-y-2">
                    {selectedPlan.max_users && (
                      <li className="flex items-center text-emerald-800">
                        <svg className="w-5 h-5 text-emerald-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {selectedPlan.max_users === -1 ? 'Utilisateurs illimités' : `${selectedPlan.max_users} utilisateurs`}
                      </li>
                    )}
                    {selectedPlan.max_patients_per_month && (
                      <li className="flex items-center text-emerald-800">
                        <svg className="w-5 h-5 text-emerald-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {selectedPlan.max_patients_per_month === -1 ? 'Patients illimités' : `${selectedPlan.max_patients_per_month} patients/mois`}
                      </li>
                    )}
                    {selectedPlan.max_storage_gb && (
                      <li className="flex items-center text-emerald-800">
                        <svg className="w-5 h-5 text-emerald-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {selectedPlan.max_storage_gb} GB de stockage
                      </li>
                    )}
                    {selectedPlan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center text-emerald-800">
                        <svg className="w-5 h-5 text-emerald-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Information de changement de plan */}
              {subscription && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-1">Changement de plan</h4>
                      <p className="text-sm text-blue-800">
                        Vous passez de <strong>{subscription.plan.name}</strong> à <strong>{selectedPlan.name}</strong>.
                        Le changement prendra effet immédiatement et vous serez facturé au prorata.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Note pour les plans gratuits */}
              {selectedPlan.price_monthly === 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-700">
                    <strong>Note :</strong> Ce plan est gratuit dans le cadre du programme pilote. Vous ne serez pas facturé.
                  </p>
                </div>
              )}

              {/* Simulateur de paiement (pour les plans payants) */}
              {selectedPlan.price_monthly > 0 && (
                <div className="border border-gray-200 rounded-lg p-6 mb-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Informations de paiement</h4>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div className="flex-1">
                        <h5 className="font-semibold text-yellow-900 mb-1">Intégration Stripe en cours</h5>
                        <p className="text-sm text-yellow-800">
                          Le système de paiement sera activé prochainement. Pour l'instant, les plans payants sont accessibles gratuitement pendant la phase pilote.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Conditions */}
              <div className="text-sm text-gray-600 mb-6">
                <p>
                  En souscrivant, vous acceptez nos{' '}
                  <a href="#" className="text-emerald-600 hover:text-emerald-700 underline">
                    conditions d'utilisation
                  </a>{' '}
                  et notre{' '}
                  <a href="#" className="text-emerald-600 hover:text-emerald-700 underline">
                    politique de confidentialité
                  </a>
                  .
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowSubscribeModal(false)
                  setSelectedPlan(null)
                }}
                disabled={actionLoading}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmSubscription}
                disabled={actionLoading}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Traitement...' : subscription ? 'Confirmer le changement' : 'Confirmer la souscription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
