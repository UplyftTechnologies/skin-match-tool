"use client"

import React, { useState } from 'react'

const initialForm = {
    fullName: '',
    brandName: '',
    workEmail: '',
    phoneNumber: '',
}

function PartnerInquiryForm() {
    const [form, setForm] = useState(initialForm)
    const [status, setStatus] = useState('idle') // idle | submitting | success | error
    const [errorMessage, setErrorMessage] = useState('')

    const handleChange = (field) => (event) => {
        setForm((prev) => ({ ...prev, [field]: event.target.value }))
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        setStatus('submitting')
        setErrorMessage('')

        try {
            const response = await fetch('/api/partner/inquiry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })

            const result = await response.json().catch(() => ({}))

            if (!response.ok) {
                throw new Error(result?.error || 'Something went wrong. Please try again.')
            }

            setStatus('success')
            setForm(initialForm)
        } catch (error) {
            setStatus('error')
            setErrorMessage(error.message || 'Something went wrong. Please try again.')
        }
    }

    return (
        <div className="bg-black rounded-[20px] p-6 md:p-10 mt-3">
            <h2 className="font-lato text-white text-[19px] sm:text-[21px] md:text-[26px] font-bold text-center mb-2">
                Let's build something together
            </h2>

            <p className="font-poppins text-[#bbb] text-[13px] md:text-[14px] text-center mb-6 max-w-[320px] md:max-w-[420px] mx-auto">
                Tell us a little about your brand and we'll follow up within a few business days.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1">
                        <span className="font-poppins text-white text-[12px] font-semibold">Full name</span>
                        <input
                            type="text"
                            required
                            placeholder="Jane Doe"
                            value={form.fullName}
                            onChange={handleChange('fullName')}
                            className="bg-[#2a2a2a] text-white placeholder:text-[#8a8a8a] font-poppins text-[13px] md:text-[14px] rounded-[10px] px-3 py-[10px] md:py-3 outline-none focus:ring-1 focus:ring-[#8ECFC9]"
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="font-poppins text-white text-[12px] font-semibold">Brand / company name</span>
                        <input
                            type="text"
                            placeholder="Your Brand Co."
                            value={form.brandName}
                            onChange={handleChange('brandName')}
                            className="bg-[#2a2a2a] text-white placeholder:text-[#8a8a8a] font-poppins text-[13px] md:text-[14px] rounded-[10px] px-3 py-[10px] md:py-3 outline-none focus:ring-1 focus:ring-[#8ECFC9]"
                        />
                    </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1">
                        <span className="font-poppins text-white text-[12px] font-semibold">Work email</span>
                        <input
                            type="email"
                            required
                            placeholder="jane@yourbrand.com"
                            value={form.workEmail}
                            onChange={handleChange('workEmail')}
                            className="bg-[#2a2a2a] text-white placeholder:text-[#8a8a8a] font-poppins text-[13px] md:text-[14px] rounded-[10px] px-3 py-[10px] md:py-3 outline-none focus:ring-1 focus:ring-[#8ECFC9]"
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="font-poppins text-white text-[12px] font-semibold">Phone Number</span>
                        <input
                            type="tel"
                            placeholder="0000000000"
                            value={form.phoneNumber}
                            onChange={handleChange('phoneNumber')}
                            className="bg-[#2a2a2a] text-white placeholder:text-[#8a8a8a] font-poppins text-[13px] md:text-[14px] rounded-[10px] px-3 py-[10px] md:py-3 outline-none focus:ring-1 focus:ring-[#8ECFC9]"
                        />
                    </label>
                </div>

                <div className="flex flex-col items-center mt-2">
                    <button
                        type="submit"
                        disabled={status === 'submitting'}
                        className="bg-[#FF7E67] text-black font-poppins font-bold text-[13px] md:text-[14px] px-8 md:px-10 py-[12px] md:py-[14px] rounded-[24px] hover:bg-[#7bbab5] transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {status === 'submitting' ? 'Sending...' : 'Send Partnership Inquiry'}
                    </button>

                    {status === 'success' && (
                        <p className="font-poppins text-[#8ECFC9] text-[12px] mt-3 text-center">
                            Thanks! We've received your inquiry and will be in touch soon.
                        </p>
                    )}

                    {status === 'error' && (
                        <p className="font-poppins text-[#FF7E67] text-[12px] mt-3 text-center">
                            {errorMessage}
                        </p>
                    )}
                </div>
            </form>
        </div>
    )
}

export default PartnerInquiryForm
