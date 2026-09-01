'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiArrowRight, FiCircle, FiSquare, FiSun } from 'react-icons/fi'
import { BsDiamond } from 'react-icons/bs'
import { useQuizGate } from '@/hooks/use-quiz-gate'
import RequireQuizModal from '@/components/RequireQuizModal'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'
import { stepsForTime } from '@/lib/routine-steps'

// Icons are only used in this teaser card; labels/categories/time-of-day
// come from the shared routine-steps.js so this stays in sync with the full
// builder page and the "Add to Routine" picker on product cards.
const STEP_ICONS = {
    cleanser: FiCircle,
    serum: BsDiamond,
    moisturiser: FiSquare,
    sunscreen: FiSun,
}

export default function Routine() {
    const router = useRouter()
    const { guard, modalOpen, closeModal } = useQuizGate()
    const [activeTime, setActiveTime] = useState('am')

    const handleBuildRoutine = (source) => {
        trackingService.trackEvent(EVENTS.CLICKED_BUILD_ROUTINE_CTA, { source })
        guard(() => router.push('/build-routine'))
    }

    const handleAddStep = (step) => {
        trackingService.trackEvent(EVENTS.CLICKED_ROUTINE_TEASER_ADD_STEP, {
            time: activeTime,
            step: step.id,
            productType: step.label,
        })
        guard(() => router.push('/build-routine'))
    }

    const handleTimeTabChange = (time) => {
        trackingService.trackEvent(EVENTS.CLICKED_ROUTINE_TIME_TAB, {
            time,
            section: 'home_routine_teaser',
        })
        setActiveTime(time)
    }

    return (
        <div className="bg-[#faf7f2] px-4 py-10 md:py-16">
            <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-2 lg:gap-14">
                {/* Left — pitch + CTA */}
                <div className="text-center lg:text-left">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d77465]">
                        Your Routine
                    </p>
                    <h2 className="mt-2 font-cormorant text-3xl italic text-gray-900 sm:text-4xl lg:text-[42px]">
                        Build your AM &amp; PM routine
                    </h2>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-500 lg:mx-0">
                        Add the products you already use or the ones you&apos;re thinking of
                        buying and build your skincare routine in one place.
                    </p>

                    <button
                        type="button"
                        onClick={() => handleBuildRoutine('teaser_cta')}
                        className="mt-6 inline-flex items-center gap-2
                        rounded-full bg-[#D17A6D] px-7 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#D17A8D]"
                    >
                        Build My Routine
                        <FiArrowRight aria-hidden="true" />
                    </button>

                    <p className="mt-3 text-xs text-gray-400">
                        Add products · Check your skin match · Compare prices
                    </p>
                </div>

                {/* Right — routine builder preview card */}
                <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-2 shadow-[0_8px_30px_rgba(70,55,50,0.08)]">
                    <div className="flex gap-1 rounded-xl bg-[#f3eef8] p-1">
                        <button
                            type="button"
                            onClick={() => handleTimeTabChange('am')}
                            className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                                activeTime === 'am'
                                    ? 'bg-[#d9d3f0] text-gray-900'
                                    : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            AM Routine
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTimeTabChange('pm')}
                            className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                                activeTime === 'pm'
                                    ? 'bg-[#d9d3f0] text-gray-900'
                                    : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            PM Routine
                        </button>
                    </div>

                    <ul className="divide-y divide-gray-100 px-2">
                        {stepsForTime(activeTime).map((step) => {
                            const Icon = STEP_ICONS[step.id]
                            return (
                                <li key={step.id} className="flex items-center justify-between gap-3 py-3.5">
                                    <span className="flex items-center gap-3 text-sm font-semibold text-gray-800">
                                        <Icon aria-hidden="true" className="h-4 w-4 text-gray-400" />
                                        {step.label}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleAddStep(step)}
                                        className="text-xs font-bold text-[#e08a7d] hover:text-[#d17a6d]"
                                    >
                                        + Add
                                    </button>
                                </li>
                            )
                        })}
                    </ul>

                    <button
                        type="button"
                        onClick={() => handleBuildRoutine('teaser_score_banner')}
                        className="mt-2 flex w-full items-center justify-between rounded-xl bg-[#fdeef1] px-4 py-3 text-left transition-colors hover:bg-[#fbe4ea]"
                    >
                        <span className="text-xs text-[#c76557]">Your routine, matched to your skin</span>
                        <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-[#e01a7f]">
                            Roopsee score
                            <FiArrowRight aria-hidden="true" />
                        </span>
                    </button>
                </div>
            </div>
            <RequireQuizModal open={modalOpen} onClose={closeModal} />
        </div>
    )
}
