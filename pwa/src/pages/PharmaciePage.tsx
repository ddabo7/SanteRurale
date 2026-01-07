import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'

export const PharmaciePage = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [showGuide, setShowGuide] = useState(true)

  // Charger la préférence au montage
  useEffect(() => {
    const saved = localStorage.getItem('pharmacie_show_guide')
    if (saved !== null) {
      setShowGuide(saved === 'true')
    }
  }, [])

  // Sauvegarder la préférence
  const toggleGuide = () => {
    const newValue = !showGuide
    setShowGuide(newValue)
    localStorage.setItem('pharmacie_show_guide', String(newValue))
  }

  const modules = [
    {
      title: t('pharmacy.modules.catalog.title'),
      description: t('pharmacy.modules.catalog.description'),
      icon: '💊',
      link: '/medicaments',
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: t('pharmacy.modules.stock.title'),
      description: t('pharmacy.modules.stock.description'),
      icon: '📦',
      link: '/stock',
      color: 'from-emerald-500 to-emerald-600'
    },
    {
      title: t('pharmacy.modules.suppliers.title'),
      description: t('pharmacy.modules.suppliers.description'),
      icon: '🏭',
      link: '/fournisseurs',
      color: 'from-purple-500 to-purple-600'
    },
    {
      title: t('pharmacy.modules.orders.title'),
      description: t('pharmacy.modules.orders.description'),
      icon: '📋',
      link: '/bons-commande',
      color: 'from-orange-500 to-orange-600'
    }
  ]

  return (
    <div className="max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">💊 {t('pharmacy.title')}</h1>
        <p className="text-lg text-gray-600">
          {t('pharmacy.description')}
        </p>
      </div>

      {/* Grille des modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((module) => (
          <Link
            key={module.link}
            to={module.link}
            className="group relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${module.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>

            <div className="relative p-8">
              {/* Icône */}
              <div className="text-6xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                {module.icon}
              </div>

              {/* Titre */}
              <h2 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 transition-all duration-300">
                {module.title}
              </h2>

              {/* Description */}
              <p className="text-gray-600 mb-4">
                {module.description}
              </p>

              {/* Bouton */}
              <div className="flex items-center text-blue-600 font-semibold group-hover:text-purple-600 transition-colors duration-300">
                <span>{t('common.access')}</span>
                <svg
                  className="ml-2 w-5 h-5 transform group-hover:translate-x-2 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Section d'aide avec bouton masquer/afficher */}
      <div className="mt-12">
        {showGuide ? (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-100 relative">
            <button
              onClick={toggleGuide}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-lg hover:bg-white/50"
              title={t('pharmacy.guide.hide')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">ℹ️</span>
              {t('pharmacy.guide.title')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                <h4 className="font-semibold mb-2">📋 {t('pharmacy.guide.workflow.title')}:</h4>
                <ol className="list-decimal list-inside space-y-1">
                  <li>{t('pharmacy.guide.workflow.step1')}</li>
                  <li>{t('pharmacy.guide.workflow.step2')}</li>
                  <li>{t('pharmacy.guide.workflow.step3')}</li>
                  <li>{t('pharmacy.guide.workflow.step4')}</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold mb-2">🔐 {t('pharmacy.guide.permissions.title')}:</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('pharmacy.guide.permissions.view')}</li>
                  <li>{t('pharmacy.guide.permissions.manage')}</li>
                  <li>{t('pharmacy.guide.permissions.note')}</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={toggleGuide}
            className="w-full bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 rounded-2xl p-4 border border-blue-100 transition-all flex items-center justify-center gap-2 text-gray-700 hover:text-gray-900"
          >
            <span className="text-xl">ℹ️</span>
            <span className="font-semibold">{t('pharmacy.guide.show')}</span>
          </button>
        )}
      </div>
    </div>
  )
}
