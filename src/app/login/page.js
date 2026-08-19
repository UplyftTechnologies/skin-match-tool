'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiUser, FiArrowLeft } from 'react-icons/fi'
import { FcGoogle } from 'react-icons/fc'
import { supabase } from '@/lib/supabase/client'
import { useOtpAuth } from '@/hooks/use-otp-auth'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'

const benefits = [
  'Save Your Skin Profile',
  'Save Wishlist',
  'Get Price Drop Alert',
]

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'

  const avatarInputRef = useRef(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarError, setAvatarError] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

  useEffect(() => {
    trackingService.trackPageLoad(EVENTS.PAGE_VIEWED_LOGIN, {
      page_type: 'login',
      redirect_to: redirectTo,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const MAX_AVATAR_BYTES = 5 * 1024 * 1024

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Image is larger than 5MB.')
      return
    }

    setAvatarError('')
    setAvatarFile(file)
    setAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const uploadAvatarIfNeeded = async () => {
    if (!avatarFile) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const body = new FormData()
      body.append('file', avatarFile)

      const response = await fetch('/api/auth/upload-avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      })

      if (response.ok) {
        // Pull the updated user_metadata.avatar_url into the client's cached session.
        await supabase.auth.refreshSession()
      } else {
        console.error('[login] Avatar upload failed:', await response.json().catch(() => ({})))
      }
    } catch (err) {
      console.error('[login] Avatar upload failed:', err)
    }
  }

  const {
    step,
    phone,
    setPhone,
    otp,
    loading,
    error,
    resendTimer,
    resending,
    resendCount,
    webOtpStatus,
    otpInputsRef,
    handleSendOtp,
    handleResend,
    handleOtpChange,
    handlePaste,
    triggerVerify,
    resetToPhoneStep,
  } = useOtpAuth({
    active: true,
    onSuccess: async () => {
      await uploadAvatarIfNeeded()
      router.push(redirectTo)
    },
  })

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setGoogleError('')

    const safeRedirect = redirectTo.startsWith('/') && !redirectTo.startsWith('//')
      ? redirectTo
      : '/'

    try {
      trackingService.trackEvent(EVENTS.CLICKED_LOGIN, { method: 'google' })

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(safeRedirect)}`,
        },
      })

      if (oauthError) throw oauthError
    } catch (oauthError) {
      console.error('Google sign-in failed:', oauthError)
      trackingService.trackEvent(EVENTS.GOOGLE_LOGIN_FAILED, {
        method: 'google',
        stage: 'initiate',
        error: oauthError?.message || String(oauthError),
      })
      setGoogleError('Google sign-in is temporarily unavailable. Please use your phone number or try again later.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden bg-[#fffdfa] md:grid md:grid-cols-[minmax(280px,0.85fr)_minmax(420px,1.15fr)] lg:grid-cols-[minmax(340px,0.9fr)_minmax(500px,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-[#171417] px-6 py-8 text-white md:flex md:min-h-screen md:flex-col md:justify-between lg:px-10 lg:py-12 xl:px-16 xl:py-16">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#b852a4]/30 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-28 -right-24 h-96 w-96 rounded-full bg-[#90f5da]/15 blur-3xl" aria-hidden="true" />

        <a href="/" className="relative text-[30px] font-semibold leading-none tracking-[-0.04em]">
          roopsee<span className="text-[#ff00e6]">.</span>
        </a>

        <div className="relative max-w-lg">
          <p className="font-lato text-[10px] font-bold uppercase tracking-[0.24em] text-[#90f5da]">
            Your skin, better understood
          </p>
          <h2 className="mt-5 font-cormorant text-2xl font-medium leading-[1.05] tracking-[-0.035em] lg:text-3xl lg:leading-[0.98] xl:text-4xl">
            Save your profile.<br />Find better <em className="font-normal">matches.</em>
          </h2>
          <p className="mt-6 max-w-md font-lato text-sm leading-7 text-white/60">
            Create a free profile to keep your personalised scores, wishlist and price-drop updates together.
          </p>
        </div>

        <div className="relative flex flex-wrap gap-x-6 gap-y-2 font-lato text-[10px] uppercase tracking-[0.14em] text-white/45">
          {benefits.map((benefit) => <span key={benefit}>{benefit}</span>)}
        </div>
      </aside>

      <div className="absolute left-3 top-3 z-10 sm:left-5 sm:top-5 md:left-auto md:right-6 md:top-6">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/80 text-gray-600 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-gray-900"
        >
          <FiArrowLeft size={20} />
        </button>
      </div>
      <div className="flex min-h-[100svh] items-center justify-center px-3 py-16 sm:px-6 sm:py-20 md:col-start-2 md:row-start-1 md:px-8 lg:px-10 xl:px-16">

      <div className="relative w-full max-w-[430px] rounded-2xl border border-[#eee7e3] bg-white px-5 py-7 shadow-[0_18px_55px_rgba(62,45,57,0.08)] sm:px-9 sm:py-9 md:border-0 md:shadow-none">


        <h2
          style={{ letterSpacing: '0.15em' }}
          className="text-center font-lato text-sm font-semibold uppercase text-gray-900 sm:text-lg"
        >
          Create Profile
        </h2>

        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          aria-label={avatarPreview ? 'Change profile photo' : 'Add profile photo'}
          className="relative mx-auto mt-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-gray-400 transition hover:bg-gray-300 sm:mt-5 sm:h-20 sm:w-20"
        >
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarPreview} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <FiUser className="h-8 w-8 sm:h-10 sm:w-10" />
          )}
          {/* <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#e08a7d] text-white">
            <FiCamera size={12} /> 
          </span> */}
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
        {avatarError ? (
          <p className="mt-2 text-center text-xs font-medium text-red-600" role="alert">{avatarError}</p>
        ) : null}

        {error ? (
          <p className="mt-4 text-center text-xs font-medium text-red-600" role="alert">{error}</p>
        ) : null}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="mt-5 sm:mt-6">
            <label htmlFor="login-phone" className="block text-sm text-gray-700 mb-1">
              Phone number
            </label>
            <div className="flex items-center rounded-lg border border-[#c9dedc] focus-within:border-[#7fb3ab] transition-colors overflow-hidden">
              <span className="flex shrink-0 items-center border-r border-[#c9dedc] bg-[#eef7f6] px-3 py-3 text-sm font-medium text-gray-600">
                +91
              </span>
              <input
                id="login-phone"
                type="tel"
                name="phone"
                autoComplete="tel"
                maxLength="10"
                placeholder="Enter 10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
                autoFocus
                className="min-w-0 flex-1 px-3 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !/^[6-9]\d{9}$/.test(phone)}
              className="mt-5 min-h-11 w-full rounded-[10px] border border-[#e08a7d] px-4 py-2.5 font-lato text-sm capitalize tracking-widest text-[#e16f60] transition-colors duration-300 hover:bg-[#d17a6d] hover:text-white disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? 'Sending OTP…' : 'Get OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); triggerVerify() }} className="mt-5 sm:mt-6">
            <p className="text-center text-sm text-gray-600 mb-3">
              We sent a 6-digit code to +91 {phone}
            </p>
          
            <input
              ref={(el) => (otpInputsRef.current[0] = el)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="6"
              autoComplete="one-time-code"
              name="otp"
              aria-label="6-digit verification code"
              value={otp.join('')}
              onChange={(e) => handleOtpChange(0, e.target.value)}
              onPaste={handlePaste}
              disabled={loading}
              className="h-12 w-full rounded-lg border border-[#c9dedc] px-4 text-center text-xl font-semibold tracking-[0.55em] text-gray-900 transition-colors focus:border-[#7fb3ab] focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
            />

            <div className="mt-3 flex items-center justify-between text-xs">
              {resendCount >= 2 ? (
                <span className="text-amber-600 font-medium">Max resends reached</span>
              ) : resendTimer > 0 ? (
                <span className="text-gray-500 font-medium">Resend code in {resendTimer}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="font-semibold text-[#e08a7d] hover:text-[#d17a6d] disabled:opacity-50 transition-colors"
                >
                  {resending ? 'Sending…' : 'Resend code'}
                </button>
              )}
              <button
                type="button"
                onClick={resetToPhoneStep}
                className="font-semibold text-gray-500 hover:text-gray-700"
              >
                Change number
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || otp.join('').length < 6}
              className="mt-5 w-full rounded-[10px] border border-[#e08a7d] py-2.5 font-lato text-sm capitalize tracking-widest text-[#ff7e67] transition-colors duration-300 hover:bg-[#d17a6d] hover:text-white disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? 'Verifying…' : 'Verify & Continue'}
            </button>
          </form>
        )}
        <div className="my-4 flex items-center gap-3 sm:my-5">
          <span className="h-px flex-1 bg-gray-200" />
          <span className="text-xs uppercase tracking-widest text-gray-400">Or</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
        >
          <FcGoogle size={18} />
          {googleLoading ? 'Connecting to Google…' : 'Continue with Google'}
        </button>
        {googleError ? (
          <p className="mt-3 text-center text-xs font-medium text-red-600" role="alert">
            {googleError}
          </p>
        ) : null}

        <div className="mt-6 grid grid-cols-3 divide-x divide-gray-300 text-center sm:mt-7">
          {benefits.map((benefit) => (
            <p key={benefit} className="px-1.5 text-[9px] leading-tight text-gray-600 min-[360px]:px-2 min-[360px]:text-[10px] sm:text-[11px]">
              {benefit}
            </p>
          ))}
        </div>
      </div>
    </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}
