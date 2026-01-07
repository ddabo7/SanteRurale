import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { reportsService } from '../services/api'

interface TopDiagnostic {
  code?: string
  libelle: string
  count: number
}

interface ReportOverview {
  period: {
    from: string
    to: string
  }
  total_consultations: number
  total_patients: number
  nouveaux_patients: number
  consultations_moins_5_ans: number
  top_diagnostics: TopDiagnostic[]
  references: {
    total: number
    confirmes: number
    completes: number
    en_attente: number
  }
}

export const RapportsPage = () => {
  const { t } = useTranslation()
  const [report, setReport] = useState<ReportOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dates par défaut: dernier mois
  const today = new Date()
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())

  const [fromDate, setFromDate] = useState(lastMonth.toISOString().split('T')[0])
  const [toDate, setToDate] = useState(today.toISOString().split('T')[0])

  useEffect(() => {
    loadReport()
  }, [fromDate, toDate])

  const loadReport = async () => {
    if (!fromDate || !toDate) return

    try {
      setLoading(true)
      setError(null)

      const data = await reportsService.getOverview({
        from: fromDate,
        to: toDate,
      })

      setReport(data)
    } catch (err) {
      console.error('Erreur lors du chargement du rapport:', err)
      setError(t('reports.loadError', 'Impossible de charger le rapport'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('reports.title')}</h1>

      {/* Sélecteur de période */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('consultations.filters.startDate')}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('consultations.filters.endDate')}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          {t('common.loading')}
        </div>
      )}

      {error && (
        <div className="bg-white rounded-lg shadow p-12 text-center text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && report && (
        <div className="space-y-6">
          {/* Statistiques principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500 mb-2">
                {t('reports.stats.totalConsultations')}
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {report.total_consultations}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500 mb-2">
                {t('admin.dashboard.stats.patients')}
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {report.total_patients}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500 mb-2">
                {t('reports.stats.newPatients')}
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {report.nouveaux_patients}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500 mb-2">
                {t('reports.stats.childrenUnder5')}
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {report.consultations_moins_5_ans}
              </div>
              {report.total_consultations > 0 && (
                <div className="text-sm text-gray-500 mt-1">
                  {Math.round((report.consultations_moins_5_ans / report.total_consultations) * 100)}%
                </div>
              )}
            </div>
          </div>

          {/* Top diagnostics */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {t('reports.charts.topDiagnoses')}
              </h2>
            </div>
            <div className="p-6">
              {report.top_diagnostics.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {t('common.noData')}
                </div>
              ) : (
                <div className="space-y-4">
                  {report.top_diagnostics.map((diagnostic, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {index + 1}.
                          </span>
                          {diagnostic.code && (
                            <span className="text-sm font-mono text-gray-600">
                              {diagnostic.code}
                            </span>
                          )}
                          <span className="text-sm text-gray-900">
                            {diagnostic.libelle}
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(diagnostic.count / report.top_diagnostics[0].count) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {diagnostic.count}
                        </div>
                        <div className="text-xs text-gray-500">
                          {t('reports.charts.cases')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Statistiques de références */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {t('reports.stats.references')}
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {report.references.total}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {t('common.total')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {report.references.en_attente}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {t('consultation.form.statusPending')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {report.references.confirmes}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {t('consultation.form.statusConfirmed')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {report.references.completes}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {t('consultation.form.statusCompleted')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
