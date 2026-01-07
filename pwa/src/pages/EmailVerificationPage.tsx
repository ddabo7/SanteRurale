import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authService } from '../services/authService'

export const EmailVerificationPage = () => {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null)
  const token = useMemo(() => searchParams.get('token'), [searchParams])

  useEffect(() => {
    let isCancelled = false

    if (!token) {
      setStatus('error')
      setMessage(t('auth.emailVerification.missingToken'))
      return
    }

    const verifyEmail = async () => {
      try {
        const result = await authService.verifyEmail(token)
        if (isCancelled) {
          return
        }
        setStatus('success')
        setMessage(result.message)
      } catch (err) {
        if (isCancelled) {
          return
        }
        setStatus('error')
        console.error('Erreur de vérification:', err)
        const errorMessage = err instanceof Error ? err.message : t('auth.emailVerification.verificationError')
        setMessage(`${errorMessage} ${t('auth.emailVerification.verificationErrorDetails')}`)
      }
    }

    verifyEmail()

    return () => {
      isCancelled = true
    }
  }, [token, t])

  useEffect(() => {
    if (status !== 'success') {
      setRedirectCountdown(null)
      return
    }

    setRedirectCountdown(3)

    const countdownInterval = window.setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev === null) {
          return null
        }
        if (prev <= 1) {
          window.clearInterval(countdownInterval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    const redirectTimeout = window.setTimeout(() => {
      navigate('/login', {
        state: {
          message: t('auth.emailVerification.successMessage')
        }
      })
    }, 3000)

    return () => {
      window.clearInterval(countdownInterval)
      window.clearTimeout(redirectTimeout)
    }
  }, [status, navigate, t])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🏥</div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('auth.emailVerification.title')}
            </h1>
          </div>

          {/* Statut */}
          <div className="text-center">
            {status === 'loading' && (
              <div>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                  <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <p className="text-gray-600">{t('auth.emailVerification.verifying')}</p>
              </div>
            )}

            {status === 'success' && (
              <div>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {t('auth.emailVerification.successTitle')}
                </h2>
                <p className="text-gray-600 mb-4">{message}</p>
                <p className="text-sm text-gray-500 mb-4">
                  {t('auth.emailVerification.redirectMessage')}{redirectCountdown !== null ? ` ${t(redirectCountdown > 1 ? 'auth.emailVerification.redirectCountdownPlural' : 'auth.emailVerification.redirectCountdown', { count: redirectCountdown })}` : '...'}
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                  </svg>
                  {t('auth.emailVerification.goToLogin')}
                </Link>
              </div>
            )}

            {status === 'error' && (
              <div>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {t('auth.emailVerification.errorTitle')}
                </h2>
                <p className="text-gray-600 mb-6">{message}</p>

                <Link
                  to="/login"
                  className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  {t('auth.emailVerification.backToLogin')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
