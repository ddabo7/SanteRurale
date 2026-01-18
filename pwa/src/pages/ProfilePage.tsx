import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authService } from '../services/authService'
import { User, Mail, Phone, Shield, Lock, Key, Edit2, Check, X, Camera, Upload, Download, Trash2, AlertTriangle } from 'lucide-react'

export const ProfilePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, updateUser, logout } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // RGPD states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [exportingData, setExportingData] = useState(false)

  // Fonction pour formater le rôle selon le sexe
  const formatRole = (role: string, sexe?: string): string => {
    if (sexe === 'F') {
      switch (role) {
        case 'infirmier': return t('profile.roles.infirmiere')
        case 'major': return t('profile.roles.majorFemale')
        case 'soignant': return t('profile.roles.soignante')
        case 'pharmacien': return t('profile.roles.pharmacienne')
        case 'medecin': return t('profile.roles.medecin')
        default: return role
      }
    }
    // Pour les hommes ou sexe non défini
    switch (role) {
      case 'infirmier': return t('profile.roles.infirmier')
      case 'major': return t('profile.roles.major')
      case 'soignant': return t('profile.roles.soignant')
      case 'pharmacien': return t('profile.roles.pharmacien')
      case 'medecin': return t('profile.roles.medecin')
      default: return role
    }
  }

  // Formulaire de profil
  const [formData, setFormData] = useState({
    nom: user?.nom || '',
    prenom: user?.prenom || '',
    telephone: user?.telephone || '',
    email: user?.email || '',
  })

  // Formulaire de changement de mot de passe
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    if (user) {
      setFormData({
        nom: user.nom || '',
        prenom: user.prenom || '',
        telephone: user.telephone || '',
        email: user.email || '',
      })
    }
  }, [user])

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await authService.updateProfile(formData)
      setSuccess(t('profile.personalInfo.updateSuccess'))
      setIsEditing(false)

      // Mettre à jour le contexte utilisateur
      if (updateUser && response.user) {
        updateUser({
          ...user,
          nom: response.user.nom,
          prenom: response.user.prenom,
          telephone: response.user.telephone,
          email: response.user.email,
        })
      }
    } catch (err: any) {
      setError(err.message || t('profile.personalInfo.updateError'))
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Vérifier que c'est une image
    if (!file.type.startsWith('image/')) {
      setError(t('profile.avatar.selectImage'))
      return
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError(t('profile.avatar.sizeError'))
      return
    }

    setUploadingAvatar(true)
    setError(null)
    setSuccess(null)

    try {
      // Convertir l'image en base64 data URL
      const reader = new FileReader()
      reader.onloadend = async () => {
        const dataUrl = reader.result as string

        // Mettre à jour le profil avec la nouvelle photo
        const response = await authService.updateProfile({ avatar_url: dataUrl })

        setSuccess(t('profile.avatar.uploadSuccess'))

        // Mettre à jour le contexte utilisateur avec la réponse du serveur
        if (updateUser && response.user) {
          updateUser({
            avatar_url: response.user.avatar_url,
          })
        }
      }
      reader.readAsDataURL(file)
    } catch (err: any) {
      setError(err.message || t('profile.avatar.uploadError'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    // Validation
    if (passwordData.newPassword.length < 8) {
      setError(t('profile.security.minLengthError'))
      setLoading(false)
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError(t('profile.security.mismatchError'))
      setLoading(false)
      return
    }

    try {
      await authService.changePassword({
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword,
      })

      setSuccess(t('profile.security.changeSuccess'))
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (err: any) {
      setError(err.message || t('profile.security.changeError'))
    } finally {
      setLoading(false)
    }
  }

  // RGPD: Export user data
  const handleExportData = async () => {
    setExportingData(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/gdpr/export-data', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Erreur lors de l\'export des donnees')
      }

      // Telecharger le fichier JSON
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sante_rurale_export_${user?.email}_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setSuccess(t('profile.gdpr.exportSuccess', 'Vos donnees ont ete exportees avec succes'))
    } catch (err: any) {
      setError(err.message || t('profile.gdpr.exportError', 'Erreur lors de l\'export'))
    } finally {
      setExportingData(false)
    }
  }

  // RGPD: Delete account
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'SUPPRIMER MON COMPTE') {
      setError(t('profile.gdpr.confirmationError', 'Veuillez saisir exactement: SUPPRIMER MON COMPTE'))
      return
    }

    setDeletingAccount(true)
    setError(null)

    try {
      const response = await fetch('/api/v1/gdpr/delete-account', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: deletePassword,
          confirmation: deleteConfirmation,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Erreur lors de la suppression')
      }

      // Deconnecter et rediriger
      logout()
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || t('profile.gdpr.deleteError', 'Erreur lors de la suppression'))
    } finally {
      setDeletingAccount(false)
    }
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('profile.loadingError')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* En-tête avec gradient */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-lg p-8 mb-6 text-white">
        <div className="flex items-center space-x-4">
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full">
            <User className="w-12 h-12" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t('profile.title')}</h1>
            <p className="text-blue-100 mt-1">{t('profile.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Messages de succès/erreur */}
      {success && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-500 text-green-800 px-4 py-3 rounded-lg flex items-center space-x-2">
          <Check className="w-5 h-5 text-green-600" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-800 px-4 py-3 rounded-lg flex items-center space-x-2">
          <X className="w-5 h-5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Section Photo de profil */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6 border border-gray-100">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-purple-100">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{t('profile.avatar.title')}</h2>
              <p className="text-sm text-gray-600 mt-0.5">{t('profile.avatar.subtitle')}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center space-x-6">
            {/* Avatar actuel */}
            <div className="relative">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={`${user.prenom} ${user.nom}`}
                  className="w-24 h-24 rounded-full object-cover border-4 border-purple-200"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-purple-200">
                  {user.prenom?.[0]}{user.nom?.[0]}
                </div>
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              )}
            </div>

            {/* Bouton pour changer la photo */}
            <div className="flex-1">
              <label
                htmlFor="avatar-upload"
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-2.5 rounded-lg font-medium cursor-pointer transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>{uploadingAvatar ? t('profile.avatar.uploading') : t('profile.avatar.changePhoto')}</span>
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
                className="hidden"
              />
              <p className="text-xs text-gray-500 mt-2">
                {t('profile.avatar.acceptedFormats')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section Informations personnelles */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6 border border-gray-100">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">{t('profile.personalInfo.title')}</h2>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              <span>{t('profile.personalInfo.editButton')}</span>
            </button>
          )}
        </div>

        <div className="p-6">
          {!isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <label className="text-sm font-medium text-gray-500">{t('profile.personalInfo.lastName')}</label>
                </div>
                <p className="text-gray-900 font-medium">{user.nom}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <User className="w-4 h-4 text-green-600" />
                  <label className="text-sm font-medium text-gray-500">{t('profile.personalInfo.firstName')}</label>
                </div>
                <p className="text-gray-900 font-medium">{user.prenom || '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Mail className="w-4 h-4 text-purple-600" />
                  <label className="text-sm font-medium text-gray-500">{t('profile.personalInfo.email')}</label>
                </div>
                <p className="text-gray-900 font-medium">{user.email}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Phone className="w-4 h-4 text-orange-600" />
                  <label className="text-sm font-medium text-gray-500">{t('profile.personalInfo.phone')}</label>
                </div>
                <p className="text-gray-900 font-medium">{user.telephone || '-'}</p>
              </div>
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200 md:col-span-2">
                <div className="flex items-center space-x-2 mb-2">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <label className="text-sm font-medium text-gray-500">{t('profile.personalInfo.role')}</label>
                </div>
                <p className="text-gray-900 font-medium">{formatRole(user.role, user.sexe)}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleProfileUpdate} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>{t('profile.personalInfo.lastName')} <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    required
                    className="w-full border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg px-4 py-2.5 transition-all"
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                    <User className="w-4 h-4 text-green-600" />
                    <span>{t('profile.personalInfo.firstName')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className="w-full border-2 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-lg px-4 py-2.5 transition-all"
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                    <Mail className="w-4 h-4 text-purple-600" />
                    <span>{t('profile.personalInfo.email')} <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full border-2 border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 rounded-lg px-4 py-2.5 transition-all"
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 text-orange-600" />
                    <span>{t('profile.personalInfo.phone')}</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    className="w-full border-2 border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 rounded-lg px-4 py-2.5 transition-all"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>{loading ? t('profile.personalInfo.saving') : t('profile.personalInfo.saveButton')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setFormData({
                      nom: user.nom || '',
                      prenom: user.prenom || '',
                      telephone: user.telephone || '',
                      email: user.email || '',
                    })
                  }}
                  className="flex items-center space-x-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-medium transition-all"
                >
                  <X className="w-4 h-4" />
                  <span>{t('profile.personalInfo.cancelButton')}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Section Changement de mot de passe */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-b border-red-100">
          <div className="flex items-center space-x-3">
            <div className="bg-red-600 p-2 rounded-lg">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{t('profile.security.title')}</h2>
              <p className="text-sm text-gray-600 mt-0.5">{t('profile.security.subtitle')}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={handlePasswordChange} className="space-y-5">
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                <Key className="w-4 h-4 text-gray-600" />
                <span>{t('profile.security.currentPassword')} <span className="text-red-500">*</span></span>
              </label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, currentPassword: e.target.value })
                }
                required
                className="w-full border-2 border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 rounded-lg px-4 py-2.5 transition-all"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="mb-3">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                  <Lock className="w-4 h-4 text-blue-600" />
                  <span>{t('profile.security.newPassword')} <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                  }
                  required
                  minLength={8}
                  className="w-full border-2 border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg px-4 py-2.5 transition-all"
                />
              </div>
              <p className="text-xs text-blue-700 flex items-start space-x-2">
                <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{t('profile.security.requirements')}</span>
              </p>
            </div>

            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>{t('profile.security.confirmPassword')} <span className="text-red-500">*</span></span>
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
                required
                className="w-full border-2 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-lg px-4 py-2.5 transition-all"
              />
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
              >
                <Key className="w-4 h-4" />
                <span>{loading ? t('profile.security.changing') : t('profile.security.changeButton')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Section RGPD - Droits sur les donnees */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mt-6 border border-gray-100">
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4 border-b border-purple-100">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{t('profile.gdpr.title', 'Vos droits RGPD')}</h2>
              <p className="text-sm text-gray-600 mt-0.5">{t('profile.gdpr.subtitle', 'Gerez vos donnees personnelles')}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Export des donnees */}
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Download className="w-4 h-4 text-green-600" />
                {t('profile.gdpr.exportTitle', 'Exporter mes donnees')}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {t('profile.gdpr.exportDescription', 'Telechargez une copie de toutes vos donnees personnelles (Article 20 RGPD)')}
              </p>
            </div>
            <button
              onClick={handleExportData}
              disabled={exportingData}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exportingData ? t('common.loading', 'Chargement...') : t('common.export', 'Exporter')}
            </button>
          </div>

          {/* Lien vers politique de confidentialite */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{t('profile.gdpr.privacyTitle', 'Politique de confidentialite')}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {t('profile.gdpr.privacyDescription', 'Consultez comment nous traitons vos donnees')}
              </p>
            </div>
            <Link
              to="/privacy"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {t('profile.gdpr.viewPolicy', 'Consulter')}
            </Link>
          </div>

          {/* Suppression du compte */}
          <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-600" />
                {t('profile.gdpr.deleteTitle', 'Supprimer mon compte')}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {t('profile.gdpr.deleteDescription', 'Supprimez definitivement votre compte et vos donnees (Article 17 RGPD)')}
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {t('common.delete', 'Supprimer')}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmation de suppression */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">{t('profile.gdpr.deleteModalTitle', 'Supprimer votre compte ?')}</h3>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800 text-sm font-medium mb-2">{t('profile.gdpr.deleteWarning', 'Cette action est IRREVERSIBLE !')}</p>
              <ul className="text-red-700 text-sm space-y-1">
                <li>- {t('profile.gdpr.deleteWarning1', 'Votre compte sera supprime definitivement')}</li>
                <li>- {t('profile.gdpr.deleteWarning2', 'Vos donnees personnelles seront effacees')}</li>
                <li>- {t('profile.gdpr.deleteWarning3', 'Vous serez deconnecte immediatement')}</li>
              </ul>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.gdpr.currentPassword', 'Mot de passe actuel')}
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full border-2 border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 rounded-lg px-4 py-2"
                  placeholder="********"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.gdpr.typeToConfirm', 'Tapez "SUPPRIMER MON COMPTE" pour confirmer')}
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full border-2 border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 rounded-lg px-4 py-2"
                  placeholder="SUPPRIMER MON COMPTE"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletePassword('')
                  setDeleteConfirmation('')
                }}
                className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                {t('common.cancel', 'Annuler')}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmation !== 'SUPPRIMER MON COMPTE'}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingAccount ? t('common.loading', 'Chargement...') : t('profile.gdpr.confirmDelete', 'Supprimer definitivement')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
