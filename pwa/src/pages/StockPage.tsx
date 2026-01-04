import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { stockService } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface StockSite {
  id: string
  medicament_id: string
  site_id: string
  quantite_disponible: number
  seuil_alerte: number | null
  medicament_nom: string
  medicament_code: string
  medicament_dci?: string
  site_nom: string
  en_alerte: boolean
}

export const StockPage = () => {
  const { user } = useAuth()
  const [stocks, setStocks] = useState<StockSite[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAlerte, setFilterAlerte] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.site_id) {
      loadStocks()
    }
  }, [user?.site_id, searchTerm, filterAlerte])

  const loadStocks = async () => {
    if (!user?.site_id) return

    try {
      setIsLoading(true)
      setError(null)

      const params: any = { limit: 200 }
      if (searchTerm) params.search = searchTerm
      if (filterAlerte !== null) params.en_alerte = filterAlerte

      const response = await stockService.listBySite(user.site_id, params)
      setStocks(response.items || [])
    } catch (error: any) {
      console.error('Erreur chargement stocks:', error)
      setError(error.response?.data?.detail || 'Impossible de charger les stocks')
    } finally {
      setIsLoading(false)
    }
  }

  const totalStocks = stocks.length
  const stocksEnAlerte = stocks.filter(s => s.en_alerte).length

  return (
    <div className="max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">📦 Gestion des Stocks</h1>
        <p className="text-gray-600 mt-1">Suivi des stocks de médicaments par site</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total médicaments</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalStocks}</p>
            </div>
            <div className="text-4xl">📊</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En alerte</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stocksEnAlerte}</p>
            </div>
            <div className="text-4xl">⚠️</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Actions rapides</p>
              <Link
                to="/stock/mouvement/nouveau"
                className="inline-block mt-2 text-emerald-600 hover:text-emerald-800 font-medium text-sm"
              >
                + Mouvement de stock
              </Link>
            </div>
            <div className="text-4xl">⚡</div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nom ou code du médicament..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrer par statut
            </label>
            <select
              value={filterAlerte === null ? '' : filterAlerte.toString()}
              onChange={(e) => setFilterAlerte(e.target.value === '' ? null : e.target.value === 'true')}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="">Tous les stocks</option>
              <option value="true">En alerte uniquement</option>
              <option value="false">Stock normal</option>
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

      {!isLoading && !error && stocks.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Aucun stock trouvé
          </h3>
          <p className="text-gray-600">
            {searchTerm ? 'Essayez avec d\'autres critères de recherche' : 'Les stocks sont vides'}
          </p>
        </div>
      )}

      {!isLoading && !error && stocks.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Médicament
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Quantité
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Seuil alerte
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
                {stocks.map((stock) => (
                  <tr key={stock.id} className={stock.en_alerte ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm text-gray-900">{stock.medicament_code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{stock.medicament_nom}</div>
                      {stock.medicament_dci && (
                        <div className="text-sm text-gray-500">{stock.medicament_dci}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-lg font-bold ${stock.en_alerte ? 'text-red-600' : 'text-emerald-600'}`}>
                        {stock.quantite_disponible}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stock.seuil_alerte || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {stock.en_alerte ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          ⚠️ Alerte
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          ✓ OK
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        to={`/stock/mouvements?medicament_id=${stock.medicament_id}`}
                        className="text-emerald-600 hover:text-emerald-900 font-medium"
                      >
                        Historique
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {stocks.map((stock) => (
              <div key={stock.id} className={`rounded-lg shadow p-4 ${stock.en_alerte ? 'bg-red-50 border-2 border-red-200' : 'bg-white'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{stock.medicament_nom}</h3>
                    {stock.medicament_dci && <p className="text-sm text-gray-600">{stock.medicament_dci}</p>}
                    <p className="text-xs font-mono text-gray-500 mt-1">{stock.medicament_code}</p>
                  </div>
                  {stock.en_alerte ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      ⚠️ Alerte
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      ✓ OK
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <span className="text-sm text-gray-600">Quantité:</span>
                    <p className={`text-2xl font-bold ${stock.en_alerte ? 'text-red-600' : 'text-emerald-600'}`}>
                      {stock.quantite_disponible}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Seuil alerte:</span>
                    <p className="text-xl font-semibold text-gray-900">
                      {stock.seuil_alerte || '-'}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/stock/mouvements?medicament_id=${stock.medicament_id}`}
                  className="block w-full text-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Voir l'historique
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
