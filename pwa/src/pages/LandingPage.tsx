import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export const LandingPage = () => {
  const { isAuthenticated, isLoading } = useAuth()

  // Rediriger vers /patients si déjà connecté
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white font-medium">Chargement...</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/patients" replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 px-4 relative overflow-hidden">
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full blur-2xl"></div>
      </div>

      <div className="max-w-4xl w-full relative z-10">
        {/* Main Card */}
        <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl p-8 md:p-12 border border-white/20">
          {/* Logo et Titre */}
          <div className="text-center mb-8">
            <div className="inline-block animate-bounce">
              <div className="text-7xl mb-4 filter drop-shadow-lg">🏥</div>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Santé Rurale
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 font-semibold mb-2">
              E-santé pour les centres de santé ruraux
            </p>
            <p className="text-gray-600 text-lg">
              🌍 Pensée pour l'Afrique de l'Ouest
            </p>
          </div>

          {/* Description */}
          <div className="mb-8 text-center">
            <p className="text-gray-700 text-lg mb-6 leading-relaxed">
              Une <span className="font-semibold text-purple-600">PWA offline-first</span>, capable de fonctionner même avec une connexion instable
            </p>
          </div>

          {/* Fonctionnalités */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border-2 border-blue-200 hover:shadow-lg transition-all">
              <div className="text-3xl mb-3">👤</div>
              <h3 className="font-bold text-blue-900 text-lg mb-2">Gestion des patients</h3>
              <p className="text-blue-700 text-sm">Création et suivi complet des dossiers patients</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border-2 border-purple-200 hover:shadow-lg transition-all">
              <div className="text-3xl mb-3">🩺</div>
              <h3 className="font-bold text-purple-900 text-lg mb-2">Consultations & diagnostics</h3>
              <p className="text-purple-700 text-sm">Enregistrement détaillé des consultations médicales</p>
            </div>

            <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-2xl border-2 border-pink-200 hover:shadow-lg transition-all">
              <div className="text-3xl mb-3">💊</div>
              <h3 className="font-bold text-pink-900 text-lg mb-2">Ordonnances</h3>
              <p className="text-pink-700 text-sm">Prescription et gestion des traitements</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border-2 border-green-200 hover:shadow-lg transition-all">
              <div className="text-3xl mb-3">🔄</div>
              <h3 className="font-bold text-green-900 text-lg mb-2">Synchronisation auto</h3>
              <p className="text-green-700 text-sm">Vos données se synchronisent dès que vous êtes en ligne</p>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-2xl border-2 border-indigo-200 hover:shadow-lg transition-all">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="font-bold text-indigo-900 text-lg mb-2">Tableau de bord</h3>
              <p className="text-indigo-700 text-sm">Statistiques et rapports essentiels</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-2xl border-2 border-yellow-200 hover:shadow-lg transition-all">
              <div className="text-3xl mb-3">📱</div>
              <h3 className="font-bold text-yellow-900 text-lg mb-2">Mode offline</h3>
              <p className="text-yellow-700 text-sm">Fonctionne sans connexion internet</p>
            </div>
          </div>

          {/* Objectif */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-2xl text-white text-center mb-8">
            <h3 className="font-bold text-2xl mb-3">🎯 Notre Mission</h3>
            <p className="text-lg leading-relaxed">
              Aider les <strong>médecins</strong>, <strong>infirmiers</strong> et <strong>sages-femmes</strong> à gagner du temps
              et à fiabiliser les données, là où la connectivité est un vrai défi.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/signup"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl transition-all transform hover:scale-105 hover:shadow-xl flex items-center gap-2 text-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Créer un compte
            </Link>

            <Link
              to="/login"
              className="px-8 py-4 bg-white hover:bg-gray-50 text-purple-600 font-bold rounded-xl border-2 border-purple-600 transition-all transform hover:scale-105 hover:shadow-xl flex items-center gap-2 text-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Se connecter
            </Link>
          </div>
        </div>

        {/* Info badges */}
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-2xl px-6 py-3 text-white">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Sécurisé SSL</span>
          </div>

          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-2xl px-6 py-3 text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">Mode Offline</span>
          </div>

          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-2xl px-6 py-3 text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">Afrique de l'Ouest</span>
          </div>
        </div>
      </div>
    </div>
  )
}
