import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { patientsService } from '../services/api'
import type { Patient } from '../db'

export const PatientsPage = () => {
  const [patients, setPatients] = useState<Patient[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPatients()
  }, [])

  const loadPatients = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Charger depuis l'API
      const response = await patientsService.list({ limit: 200 })
      setPatients(response.data || [])
    } catch (error: any) {
      console.error('Erreur chargement patients:', error)
      setError(error.response?.data?.detail || 'Impossible de charger les patients')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredPatients = patients.filter(patient => {
    const search = searchTerm.toLowerCase()
    return (
      patient.nom.toLowerCase().includes(search) ||
      patient.prenom?.toLowerCase().includes(search) ||
      patient.telephone?.includes(search) ||
      patient.village?.toLowerCase().includes(search)
    )
  })

  const getAge = (anneeNaissance?: number) => {
    if (typeof anneeNaissance !== 'number') {
      return null
    }
    return new Date().getFullYear() - anneeNaissance
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des patients...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <p className="text-red-600 font-semibold mb-2">{error}</p>
          <button
            onClick={loadPatients}
            className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-600 mt-1">{patients.length} patients enregistrés</p>
        </div>
        <Link
          to="/patients/nouveau"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center"
        >
          <span className="mr-2">+</span>
          Nouveau patient
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone ou village..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
          <span className="absolute left-4 top-3.5 text-gray-400 text-xl">🔍</span>
        </div>
      </div>

      {/* Patients list */}
      {filteredPatients.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ? 'Aucun patient trouvé' : 'Aucun patient enregistré'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm
              ? 'Essayez une autre recherche'
              : 'Commencez par ajouter votre premier patient'
            }
          </p>
          {!searchTerm && (
            <Link
              to="/patients/nouveau"
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              + Ajouter un patient
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Âge / Sexe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Téléphone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Village
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPatients.map((patient) => {
                const age = getAge(patient.annee_naissance)
                return (
                  <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
                          <span className="text-emerald-600 font-semibold">
                            {patient.nom.charAt(0)}{patient.prenom?.charAt(0) || ''}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {patient.nom} {patient.prenom || ''}
                          </div>
                          {patient.matricule && (
                            <div className="text-sm text-gray-500">
                              {patient.matricule}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {age !== null ? `${age} ans` : 'Âge inconnu'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {patient.sexe === 'M' ? '♂️ Homme' : '♀️ Femme'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {patient.telephone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {patient.village || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        to={`/patients/${patient.id}`}
                        className="text-emerald-600 hover:text-emerald-900 mr-4"
                      >
                        Voir
                      </Link>
                      <Link
                        to={`/consultations?patient=${patient.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Consulter
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
