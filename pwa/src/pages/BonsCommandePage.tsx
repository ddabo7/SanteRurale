import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { bonsCommandeService } from '../services/api'
import { formatCurrency } from '../utils/currency'
import { getCachedOrDetectCurrency } from '../utils/geolocation'

interface BonCommande {
  id: string
  numero: string
  fournisseur_id: string
  fournisseur_nom?: string
  site_id: string
  statut: string
  date_commande: string
  date_livraison_prevue?: string
  date_reception?: string
  montant_total?: number
  notes?: string
  created_at: string
}

export const BonsCommandePage = () => {
  const [searchParams] = useSearchParams()
  const fournisseurIdParam = searchParams.get('fournisseur_id')

  const [bons, setBons] = useState<BonCommande[]>([])
  const [filterFournisseur, setFilterFournisseur] = useState(fournisseurIdParam || '')
  const [filterStatut, setFilterStatut] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currency, setCurrency] = useState<string>('XOF')

  useEffect(() => {
    loadBons()
  }, [filterFournisseur, filterStatut])

  useEffect(() => {
    const detectCurrency = async () => {
      const detectedCurrency = await getCachedOrDetectCurrency()
      setCurrency(detectedCurrency)
    }
    detectCurrency()
  }, [])

  const loadBons = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params: any = { limit: 200 }
      if (filterFournisseur) params.fournisseur_id = filterFournisseur
      if (filterStatut) params.statut = filterStatut

      const response = await bonsCommandeService.list(params)
      setBons(response.items || [])
    } catch (error: any) {
      console.error('Erreur chargement bons de commande:', error)
      setError(error.response?.data?.detail || 'Impossible de charger les bons de commande')
    } finally {
      setIsLoading(false)
    }
  }

  const statuts = [
    { value: 'brouillon', label: 'Brouillon', color: 'gray' },
    { value: 'validee', label: 'Validée', color: 'blue' },
    { value: 'en_cours', label: 'En cours', color: 'yellow' },
    { value: 'livree', label: 'Livrée', color: 'green' },
  ]

  const getStatutColor = (statut: string) => {
    const statutObj = statuts.find(s => s.value === statut)
    return statutObj?.color || 'gray'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const totalCommandes = bons.length
  const commandesEnCours = bons.filter(b => b.statut === 'en_cours').length
  const montantTotal = bons.reduce((sum, b) => sum + (b.montant_total || 0), 0)

  return (
    <div className="max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📋 Bons de Commande</h1>
          <p className="text-gray-600 mt-1">Gestion des commandes aux fournisseurs</p>
        </div>
        <Link
          to="/bons-commande/nouveau"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          + Nouvelle commande
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total commandes</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalCommandes}</p>
            </div>
            <div className="text-4xl">📦</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En cours</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">{commandesEnCours}</p>
            </div>
            <div className="text-4xl">⏳</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Montant total</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {formatCurrency(montantTotal, currency)}
              </p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fournisseur
            </label>
            <input
              type="text"
              value={filterFournisseur}
              onChange={(e) => setFilterFournisseur(e.target.value)}
              placeholder="ID du fournisseur..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statut
            </label>
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="">Tous les statuts</option>
              {statuts.map(statut => (
                <option key={statut.value} value={statut.value}>{statut.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Liste */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Chargement...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {!isLoading && !error && bons.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Aucun bon de commande trouvé
          </h3>
          <p className="text-gray-600 mb-6">
            Créez votre première commande
          </p>
          <Link
            to="/bons-commande/nouveau"
            className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold"
          >
            + Créer une commande
          </Link>
        </div>
      )}

      {!isLoading && !error && bons.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Numéro
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fournisseur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date commande
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Livraison prévue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bons.map((bon) => {
                  const color = getStatutColor(bon.statut)
                  return (
                    <tr key={bon.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-medium text-gray-900">{bon.numero}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bon.fournisseur_nom || bon.fournisseur_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(bon.date_commande)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {bon.date_livraison_prevue ? formatDate(bon.date_livraison_prevue) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {bon.montant_total ? formatCurrency(bon.montant_total, currency) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-${color}-100 text-${color}-800`}>
                          {bon.statut.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          to={`/bons-commande/${bon.id}`}
                          className="text-emerald-600 hover:text-emerald-900 font-medium"
                        >
                          Voir détails
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {bons.map((bon) => {
              const color = getStatutColor(bon.statut)
              return (
                <div key={bon.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{bon.numero}</h3>
                      <p className="text-sm text-gray-600">{bon.fournisseur_nom || bon.fournisseur_id}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full bg-${color}-100 text-${color}-800`}>
                      {bon.statut.toUpperCase()}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm mb-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date commande:</span>
                      <span className="font-medium">{formatDate(bon.date_commande)}</span>
                    </div>
                    {bon.date_livraison_prevue && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Livraison prévue:</span>
                        <span className="font-medium">{formatDate(bon.date_livraison_prevue)}</span>
                      </div>
                    )}
                    {bon.montant_total && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Montant:</span>
                        <span className="font-bold text-emerald-600">{formatCurrency(bon.montant_total, currency)}</span>
                      </div>
                    )}
                  </div>
                  <Link
                    to={`/bons-commande/${bon.id}`}
                    className="block w-full text-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Voir les détails
                  </Link>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
