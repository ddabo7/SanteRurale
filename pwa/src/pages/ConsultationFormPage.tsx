import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { encountersService, patientsService, conditionsService, medicationsService, proceduresService, referencesService } from '../services/api'
import { offlineFirst, connectivityMonitor } from '../services/offlineFirst'
import { FileUpload } from '../components/FileUpload'
import { FileList } from '../components/FileList'

interface Patient {
  id: string
  nom: string
  prenom: string
  sexe: 'M' | 'F'
  annee_naissance?: number
}

interface Condition {
  libelle: string
  code_icd10?: string
  commentaire?: string
}

interface Medication {
  medicament: string
  posologie: string
  duree_jours?: number
  quantite?: number
  unite?: string
  commentaire?: string
}

interface Procedure {
  type: string
  description?: string
  resultat?: string
}

interface Reference {
  etablissement_destination: string
  motif: string
  statut: 'en_attente' | 'confirme' | 'complete' | 'annule'
  date_reference?: string
  commentaire?: string
}

export const ConsultationFormPage = () => {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEditMode = !!id
  const patientIdParam = searchParams.get('patient')

  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isOffline, setIsOffline] = useState(!connectivityMonitor.isOnline())
  const [uploadRefresh, setUploadRefresh] = useState(0)
  const [createdEncounterId, setCreatedEncounterId] = useState<string | null>(null)

  // Données de la consultation
  const [formData, setFormData] = useState({
    patient_id: patientIdParam || '',
    date: new Date().toISOString().split('T')[0],
    motif: '',
    temperature: '',
    pouls: '',
    pression_systolique: '',
    pression_diastolique: '',
    poids: '',
    taille: '',
    commentaire: '',
  })

  // Diagnostics, prescriptions, actes
  const [conditions, setConditions] = useState<Condition[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [procedures, setProcedures] = useState<Procedure[]>([])

  // Référence/Évacuation
  const [hasReference, setHasReference] = useState(false)
  const [reference, setReference] = useState<Reference>({
    etablissement_destination: '',
    motif: '',
    statut: 'en_attente',
    date_reference: '',
    commentaire: '',
  })

  useEffect(() => {
    loadPatients()

    // Écouter les changements de connectivité
    const unsubscribe = connectivityMonitor.addListener((online) => {
      setIsOffline(!online)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (formData.patient_id) {
      const patient = patients.find(p => p.id === formData.patient_id)
      setSelectedPatient(patient || null)
    }
  }, [formData.patient_id, patients])

  const loadPatients = async () => {
    try {
      const response = await patientsService.list({ limit: 200 })
      setPatients(response.data || [])
    } catch (error) {
      console.error('Erreur chargement patients:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Empêcher les soumissions multiples
    if (isLoading) return

    setError('')
    setSuccess('')
    setIsLoading(true)

    try {
      // ✅ CRÉATION AVEC UI OPTIMISTE
      const encounterData = {
        patient_id: formData.patient_id,
        date: formData.date,
        motif: formData.motif || undefined,
        temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        pouls: formData.pouls ? parseInt(formData.pouls) : undefined,
        pression_systolique: formData.pression_systolique ? parseInt(formData.pression_systolique) : undefined,
        pression_diastolique: formData.pression_diastolique ? parseInt(formData.pression_diastolique) : undefined,
        poids: formData.poids ? parseFloat(formData.poids) : undefined,
        taille: formData.taille ? parseInt(formData.taille) : undefined,
        notes: formData.notes || undefined,
      }

      // Si on est en ligne, créer directement via l'API pour avoir l'ID serveur immédiatement
      // Sinon utiliser offline-first
      let serverEncounterId: string | null = null
      
      if (connectivityMonitor.isOnline()) {
        // Création directe via API
        const response = await encountersService.create(encounterData)
        console.log('🔍 DEBUG Response:', response)
        // La réponse peut être response.data ou directement response
        serverEncounterId = response.data?.id || response.id
        console.log('🔍 DEBUG serverEncounterId:', serverEncounterId)
        setCreatedEncounterId(serverEncounterId)
      } else {
        // Offline-first pour mode hors ligne
        const result = await offlineFirst.createEncounter(encounterData)
        setCreatedEncounterId(result.localId)
      }

      // Ajouter les éléments liés seulement si on a un ID serveur
      if (serverEncounterId) {
        // Ajouter les diagnostics
        for (const condition of conditions) {
          if (condition.libelle.trim()) {
            try {
              await conditionsService.create({
                encounter_id: serverEncounterId,
                ...condition,
              })
            } catch (err) {
              console.error('Erreur ajout diagnostic:', err)
            }
          }
        }

        // Ajouter les prescriptions
        for (const medication of medications) {
          if (medication.medicament.trim()) {
            try {
              await medicationsService.create({
                encounter_id: serverEncounterId,
                ...medication,
              })
            } catch (err) {
              console.error('Erreur ajout prescription:', err)
            }
          }
        }

        // Ajouter les actes
        for (const procedure of procedures) {
          if (procedure.type.trim()) {
            try {
              await proceduresService.create({
                encounter_id: serverEncounterId,
                ...procedure,
              })
            } catch (err) {
              console.error('Erreur ajout acte:', err)
            }
          }
        }

        // Ajouter la référence/évacuation si nécessaire
        if (hasReference && reference.etablissement_destination.trim() && reference.motif.trim()) {
          try {
            await referencesService.create({
              encounter_id: serverEncounterId,
              etablissement_destination: reference.etablissement_destination,
              motif: reference.motif,
              statut: reference.statut,
              date_reference: reference.date_reference || undefined,
              commentaire: reference.commentaire || undefined,
            })
          } catch (err) {
            console.error('Erreur ajout référence:', err)
          }
        }
      }

      // Messages de succès adaptés
      if (connectivityMonitor.isOnline()) {
        setSuccess('✅ Consultation créée avec succès')
        setTimeout(() => navigate('/consultations'), 1000)
      } else {
        setSuccess('✅ Consultation créée localement (mode hors ligne). Sera synchronisée automatiquement.')
        setTimeout(() => navigate('/consultations'), 2000)
      }
    } catch (error: any) {
      console.error('❌ Erreur sauvegarde consultation:', error)

      if (error.message) {
        setError(error.message)
      } else if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          const errors = error.response.data.detail.map((e: any) => e.msg).join(', ')
          setError(`Erreur de validation: ${errors}`)
        } else {
          setError(error.response.data.detail)
        }
      } else {
        setError('Impossible de sauvegarder la consultation. Veuillez réessayer.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const addCondition = () => {
    setConditions([...conditions, { libelle: '', code_icd10: '', notes: '' }])
  }

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  const addMedication = () => {
    setMedications([...medications, { medicament: '', posologie: '', duree_jours: undefined, notes: '' }])
  }

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index))
  }

  const addProcedure = () => {
    setProcedures([...procedures, { type: '', description: '', resultat: '' }])
  }

  const removeProcedure = (index: number) => {
    setProcedures(procedures.filter((_, i) => i !== index))
  }

  const calculateAge = () => {
    if (selectedPatient?.annee_naissance) {
      return new Date().getFullYear() - selectedPatient.annee_naissance
    }
    return null
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? 'Modifier la consultation' : 'Nouvelle consultation'}
        </h1>
        <p className="text-gray-600 mt-1">
          Enregistrez les détails de la consultation médicale
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-8">
        {/* Bannière mode offline */}
        {isOffline && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Mode hors ligne - Les données seront synchronisées automatiquement
          </div>
        )}

        {/* Message de succès */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Message d'erreur */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Patient et Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="patient_id" className="block text-sm font-medium text-gray-700 mb-2">
                Patient <span className="text-red-500">*</span>
              </label>
              <select
                id="patient_id"
                value={formData.patient_id}
                onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="">Sélectionner un patient</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.nom} {patient.prenom} ({patient.sexe})
                  </option>
                ))}
              </select>
              {selectedPatient && (
                <p className="text-sm text-gray-500 mt-1">
                  {calculateAge() && `Âge: ${calculateAge()} ans`}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                Date de consultation <span className="text-red-500">*</span>
              </label>
              <input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Motif */}
          <div>
            <label htmlFor="motif" className="block text-sm font-medium text-gray-700 mb-2">
              Motif de consultation
            </label>
            <textarea
              id="motif"
              value={formData.motif}
              onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="Raison de la visite..."
            />
          </div>

          {/* Signes vitaux */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Signes vitaux</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-2">
                  Température (°C)
                </label>
                <input
                  id="temperature"
                  type="number"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="37.5"
                />
              </div>

              <div>
                <label htmlFor="pouls" className="block text-sm font-medium text-gray-700 mb-2">
                  Pouls (bpm)
                </label>
                <input
                  id="pouls"
                  type="number"
                  value={formData.pouls}
                  onChange={(e) => setFormData({ ...formData, pouls: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="72"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tension artérielle
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={formData.pression_systolique}
                    onChange={(e) => setFormData({ ...formData, pression_systolique: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="120"
                  />
                  <span className="text-gray-500">/</span>
                  <input
                    type="number"
                    value={formData.pression_diastolique}
                    onChange={(e) => setFormData({ ...formData, pression_diastolique: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="80"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="poids" className="block text-sm font-medium text-gray-700 mb-2">
                  Poids (kg)
                </label>
                <input
                  id="poids"
                  type="number"
                  step="0.1"
                  value={formData.poids}
                  onChange={(e) => setFormData({ ...formData, poids: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="70.5"
                />
              </div>

              <div>
                <label htmlFor="taille" className="block text-sm font-medium text-gray-700 mb-2">
                  Taille (cm)
                </label>
                <input
                  id="taille"
                  type="number"
                  value={formData.taille}
                  onChange={(e) => setFormData({ ...formData, taille: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="175"
                />
              </div>
            </div>
          </div>

          {/* Diagnostics */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Diagnostics</h3>
              <button
                type="button"
                onClick={addCondition}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg"
              >
                + Ajouter diagnostic
              </button>
            </div>
            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div key={index} className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={condition.libelle}
                      onChange={(e) => {
                        const updated = [...conditions]
                        updated[index].libelle = e.target.value
                        setConditions(updated)
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Libellé du diagnostic"
                    />
                    <input
                      type="text"
                      value={condition.code_icd10 || ''}
                      onChange={(e) => {
                        const updated = [...conditions]
                        updated[index].code_icd10 = e.target.value
                        setConditions(updated)
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Code CIM-10"
                      maxLength={10}
                    />
                    <input
                      type="text"
                      value={condition.notes || ''}
                      onChange={(e) => {
                        const updated = [...conditions]
                        updated[index].notes = e.target.value
                        setConditions(updated)
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Notes"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    className="text-red-600 hover:text-red-800 px-2 py-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Prescriptions */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Prescriptions</h3>
              <button
                type="button"
                onClick={addMedication}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg"
              >
                + Ajouter prescription
              </button>
            </div>
            <div className="space-y-3">
              {medications.map((medication, index) => (
                <div key={index} className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={medication.medicament}
                      onChange={(e) => {
                        const updated = [...medications]
                        updated[index].medicament = e.target.value
                        setMedications(updated)
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Médicament"
                    />
                    <input
                      type="text"
                      value={medication.posologie}
                      onChange={(e) => {
                        const updated = [...medications]
                        updated[index].posologie = e.target.value
                        setMedications(updated)
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Posologie (ex: 1 cp x 3/jour)"
                    />
                    <input
                      type="number"
                      value={medication.duree_jours || ''}
                      onChange={(e) => {
                        const updated = [...medications]
                        updated[index].duree_jours = e.target.value ? parseInt(e.target.value) : undefined
                        setMedications(updated)
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Durée (jours)"
                    />
                    <input
                      type="text"
                      value={medication.notes || ''}
                      onChange={(e) => {
                        const updated = [...medications]
                        updated[index].notes = e.target.value
                        setMedications(updated)
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Notes"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMedication(index)}
                    className="text-red-600 hover:text-red-800 px-2 py-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actes médicaux */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Actes médicaux</h3>
              <button
                type="button"
                onClick={addProcedure}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg"
              >
                + Ajouter acte
              </button>
            </div>
            <div className="space-y-3">
              {procedures.map((procedure, index) => (
                <div key={index} className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={procedure.type}
                      onChange={(e) => {
                        const updated = [...procedures]
                        updated[index].type = e.target.value
                        setProcedures(updated)
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Type d'acte"
                    />
                    <input
                      type="text"
                      value={procedure.description || ''}
                      onChange={(e) => {
                        const updated = [...procedures]
                        updated[index].description = e.target.value
                        setProcedures(updated)
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Description"
                    />
                    <input
                      type="text"
                      value={procedure.resultat || ''}
                      onChange={(e) => {
                        const updated = [...procedures]
                        updated[index].resultat = e.target.value
                        setProcedures(updated)
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Résultat"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProcedure(index)}
                    className="text-red-600 hover:text-red-800 px-2 py-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Référence/Évacuation */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">🚑 Référence / Évacuation</h3>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasReference}
                  onChange={(e) => setHasReference(e.target.checked)}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Patient à évacuer/référer
                </span>
              </label>
            </div>

            {hasReference && (
              <div className="space-y-4 bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Destination <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={reference.etablissement_destination}
                      onChange={(e) => setReference({ ...reference, destination: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="Ex: Hôpital de Bamako, Centre de santé de référence..."
                      required={hasReference}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Statut
                    </label>
                    <select
                      value={reference.statut}
                      onChange={(e) => setReference({ ...reference, statut: e.target.value as Reference['statut'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    >
                      <option value="en_attente">En attente</option>
                      <option value="confirme">Confirmée</option>
                      <option value="complete">Complétée</option>
                      <option value="annule">Annulée</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Raison de l'évacuation <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={reference.motif}
                    onChange={(e) => setReference({ ...reference, raison: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Ex: Complications nécessitant chirurgie, Accouchement à risque..."
                    required={hasReference}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Heure d'arrivée estimée (ETA)
                  </label>
                  <input
                    type="datetime-local"
                    value={reference.date_reference}
                    onChange={(e) => setReference({ ...reference, eta: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes complémentaires
                  </label>
                  <textarea
                    value={reference.commentaire}
                    onChange={(e) => setReference({ ...reference, commentaire: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Informations supplémentaires, contact du centre de destination..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Notes de consultation
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="Observations, recommandations..."
            />
          </div>

          {/* Buttons */}
          <div className="flex space-x-4 pt-4 border-t">
            <button
              type="submit"
              disabled={isLoading || !!createdEncounterId}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isLoading ? 'Enregistrement...' : isEditMode ? 'Modifier' : 'Enregistrer la consultation'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/consultations')}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              {createdEncounterId ? 'Terminer' : 'Annuler'}
            </button>
          </div>
        </form>

        {/* Section d'upload après création */}
        {createdEncounterId && (
          <div className="mt-8 pt-8 border-t">
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6">
              <p className="font-medium mb-1">✅ Consultation enregistrée avec succès!</p>
              <p className="text-sm">Vous pouvez maintenant ajouter des documents médicaux (radios, résultats d'analyses, etc.)</p>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mb-4">
              📎 Documents médicaux
            </h3>

            <FileUpload
              encounterId={createdEncounterId}
              onUploadSuccess={() => setUploadRefresh(prev => prev + 1)}
              accept="image/*,.pdf,.doc,.docx"
              maxSizeMB={10}
            />

            <div className="mt-4">
              <FileList
                encounterId={createdEncounterId}
                refreshTrigger={uploadRefresh}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/consultations')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Retour à la liste des consultations
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
