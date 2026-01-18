import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Shield, ArrowLeft, Mail, Database, Lock, Eye, Trash2, Download, Clock, Globe } from 'lucide-react'

export const PrivacyPolicyPage = () => {
  const { t, i18n } = useTranslation()
  const lastUpdated = i18n.language === 'en' ? 'January 18, 2026' : '18 janvier 2026'

  const personalDataItems = t('privacy.dataCollected.personal.items', { returnObjects: true }) as string[]
  const medicalDataItems = t('privacy.dataCollected.medical.items', { returnObjects: true }) as string[]
  const technicalDataItems = t('privacy.dataCollected.technical.items', { returnObjects: true }) as string[]
  const purposeItems = t('privacy.purpose.items', { returnObjects: true }) as string[]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-emerald-50 to-teal-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t('common.back', 'Back')}
          </Link>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{t('privacy.title')}</h1>
              <p className="text-emerald-100 mt-1">{t('privacy.lastUpdated')}: {lastUpdated}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 space-y-8">

          {/* Introduction */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              {t('privacy.intro.title')}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {t('privacy.intro.text')}
            </p>
          </section>

          {/* Data Controller */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-600" />
              {t('privacy.controller.title')}
            </h2>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-gray-700 font-medium">Sante Rurale</p>
              <p className="text-gray-600 mt-1">Email: privacy@santerurale.io</p>
              <p className="text-gray-600">{t('privacy.controller.address')}: Bamako, Mali</p>
            </div>
          </section>

          {/* Data Collected */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              {t('privacy.dataCollected.title')}
            </h2>
            <div className="space-y-4">
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <h3 className="font-medium text-emerald-900 mb-2">{t('privacy.dataCollected.personal.title')}</h3>
                <ul className="text-emerald-800 text-sm space-y-1">
                  {Array.isArray(personalDataItems) && personalDataItems.map((item, index) => (
                    <li key={index}>- {item}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <h3 className="font-medium text-purple-900 mb-2">{t('privacy.dataCollected.medical.title')}</h3>
                <ul className="text-purple-800 text-sm space-y-1">
                  {Array.isArray(medicalDataItems) && medicalDataItems.map((item, index) => (
                    <li key={index}>- {item}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <h3 className="font-medium text-orange-900 mb-2">{t('privacy.dataCollected.technical.title')}</h3>
                <ul className="text-orange-800 text-sm space-y-1">
                  {Array.isArray(technicalDataItems) && technicalDataItems.map((item, index) => (
                    <li key={index}>- {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Purpose */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-emerald-600" />
              {t('privacy.purpose.title')}
            </h2>
            <ul className="space-y-3 text-gray-600">
              {Array.isArray(purposeItems) && purposeItems.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium">{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Security */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-600" />
              {t('privacy.security.title')}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-2">{t('privacy.security.encryption.title')}</h3>
                <p className="text-gray-600 text-sm">{t('privacy.security.encryption.description')}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-2">{t('privacy.security.authentication.title')}</h3>
                <p className="text-gray-600 text-sm">{t('privacy.security.authentication.description')}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-2">{t('privacy.security.isolation.title')}</h3>
                <p className="text-gray-600 text-sm">{t('privacy.security.isolation.description')}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-2">{t('privacy.security.backups.title')}</h3>
                <p className="text-gray-600 text-sm">{t('privacy.security.backups.description')}</p>
              </div>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              {t('privacy.retention.title')}
            </h2>
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <p className="text-yellow-800">
                {t('privacy.retention.text')}
              </p>
            </div>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-600" />
              {t('privacy.rights.title')}
            </h2>
            <p className="text-gray-600 mb-4">
              {t('privacy.rights.intro')}
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Eye className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900">{t('privacy.rights.access.title')}</h4>
                  <p className="text-sm text-gray-600">{t('privacy.rights.access.description')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Download className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900">{t('privacy.rights.portability.title')}</h4>
                  <p className="text-sm text-gray-600">{t('privacy.rights.portability.description')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900">{t('privacy.rights.erasure.title')}</h4>
                  <p className="text-sm text-gray-600">{t('privacy.rights.erasure.description')}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-emerald-800 text-sm">
                {t('privacy.rights.exerciseRights')}
              </p>
            </div>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('privacy.cookies.title')}
            </h2>
            <p className="text-gray-600 mb-4">
              {t('privacy.cookies.text')}
            </p>
            <ul className="space-y-2 text-gray-600 text-sm">
              <li><strong>{t('privacy.cookies.essential')}</strong></li>
              <li><strong>{t('privacy.cookies.functional')}</strong></li>
              <li><strong>{t('privacy.cookies.analytics')}</strong></li>
            </ul>
          </section>

          {/* Contact */}
          <section className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('privacy.contact.title')}
            </h2>
            <p className="text-gray-600">
              {t('privacy.contact.text')}
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-700">Email: <a href="mailto:privacy@santerurale.io" className="text-emerald-600 hover:underline">privacy@santerurale.io</a></p>
            </div>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <Link to="/terms" className="hover:text-gray-700 underline">
            {t('privacy.seeTerms')}
          </Link>
        </div>
      </main>
    </div>
  )
}
