import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { encountersService, patientsService } from '../services/api'

interface Encounter {
  id: string
  patient_id: string
  date: string  // API returns "date" due to serialization_alias
  motif?: string
  temperature?: number
  pouls?: number
  pression_systolique?: number
  pression_diastolique?: number
  patient?: {
    nom: string
    prenom: string
  }
  conditions?: Array<{
    id: string
    libelle: string
    code_icd10?: string
  }>
}

interface Patient {
  id: string
  nom: string
  prenom: string
}

export const ConsultationsPage = () => {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const patientIdParam = searchParams.get('patient')

  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtres
  const [selectedPatient, setSelectedPatient] = useState(patientIdParam || '')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    loadData()
  }, [selectedPatient, fromDate, toDate])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Charger la liste des patients pour le filtre
      const patientsData = await patientsService.list({ limit: 100 })
      setPatients(patientsData.data || [])

      // Charger les consultations avec filtres
      const params: any = {}
      if (selectedPatient) params.patient_id = selectedPatient
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate

      const encountersData = await encountersService.list(params)
      setEncounters(encountersData || [])
    } catch (err) {
      console.error('Erreur lors du chargement:', err)
      setError(t('consultations.loadingError'))
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{t('consultations.title')}</h1>
        <Link
          to="/consultations/nouvelle"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          {t('consultations.newConsultation')}
        </Link>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('consultations.filters.patient')}
            </label>
            <select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">{t('consultations.filters.allPatients')}</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.nom} {patient.prenom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('consultations.filters.startDate')}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('consultations.filters.endDate')}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Liste des consultations */}
      <div className="bg-white rounded-lg shadow">
        {loading && (
          <div className="p-8 text-center text-gray-500">
            {t('common.loading')}
          </div>
        )}

        {error && (
          <div className="p-8 text-center text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && encounters.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            {t('consultations.noConsultations')}
          </div>
        )}

        {!loading && !error && encounters.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('consultations.table.date')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('consultations.table.patient')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('consultations.table.reason')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('consultations.table.vitalSigns')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('consultations.table.diagnoses')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('consultations.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {encounters.map((encounter) => (
                  <tr key={encounter.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(encounter.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {encounter.patient?.nom} {encounter.patient?.prenom}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {encounter.motif || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="space-y-1">
                        {encounter.temperature && (
                          <div>{t('consultations.table.temperature')}: {encounter.temperature}°C</div>
                        )}
                        {encounter.pouls && (
                          <div>{t('consultations.table.pulse')}: {encounter.pouls} {t('consultations.table.bpm')}</div>
                        )}
                        {encounter.pression_systolique && encounter.pression_diastolique && (
                          <div>{t('consultations.table.bloodPressure')}: {encounter.pression_systolique}/{encounter.pression_diastolique}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {encounter.conditions && encounter.conditions.length > 0 ? (
                        <div className="space-y-1">
                          {encounter.conditions.map((condition) => (
                            <div key={condition.id} className="text-xs">
                              {condition.code_icd10 && `${condition.code_icd10} - `}
                              {condition.libelle}
                            </div>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/consultations/${encounter.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        {t('consultations.table.viewDetails')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
