import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { FileText, ArrowLeft, CheckCircle, AlertTriangle, Scale, Users, Ban, RefreshCw } from 'lucide-react'

export const TermsPage = () => {
  const { t, i18n } = useTranslation()
  const lastUpdated = i18n.language === 'en' ? 'January 18, 2026' : '18 janvier 2026'

  const descriptionItems = t('terms.description.items', { returnObjects: true }) as string[]
  const eligibilityItems = t('terms.eligibility.items', { returnObjects: true }) as string[]
  const prohibitedItems = t('terms.prohibited.items', { returnObjects: true }) as string[]

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
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{t('terms.title')}</h1>
              <p className="text-emerald-100 mt-1">{t('terms.lastUpdated')}: {lastUpdated}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 space-y-8">

          {/* Acceptance */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              {t('terms.acceptance.title')}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {t('terms.acceptance.text')}
            </p>
          </section>

          {/* Description */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              {t('terms.description.title')}
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              {t('terms.description.text')}
            </p>
            <ul className="space-y-2 text-gray-600">
              {Array.isArray(descriptionItems) && descriptionItems.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Eligibility */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              {t('terms.eligibility.title')}
            </h2>
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
              <p className="text-emerald-800">
                {t('terms.eligibility.text')}
              </p>
              <ul className="mt-3 space-y-1 text-emerald-700 text-sm">
                {Array.isArray(eligibilityItems) && eligibilityItems.map((item, index) => (
                  <li key={index}>- {item}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* User Obligations */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-600" />
              {t('terms.obligations.title')}
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-2">{t('terms.obligations.accountSecurity.title')}</h3>
                <p className="text-gray-600 text-sm">
                  {t('terms.obligations.accountSecurity.text')}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-2">{t('terms.obligations.properUse.title')}</h3>
                <p className="text-gray-600 text-sm">
                  {t('terms.obligations.properUse.text')}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-2">{t('terms.obligations.accuracy.title')}</h3>
                <p className="text-gray-600 text-sm">
                  {t('terms.obligations.accuracy.text')}
                </p>
              </div>
            </div>
          </section>

          {/* Prohibited Uses */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-600" />
              {t('terms.prohibited.title')}
            </h2>
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <p className="text-red-800 mb-3">{t('terms.prohibited.intro')}</p>
              <ul className="space-y-2 text-red-700 text-sm">
                {Array.isArray(prohibitedItems) && prohibitedItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Ban className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Data & Privacy */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('terms.data.title')}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {t('terms.data.text')}{' '}
              <Link to="/privacy" className="text-emerald-600 hover:underline font-medium">
                {t('terms.data.privacyPolicy')}
              </Link>
              {t('terms.data.textEnd')}
            </p>
          </section>

          {/* Service Availability */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-600" />
              {t('terms.availability.title')}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {t('terms.availability.text')}
            </p>
          </section>

          {/* Liability */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              {t('terms.liability.title')}
            </h2>
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <p className="text-yellow-800 text-sm">
                {t('terms.liability.text')}
              </p>
            </div>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('terms.termination.title')}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {t('terms.termination.text')}
            </p>
          </section>

          {/* Modifications */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('terms.modifications.title')}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {t('terms.modifications.text')}
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('terms.law.title')}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {t('terms.law.text')}
            </p>
          </section>

          {/* Contact */}
          <section className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('terms.contact.title')}
            </h2>
            <p className="text-gray-600">
              {t('terms.contact.text')}
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-700">Email: <a href="mailto:legal@santerurale.io" className="text-emerald-600 hover:underline">legal@santerurale.io</a></p>
            </div>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <Link to="/privacy" className="hover:text-gray-700 underline">
            {t('terms.seePrivacy')}
          </Link>
        </div>
      </main>
    </div>
  )
}
