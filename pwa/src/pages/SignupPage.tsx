import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'

export const SignupPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nom: '',
    prenom: '',
    telephone: '',
    sexe: '',  // M ou F
    role: '',  // Obligatoire: médecin, infirmier, major, soignant, pharmacien
    // Informations du site/CSCOM
    site_nom: '',
    site_type: 'cscom',
    site_ville: '',
    site_pays: 'Mali',
    site_adresse: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const navigate = useNavigate()

  const passwordRequirements = {
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[!@#$%^&*]/.test(formData.password),
  }

  const allRequirementsMet = Object.values(passwordRequirements).every(Boolean)

  // Redirection automatique vers login après inscription
  useEffect(() => {
    if (success) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [success])

  // Redirection séparée quand countdown atteint 0
  useEffect(() => {
    if (success && countdown === 0) {
      navigate('/login', {
        state: {
          message: 'Compte créé ! Vérifiez votre email puis connectez-vous.'
        }
      })
    }
  }, [countdown, success, navigate])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    if (!allRequirementsMet) {
      setError('Le mot de passe ne respecte pas tous les critères de sécurité')
      return
    }

    setIsLoading(true)

    try {
      await authService.signup({
        email: formData.email,
        password: formData.password,
        nom: formData.nom,
        prenom: formData.prenom,
        telephone: formData.telephone || undefined,
        sexe: formData.sexe,  // M ou F
        role: formData.role,  // Obligatoire
        // Informations du site
        site_nom: formData.site_nom,
        site_type: formData.site_type,
        site_ville: formData.site_ville || undefined,
        site_pays: formData.site_pays,
        site_adresse: formData.site_adresse || undefined,
      })

      // Afficher le message de succès
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du compte')
    } finally {
      setIsLoading(false)
    }
  }

  // Afficher le message de succès si l'inscription a réussi
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {/* Success Icon */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Compte créé avec succès !
              </h1>
              <p className="text-gray-600 text-sm mb-4">
                Un email de vérification a été envoyé à <strong>{formData.email}</strong>
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-emerald-800">
                <strong>📧 Vérifiez votre boîte de réception</strong><br />
                Cliquez sur le lien dans l'email pour activer votre compte.
                Le lien est valide pendant 24 heures.
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-xs text-yellow-800">
                <strong>⚠️ Email non reçu ?</strong><br />
                Vérifiez vos courriers indésirables (spam).
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 text-center">
              <p className="text-sm text-gray-600">
                Redirection vers la page de connexion dans <strong className="text-emerald-600 text-lg">{countdown}</strong> seconde{countdown > 1 ? 's' : ''}...
              </p>
            </div>

            <Link
              to="/login"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Aller maintenant à la connexion
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🏥</div>
            <h1 className="text-2xl font-bold text-gray-900">
              Créer un compte
            </h1>
            <p className="text-gray-600 mt-2 text-sm">
              Centre de Santé Communautaire
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom
                </label>
                <input
                  id="nom"
                  name="nom"
                  type="text"
                  value={formData.nom}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                  placeholder="DIARRA"
                />
              </div>

              <div>
                <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-2">
                  Prénom
                </label>
                <input
                  id="prenom"
                  name="prenom"
                  type="text"
                  value={formData.prenom}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                  placeholder="Mamadou"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Adresse email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                placeholder="votre.email@cscom.ml"
              />
            </div>

            <div>
              <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-2">
                Téléphone (optionnel)
              </label>
              <input
                id="telephone"
                name="telephone"
                type="tel"
                value={formData.telephone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                placeholder="+223 70 00 00 00"
              />
            </div>

            <div>
              <label htmlFor="sexe" className="block text-sm font-medium text-gray-700 mb-2">
                Sexe <span className="text-red-500">*</span>
              </label>
              <select
                id="sexe"
                name="sexe"
                value={formData.sexe}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition bg-white"
              >
                <option value="">Sélectionnez votre sexe</option>
                <option value="M">👨 Homme</option>
                <option value="F">👩 Femme</option>
              </select>
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                Fonction <span className="text-red-500">*</span>
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition bg-white"
              >
                <option value="">Sélectionnez votre fonction</option>
                <option value="medecin">🩺 Médecin</option>
                <option value="infirmier">{formData.sexe === 'F' ? '👩‍⚕️ Infirmière' : '👨‍⚕️ Infirmier'}</option>
                <option value="major">👩‍⚕️ Major (Infirmier{formData.sexe === 'F' ? 'ère' : ''} chef)</option>
                <option value="soignant">🩹 Soignant{formData.sexe === 'F' ? 'e' : ''}</option>
                <option value="pharmacien">💊 Pharmacien{formData.sexe === 'F' ? 'ne' : ''}</option>
              </select>
            </div>

            {/* Séparateur visuel */}
            <div className="border-t border-gray-200 pt-6 mt-2">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Informations de votre structure de santé
              </h3>
            </div>

            <div>
              <label htmlFor="site_nom" className="block text-sm font-medium text-gray-700 mb-2">
                Nom de votre CSCOM/Hôpital <span className="text-red-500">*</span>
              </label>
              <input
                id="site_nom"
                name="site_nom"
                type="text"
                value={formData.site_nom}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                placeholder="Ex: CSCOM de Bamako Coura"
              />
            </div>

            <div>
              <label htmlFor="site_type" className="block text-sm font-medium text-gray-700 mb-2">
                Type de structure <span className="text-red-500">*</span>
              </label>
              <select
                id="site_type"
                name="site_type"
                value={formData.site_type}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition bg-white"
              >
                <option value="cscom">CSCOM (Centre de Santé Communautaire)</option>
                <option value="hospital">Hôpital</option>
                <option value="clinic">Clinique</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="site_ville" className="block text-sm font-medium text-gray-700 mb-2">
                  Ville
                </label>
                <input
                  id="site_ville"
                  name="site_ville"
                  type="text"
                  value={formData.site_ville}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                  placeholder="Bamako"
                />
              </div>

              <div>
                <label htmlFor="site_pays" className="block text-sm font-medium text-gray-700 mb-2">
                  Pays <span className="text-red-500">*</span>
                </label>
                <input
                  id="site_pays"
                  name="site_pays"
                  type="text"
                  value={formData.site_pays}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                  placeholder="Mali"
                />
              </div>
            </div>

            <div>
              <label htmlFor="site_adresse" className="block text-sm font-medium text-gray-700 mb-2">
                Adresse complète (optionnel)
              </label>
              <input
                id="site_adresse"
                name="site_adresse"
                type="text"
                value={formData.site_adresse}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                placeholder="Rue, quartier, commune"
              />
            </div>

            {/* Séparateur visuel */}
            <div className="border-t border-gray-200 pt-6 mt-2">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Sécurité du compte
              </h3>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                placeholder="••••••••"
              />

              {/* Indicateurs de force du mot de passe */}
              {formData.password && (
                <div className="mt-2 space-y-1">
                  <div className={`text-xs flex items-center ${passwordRequirements.length ? 'text-green-600' : 'text-gray-500'}`}>
                    <span className="mr-1">{passwordRequirements.length ? '✓' : '○'}</span>
                    Au moins 8 caractères
                  </div>
                  <div className={`text-xs flex items-center ${passwordRequirements.uppercase ? 'text-green-600' : 'text-gray-500'}`}>
                    <span className="mr-1">{passwordRequirements.uppercase ? '✓' : '○'}</span>
                    Au moins une majuscule
                  </div>
                  <div className={`text-xs flex items-center ${passwordRequirements.number ? 'text-green-600' : 'text-gray-500'}`}>
                    <span className="mr-1">{passwordRequirements.number ? '✓' : '○'}</span>
                    Au moins un chiffre
                  </div>
                  <div className={`text-xs flex items-center ${passwordRequirements.special ? 'text-green-600' : 'text-gray-500'}`}>
                    <span className="mr-1">{passwordRequirements.special ? '✓' : '○'}</span>
                    Au moins un caractère spécial (!@#$%^&*)
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirmer le mot de passe
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                placeholder="••••••••"
              />
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">Les mots de passe ne correspondent pas</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !allRequirementsMet}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center mt-6"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Création du compte...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Créer mon compte
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Vous avez déjà un compte ?{' '}
              <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-semibold transition-colors">
                Se connecter
              </Link>
            </p>
          </div>
        </div>

        {/* Info sécurité */}
        <div className="mt-6 text-center text-white text-sm">
          <div className="flex items-center justify-center space-x-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>Inscription sécurisée</span>
          </div>
        </div>
      </div>
    </div>
  )
}
