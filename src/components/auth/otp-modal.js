'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { trackingService } from '@/lib/tracking/trackingClient.js';
import { EVENTS } from '@/lib/tracking/events.js';

export default function OtpModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const [resending, setResending] = useState(false);
  const [resendCount, setResendCount] = useState(0);

  const otpInputsRef = useRef([]);
  const verifyingRef = useRef(false);

  const widgetId = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID;
  const tokenAuth = process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH;

  // Resend OTP countdown timer effect
  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return;
    const timer = setTimeout(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [step, resendTimer]);

  useEffect(() => {
    if (step !== 2) return;
    if (typeof window === 'undefined' || !('OTPCredential' in window)) return;

    const ac = new AbortController();

    navigator.credentials
      .get({
        otp: { transport: ['sms'] },
        signal: ac.signal,
      })
      .then((otpCredential) => {
        if (otpCredential?.code) {
          const digits = otpCredential.code.replace(/\D/g, '').slice(0, 6).split('');
          if (digits.length === 6) {
            const newOtp = ['', '', '', '', '', ''];
            digits.forEach((d, i) => { newOtp[i] = d; });
            setOtp(newOtp);
            triggerVerify(digits.join(''));
          }
        }
      })
      .catch((err) => {
        // AbortError is expected on cleanup/unmount, safe to ignore
        if (err?.name !== 'AbortError') {
          console.log('[WebOTP]:', err);
        }
      });

    return () => ac.abort();
  }, [step]);


  // Helper to extract clean token from MSG91 responses
  const extractToken = (data) => {
    if (!data) return null;
    if (typeof data === 'string') {
      const trimmed = data.trim();
      if (trimmed && !trimmed.toLowerCase().includes('success') && !trimmed.toLowerCase().includes('verified')) {
        return trimmed;
      }
      return null;
    }
    const candidate = data['access-token'] || data.accessToken || data.token || data.message || data.data;
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed && !trimmed.toLowerCase().includes('success') && !trimmed.toLowerCase().includes('verified')) {
        return trimmed;
      }
    }
    return null;
  };

  const handleVerifyWithBackend = async (token) => {
    if (!token || verifyingRef.current) return;
    verifyingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const backendRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token }),
      });

      const text = await backendRes.text();
      let backendData = {};
      try {
        backendData = JSON.parse(text);
      } catch {
        // Fallback for non-JSON responses (HTML error pages)
      }

      if (!backendRes.ok || !backendData.success) {
        const errMsg = backendData.error || backendData.message || 'Backend session verification failed.';
        console.error('[OTP Verify Error]:', errMsg);
        setLoading(false);
        setError(typeof errMsg === 'string' ? errMsg : 'Backend session verification failed.');
        verifyingRef.current = false;
        return;
      }

      // Set Supabase session on client
      if (backendData.token && backendData.refresh_token) {
        trackingService.trackEvent(EVENTS.OTP_VERIFIED, {
          phone_number: backendData.user?.phone || phone,
        });
        await supabase.auth.setSession({
          access_token: backendData.token,
          refresh_token: backendData.refresh_token,
        });
      }

      setLoading(false);
      verifyingRef.current = false;
      if (onSuccess) {
        onSuccess(backendData.user);
      } else {
        onClose?.();
      }
    } catch (err) {
      console.error('[OTP Catch Error]:', err);
      setLoading(false);
      setError(err?.message || 'Error verifying OTP with backend.');
      verifyingRef.current = false;
    }
  };

  // Load & initialize MSG91 Widget script dynamically
  useEffect(() => {

    if (typeof window === 'undefined' || !isOpen) return;

    const scriptId = 'msg91-otp-script';
    let script = document.getElementById(scriptId);

    const initWidget = () => {
      if (window.initSendOTP && widgetId && tokenAuth) {
        try {
          window.initSendOTP({
            widgetId: widgetId,
            tokenAuth: tokenAuth,
            exposeMethods: true,
            success: (data) => {
              console.log('[MSG91 Global Success]:', data);
              const token = extractToken(data);
              if (token) {
                handleVerifyWithBackend(token);
              }
            },
            failure: (err) => {
              if (err?.code === 703 || err?.message?.toLowerCase()?.includes('already verif')) return;
              console.error('MSG91 Widget failure:', err);
            },
          });
        } catch (err) {
          console.error('Failed to initialize MSG91 widget:', err);
        }
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://verify.msg91.com/otp-provider.js';
      script.async = true;
      script.onload = initWidget;
      script.onerror = () => setError('Failed to load login verification widget.');
      document.body.appendChild(script);
    } else {
      initWidget();
    }
  }, [isOpen, widgetId, tokenAuth]);

  useEffect(() => {
    if (isOpen) {
      trackingService.trackEvent(EVENTS.LOGIN_POPUP_SHOWN);
    }
  }, [isOpen]);
  // Handle Send OTP
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setError('');
    setResending(false);
    setResendCount(0);
    verifyingRef.current = false;

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    const sendOtpFunc = window.sendOtp || window.sendOTP;

    if (!sendOtpFunc) {
      setError('OTP Service is still loading. Please wait a moment and try again.');
      return;
    }

    setLoading(true);

    try {
      sendOtpFunc(
        `91${cleanPhone}`,
        () => {
          setLoading(false);
          setError('');
          setStep(2);
          setResendTimer(30);
          setResendCount(0);
          setOtp(['', '', '', '', '', '']);
          setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
          trackingService.trackEvent(EVENTS.CLICKED_SEND_OTP, {
            phone_number: cleanPhone,
          });
        },
        (errorRes) => {
          setLoading(false);
          const msg = typeof errorRes === 'string' ? errorRes : errorRes?.message;
          if (msg && msg !== widgetId && !/^[a-f0-9]{24}$/i.test(msg)) {
            setError(msg);
          }
        }
      );
    } catch (err) {
      setLoading(false);
      setError(err.message || 'An error occurred sending OTP.');
    }
  };

  // Handle Resend OTP matching skinmeta
  const handleResend = async () => {
    if (resending || resendTimer > 0 || resendCount >= 2) return;
    setError('');
    setOtp(['', '', '', '', '', '']);
    setResending(true);
    setResendCount((prev) => prev + 1);

    trackingService.trackEvent(EVENTS.CLICKED_RESEND_OTP, { phone_number: phone });

    const cleanPhone = phone.replace(/\D/g, '');
    const sendOtpFunc = window.sendOtp || window.sendOTP;

    let callbackCalled = false;

    const handleSuccess = () => {
      callbackCalled = true;
      setResending(false);
      setError('');
      setResendTimer(30);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
    };

    const handleError = (errorRes) => {
      callbackCalled = true;
      setResending(false);
      const msg = typeof errorRes === 'string' ? errorRes : errorRes?.message;
      if (msg && msg !== widgetId && !/^[a-f0-9]{24}$/i.test(msg)) {
        setError(msg || 'Failed to resend OTP.');
      }
      if (msg && (msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('max') || msg.toLowerCase().includes('exceed'))) {
        setResendCount(2);
      }
    };

    // Safety fallback: if MSG91 SDK callback doesn't respond in 4s, unlock resending
    setTimeout(() => {
      if (!callbackCalled) {
        setResending(false);
      }
    }, 4000);

    try {
      if (typeof window.retryOtp === 'function') {
        try {
          window.retryOtp(handleSuccess, handleError);
        } catch {
          if (sendOtpFunc) {
            sendOtpFunc(`91${cleanPhone}`, handleSuccess, handleError);
          } else {
            handleError('Failed to resend OTP.');
          }
        }
      } else if (sendOtpFunc) {
        sendOtpFunc(`91${cleanPhone}`, handleSuccess, handleError);
      } else {
        handleError('Resend service not available.');
      }
    } catch (err) {
      console.error('Resend failed:', err);
      handleError(err?.message || 'Failed to resend OTP.');
    }
  };

  // Handle Input Changes
  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }

    if (value && index === 5) {
      const fullCode = newOtp.join('');
      if (fullCode.length === 6) {
        triggerVerify(fullCode);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim().replace(/\D/g, '');
    if (pasteData.length > 0) {
      const digits = pasteData.slice(0, 6).split('');
      const newOtp = ['', '', '', '', '', ''];
      digits.forEach((digit, i) => {
        newOtp[i] = digit;
      });
      setOtp(newOtp);
      const nextFocus = Math.min(digits.length, 5);
      otpInputsRef.current[nextFocus]?.focus();
      if (digits.length === 6) {
        triggerVerify(digits.join(''));
      }
    }
  };

  const triggerVerify = (otpCode) => {
    const code = otpCode || otp.join('');
    if (code.length !== 6) {
      setError('Please enter complete 6-digit OTP.');
      return;
    }

    const verifyFunc = window.verifyOtp || window.verifyOTP;

    if (!verifyFunc) {
      setError('OTP verification handler unavailable.');
      return;
    }

    setLoading(true);
    setError('');

    verifyFunc(
      code,
      (res) => {
        console.log('[MSG91 Local Verify Res]:', res);
        const token = extractToken(res);
        if (token) {
          handleVerifyWithBackend(token);
        } else {
          // If no token inline, wait 2.5s for global callback, otherwise clear loading
          setTimeout(() => {
            if (verifyingRef.current === false && loading) {
              setLoading(false);
              setError('OTP verified, but access token was not returned. Please try resending.');
            }
          }, 2500);
        }
      },
      (err) => {
        setLoading(false);
        const msg = typeof err === 'string' ? err : err?.message;
        if (msg && msg !== widgetId && !/^[a-f0-9]{24}$/i.test(msg)) {
          setError(msg || 'Invalid OTP code.');
        } else {
          setError('Invalid OTP code.');
        }
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="otp-modal-overlay">
      <div className="otp-modal-container">
        <div className="otp-modal-content">
          <div className="otp-modal-header">
            <h3>{step === 1 ? 'Verify Your Mobile' : 'Enter Verification Code'}</h3>
            <p>
              {step === 1
                ? 'Enter your mobile number to unlock your personalized skin match routine & save results.'
                : `We sent a 6-digit code to +91 ${phone}`}
            </p>
          </div>

          {error && <div className="otp-error-alert">{error}</div>}

          {step === 1 ? (
            <form onSubmit={handleSendOtp} className="otp-form">
              <div className="flex items-center rounded-lg border border-gray-300 focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-100 transition-colors overflow-hidden">
                <span className="flex items-center px-3 sm:px-4 py-3 text-[15px] sm:text-base font-medium text-gray-600 border-r border-gray-300 bg-gray-50 shrink-0">
                  +91
                </span>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  maxLength="10"
                  placeholder="Enter 10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  autoFocus
                  className="flex-1 min-w-0 px-3 sm:px-4 py-3 text-[15px] sm:text-base text-gray-900 placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="otp-submit-btn"
                disabled={loading || !phone || phone.length < 10}
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); triggerVerify(); }} className="otp-form">
              <div
                className="flex justify-between gap-1.5 xs:gap-2 sm:gap-3"
                onPaste={handlePaste}
              >
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputsRef.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength="1"
                    autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                    name={idx === 0 ? 'otp' : undefined}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    disabled={loading}
                    className="w-10 h-12 sm:w-12 sm:h-14 rounded-lg border border-gray-300 text-center text-lg sm:text-xl font-semibold text-gray-900 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100 disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs sm:text-sm mt-3 mb-1">
                {resendCount >= 2 ? (
                  <div className="w-full flex items-center justify-between gap-2">
                    <span className="text-amber-600 font-medium text-xs">Max resends reached</span>
                    <button
                      type="button"
                      disabled={true}
                      className="text-gray-400 font-semibold cursor-not-allowed opacity-60 text-xs sm:text-sm select-none"
                    >
                      Resend code
                    </button>
                  </div>
                ) : resendTimer > 0 ? (
                  <span className="text-gray-500 font-medium">Resend code in {resendTimer}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending || resendCount >= 2}
                    className="text-rose-500 hover:text-rose-600 font-semibold focus:outline-none disabled:opacity-50 transition-colors"
                  >
                    {resending ? 'Sending...' : 'Resend code'}
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="otp-submit-btn"
                disabled={loading || otp.join('').length < 6}
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>

              <button
                type="button"
                className="otp-back-btn"
                onClick={() => {
                  setStep(1);
                  setError('');
                  setResending(false);
                  setResendTimer(30);
                  setResendCount(0);
                  setOtp(['', '', '', '', '', '']);
                  verifyingRef.current = false;
                }}
              >
                Change Phone Number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
