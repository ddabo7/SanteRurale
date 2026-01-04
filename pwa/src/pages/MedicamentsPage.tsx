import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { medicamentsService } from '../services/api'

interface Medicament {
  id: string
  code: string
  nom: string
  dci?: string
  forme: string
  dosage?: string
  unite?: string
  prix_unitaire?: number
  seuil_alerte_defaut?: number
  is_active: boolean
  created_at: string
}

export const MedicamentsPage = () => {
  const [medicaments, setMedicaments] = useState<Medicament[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterForme, setFilterForme] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMedicaments()
  }, [searchTerm, filterForme])

  const loadMedicaments = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params: any = { limit: 200 }
      if (searchTerm) params.search = searchTerm
      if (filterForme) params.forme = filterForme

      const response = await medicamentsService.list(params)
      setMedicaments(response.items || [])
    } catch (error: any) {
      console.error('Erreur chargement médicaments:', error)
      setError(error.response?.data?.detail || 'Impossible de charger les médicaments')
    } finally {
      setIsLoading(false)
    }
  }

  const formes = ['COMPRIME', 'SIROP', 'INJECTABLE', 'POMMADE', 'SACHET', 'SUPPOSITOIRE', 'AUTRE']

  return (
    <div className="max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">💊 Catalogue de Médicaments</h1>
          <p className="text-gray-600 mt-1">Gestion du catalogue des produits pharmaceutiques</p>
        </div>
        <Link
          to="/medicaments/nouveau"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          + Nouveau médicament
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
              placeholder="Nom, code ou DCI..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Forme pharmaceutique
            </label>
            <select
              value={filterForme}
              onChange={(e) => setFilterForme(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="">Toutes les formes</option>
              {formes.map(forme => (
                <option key={forme} value={forme}>{forme}</option>
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

      {!isLoading && !error && medicaments.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">💊</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Aucun médicament trouvé
          </h3>
          <p className="text-gray-600 mb-6">
            Commencez par ajouter des médicaments au catalogue
          </p>
          <Link
            to="/medicaments/nouveau"
            className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold"
          >
            + Ajouter un médicament
          </Link>
        </div>
      )}

      {!isLoading && !error && medicaments.length > 0 && (
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
                    Nom / DCI
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Forme
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Dosage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Prix
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Seuil alerte
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {medicaments.map((med) => (
                  <tr key={med.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm text-gray-900">{med.code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{med.nom}</div>
                      {med.dci && (
                        <div className="text-sm text-gray-500">{med.dci}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {med.forme}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {med.dosage && med.unite ? `${med.dosage} ${med.unite}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {med.prix_unitaire ? `${med.prix_unitaire} FCFA` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {med.seuil_alerte_defaut || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        to={`/medicaments/${med.id}`}
                        className="text-emerald-600 hover:text-emerald-900 font-medium"
                      >
                        Modifier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {medicaments.map((med) => (
              <div key={med.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{med.nom}</h3>
                    {med.dci && <p className="text-sm text-gray-600">{med.dci}</p>}
                    <p className="text-xs font-mono text-gray-500 mt-1">{med.code}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {med.forme}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div>
                    <span className="text-gray-600">Dosage:</span>
                    <p className="font-medium">
                      {med.dosage && med.unite ? `${med.dosage} ${med.unite}` : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Prix:</span>
                    <p className="font-medium">
                      {med.prix_unitaire ? `${med.prix_unitaire} FCFA` : '-'}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/medicaments/${med.id}`}
                  className="block w-full text-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Modifier
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
