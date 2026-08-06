'use client';

import { useOtpAuth } from '@/hooks/use-otp-auth';

export default function OtpModal({ isOpen, onClose, onSuccess }) {
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
    otpInputsRef,
    handleSendOtp,
    handleResend,
    handleOtpChange,
    handleKeyDown,
    handlePaste,
    triggerVerify,
    resetToPhoneStep,
  } = useOtpAuth({
    active: isOpen,
    onSuccess: (user) => {
      if (onSuccess) {
        onSuccess(user);
      } else {
        onClose?.();
      }
    },
  });

  if (!isOpen) return null;

  return (
    <div className="otp-modal-overlay">
      <div className="otp-modal-container">
        <button
          type="button"
          className="otp-modal-close"
          onClick={onClose}
          aria-label="Close login popup"
        >
          &times;
        </button>
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
                onClick={resetToPhoneStep}
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
