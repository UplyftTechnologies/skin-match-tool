'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { trackingService } from '@/lib/tracking/trackingClient.js'
import { EVENTS } from '@/lib/tracking/events.js'

const OTP_LENGTH = 6
// How long to wait for the widget's verify callback before releasing the lock.
const VERIFY_WATCHDOG_MS = 10000
// Grace period for a token to arrive via the widget's global success hook
// after a local verify returned none.
const TOKEN_GRACE_MS = 2500

// Shared MSG91-backed phone/OTP flow. `active` controls when the widget
// script loads (mirrors a modal's isOpen, or true for an always-visible page).
//
// `otp` is a single string, not six characters. That is load-bearing: split
// per-digit inputs break iOS QuickType autofill outright, and force every fill
// route to reimplement digit distribution. One field, one funnel (fillOtp).
export function useOtpAuth({ active = true, onSuccess } = {}) {
  const [step, setStep] = useState(1) // 1: Phone, 2: OTP
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(30)
  const [resending, setResending] = useState(false)
  const [resendCount, setResendCount] = useState(0)
  // Last asynchronous thing the WebOTP listener reported. Console logs are
  // unreachable on a phone without USB debugging, so this is surfaced in the UI
  // behind ?otpdebug=1. Resting states are derived near the return.
  const [webotpEvent, setWebotpEvent] = useState('')

  const inputRef = useRef(null)

  // Mirrors of reactive values, so the callbacks below can be created once and
  // still read current data. The WebOTP request stays pending for up to a
  // minute; anything that re-creates it mid-flight kills auto-read.
  const otpRef = useRef('')
  const phoneRef = useRef('')
  const onSuccessRef = useRef(onSuccess)
  const fillOtpRef = useRef(null)

  // Backend verification is in flight.
  const verifyingRef = useRef(false)
  // A session was established. Latched: MSG91 can fire both its global success
  // hook and the local verify callback for one OTP, and verifying twice makes
  // the second attempt fail as an invalid code.
  const succeededRef = useRef(false)
  // Submit lock. A ref, not state: autofill auto-submits at the same moment the
  // user may tap Verify, and a state update is too slow to win that race.
  const verifyLockRef = useRef(false)

  const tokenTimeoutRef = useRef(null)
  const watchdogRef = useRef(null)
  const resendTimeoutRef = useRef(null)

  const widgetId = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID
  const tokenAuth = process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH

  useEffect(() => { otpRef.current = otp }, [otp])
  useEffect(() => { phoneRef.current = phone }, [phone])
  useEffect(() => { onSuccessRef.current = onSuccess }, [onSuccess])

  useEffect(() => () => {
    clearTimeout(tokenTimeoutRef.current)
    clearTimeout(watchdogRef.current)
    clearTimeout(resendTimeoutRef.current)
  }, [])

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return
    const timer = setTimeout(() => setResendTimer((prev) => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [step, resendTimer])

  // Focus once the step-2 layout has settled, or mobile keyboards don't open.
  useEffect(() => {
    if (step !== 2) return
    const timer = setTimeout(() => inputRef.current?.focus(), 250)
    return () => clearTimeout(timer)
  }, [step])

  // MSG91 sometimes passes the widget id (a 24-char hex string) to the failure
  // callback instead of a real message. Filter that out, but always return
  // something printable so a failure can never be silent.
  const widgetErrorMessage = useCallback((errorRes, fallback) => {
    const msg = typeof errorRes === 'string' ? errorRes : errorRes?.message
    if (msg && msg !== widgetId && !/^[a-f0-9]{24}$/i.test(msg)) return msg
    return fallback
  }, [widgetId])

  const releaseLock = useCallback(() => {
    verifyLockRef.current = false
    clearTimeout(watchdogRef.current)
  }, [])

  const extractToken = useCallback((data) => {
    if (!data) return null
    const looksLikeStatus = (value) =>
      value.toLowerCase().includes('success') || value.toLowerCase().includes('verified')

    if (typeof data === 'string') {
      const trimmed = data.trim()
      return trimmed && !looksLikeStatus(trimmed) ? trimmed : null
    }
    const candidate = data['access-token'] || data.accessToken || data.token || data.message || data.data
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed && !looksLikeStatus(trimmed)) return trimmed
    }
    return null
  }, [])

  const handleVerifyWithBackend = useCallback(async (token) => {
    if (!token || verifyingRef.current || succeededRef.current) return
    verifyingRef.current = true
    clearTimeout(tokenTimeoutRef.current)
    clearTimeout(watchdogRef.current)
    setLoading(true)
    setError('')

    try {
      const backendRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token }),
      })

      const text = await backendRes.text()
      let backendData = {}
      try {
        backendData = JSON.parse(text)
      } catch {
        // Non-JSON response (an HTML error page); the check below handles it.
      }

      if (!backendRes.ok || !backendData.success) {
        const errMsg = backendData.error || backendData.message || 'Backend session verification failed.'
        console.error('[OTP Verify Error]:', errMsg)
        setLoading(false)
        setError(typeof errMsg === 'string' ? errMsg : 'Backend session verification failed.')
        verifyingRef.current = false
        releaseLock()
        return
      }

      if (backendData.token && backendData.refresh_token) {
        const phoneNumber = backendData.user?.phone || phoneRef.current
        trackingService.trackEvent(EVENTS.OTP_VERIFIED, { phone_number: phoneNumber })
        trackingService.trackEvent(
          backendData.is_new_user ? EVENTS.ACCOUNT_CREATED : EVENTS.EXISTING_USER_LOGIN,
          { phone_number: phoneNumber, userId: backendData.user?.id },
        )
        await supabase.auth.setSession({
          access_token: backendData.token,
          refresh_token: backendData.refresh_token,
        })
      }

      // Latch before handing control away, and deliberately leave verifyingRef
      // and the lock set so a late duplicate callback cannot re-enter. Both are
      // cleared when a new attempt starts.
      succeededRef.current = true
      clearTimeout(watchdogRef.current)
      setLoading(false)
      onSuccessRef.current?.(backendData.user)
    } catch (err) {
      console.error('[OTP Catch Error]:', err)
      setLoading(false)
      setError(err?.message || 'Error verifying OTP with backend.')
      verifyingRef.current = false
      releaseLock()
    }
  }, [releaseLock])

  const triggerVerify = useCallback((otpCode) => {
    const code = String(otpCode ?? otpRef.current).replace(/\D/g, '')

    if (code.length !== OTP_LENGTH) {
      setError(`Please enter the complete ${OTP_LENGTH}-digit code.`)
      return
    }
    // The lock is what stops autofill's auto-submit and the user's tap from
    // both calling verify: MSG91 consumes the code on the first call and
    // rejects the second as invalid.
    if (verifyLockRef.current || verifyingRef.current || succeededRef.current) return

    const verifyFunc = window.verifyOtp || window.verifyOTP
    if (!verifyFunc) {
      setError('OTP verification handler unavailable.')
      return
    }

    verifyLockRef.current = true
    setLoading(true)
    setError('')

    // Provider callbacks can silently never fire; never strand the user.
    clearTimeout(watchdogRef.current)
    watchdogRef.current = setTimeout(() => {
      if (verifyingRef.current || succeededRef.current) return
      releaseLock()
      setLoading(false)
      setError('Verification timed out. Please try again or resend the code.')
    }, VERIFY_WATCHDOG_MS)

    verifyFunc(
      code,
      (res) => {
        const token = extractToken(res)
        if (token) {
          handleVerifyWithBackend(token)
          return
        }
        // No token locally. The widget's global success hook may still deliver
        // one, so allow a short grace period before giving up. Checked via refs
        // rather than `loading`, which would be the value captured before
        // setLoading(true) above and so always stale.
        clearTimeout(tokenTimeoutRef.current)
        tokenTimeoutRef.current = setTimeout(() => {
          if (verifyingRef.current || succeededRef.current) return
          releaseLock()
          setLoading(false)
          setError('OTP verified, but access token was not returned. Please try resending.')
        }, TOKEN_GRACE_MS)
      },
      (err) => {
        // A failure fired after the global hook already produced a token is
        // noise; don't clobber a verification already under way.
        if (verifyingRef.current || succeededRef.current) return
        releaseLock()
        setLoading(false)
        setError(widgetErrorMessage(err, 'Invalid OTP code.'))
      },
    )
  }, [extractToken, handleVerifyWithBackend, releaseLock, widgetErrorMessage])

  // The single funnel every fill route goes through: typing, paste, iOS
  // QuickType and Android WebOTP.
  const fillOtp = useCallback((rawValue, shouldVerify = false) => {
    const digits = String(rawValue || '').replace(/\D/g, '').slice(0, OTP_LENGTH)
    otpRef.current = digits
    setOtp(digits)
    setError('')

    if (shouldVerify && digits.length === OTP_LENGTH) {
      // Let React paint the filled code before the UI flips to "Verifying...",
      // and pass the digits explicitly so no stale state is read.
      setTimeout(() => triggerVerify(digits), 100)
    }
  }, [triggerVerify])

  useEffect(() => { fillOtpRef.current = fillOtp }, [fillOtp])

  const handleOtpChange = useCallback((eventOrValue) => {
    const raw = typeof eventOrValue === 'string' ? eventOrValue : eventOrValue?.target?.value
    const digits = String(raw || '').replace(/\D/g, '').slice(0, OTP_LENGTH)
    fillOtp(digits, digits.length === OTP_LENGTH)
  }, [fillOtp])

  const handlePaste = useCallback((e) => {
    const text = e.clipboardData?.getData('text') || ''
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!digits) return
    e.preventDefault()
    fillOtp(digits, digits.length === OTP_LENGTH)
  }, [fillOtp])

  // ---- Android WebOTP -----------------------------------------------------
  // Empty deps are load-bearing. credentials.get() stays pending for up to a
  // minute waiting for the SMS; if anything re-runs this effect in that window
  // the request is torn down, and the user taps Chrome's prompt to no effect.
  // The latest callback is reached through fillOtpRef instead of a dependency.
  //
  // Requirements that cannot be satisfied from here: Chromium on Android, a
  // secure top-level context, and an SMS whose LAST line is exactly
  // `@<host> #<code>` with the host matching this page's origin. That last one
  // lives in the MSG91 template.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('OTPCredential' in window) || !navigator.credentials) return
    if (!window.isSecureContext) return

    const abortController = new AbortController()
    let stopped = false

    const arm = () => {
      navigator.credentials
        .get({ otp: { transport: ['sms'] }, signal: abortController.signal })
        .then((credential) => {
          if (stopped) return
          const raw = String(credential?.code ?? '')
          const code = raw.replace(/\D/g, '').slice(0, OTP_LENGTH)
          console.log('[WebOTP] credential received:', JSON.stringify(raw), '->', code)

          if (!code) {
            setWebotpEvent('credential arrived with no digits - check the "#code" in the SMS template')
            return
          }

          setWebotpEvent(`received "${code}" (${code.length} digits)`)
          fillOtpRef.current?.(code, code.length === OTP_LENGTH)
          // Re-arm so a resent code is auto-read too. Only after a real code,
          // otherwise a null resolution would spin.
          arm()
        })
        .catch((err) => {
          if (stopped || err?.name === 'AbortError') return
          console.warn('[WebOTP] failed:', err?.name, err?.message)
          setWebotpEvent(`failed: ${err?.name} - ${err?.message}`)
        })
    }

    arm()

    return () => {
      stopped = true
      abortController.abort()
    }
  }, [])

  // ---- MSG91 widget -------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined' || !active) return

    const scriptId = 'msg91-otp-script'
    let script = document.getElementById(scriptId)

    const initWidget = () => {
      if (!window.initSendOTP || !widgetId || !tokenAuth) return
      try {
        window.initSendOTP({
          widgetId,
          tokenAuth,
          exposeMethods: true,
          success: (data) => {
            const token = extractToken(data)
            if (token) handleVerifyWithBackend(token)
          },
          failure: (err) => {
            if (err?.code === 703 || err?.message?.toLowerCase()?.includes('already verif')) return
            console.error('MSG91 Widget failure:', err)
          },
        })
      } catch (err) {
        console.error('Failed to initialize MSG91 widget:', err)
      }
    }

    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://verify.msg91.com/otp-provider.js'
      script.async = true
      script.onload = initWidget
      script.onerror = () => setError('Failed to load login verification widget.')
      document.body.appendChild(script)
    } else {
      initWidget()
    }
  }, [active, widgetId, tokenAuth, extractToken, handleVerifyWithBackend])

  const handleSendOtp = async (e) => {
    e?.preventDefault()
    setError('')
    setResending(false)
    setResendCount(0)
    verifyingRef.current = false
    succeededRef.current = false
    verifyLockRef.current = false
    clearTimeout(tokenTimeoutRef.current)
    clearTimeout(watchdogRef.current)

    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.')
      return
    }

    const sendOtpFunc = window.sendOtp || window.sendOTP
    if (!sendOtpFunc) {
      setError('OTP Service is still loading. Please wait a moment and try again.')
      return
    }

    setLoading(true)
    let sent = false

    try {
      sendOtpFunc(
        `91${cleanPhone}`,
        () => {
          sent = true
          setLoading(false)
          setError('')
          setStep(2)
          setResendTimer(30)
          setResendCount(0)
          fillOtp('')
          setWebotpEvent('')
          trackingService.trackEvent(EVENTS.CLICKED_SEND_OTP, { phone_number: cleanPhone })
        },
        (errorRes) => {
          // MSG91 can fire failure *after* a successful send; ignore that so a
          // working flow isn't overwritten with an error.
          if (sent) return
          setLoading(false)
          setError(widgetErrorMessage(errorRes, 'Could not send OTP. Please try again.'))
        },
      )
    } catch (err) {
      setLoading(false)
      setError(err?.message || 'An error occurred sending OTP.')
    }
  }

  const handleResend = async () => {
    if (resending || resendTimer > 0 || resendCount >= 2) return
    setError('')
    fillOtp('')
    setWebotpEvent('')
    setResending(true)
    verifyLockRef.current = false
    verifyingRef.current = false

    trackingService.trackEvent(EVENTS.CLICKED_RESEND_OTP, { phone_number: phone })

    const cleanPhone = phone.replace(/\D/g, '')
    const sendOtpFunc = window.sendOtp || window.sendOTP
    let settled = false

    const handleSuccess = () => {
      if (settled) return
      settled = true
      clearTimeout(resendTimeoutRef.current)
      setResending(false)
      setError('')
      setResendTimer(30)
      // Counted only on a confirmed resend, so a failed attempt doesn't burn
      // one of the two the user is allowed.
      setResendCount((prev) => prev + 1)
      setTimeout(() => inputRef.current?.focus(), 100)
    }

    const handleError = (errorRes) => {
      if (settled) return
      settled = true
      clearTimeout(resendTimeoutRef.current)
      setResending(false)
      setError(widgetErrorMessage(errorRes, 'Failed to resend OTP.'))
      const msg = typeof errorRes === 'string' ? errorRes : errorRes?.message
      if (msg && /limit|max|exceed/i.test(msg)) setResendCount(2)
    }

    // Safety net for a widget that never calls back: re-enable the button
    // without claiming success or failure, since we can't tell which.
    clearTimeout(resendTimeoutRef.current)
    resendTimeoutRef.current = setTimeout(() => {
      if (!settled) setResending(false)
    }, 4000)

    try {
      if (typeof window.retryOtp === 'function') {
        try {
          // MSG91's signature is retryOtp(channel, onSuccess, onFailure); null
          // means "use the widget's configured default". Passing the callbacks
          // first put them in the wrong positions entirely.
          window.retryOtp(null, handleSuccess, handleError)
        } catch {
          if (sendOtpFunc) sendOtpFunc(`91${cleanPhone}`, handleSuccess, handleError)
          else handleError('Failed to resend OTP.')
        }
      } else if (sendOtpFunc) {
        sendOtpFunc(`91${cleanPhone}`, handleSuccess, handleError)
      } else {
        handleError('Resend service not available.')
      }
    } catch (err) {
      console.error('Resend failed:', err)
      handleError(err?.message || 'Failed to resend OTP.')
    }
  }

  const resetToPhoneStep = () => {
    setStep(1)
    setError('')
    setLoading(false)
    setResending(false)
    setResendTimer(30)
    setResendCount(0)
    fillOtp('')
    setWebotpEvent('')
    verifyingRef.current = false
    succeededRef.current = false
    verifyLockRef.current = false
    clearTimeout(tokenTimeoutRef.current)
    clearTimeout(watchdogRef.current)
    clearTimeout(resendTimeoutRef.current)
  }

  // Resting states are derived rather than stored: setState called
  // synchronously inside an effect body triggers cascading renders.
  const webotpStatus =
    webotpEvent ||
    (step !== 2 || typeof window === 'undefined'
      ? 'idle'
      : !('OTPCredential' in window)
        ? 'unsupported: no OTPCredential (needs Chromium on Android)'
        : !window.isSecureContext
          ? 'unsupported: not a secure context'
          : 'armed: waiting for SMS')

  return {
    step,
    phone,
    setPhone,
    otp,
    otpLength: OTP_LENGTH,
    loading,
    error,
    resendTimer,
    resending,
    resendCount,
    inputRef,
    handleSendOtp,
    handleResend,
    handleOtpChange,
    handlePaste,
    triggerVerify,
    resetToPhoneStep,
    webotpStatus,
  }
}
