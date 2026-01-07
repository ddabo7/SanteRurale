import { useEffect, useRef, useCallback, useState } from 'react'

interface UseInactivityDetectionOptions {
  /**
   * Timeout in milliseconds before showing warning
   * Default: 14 minutes (14 * 60 * 1000)
   */
  warningTimeout?: number
  /**
   * Timeout in milliseconds before auto-logout
   * Default: 15 minutes (15 * 60 * 1000)
   */
  logoutTimeout?: number
  /**
   * Callback to execute when user should be logged out
   */
  onLogout: () => void
  /**
   * Enable/disable the inactivity detection
   * Default: true
   */
  enabled?: boolean
}

export const useInactivityDetection = ({
  warningTimeout = 14 * 60 * 1000, // 14 minutes
  logoutTimeout = 15 * 60 * 1000, // 15 minutes
  onLogout,
  enabled = true
}: UseInactivityDetectionOptions) => {
  const [showWarning, setShowWarning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(60)

  const warningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current)
      warningTimerRef.current = null
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current)
      logoutTimerRef.current = null
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }, [])

  // Start countdown for warning
  const startCountdown = useCallback(() => {
    const warningDuration = logoutTimeout - warningTimeout
    setRemainingSeconds(Math.floor(warningDuration / 1000))

    countdownTimerRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        const newValue = prev - 1
        if (newValue <= 0) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current)
            countdownTimerRef.current = null
          }
        }
        return newValue
      })
    }, 1000)
  }, [logoutTimeout, warningTimeout])

  // Reset all timers and hide warning
  const resetTimers = useCallback(() => {
    clearTimers()
    setShowWarning(false)

    if (!enabled) return

    // Set warning timer
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true)
      startCountdown()
    }, warningTimeout)

    // Set logout timer
    logoutTimerRef.current = setTimeout(() => {
      onLogout()
    }, logoutTimeout)
  }, [enabled, warningTimeout, logoutTimeout, onLogout, clearTimers, startCountdown])

  // Handle user activity
  const handleActivity = useCallback(() => {
    if (showWarning) {
      setShowWarning(false)
    }
    resetTimers()
  }, [showWarning, resetTimers])

  // Dismiss warning and reset
  const dismissWarning = useCallback(() => {
    handleActivity()
  }, [handleActivity])

  // Force logout
  const forceLogout = useCallback(() => {
    clearTimers()
    onLogout()
  }, [clearTimers, onLogout])

  // Setup event listeners
  useEffect(() => {
    if (!enabled) {
      clearTimers()
      setShowWarning(false)
      return
    }

    // List of events to track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // Start timers
    resetTimers()

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
      clearTimers()
    }
  }, [enabled, handleActivity, resetTimers, clearTimers])

  return {
    showWarning,
    remainingSeconds,
    dismissWarning,
    forceLogout
  }
}
