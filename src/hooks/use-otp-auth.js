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

  const otpInputsRef = useRef([])
  const verifyingRef = useRef(false)
  const webOtpListenRef = useRef(null)

  const widgetId = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID
  const tokenAuth = process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return
    const timer = setTimeout(() => {
      setResendTimer((prev) => prev - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [step, resendTimer])

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
    if (!token || verifyingRef.current) return
    verifyingRef.current = true
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
        trackingService.trackEvent(EVENTS.OTP_VERIFIED, {
          phone_number: backendData.user?.phone || phone,
        })
        trackingService.trackEvent(
          backendData.is_new_user ? EVENTS.ACCOUNT_CREATED : EVENTS.EXISTING_USER_LOGIN,
          {
            phone_number: backendData.user?.phone || phone,
            userId: backendData.user?.id,
          },
        )
        await supabase.auth.setSession({
          access_token: backendData.token,
          refresh_token: backendData.refresh_token,
        })
      }

      setLoading(false)
      verifyingRef.current = false
      onSuccess?.(backendData.user)
    } catch (err) {
      console.error('[OTP Catch Error]:', err)
      setLoading(false)
      setError(err?.message || 'Error verifying OTP with backend.')
      verifyingRef.current = false
    }
  }

  const triggerVerify = (otpCode) => {
    const code = otpCode || otp.join('')
    if (code.length !== 6) {
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
        } else {
          setTimeout(() => {
            if (verifyingRef.current === false && loading) {
              setLoading(false)
              setError('OTP verified, but access token was not returned. Please try resending.')
            }
          }, 2500)
        }
      },
      (err) => {
        setLoading(false)
        const msg = typeof err === 'string' ? err : err?.message
        if (msg && msg !== widgetId && !/^[a-f0-9]{24}$/i.test(msg)) {
          setError(msg || 'Invalid OTP code.')
        } else {
          setError('Invalid OTP code.')
        }
      },
    )
  }

  useEffect(() => {
    if (step !== 2) return
    if (typeof window === 'undefined' || !('OTPCredential' in window)) return

    // navigator.credentials.get() shows a native, user-interactive "Allow
    // Chrome to read the message" prompt the instant it's called, and stays
    // pending until the person actually taps it — which can take several
    // seconds. React Strict Mode's dev-only synchronous mount→cleanup→
    // remount was aborting this a moment after starting it and starting a
    // second one, leaving that already-open prompt bound to the discarded
    // first request — so tapping "Allow" resolved nothing. Reuse a listen
    // that's still alive across that phantom remount instead of restarting
    // it, and only actually cancel it (after a tick, so a same-tick remount
    // can reclaim it) on a real step change or unmount.
    function scheduleCancel() {
      const listen = webOtpListenRef.current
      if (!listen) return
      listen.cancelTimer = setTimeout(() => {
        if (webOtpListenRef.current === listen) {
          webOtpListenRef.current = null
          listen.controller.abort()
        }
      }, 0)
    }

    if (webOtpListenRef.current) {
      clearTimeout(webOtpListenRef.current.cancelTimer)
      return scheduleCancel
    }

    const ac = new AbortController()
    webOtpListenRef.current = { controller: ac, cancelTimer: null }

    navigator.credentials
      .get({
        otp: { transport: ['sms'] },
        signal: ac.signal,
      })
      .then((otpCredential) => {
        webOtpListenRef.current = null
        if (otpCredential?.code) {
          const digits = otpCredential.code.replace(/\D/g, '').slice(0, 6).split('')
          if (digits.length === 6) {
            const newOtp = ['', '', '', '', '', '']
            digits.forEach((d, i) => { newOtp[i] = d })
            setOtp(newOtp)
            triggerVerify(digits.join(''))
          }
        }
      })
      .catch((err) => {
        webOtpListenRef.current = null
        if (err?.name !== 'AbortError') {
          console.log('[WebOTP]:', err)
        }
      })

    return scheduleCancel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, widgetId, tokenAuth])

  const handleSendOtp = async (e) => {
    e?.preventDefault()
    setError('')
    setResending(false)
    setResendCount(0)
    verifyingRef.current = false

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

    try {
      sendOtpFunc(
        `91${cleanPhone}`,
        () => {
          setLoading(false)
          setError('')
          setStep(2)
          setResendTimer(30)
          setResendCount(0)
          setOtp(['', '', '', '', '', ''])
          setTimeout(() => otpInputsRef.current[0]?.focus(), 100)
          trackingService.trackEvent(EVENTS.CLICKED_SEND_OTP, {
            phone_number: cleanPhone,
          })
        },
        (errorRes) => {
          setLoading(false)
          const msg = typeof errorRes === 'string' ? errorRes : errorRes?.message
          if (msg && msg !== widgetId && !/^[a-f0-9]{24}$/i.test(msg)) {
            setError(msg)
          }
        },
      )
    } catch (err) {
      setLoading(false)
      setError(err.message || 'An error occurred sending OTP.')
    }
  }

  const handleResend = async () => {
    if (resending || resendTimer > 0 || resendCount >= 2) return
    setError('')
    setOtp(['', '', '', '', '', ''])
    setResending(true)
    setResendCount((prev) => prev + 1)

    trackingService.trackEvent(EVENTS.CLICKED_RESEND_OTP, { phone_number: phone })

    const cleanPhone = phone.replace(/\D/g, '')
    const sendOtpFunc = window.sendOtp || window.sendOTP

    let callbackCalled = false

    const handleSuccess = () => {
      callbackCalled = true
      setResending(false)
      setError('')
      setResendTimer(30)
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100)
    }

    const handleError = (errorRes) => {
      callbackCalled = true
      setResending(false)
      const msg = typeof errorRes === 'string' ? errorRes : errorRes?.message
      if (msg && msg !== widgetId && !/^[a-f0-9]{24}$/i.test(msg)) {
        setError(msg || 'Failed to resend OTP.')
      }
      if (msg && (msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('max') || msg.toLowerCase().includes('exceed'))) {
        setResendCount(2)
      }
    }

    setTimeout(() => {
      if (!callbackCalled) {
        setResending(false)
      }
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
    const digitsOnly = value.replace(/\D/g, '')

    // Keyboard autofill (iOS/Android "from Messages" suggestion) drops the
    // whole code into whichever box is focused via a normal input event, not
    // a paste event — so it never reaches handlePaste below. Spread it across
    // the remaining boxes instead of keeping only the last digit.
    if (digitsOnly.length > 1) {
      const newOtp = [...otp]
      let cursor = index
      for (const digit of digitsOnly) {
        if (cursor > 5) break
        newOtp[cursor] = digit
        cursor += 1
      }
      setOtp(newOtp)
      otpInputsRef.current[Math.min(cursor, 5)]?.focus()

      const fullCode = newOtp.join('')
      if (fullCode.length === 6) {
        triggerVerify(fullCode)
      }
      return
    }

    const newOtp = [...otp]
    newOtp[index] = digitsOnly
    setOtp(newOtp)

    if (digitsOnly && index < 5) {
      otpInputsRef.current[index + 1]?.focus()
    }

    if (digitsOnly && index === 5) {
      const fullCode = newOtp.join('')
      if (fullCode.length === 6) {
        triggerVerify(fullCode)
      }
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
    setResending(false)
    setResendTimer(30)
    setResendCount(0)
    setOtp(['', '', '', '', '', ''])
    verifyingRef.current = false
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
