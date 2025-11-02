import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { encountersService } from '../services/api'

interface EncounterDetails {
  id: string
  patient_id: string
  date: string
  motif?: string
  temperature?: number
  pouls?: number
  pression_systolique?: number
  pression_diastolique?: number
  poids?: number
  taille?: number
  notes?: string
  patient?: {
    nom: string
    prenom: string
    sexe: 'M' | 'F'
    annee_naissance?: number
    telephone?: string
    village?: string
  }
  user?: {
    nom: string
    prenom: string
    role: string
  }
  conditions?: Array<{
    id: string
    libelle: string
    code_icd10?: string
    notes?: string
  }>
  medication_requests?: Array<{
    id: string
    medicament: string
    posologie: string
    duree_jours?: number
    quantite?: number
    unite?: string
    notes?: string
  }>
  procedures?: Array<{
    id: string
    type: string
    description?: string
    resultat?: string
  }>
  created_at: string
  updated_at: string
}

export const ConsultationDetailsPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [encounter, setEncounter] = useState<EncounterDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      loadEncounter(id)
    }
  }, [id])

  const loadEncounter = async (encounterId: string) => {
    try {
      setLoading(true)
      setError(null)
      const data = await encountersService.get(encounterId)
      setEncounter(data)
    } catch (err) {
      console.error('Erreur lors du chargement:', err)
      setError('Impossible de charger les détails de la consultation')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const calculateAge = () => {
    if (encounter?.patient?.annee_naissance) {
      return new Date().getFullYear() - encounter.patient.annee_naissance
    }
    return null
  }

  const calculateIMC = () => {
    if (encounter?.poids && encounter?.taille) {
      const heightInMeters = encounter.taille / 100
      return (encounter.poids / (heightInMeters * heightInMeters)).toFixed(1)
    }
    return null
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-8 text-center">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  if (error || !encounter) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || 'Consultation non trouvée'}
        </div>
        <button
          onClick={() => navigate('/consultations')}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          ← Retour aux consultations
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/consultations')}
          className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center"
        >
          ← Retour aux consultations
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Consultation du {formatDate(encounter.date)}
            </h1>
            <p className="text-gray-600 mt-1">
              Créée le {formatDateTime(encounter.created_at)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations patient */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Patient</h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Nom</div>
                <div className="font-medium">
                  <Link
                    to={`/patients/${encounter.patient_id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {encounter.patient?.nom} {encounter.patient?.prenom}
                  </Link>
                </div>
              </div>
              {encounter.patient?.sexe && (
                <div>
                  <div className="text-sm text-gray-500">Sexe</div>
                  <div>{encounter.patient.sexe === 'M' ? 'Homme' : 'Femme'}</div>
                </div>
              )}
              {calculateAge() && (
                <div>
                  <div className="text-sm text-gray-500">Âge</div>
                  <div>{calculateAge()} ans</div>
                </div>
              )}
              {encounter.patient?.telephone && (
                <div>
                  <div className="text-sm text-gray-500">Téléphone</div>
                  <div>{encounter.patient.telephone}</div>
                </div>
              )}
              {encounter.patient?.village && (
                <div>
                  <div className="text-sm text-gray-500">Village</div>
                  <div>{encounter.patient.village}</div>
                </div>
              )}
            </div>

            {encounter.user && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Soignant</h3>
                <div className="text-sm">
                  {encounter.user.prenom} {encounter.user.nom}
                  <div className="text-gray-500">{encounter.user.role}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Détails de la consultation */}
        <div className="lg:col-span-2 space-y-6">
          {/* Motif */}
          {encounter.motif && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Motif de consultation</h2>
              <p className="text-gray-700">{encounter.motif}</p>
            </div>
          )}

          {/* Signes vitaux */}
          {(encounter.temperature || encounter.pouls || encounter.pression_systolique || encounter.poids || encounter.taille) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Signes vitaux</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {encounter.temperature && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">Température</div>
                    <div className="text-xl font-semibold">{encounter.temperature}°C</div>
                  </div>
                )}
                {encounter.pouls && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">Pouls</div>
                    <div className="text-xl font-semibold">{encounter.pouls} bpm</div>
                  </div>
                )}
                {encounter.pression_systolique && encounter.pression_diastolique && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">Tension artérielle</div>
                    <div className="text-xl font-semibold">
                      {encounter.pression_systolique}/{encounter.pression_diastolique}
                    </div>
                  </div>
                )}
                {encounter.poids && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">Poids</div>
                    <div className="text-xl font-semibold">{encounter.poids} kg</div>
                  </div>
                )}
                {encounter.taille && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">Taille</div>
                    <div className="text-xl font-semibold">{encounter.taille} cm</div>
                  </div>
                )}
                {calculateIMC() && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">IMC</div>
                    <div className="text-xl font-semibold">{calculateIMC()}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Diagnostics */}
          {encounter.conditions && encounter.conditions.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Diagnostics</h2>
              <div className="space-y-3">
                {encounter.conditions.map((condition) => (
                  <div key={condition.id} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="font-medium">
                      {condition.code_icd10 && (
                        <span className="text-blue-600 mr-2">[{condition.code_icd10}]</span>
                      )}
                      {condition.libelle}
                    </div>
                    {condition.notes && (
                      <div className="text-sm text-gray-600 mt-1">{condition.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prescriptions */}
          {encounter.medication_requests && encounter.medication_requests.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Prescriptions</h2>
              <div className="space-y-3">
                {encounter.medication_requests.map((medication) => (
                  <div key={medication.id} className="border-l-4 border-green-500 pl-4 py-2">
                    <div className="font-medium">{medication.medicament}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {medication.posologie}
                      {medication.duree_jours && ` - ${medication.duree_jours} jours`}
                    </div>
                    {medication.notes && (
                      <div className="text-sm text-gray-500 mt-1">{medication.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actes médicaux */}
          {encounter.procedures && encounter.procedures.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actes médicaux</h2>
              <div className="space-y-3">
                {encounter.procedures.map((procedure) => (
                  <div key={procedure.id} className="border-l-4 border-purple-500 pl-4 py-2">
                    <div className="font-medium">{procedure.type}</div>
                    {procedure.description && (
                      <div className="text-sm text-gray-600 mt-1">{procedure.description}</div>
                    )}
                    {procedure.resultat && (
                      <div className="text-sm text-gray-700 mt-1">
                        <span className="font-medium">Résultat:</span> {procedure.resultat}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {encounter.notes && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Notes</h2>
              <p className="text-gray-700 whitespace-pre-line">{encounter.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
