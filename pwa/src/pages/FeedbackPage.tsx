import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Layout } from '../components/Layout'
import { apiClient } from '../services/api'

type FeedbackType = 'bug' | 'feature_request' | 'improvement' | 'general' | 'complaint'

export const FeedbackPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    type: 'general' as FeedbackType,
    subject: '',
    message: '',
  })

  const feedbackTypes = [
    { value: 'bug', label: `🐛 ${t('feedback.types.bug')}`, icon: '🐛' },
    { value: 'feature_request', label: `✨ ${t('feedback.types.featureRequest')}`, icon: '✨' },
    { value: 'improvement', label: `🚀 ${t('feedback.types.improvement')}`, icon: '🚀' },
    { value: 'general', label: `💬 ${t('feedback.types.general')}`, icon: '💬' },
    { value: 'complaint', label: `⚠️ ${t('feedback.types.complaint')}`, icon: '⚠️' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Collecter les informations techniques
      const browserInfo = navigator.userAgent
      const screenSize = `${window.screen.width}x${window.screen.height}`
      const url = window.location.href

      await apiClient.post('/feedback/', {
        ...formData,
        browser_info: browserInfo,
        screen_size: screenSize,
        url: url,
      })

      setSuccess(true)
      setFormData({ type: 'general', subject: '', message: '' })

      // Rediriger après 3 secondes
      setTimeout(() => {
        navigate('/')
      }, 3000)
    } catch (err: any) {
      setError(err.response?.data?.detail || t('feedback.errors.submitError'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-12">
          <div className="bg-green-50 border-2 border-green-500 rounded-3xl p-8 text-center animate-scaleIn">
            <div className="text-6xl mb-4 animate-bounce">✅</div>
            <h2 className="text-2xl font-bold text-green-800 mb-2">
              {t('feedback.success.title')}
            </h2>
            <p className="text-green-700">
              {t('feedback.success.message')}
            </p>
            <p className="text-sm text-green-600 mt-4">
              {t('feedback.success.redirecting')}
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 rounded-3xl p-8 mb-8 text-white shadow-2xl">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <span className="text-4xl">💬</span>
            {t('feedback.title')}
          </h1>
          <p className="text-blue-100">
            {t('feedback.subtitle')}
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg animate-slideInFromLeft">
              <p className="text-red-800 font-semibold flex items-center gap-2">
                <span>⚠️</span>
                {error}
              </p>
            </div>
          )}

          {/* Type de feedback */}
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-3">
              {t('feedback.form.type')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {feedbackTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: type.value as FeedbackType })}
                  className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 text-left ${
                    formData.type === type.value
                      ? 'border-purple-500 bg-purple-50 shadow-lg'
                      : 'border-gray-200 bg-white hover:border-purple-300'
                  }`}
                >
                  <span className="text-2xl mr-2">{type.icon}</span>
                  <span className="font-semibold text-gray-700">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sujet */}
          <div className="mb-6">
            <label htmlFor="subject" className="block text-gray-700 font-semibold mb-2">
              {t('feedback.form.subject')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
              minLength={5}
              maxLength={255}
              placeholder={t('feedback.form.subjectPlaceholder')}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
            />
            <p className="text-sm text-gray-500 mt-1">
              {t('feedback.form.characterCount', { count: formData.subject.length, max: 255 })}
            </p>
          </div>

          {/* Message */}
          <div className="mb-6">
            <label htmlFor="message" className="block text-gray-700 font-semibold mb-2">
              {t('feedback.form.message')} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              required
              minLength={10}
              maxLength={5000}
              rows={8}
              placeholder={t('feedback.form.messagePlaceholder')}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 transition-colors resize-none"
            />
            <p className="text-sm text-gray-500 mt-1">
              {t('feedback.form.characterCount', { count: formData.message.length, max: 5000 })}
            </p>
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-lg">
            <p className="text-sm text-blue-800 flex items-center gap-2">
              <span className="text-xl">ℹ️</span>
              <span>
                {t('feedback.form.technicalInfo')}
              </span>
            </p>
          </div>

          {/* Boutons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all transform hover:scale-105"
            >
              {t('feedback.form.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !formData.subject || !formData.message}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('feedback.form.sending')}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>📤</span>
                  {t('feedback.form.submit')}
                </span>
              )}
            </button>
          </div>
        </form>

        {/* Stats/Info */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-2xl border border-green-200">
            <div className="text-3xl mb-2">⚡</div>
            <div className="font-semibold text-green-800">{t('feedback.features.quickResponse.title')}</div>
            <div className="text-sm text-green-600">{t('feedback.features.quickResponse.subtitle')}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-2xl border border-blue-200">
            <div className="text-3xl mb-2">🔒</div>
            <div className="font-semibold text-blue-800">{t('feedback.features.privacy.title')}</div>
            <div className="text-sm text-blue-600">{t('feedback.features.privacy.subtitle')}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-2xl border border-purple-200">
            <div className="text-3xl mb-2">📊</div>
            <div className="font-semibold text-purple-800">{t('feedback.features.directImpact.title')}</div>
            <div className="text-sm text-purple-600">{t('feedback.features.directImpact.subtitle')}</div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
