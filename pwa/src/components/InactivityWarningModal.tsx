import { useTranslation } from 'react-i18next'

interface InactivityWarningModalProps {
  isOpen: boolean
  remainingSeconds: number
  onStayConnected: () => void
  onLogout: () => void
}

export const InactivityWarningModal = ({
  isOpen,
  remainingSeconds,
  onStayConnected,
  onLogout
}: InactivityWarningModalProps) => {
  const { t } = useTranslation()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl animate-pulse">⚠️</div>
            <div>
              <h3 className="text-xl font-bold">{t('auth.inactivityWarning')}</h3>
              <p className="text-sm text-white/90">{t('auth.sessionExpired')}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-100 mb-4">
              <span className="text-4xl font-bold text-orange-600">{remainingSeconds}</span>
            </div>
            <p className="text-gray-700 text-lg">
              {t('auth.inactivityWarningMessage', { seconds: remainingSeconds })}
            </p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onLogout}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-colors"
            >
              {t('auth.logoutNow')}
            </button>
            <button
              onClick={onStayConnected}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold shadow-lg transition-all transform hover:scale-105"
            >
              {t('auth.stayConnected')}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-1000"
            style={{
              width: `${Math.max(0, (remainingSeconds / 60) * 100)}%`
            }}
          />
        </div>
      </div>
    </div>
  )
}
