import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { patientsService } from '../services/api'
import type { Patient } from '../db'

export const PatientsPage = () => {
  const { t } = useTranslation()
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
          <p className="text-gray-600">{t('common.loading')}</p>
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
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('patients.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">{t('patients.registered', { count: patients.length })}</p>
        </div>
        <Link
          to="/patients/nouveau"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 sm:px-6 rounded-lg transition-colors flex items-center justify-center text-sm sm:text-base"
        >
          <span className="mr-2">+</span>
          {t('patients.newPatient')}
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder={t('patients.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
          <span className="absolute left-4 top-3.5 text-gray-400 text-xl">🔍</span>
        </div>
      </div>

      {/* Patients list */}
      {filteredPatients.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 sm:p-12 text-center">
          <div className="text-5xl sm:text-6xl mb-4">👥</div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ? t('common.noData') : t('patients.registered', { count: 0 })}
          </h3>
          <p className="text-sm sm:text-base text-gray-600 mb-6">
            {searchTerm
              ? t('patients.searchPlaceholder')
              : t('patients.newPatient')
            }
          </p>
          {!searchTerm && (
            <Link
              to="/patients/nouveau"
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-sm sm:text-base"
            >
              + {t('patients.newPatient')}
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table view */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('patients.table.patient')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('patients.table.ageGender')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('patients.table.phone')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('patients.table.village')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('patients.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPatients.map((patient) => {
                  const age = getAge(patient.annee_naissance)
                  const genderText = patient.sexe === 'M' ? t('patients.gender.male') : t('patients.gender.female')
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
                          {age !== null ? t('patients.age', { count: age }) : t('common.noData')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {patient.sexe === 'M' ? '♂️' : '♀️'} {genderText}
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
                          {t('patients.table.view')}
                        </Link>
                        <Link
                          to={`/consultations?patient=${patient.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {t('patients.table.consult')}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-4">
            {filteredPatients.map((patient) => {
              const age = getAge(patient.annee_naissance)
              const genderText = patient.sexe === 'M' ? t('patients.gender.male') : t('patients.gender.female')
              return (
                <div key={patient.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center">
                      <span className="text-emerald-600 font-semibold text-lg">
                        {patient.nom.charAt(0)}{patient.prenom?.charAt(0) || ''}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {patient.nom} {patient.prenom || ''}
                      </h3>
                      {patient.matricule && (
                        <p className="text-sm text-gray-500">{patient.matricule}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <span className="text-gray-500">{t('patients.table.ageGender').split(' / ')[0]}:</span>
                      <span className="ml-1 text-gray-900 font-medium">
                        {age !== null ? t('patients.age', { count: age }) : t('common.noData')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('patients.table.ageGender').split(' / ')[1]}:</span>
                      <span className="ml-1 text-gray-900 font-medium">
                        {patient.sexe === 'M' ? '♂️' : '♀️'} {genderText}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">{t('patients.table.phone')}:</span>
                      <span className="ml-1 text-gray-900 font-medium">
                        {patient.telephone || '-'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">{t('patients.table.village')}:</span>
                      <span className="ml-1 text-gray-900 font-medium">
                        {patient.village || '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <Link
                      to={`/patients/${patient.id}`}
                      className="flex-1 text-center bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      {t('patients.table.view')}
                    </Link>
                    <Link
                      to={`/consultations?patient=${patient.id}`}
                      className="flex-1 text-center bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      {t('patients.table.consult')}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
