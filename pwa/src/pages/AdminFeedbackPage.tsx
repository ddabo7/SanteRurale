import React, { useState, useEffect } from 'react'
import { Layout } from '../components/Layout'
import { apiClient } from '../lib/api-client'

interface Feedback {
  id: number
  type: string
  status: string
  subject: string
  message: string
  user_email?: string
  user_name?: string
  browser_info?: string
  admin_response?: string
  responded_at?: string
  created_at: string
  updated_at: string
}

interface FeedbackStats {
  total: number
  by_type: Record<string, number>
  by_status: Record<string, number>
  recent_count: number
}

export const AdminFeedbackPage = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [stats, setStats] = useState<FeedbackStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [adminResponse, setAdminResponse] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [filterType, filterStatus])

  const loadData = async () => {
    try {
      setLoading(true)

      // Charger les stats
      const statsResponse = await apiClient.get('/feedback/admin/stats')
      setStats(statsResponse.data)

      // Charger les feedbacks avec filtres
      const params: any = {}
      if (filterType !== 'all') params.feedback_type = filterType
      if (filterStatus !== 'all') params.feedback_status = filterStatus

      const feedbacksResponse = await apiClient.get('/feedback/admin/all', { params })
      setFeedbacks(feedbacksResponse.data)
    } catch (error) {
      console.error('Erreur chargement feedbacks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (feedbackId: number, newStatus: string) => {
    try {
      await apiClient.patch(`/feedback/admin/${feedbackId}`, { status: newStatus })
      loadData()
      if (selectedFeedback?.id === feedbackId) {
        setSelectedFeedback(null)
      }
    } catch (error) {
      console.error('Erreur mise à jour statut:', error)
    }
  }

  const handleRespondToFeedback = async (feedbackId: number) => {
    if (!adminResponse.trim()) return

    try {
      await apiClient.patch(`/feedback/admin/${feedbackId}`, {
        admin_response: adminResponse,
        status: 'in_progress',
      })
      setAdminResponse('')
      loadData()
      setSelectedFeedback(null)
    } catch (error) {
      console.error('Erreur envoi réponse:', error)
    }
  }

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      bug: '🐛',
      feature_request: '✨',
      improvement: '🚀',
      general: '💬',
      complaint: '⚠️',
    }
    return icons[type] || '💬'
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      new: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Nouveau' },
      in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En cours' },
      resolved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Résolu' },
      closed: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Fermé' },
    }
    const badge = badges[status] || badges.new
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-8 mb-8 text-white shadow-2xl">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <span className="text-4xl">📬</span>
            Feedbacks Utilisateurs
          </h1>
          <p className="text-blue-100">
            Gérez les retours des utilisateurs et améliorez l'application
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="text-3xl mb-2">📊</div>
              <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
              <div className="text-sm text-gray-600">Total feedbacks</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="text-3xl mb-2">🆕</div>
              <div className="text-2xl font-bold text-blue-600">{stats.by_status.new || 0}</div>
              <div className="text-sm text-gray-600">Nouveaux</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="text-3xl mb-2">⚡</div>
              <div className="text-2xl font-bold text-orange-600">{stats.recent_count}</div>
              <div className="text-sm text-gray-600">Dernières 24h</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-2xl font-bold text-green-600">{stats.by_status.resolved || 0}</div>
              <div className="text-sm text-gray-600">Résolus</div>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6 border border-gray-100">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
              >
                <option value="all">Tous</option>
                <option value="bug">🐛 Bugs</option>
                <option value="feature_request">✨ Features</option>
                <option value="improvement">🚀 Améliorations</option>
                <option value="general">💬 Général</option>
                <option value="complaint">⚠️ Réclamations</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Statut</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
              >
                <option value="all">Tous</option>
                <option value="new">Nouveaux</option>
                <option value="in_progress">En cours</option>
                <option value="resolved">Résolus</option>
                <option value="closed">Fermés</option>
              </select>
            </div>
          </div>
        </div>

        {/* Liste des feedbacks */}
        <div className="space-y-4">
          {feedbacks.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-lg">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500">Aucun feedback pour ces filtres</p>
            </div>
          ) : (
            feedbacks.map((feedback) => (
              <div
                key={feedback.id}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="text-3xl">{getTypeIcon(feedback.type)}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">{feedback.subject}</h3>
                      <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                        <span>👤 {feedback.user_name || feedback.user_email || 'Anonyme'}</span>
                        <span>•</span>
                        <span>📅 {new Date(feedback.created_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(feedback.status)}
                </div>

                <p className="text-gray-700 mb-4 whitespace-pre-wrap">{feedback.message}</p>

                {feedback.admin_response && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded">
                    <p className="text-sm font-semibold text-blue-900 mb-1">Réponse Admin:</p>
                    <p className="text-blue-800">{feedback.admin_response}</p>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setSelectedFeedback(feedback)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold"
                  >
                    💬 Répondre
                  </button>
                  {feedback.status !== 'resolved' && (
                    <button
                      onClick={() => handleUpdateStatus(feedback.id, 'resolved')}
                      className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm font-semibold"
                    >
                      ✅ Marquer résolu
                    </button>
                  )}
                  {feedback.status !== 'closed' && (
                    <button
                      onClick={() => handleUpdateStatus(feedback.id, 'closed')}
                      className="px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors text-sm font-semibold"
                    >
                      🔒 Fermer
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal de réponse */}
        {selectedFeedback && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-scaleIn">
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span>💬</span>
                Répondre au feedback
              </h3>
              <div className="bg-gray-50 p-4 rounded-xl mb-4">
                <p className="font-semibold text-gray-900">{selectedFeedback.subject}</p>
                <p className="text-sm text-gray-600 mt-1">{selectedFeedback.message}</p>
              </div>
              <textarea
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                rows={5}
                placeholder="Votre réponse..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleRespondToFeedback(selectedFeedback.id)}
                  disabled={!adminResponse.trim()}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg disabled:opacity-50"
                >
                  Envoyer la réponse
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
