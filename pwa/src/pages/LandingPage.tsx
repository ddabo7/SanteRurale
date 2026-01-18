import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/LanguageSwitcher'

export const LandingPage = () => {
  const { t } = useTranslation()
  const { isAuthenticated, isLoading } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Rediriger vers /patients si déjà connecté
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white font-medium">{t('landing.loading')}</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/patients" replace />
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ==================== HEADER ==================== */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <span className="text-3xl">🏥</span>
              <span className="text-xl font-bold text-emerald-600 group-hover:text-emerald-700 transition-colors">
                {t('common.appName')}
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-emerald-600 font-medium transition-colors">
                {t('landing.nav.features')}
              </a>
              <a href="#stats" className="text-gray-600 hover:text-emerald-600 font-medium transition-colors">
                {t('landing.nav.stats')}
              </a>
              <a href="#for-professionals" className="text-gray-600 hover:text-emerald-600 font-medium transition-colors">
                {t('landing.nav.forProfessionals')}
              </a>
              <a href="#security" className="text-gray-600 hover:text-emerald-600 font-medium transition-colors">
                {t('landing.nav.security')}
              </a>
            </nav>

            {/* Desktop CTAs */}
            <div className="hidden md:flex items-center gap-4">
              <LanguageSwitcher />
              <Link
                to="/login"
                className="text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
              >
                {t('landing.nav.login')}
              </Link>
              <Link
                to="/signup"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
              >
                {t('landing.nav.signup')}
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Menu"
            >
              <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-100">
              <nav className="flex flex-col gap-4">
                <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-600 hover:text-emerald-600 font-medium">
                  {t('landing.nav.features')}
                </a>
                <a href="#stats" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-600 hover:text-emerald-600 font-medium">
                  {t('landing.nav.stats')}
                </a>
                <a href="#for-professionals" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-600 hover:text-emerald-600 font-medium">
                  {t('landing.nav.forProfessionals')}
                </a>
                <a href="#security" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-600 hover:text-emerald-600 font-medium">
                  {t('landing.nav.security')}
                </a>
                <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
                  <div className="flex justify-center">
                    <LanguageSwitcher />
                  </div>
                  <Link to="/login" className="text-emerald-600 font-semibold text-center py-2">
                    {t('landing.nav.login')}
                  </Link>
                  <Link to="/signup" className="bg-emerald-600 text-white py-3 rounded-lg font-semibold text-center">
                    {t('landing.nav.signup')}
                  </Link>
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* ==================== HERO SECTION ==================== */}
      <section className="relative bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-200/30 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              {t('landing.hero.title.part1')} <span className="text-emerald-600">{t('landing.hero.title.highlight')}</span>,
              <br className="hidden sm:block" /> {t('landing.hero.title.part2')}
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              {t('landing.hero.subtitle')}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link
                to="/signup"
                className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all transform hover:scale-105 hover:shadow-xl flex items-center justify-center gap-2 text-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                {t('landing.hero.cta.getStarted')}
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-gray-50 text-emerald-600 font-bold rounded-xl border-2 border-emerald-600 transition-all transform hover:scale-105 hover:shadow-xl flex items-center justify-center gap-2 text-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                {t('landing.hero.cta.alreadyHaveAccount')}
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-4 md:gap-6">
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm">
                <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-gray-700">{t('landing.hero.badges.ssl')}</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">{t('landing.hero.badges.offline')}</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">{t('landing.hero.badges.fast')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FEATURES SECTION ==================== */}
      <section id="features" className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t('landing.features.title')}
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {t('landing.features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-8 rounded-2xl border border-emerald-100 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-emerald-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{t('landing.features.items.patientManagement.title')}</h3>
              <p className="text-gray-600 leading-relaxed">
                {t('landing.features.items.patientManagement.description')}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-2xl border border-blue-100 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{t('landing.features.items.consultations.title')}</h3>
              <p className="text-gray-600 leading-relaxed">
                {t('landing.features.items.consultations.description')}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-8 rounded-2xl border border-amber-100 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-amber-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{t('landing.features.items.offline.title')}</h3>
              <p className="text-gray-600 leading-relaxed">
                {t('landing.features.items.offline.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== STATS SECTION ==================== */}
      <section id="stats" className="py-16 md:py-24 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('landing.stats.title')}</h2>
            <p className="text-xl text-emerald-100 max-w-2xl mx-auto">
              {t('landing.stats.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold mb-2">50+</div>
              <div className="text-emerald-200 font-medium">{t('landing.stats.items.healthCenters')}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold mb-2">500+</div>
              <div className="text-emerald-200 font-medium">{t('landing.stats.items.activeCarers')}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold mb-2">10k+</div>
              <div className="text-emerald-200 font-medium">{t('landing.stats.items.patientsFollowed')}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold mb-2">99.9%</div>
              <div className="text-emerald-200 font-medium">{t('landing.stats.items.availability')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FOR PROFESSIONALS SECTION ==================== */}
      <section id="for-professionals" className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm font-semibold mb-6">
                {t('landing.forProfessionals.badge')}
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                {t('landing.forProfessionals.title')}
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                {t('landing.forProfessionals.subtitle')}
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{t('landing.forProfessionals.benefits.saveTime.title')}</h4>
                    <p className="text-gray-600">{t('landing.forProfessionals.benefits.saveTime.description')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{t('landing.forProfessionals.benefits.reliableData.title')}</h4>
                    <p className="text-gray-600">{t('landing.forProfessionals.benefits.reliableData.description')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{t('landing.forProfessionals.benefits.workOffline.title')}</h4>
                    <p className="text-gray-600">{t('landing.forProfessionals.benefits.workOffline.description')}</p>
                  </div>
                </div>
              </div>

              <Link
                to="/signup"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg"
              >
                {t('landing.forProfessionals.cta')}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl p-8 md:p-12">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <div className="text-4xl mb-3">👨‍⚕️</div>
                    <h4 className="font-bold text-gray-900">{t('landing.forProfessionals.roles.doctors.title')}</h4>
                    <p className="text-sm text-gray-600 mt-1">{t('landing.forProfessionals.roles.doctors.description')}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <div className="text-4xl mb-3">👩‍⚕️</div>
                    <h4 className="font-bold text-gray-900">{t('landing.forProfessionals.roles.nurses.title')}</h4>
                    <p className="text-sm text-gray-600 mt-1">{t('landing.forProfessionals.roles.nurses.description')}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <div className="text-4xl mb-3">🤰</div>
                    <h4 className="font-bold text-gray-900">{t('landing.forProfessionals.roles.midwives.title')}</h4>
                    <p className="text-sm text-gray-600 mt-1">{t('landing.forProfessionals.roles.midwives.description')}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <div className="text-4xl mb-3">💊</div>
                    <h4 className="font-bold text-gray-900">{t('landing.forProfessionals.roles.pharmacists.title')}</h4>
                    <p className="text-sm text-gray-600 mt-1">{t('landing.forProfessionals.roles.pharmacists.description')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== SECURITY SECTION ==================== */}
      <section id="security" className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t('landing.security.title')}
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              {t('landing.security.subtitle')}
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-2xl p-6">
                <div className="text-3xl mb-4">🔐</div>
                <h4 className="font-bold text-gray-900 mb-2">{t('landing.security.features.encryption.title')}</h4>
                <p className="text-gray-600 text-sm">{t('landing.security.features.encryption.description')}</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-6">
                <div className="text-3xl mb-4">🏥</div>
                <h4 className="font-bold text-gray-900 mb-2">{t('landing.security.features.isolation.title')}</h4>
                <p className="text-gray-600 text-sm">{t('landing.security.features.isolation.description')}</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-6">
                <div className="text-3xl mb-4">📋</div>
                <h4 className="font-bold text-gray-900 mb-2">{t('landing.security.features.compliance.title')}</h4>
                <p className="text-gray-600 text-sm">{t('landing.security.features.compliance.description')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== CTA SECTION ==================== */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            {t('landing.cta.title')}
          </h2>
          <p className="text-xl text-emerald-100 mb-8">
            {t('landing.cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="px-8 py-4 bg-white text-emerald-600 font-bold rounded-xl transition-all transform hover:scale-105 hover:shadow-xl"
            >
              {t('landing.cta.buttons.getStarted')}
            </Link>
            <a
              href="mailto:contact@santerurale.io"
              className="px-8 py-4 bg-transparent border-2 border-white text-white font-bold rounded-xl transition-all transform hover:scale-105 hover:bg-white/10"
            >
              {t('landing.cta.buttons.contactUs')}
            </a>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Logo & Description */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-3xl">🏥</span>
                <span className="text-xl font-bold text-white">{t('common.appName')}</span>
              </div>
              <p className="text-gray-400 mb-4 max-w-md">
                {t('landing.footer.description')}
              </p>
              <div className="flex gap-4">
                <a href="https://twitter.com/santerurale" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" aria-label="Twitter">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                  </svg>
                </a>
                <a href="https://www.linkedin.com/company/santerurale-io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" aria-label="LinkedIn">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">{t('landing.footer.product.title')}</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-white transition-colors">{t('landing.footer.product.features')}</a></li>
                <li><a href="#stats" className="hover:text-white transition-colors">{t('landing.footer.product.stats')}</a></li>
                <li><a href="#security" className="hover:text-white transition-colors">{t('landing.footer.product.security')}</a></li>
                <li><Link to="/signup" className="hover:text-white transition-colors">{t('landing.footer.product.signup')}</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">{t('landing.footer.support.title')}</h4>
              <ul className="space-y-2">
                <li><a href="mailto:support@santerurale.io" className="hover:text-white transition-colors">{t('landing.footer.support.contact')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.footer.support.helpCenter')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.footer.support.documentation')}</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              {t('landing.footer.copyright')}
            </p>
            <div className="flex gap-6 text-sm">
              <Link to="/terms" className="text-gray-500 hover:text-white transition-colors">{t('landing.footer.legal.terms')}</Link>
              <Link to="/privacy" className="text-gray-500 hover:text-white transition-colors">{t('landing.footer.legal.privacy')}</Link>
              <Link to="/terms" className="text-gray-500 hover:text-white transition-colors">{t('landing.footer.legal.conditions')}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
