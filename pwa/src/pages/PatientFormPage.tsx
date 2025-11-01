import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db'
import type { Patient } from '../db'

export const PatientFormPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = !!id
  const currentYear = new Date().getFullYear()

  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    sexe: 'M' as 'M' | 'F',
    annee_naissance: currentYear - 30,
    telephone: '',
    village: '',
    matricule: '',
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isEditMode && id) {
      loadPatient(id)
    }
  }, [id, isEditMode])

  const loadPatient = async (patientId: string) => {
    try {
      const patient = await db.patients.get(patientId)
      if (patient) {
        setFormData({
          nom: patient.nom,
          prenom: patient.prenom || '',
          sexe: patient.sexe,
          annee_naissance: patient.annee_naissance ?? currentYear - 30,
          telephone: patient.telephone || '',
          village: patient.village || '',
          matricule: patient.matricule || '',
        })
      }
    } catch (error) {
      console.error('Erreur chargement patient:', error)
      setError('Impossible de charger le patient')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const now = new Date().toISOString()
      const normalizedData = {
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim() || undefined,
        sexe: formData.sexe,
        annee_naissance: formData.annee_naissance,
        telephone: formData.telephone.trim() || undefined,
        village: formData.village.trim() || undefined,
        matricule: formData.matricule.trim() || undefined,
      }

      if (isEditMode && id) {
        await db.patients.update(id, {
          ...normalizedData,
          updated_at: now,
          _synced: false,
        })

        // Ajouter à la queue de sync
        await db.addToOutbox(
          'update',
          'patient',
          { id, ...normalizedData },
          id
        )
      } else {
        const generatedId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `patient-${Date.now()}-${Math.random().toString(16).slice(2)}`

        const newPatient: Patient = {
          id: generatedId,
          ...normalizedData,
          site_id: 'site-1', // TODO: Utiliser le site de l'utilisateur connecté
          created_at: now,
          updated_at: now,
          version: 1,
          _synced: false,
        }

        await db.patients.add(newPatient)

        // Ajouter à la queue de sync
        await db.addToOutbox('create', 'patient', newPatient, generatedId)
      }

      navigate('/patients')
    } catch (error) {
      console.error('Erreur sauvegarde patient:', error)
      setError('Erreur lors de la sauvegarde')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? 'Modifier le patient' : 'Nouveau patient'}
        </h1>
        <p className="text-gray-600 mt-1">
          Remplissez les informations du patient
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nom */}
          <div>
            <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-2">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              id="nom"
              type="text"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="TRAORÉ"
            />
          </div>

          {/* Prénom */}
          <div>
            <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-2">
              Prénom
            </label>
            <input
              id="prenom"
              type="text"
              value={formData.prenom}
              onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="Amadou"
            />
          </div>

          {/* Sexe et Année de naissance */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sexe <span className="text-red-500">*</span>
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="M"
                    checked={formData.sexe === 'M'}
                    onChange={(e) => setFormData({ ...formData, sexe: e.target.value as 'M' | 'F' })}
                    className="mr-2"
                  />
                  <span>Homme</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="F"
                    checked={formData.sexe === 'F'}
                    onChange={(e) => setFormData({ ...formData, sexe: e.target.value as 'M' | 'F' })}
                    className="mr-2"
                  />
                  <span>Femme</span>
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="annee_naissance" className="block text-sm font-medium text-gray-700 mb-2">
                Année de naissance <span className="text-red-500">*</span>
              </label>
              <input
                id="annee_naissance"
                type="number"
                value={formData.annee_naissance}
                onChange={(e) => setFormData({ ...formData, annee_naissance: parseInt(e.target.value) })}
                required
                min={1900}
                max={currentYear}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
              <p className="text-sm text-gray-500 mt-1">
                Âge: {currentYear - formData.annee_naissance} ans
              </p>
            </div>
          </div>

          {/* Téléphone */}
          <div>
            <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-2">
              Téléphone
            </label>
            <input
              id="telephone"
              type="tel"
              value={formData.telephone}
              onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="+223 XX XX XX XX"
            />
          </div>

          {/* Village */}
          <div>
            <label htmlFor="village" className="block text-sm font-medium text-gray-700 mb-2">
              Village
            </label>
            <input
              id="village"
              type="text"
              value={formData.village}
              onChange={(e) => setFormData({ ...formData, village: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="Nom du village"
            />
          </div>

          {/* Matricule */}
          <div>
            <label htmlFor="matricule" className="block text-sm font-medium text-gray-700 mb-2">
              Matricule
            </label>
            <input
              id="matricule"
              type="text"
              value={formData.matricule}
              onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="Numéro d'identification"
            />
          </div>

          {/* Buttons */}
          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isLoading ? 'Enregistrement...' : isEditMode ? 'Modifier' : 'Créer le patient'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/patients')}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
