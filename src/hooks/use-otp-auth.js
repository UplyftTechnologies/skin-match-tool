'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { trackingService } from '@/lib/tracking/trackingClient.js'
import { EVENTS } from '@/lib/tracking/events.js'

// Shared MSG91-backed phone/OTP flow. `active` controls when the widget
// script loads (mirrors a modal's isOpen, or true for an always-visible page).
export function useOtpAuth({ active = true, onSuccess } = {}) {
  const [step, setStep] = useState(1) // 1: Phone, 2: OTP
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(30)
  const [resending, setResending] = useState(false)
  const [resendCount, setResendCount] = useState(0)
  // Bumped once per confirmed SMS, to re-arm the WebOTP listener.
  const [smsNonce, setSmsNonce] = useState(0)

  const otpInputsRef = useRef([])
  const verifyingRef = useRef(false)
  // Latches once a session has been established. MSG91 can invoke both its
  // global success callback and the local verify callback for the same OTP, so
  // without this the second one re-runs the backend verify and fires onSuccess
  // (and setSession) twice.
  const succeededRef = useRef(false)
  const tokenTimeoutRef = useRef(null)
  const resendTimeoutRef = useRef(null)

  // The widget's global success handler is registered once, so anything it
  // closes over is frozen at that render. Mirror the values it needs in refs.
  const phoneRef = useRef('')
  const onSuccessRef = useRef(onSuccess)

  const widgetId = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID
  const tokenAuth = process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH

  useEffect(() => {
    phoneRef.current = phone
  }, [phone])

  useEffect(() => {
    onSuccessRef.current = onSuccess
  }, [onSuccess])

  useEffect(() => () => {
    clearTimeout(tokenTimeoutRef.current)
    clearTimeout(resendTimeoutRef.current)
  }, [])

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return
    const timer = setTimeout(() => {
      setResendTimer((prev) => prev - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [step, resendTimer])

  // MSG91 sometimes passes the widget id (a 24-char hex string) to the failure
  // callback instead of a real message. Filter that out, but always return
  // something printable so a failure can never be silent.
  const widgetErrorMessage = (errorRes, fallback) => {
    const msg = typeof errorRes === 'string' ? errorRes : errorRes?.message
    if (msg && msg !== widgetId && !/^[a-f0-9]{24}$/i.test(msg)) return msg
    return fallback
  }

  const extractToken = (data) => {
    if (!data) return null
    if (typeof data === 'string') {
      const trimmed = data.trim()
      if (trimmed && !trimmed.toLowerCase().includes('success') && !trimmed.toLowerCase().includes('verified')) {
        return trimmed
      }
      return null
    }
    const candidate = data['access-token'] || data.accessToken || data.token || data.message || data.data
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed && !trimmed.toLowerCase().includes('success') && !trimmed.toLowerCase().includes('verified')) {
        return trimmed
      }
    }
    return null
  }

  const handleVerifyWithBackend = async (token) => {
    if (!token || verifyingRef.current || succeededRef.current) return
    verifyingRef.current = true
    clearTimeout(tokenTimeoutRef.current)
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
        // Fallback for non-JSON responses (HTML error pages)
      }

      if (!backendRes.ok || !backendData.success) {
        const errMsg = backendData.error || backendData.message || 'Backend session verification failed.'
        console.error('[OTP Verify Error]:', errMsg)
        setLoading(false)
        setError(typeof errMsg === 'string' ? errMsg : 'Backend session verification failed.')
        verifyingRef.current = false
        return
      }

      if (backendData.token && backendData.refresh_token) {
        const phoneNumber = backendData.user?.phone || phoneRef.current
        trackingService.trackEvent(EVENTS.OTP_VERIFIED, {
          phone_number: phoneNumber,
        })
        trackingService.trackEvent(
          backendData.is_new_user ? EVENTS.ACCOUNT_CREATED : EVENTS.EXISTING_USER_LOGIN,
          {
            phone_number: phoneNumber,
            userId: backendData.user?.id,
          },
        )
        await supabase.auth.setSession({
          access_token: backendData.token,
          refresh_token: backendData.refresh_token,
        })
      }

      // Latch before handing control away, and deliberately leave verifyingRef
      // set: a late duplicate callback must not be able to re-enter. Both are
      // cleared by handleSendOtp / resetToPhoneStep when a new attempt starts.
      succeededRef.current = true
      setLoading(false)
      onSuccessRef.current?.(backendData.user)
    } catch (err) {
      console.error('[OTP Catch Error]:', err)
      setLoading(false)
      setError(err?.message || 'Error verifying OTP with backend.')
      verifyingRef.current = false
    }
  }

  const triggerVerify = (otpCode) => {
    const code = otpCode || otp.join('')
    if (!/^\d{6}$/.test(code)) {
      setError('Please enter complete 6-digit OTP.')
      return
    }

    const verifyFunc = window.verifyOtp || window.verifyOTP

    if (!verifyFunc) {
      setError('OTP verification handler unavailable.')
      return
    }

    setLoading(true)
    setError('')

    verifyFunc(
      code,
      (res) => {
        console.log('[MSG91 Local Verify Res]:', res)
        const token = extractToken(res)
        if (token) {
          handleVerifyWithBackend(token)
          return
        }
        // No token in the local response. The widget's global success callback
        // may still deliver one, so wait briefly before giving up. This has to
        // test refs, not `loading`: that would be the value captured before the
        // setLoading(true) above, so it always read false and this branch never
        // fired, leaving the spinner stuck forever.
        clearTimeout(tokenTimeoutRef.current)
        tokenTimeoutRef.current = setTimeout(() => {
          if (verifyingRef.current || succeededRef.current) return
          setLoading(false)
          setError('OTP verified, but access token was not returned. Please try resending.')
        }, 2500)
      },
      (err) => {
        // A failure fired after the global callback already got a token is
        // noise -- don't clobber a verification that is under way.
        if (verifyingRef.current || succeededRef.current) return
        setLoading(false)
        setError(widgetErrorMessage(err, 'Invalid OTP code.'))
      },
    )
  }

  // WebOTP auto-read. Requirements that are NOT satisfiable from here:
  //   * Chromium on Android only -- iOS Safari and every desktop browser lack
  //     the API entirely, so `OTPCredential in window` is false and this is a
  //     no-op. Those platforms fall back to keyboard autofill via the inputs'
  //     autocomplete="one-time-code".
  //   * A secure context in a top-level frame (not an iframe).
  //   * The SMS body MUST end with a line of exactly `@<host> #<code>`, where
  //     the host matches this page's origin. Without that binding line the
  //     promise below simply never resolves. That lives in the MSG91 template.
  //
  // `smsNonce` re-arms the listener after each confirmed send. credentials.get()
  // settles once, so without this auto-read was dead for every code after the
  // first. It is a dedicated counter rather than `resendCount` so that
  // unrelated state (a rate-limit clamp, a reset) can't tear down a live
  // request mid-prompt.
  useEffect(() => {
    if (step !== 2) return
    if (typeof window === 'undefined' || !('OTPCredential' in window)) return

    const ac = new AbortController()
    let cancelled = false

    navigator.credentials
      .get({
        otp: { transport: ['sms'] },
        signal: ac.signal,
      })
      .then((otpCredential) => {
        if (cancelled) return

        const raw = String(otpCredential?.code ?? '')
        const digits = raw.replace(/\D/g, '').slice(0, 6)
        console.log('[WebOTP] credential received:', JSON.stringify(raw), '->', digits)

        if (!digits) {
          console.warn('[WebOTP] credential carried no digits — check the "#code" part of the SMS template')
          return
        }

        // Insert whatever arrived. The old code required exactly six digits and
        // did nothing otherwise, so a short or padded code vanished with no
        // error and no filled boxes.
        const next = ['', '', '', '', '', '']
        digits.split('').forEach((digit, i) => { next[i] = digit })
        setOtp(next)
        otpInputsRef.current[Math.min(digits.length, 5)]?.focus()

        if (digits.length === 6) {
          triggerVerify(digits)
        } else {
          console.warn(`[WebOTP] expected 6 digits, got ${digits.length} — filled but not submitted`)
        }
      })
      .catch((err) => {
        // AbortError used to be swallowed entirely, which hid the most likely
        // failure: the request being torn down (remount / step change) while
        // the user was still looking at Chrome's "Allow" prompt. Tapping Allow
        // then resolves nothing, so no digits ever appear.
        if (err?.name === 'AbortError') {
          console.warn('[WebOTP] request aborted before the code was delivered')
          return
        }
        console.warn('[WebOTP] failed:', err?.name, err?.message)
      })

    return () => {
      cancelled = true
      ac.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, smsNonce])

  useEffect(() => {
    if (typeof window === 'undefined' || !active) return

    const scriptId = 'msg91-otp-script'
    let script = document.getElementById(scriptId)

    const initWidget = () => {
      if (window.initSendOTP && widgetId && tokenAuth) {
        try {
          window.initSendOTP({
            widgetId: widgetId,
            tokenAuth: tokenAuth,
            exposeMethods: true,
            success: (data) => {
              console.log('[MSG91 Global Success]:', data)
              const token = extractToken(data)
              if (token) {
                handleVerifyWithBackend(token)
              }
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
  }, [active, widgetId, tokenAuth])

  const handleSendOtp = async (e) => {
    e?.preventDefault()
    setError('')
    setResending(false)
    setResendCount(0)
    verifyingRef.current = false
    succeededRef.current = false
    clearTimeout(tokenTimeoutRef.current)

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
          setOtp(['', '', '', '', '', ''])
          setSmsNonce((prev) => prev + 1)
          setTimeout(() => otpInputsRef.current[0]?.focus(), 100)
          trackingService.trackEvent(EVENTS.CLICKED_SEND_OTP, {
            phone_number: cleanPhone,
          })
        },
        (errorRes) => {
          // MSG91 can fire failure *after* a successful send; ignore that so a
          // working flow isn't overwritten with an error.
          if (sent) return
          setLoading(false)
          // Always surface something: previously an error object without a
          // string `.message` set no error at all, so the button just un-span
          // and the user got no feedback whatsoever.
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
    setOtp(['', '', '', '', '', ''])
    setResending(true)

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
      setSmsNonce((prev) => prev + 1)
      // Counted only on a confirmed resend, so a failed attempt doesn't burn
      // one of the two the user is allowed.
      setResendCount((prev) => prev + 1)
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100)
    }

    const handleError = (errorRes) => {
      if (settled) return
      settled = true
      clearTimeout(resendTimeoutRef.current)
      setResending(false)
      setError(widgetErrorMessage(errorRes, 'Failed to resend OTP.'))
      const msg = typeof errorRes === 'string' ? errorRes : errorRes?.message
      if (msg && /limit|max|exceed/i.test(msg)) {
        setResendCount(2)
      }
    }

    // Safety net for a widget that never calls back at all: re-enable the
    // button without claiming success or failure, since we can't tell which.
    clearTimeout(resendTimeoutRef.current)
    resendTimeoutRef.current = setTimeout(() => {
      if (!settled) setResending(false)
    }, 4000)

    try {
      if (typeof window.retryOtp === 'function') {
        try {
          window.retryOtp(handleSuccess, handleError)
        } catch {
          if (sendOtpFunc) {
            sendOtpFunc(`91${cleanPhone}`, handleSuccess, handleError)
          } else {
            handleError('Failed to resend OTP.')
          }
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

  const handleOtpChange = (index, value) => {
    // isNaN('') and isNaN(' ') are both false, so the old check let a space
    // through as a digit and auto-submitted a code containing whitespace.
    // Empty still has to pass -- clearing a box depends on it.
    if (value !== '' && !/^\d+$/.test(value)) return

    const newOtp = [...otp]

    if (value.length > 1) {
      // Browser autofill (Chrome's one-time-code suggestion, iOS's keyboard
      // suggestion, or a paste onto a single box) delivers the WHOLE code to
      // one input, bypassing maxLength. The old `value.substring(length - 1)`
      // kept only the last character, so an auto-read 6-digit code landed as a
      // single digit. Spread it across the boxes instead. Typed input can never
      // reach here: maxLength="1" caps it at one character.
      const digits = value.replace(/\D/g, '').slice(0, 6 - index).split('')
      digits.forEach((digit, offset) => {
        newOtp[index + offset] = digit
      })
      setOtp(newOtp)
      otpInputsRef.current[Math.min(index + digits.length, 5)]?.focus()
    } else {
      newOtp[index] = value
      setOtp(newOtp)
      if (value && index < 5) {
        otpInputsRef.current[index + 1]?.focus()
      }
    }

    // Submit as soon as all six boxes hold a digit, wherever the fill started.
    // Keying off `index === 5` alone missed autofill, which completes the code
    // from box 0.
    const fullCode = newOtp.join('')
    if (/^\d{6}$/.test(fullCode)) {
      triggerVerify(fullCode)
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasteData = e.clipboardData.getData('text').trim().replace(/\D/g, '')
    if (pasteData.length > 0) {
      const digits = pasteData.slice(0, 6).split('')
      const newOtp = ['', '', '', '', '', '']
      digits.forEach((digit, i) => {
        newOtp[i] = digit
      })
      setOtp(newOtp)
      const nextFocus = Math.min(digits.length, 5)
      otpInputsRef.current[nextFocus]?.focus()
      if (digits.length === 6) {
        triggerVerify(digits.join(''))
      }
    }
  }

  const resetToPhoneStep = () => {
    setStep(1)
    setError('')
    setLoading(false)
    setResending(false)
    setResendTimer(30)
    setResendCount(0)
    setOtp(['', '', '', '', '', ''])
    verifyingRef.current = false
    succeededRef.current = false
    clearTimeout(tokenTimeoutRef.current)
    clearTimeout(resendTimeoutRef.current)
  }

  return {
    step,
    phone,
    setPhone,
    otp,
    loading,
    error,
    resendTimer,
    resending,
    resendCount,
    otpInputsRef,
    handleSendOtp,
    handleResend,
    handleOtpChange,
    handleKeyDown,
    handlePaste,
    triggerVerify,
    resetToPhoneStep,
  }
}
