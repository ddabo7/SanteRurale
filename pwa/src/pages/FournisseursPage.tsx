import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fournisseursService } from '../services/api'

interface Fournisseur {
  id: string
  code: string
  nom: string
  type_fournisseur: string
  contact?: string
  telephone?: string
  email?: string
  adresse?: string
  ville?: string
  pays?: string
  is_active: boolean
  created_at: string
}

export const FournisseursPage = () => {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadFournisseurs()
  }, [searchTerm, filterType])

  const loadFournisseurs = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params: any = { limit: 200 }
      if (searchTerm) params.search = searchTerm
      if (filterType) params.type = filterType

      const response = await fournisseursService.list(params)
      setFournisseurs(response.items || [])
    } catch (error: any) {
      console.error('Erreur chargement fournisseurs:', error)
      setError(error.response?.data?.detail || 'Impossible de charger les fournisseurs')
    } finally {
      setIsLoading(false)
    }
  }

  const types = ['GROSSISTE', 'LABORATOIRE', 'DISTRIBUTEUR', 'AUTRE']

  return (
    <div className="max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🏢 Fournisseurs</h1>
          <p className="text-gray-600 mt-1">Gestion des fournisseurs de produits pharmaceutiques</p>
        </div>
        <Link
          to="/fournisseurs/nouveau"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          + Nouveau fournisseur
        </Link>
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
              placeholder="Nom, code ou contact..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de fournisseur
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="">Tous les types</option>
              {types.map(type => (
                <option key={type} value={type}>{type}</option>
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

      {!isLoading && !error && fournisseurs.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🏢</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Aucun fournisseur trouvé
          </h3>
          <p className="text-gray-600 mb-6">
            Commencez par ajouter des fournisseurs
          </p>
          <Link
            to="/fournisseurs/nouveau"
            className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold"
          >
            + Ajouter un fournisseur
          </Link>
        </div>
      )}

      {!isLoading && !error && fournisseurs.length > 0 && (
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
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Localisation
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
                {fournisseurs.map((fourn) => (
                  <tr key={fourn.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm text-gray-900">{fourn.code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{fourn.nom}</div>
                      {fourn.contact && (
                        <div className="text-sm text-gray-500">{fourn.contact}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {fourn.type_fournisseur}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {fourn.telephone && <div>{fourn.telephone}</div>}
                      {fourn.email && <div className="text-blue-600">{fourn.email}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {fourn.ville && fourn.pays ? `${fourn.ville}, ${fourn.pays}` : fourn.ville || fourn.pays || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {fourn.is_active ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Actif
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                      <Link
                        to={`/fournisseurs/${fourn.id}`}
                        className="text-emerald-600 hover:text-emerald-900 font-medium"
                      >
                        Modifier
                      </Link>
                      <Link
                        to={`/bons-commande?fournisseur_id=${fourn.id}`}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        Commandes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {fournisseurs.map((fourn) => (
              <div key={fourn.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{fourn.nom}</h3>
                    {fourn.contact && <p className="text-sm text-gray-600">{fourn.contact}</p>}
                    <p className="text-xs font-mono text-gray-500 mt-1">{fourn.code}</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {fourn.type_fournisseur}
                    </span>
                    {fourn.is_active ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Actif
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        Inactif
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm space-y-1 mb-3">
                  {fourn.telephone && <p>📞 {fourn.telephone}</p>}
                  {fourn.email && <p className="text-blue-600">✉️ {fourn.email}</p>}
                  {(fourn.ville || fourn.pays) && (
                    <p>📍 {fourn.ville && fourn.pays ? `${fourn.ville}, ${fourn.pays}` : fourn.ville || fourn.pays}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to={`/fournisseurs/${fourn.id}`}
                    className="text-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Modifier
                  </Link>
                  <Link
                    to={`/bons-commande?fournisseur_id=${fourn.id}`}
                    className="text-center bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Commandes
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
