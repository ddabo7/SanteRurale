import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { X, Settings, Cookie } from 'lucide-react'

interface CookiePreferences {
  essential: boolean
  functional: boolean
  analytics: boolean
  marketing: boolean
}

const COOKIE_CONSENT_KEY = 'sante_rurale_cookie_consent'
const COOKIE_PREFERENCES_KEY = 'sante_rurale_cookie_preferences'

export const CookieConsentBanner = () => {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always required
    functional: true,
    analytics: false,
    marketing: false,
  })

  useEffect(() => {
    // Check if user has already given consent
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) {
      setIsVisible(true)
    } else {
      // Load saved preferences
      const savedPreferences = localStorage.getItem(COOKIE_PREFERENCES_KEY)
      if (savedPreferences) {
        setPreferences(JSON.parse(savedPreferences))
      }
    }
  }, [])

  const saveConsent = (prefs: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, new Date().toISOString())
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(prefs))
    setPreferences(prefs)
    setIsVisible(false)
    setShowCustomize(false)
  }

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      functional: true,
      analytics: true,
      marketing: true,
    }
    saveConsent(allAccepted)
  }

  const handleRejectAll = () => {
    const essentialOnly: CookiePreferences = {
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
    }
    saveConsent(essentialOnly)
  }

  const handleSaveCustom = () => {
    saveConsent(preferences)
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          {!showCustomize ? (
            // Main banner
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-shrink-0 hidden sm:block">
                  <div className="bg-emerald-100 p-3 rounded-full">
                    <Cookie className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-gray-700 text-sm sm:text-base">
                    {t('cookies.bannerText', 'Nous utilisons des cookies pour ameliorer votre experience sur notre site, analyser le trafic et personnaliser le contenu. En continuant a naviguer, vous acceptez notre utilisation des cookies.')}{' '}
                    <Link to="/privacy" className="text-emerald-600 hover:text-emerald-800 underline font-medium">
                      {t('cookies.learnMore', 'En savoir plus')}
                    </Link>
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setShowCustomize(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                  >
                    <Settings className="w-4 h-4" />
                    {t('cookies.customize', 'Personnaliser')}
                  </button>
                  <button
                    onClick={handleRejectAll}
                    className="px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                  >
                    {t('cookies.rejectAll', 'Refuser tout')}
                  </button>
                  <button
                    onClick={handleAcceptAll}
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm shadow-md"
                  >
                    {t('cookies.acceptAll', 'Accepter tout')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Customization panel
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-emerald-600" />
                  {t('cookies.customizeTitle', 'Personnaliser vos preferences')}
                </h3>
                <button
                  onClick={() => setShowCustomize(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {/* Essential cookies */}
                <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{t('cookies.essential.title', 'Cookies essentiels')}</h4>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                        {t('cookies.required', 'Requis')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {t('cookies.essential.description', 'Necessaires au fonctionnement du site. Ils permettent la navigation et l\'acces aux zones securisees.')}
                    </p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled
                      className="w-5 h-5 rounded border-gray-300 text-emerald-600 cursor-not-allowed opacity-50"
                    />
                  </div>
                </div>

                {/* Functional cookies */}
                <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{t('cookies.functional.title', 'Cookies fonctionnels')}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {t('cookies.functional.description', 'Permettent de memoriser vos preferences (langue, parametres d\'affichage) pour ameliorer votre experience.')}
                    </p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={preferences.functional}
                      onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Analytics cookies */}
                <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{t('cookies.analytics.title', 'Cookies analytiques')}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {t('cookies.analytics.description', 'Nous aident a comprendre comment vous utilisez le site pour l\'ameliorer (pages visitees, temps de chargement).')}
                    </p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Marketing cookies */}
                <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{t('cookies.marketing.title', 'Cookies marketing')}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {t('cookies.marketing.description', 'Utilises pour vous proposer des contenus et publicites pertinents en fonction de vos interets.')}
                    </p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 justify-end border-t border-gray-200 pt-4">
                <button
                  onClick={handleRejectAll}
                  className="px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  {t('cookies.rejectAll', 'Refuser tout')}
                </button>
                <button
                  onClick={handleSaveCustom}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm shadow-md"
                >
                  {t('cookies.savePreferences', 'Enregistrer mes preferences')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
