import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { patientsService } from '../services/api'
import { offlineFirst, connectivityMonitor } from '../services/offlineFirst'
import { FileUpload } from '../components/FileUpload'
import { FileList } from '../components/FileList'

export const PatientFormPage = () => {
  const { t } = useTranslation()
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
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isOffline, setIsOffline] = useState(!connectivityMonitor.isOnline())
  const [uploadRefresh, setUploadRefresh] = useState(0)

  useEffect(() => {
    if (isEditMode && id) {
      loadPatient(id)
    }

    // Écouter les changements de connectivité
    const unsubscribe = connectivityMonitor.addListener((online) => {
      setIsOffline(!online)
    })

    return () => unsubscribe()
  }, [id, isEditMode])

  const loadPatient = async (patientId: string) => {
    try {
      const patient = await patientsService.get(patientId)
      if (patient) {
        setFormData({
          nom: patient.nom,
          prenom: patient.prenom || '',
          sexe: patient.sexe,
          annee_naissance: patient.annee_naissance ?? currentYear - 30,
          telephone: patient.telephone || '',
          village: patient.village || '',
        })
      }
    } catch (error: any) {
      console.error('Erreur chargement patient:', error)
      setError(error.response?.data?.detail || t('patients.form.loadError'))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)

    try {
      const patientData = {
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim() || undefined,
        sexe: formData.sexe,
        annee_naissance: formData.annee_naissance || undefined,
        telephone: formData.telephone.trim() || undefined,
        village: formData.village.trim() || undefined,
      }

      if (isEditMode && id) {
        // ✅ MISE À JOUR AVEC UI OPTIMISTE
        const result = await offlineFirst.updatePatient(id, patientData)

        if (result.isOffline || result.willSyncLater) {
          setSuccess(t('patients.form.successUpdated'))
          // Rediriger après un court délai pour que l'utilisateur voie le message
          setTimeout(() => navigate('/patients'), 1500)
        } else {
          setSuccess(t('patients.form.successUpdatedOnline'))
          setTimeout(() => navigate('/patients'), 1000)
        }
      } else {
        // ✅ CRÉATION AVEC UI OPTIMISTE
        const result = await offlineFirst.createPatient(patientData)

        if (result.isOffline) {
          setSuccess(t('patients.form.successCreated'))
          setTimeout(() => navigate('/patients'), 2000)
        } else if (result.willSyncLater) {
          setSuccess(t('patients.form.successCreatedSyncing'))
          setTimeout(() => navigate('/patients'), 1500)
        } else {
          setSuccess(t('patients.form.successCreatedOnline'))
          setTimeout(() => navigate('/patients'), 1000)
        }
      }
    } catch (error: any) {
      console.error('❌ Erreur sauvegarde patient:', error)

      // 🔒 QUOTA ATTEINT: Rediriger vers la page d'abonnement
      if (error.response?.status === 402) {
        const quotaMessage = error.response.data.detail || t('patients.form.quotaReached')
        if (window.confirm(`${quotaMessage}\n\n${t('patients.form.quotaMessage')}`)) {
          navigate('/subscription')
          return
        }
        setError(quotaMessage)
        return
      }
      // Messages d'erreur adaptés
      else if (error.message) {
        setError(error.message)
      } else if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          const errors = error.response.data.detail.map((e: any) => e.msg).join(', ')
          setError(t('patients.form.validationError', { errors }))
        } else {
          setError(error.response.data.detail)
        }
      } else {
        setError(t('patients.form.saveError'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? t('patients.form.titleEdit') : t('patients.form.titleNew')}
        </h1>
        <p className="text-gray-600 mt-1">
          {t('patients.form.subtitle')}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-8">
        {/* Bannière mode offline */}
        {isOffline && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {t('patients.form.offlineMode')}
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nom */}
          <div>
            <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-2">
              {t('patients.form.lastName')} <span className="text-red-500">*</span>
            </label>
            <input
              id="nom"
              type="text"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder={t('patients.form.lastNamePlaceholder')}
            />
          </div>

          {/* Prénom */}
          <div>
            <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-2">
              {t('patients.form.firstName')}
            </label>
            <input
              id="prenom"
              type="text"
              value={formData.prenom}
              onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder={t('patients.form.firstNamePlaceholder')}
            />
          </div>

          {/* Sexe et Année de naissance */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('patients.form.gender')} <span className="text-red-500">*</span>
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
                  <span>{t('patients.form.male')}</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="F"
                    checked={formData.sexe === 'F'}
                    onChange={(e) => setFormData({ ...formData, sexe: e.target.value as 'M' | 'F' })}
                    className="mr-2"
                  />
                  <span>{t('patients.form.female')}</span>
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="annee_naissance" className="block text-sm font-medium text-gray-700 mb-2">
                {t('patients.form.birthYear')} <span className="text-red-500">*</span>
              </label>
              <input
                id="annee_naissance"
                type="number"
                value={formData.annee_naissance || ''}
                onChange={(e) => setFormData({ ...formData, annee_naissance: e.target.value ? parseInt(e.target.value) : 0 })}
                required
                min={1900}
                max={currentYear}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
              <p className="text-sm text-gray-500 mt-1">
                {t('patients.form.ageLabel', { age: currentYear - formData.annee_naissance })}
              </p>
            </div>
          </div>

          {/* Téléphone */}
          <div>
            <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-2">
              {t('patients.form.phone')}
            </label>
            <input
              id="telephone"
              type="tel"
              value={formData.telephone}
              onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder={t('patients.form.phonePlaceholder')}
            />
          </div>

          {/* Village */}
          <div>
            <label htmlFor="village" className="block text-sm font-medium text-gray-700 mb-2">
              {t('patients.form.village')}
            </label>
            <input
              id="village"
              type="text"
              value={formData.village}
              onChange={(e) => setFormData({ ...formData, village: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder={t('patients.form.villagePlaceholder')}
            />
          </div>

          {/* Photo et documents du patient */}
          {isEditMode && id && (
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {t('patients.form.documentsTitle')}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('patients.form.documentsSubtitle')}
              </p>

              <FileUpload
                patientId={id}
                onUploadSuccess={() => setUploadRefresh(prev => prev + 1)}
                accept="image/*,.pdf,.doc,.docx"
                maxSizeMB={10}
              />

              <div className="mt-4">
                <FileList
                  patientId={id}
                  refreshTrigger={uploadRefresh}
                />
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isLoading ? t('patients.form.saving') : isEditMode ? t('patients.form.saveButton') : t('patients.form.createButton')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/patients')}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('patients.form.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
