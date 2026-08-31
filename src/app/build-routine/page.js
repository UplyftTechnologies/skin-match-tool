'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { FiX } from 'react-icons/fi'
import Header from '@/components/header'
import RequireQuizGate from '@/components/require-quiz-gate'
import ProductPickerModal from '@/components/routine/ProductPickerModal'
import { useRetailerCatalog } from '@/hooks/use-retailer-catalog'
import { useQuizAnswers } from '@/hooks/use-quiz-answers'
import { quizAnswersToScoringProfile } from '@/lib/quiz-profile'
import { getSavedSkinProfile } from '@/lib/profile-storage'
import { getSavedRoutine, saveRoutine } from '@/lib/routine-storage'
import { matchLabel, matchClasses } from '@/lib/routine-match'
import { STEP_DEFS, stepsForTime } from '@/lib/routine-steps'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'

const BASE_STEPS = Object.entries(STEP_DEFS).map(([id, step]) => ({ id, ...step }))

function emptyRoutine() {
    return { am: {}, pm: {} }
}

function StepRow({ stepNumber, label, product, loading, isExplicit, onChange, onRemove }) {
    const score = product?.scoring?.score
    const hasScore = Number.isFinite(Number(score))

    return (
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                    {product?.image ? (
                        <Image src={product.image} alt="" fill sizes="44px" className="object-contain" />
                    ) : null}
                </span>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                        Step {String(stepNumber).padStart(2, '0')} · {label}
                    </p>
                    {loading ? (
                        <p className="text-sm text-gray-400">Finding your best match…</p>
                    ) : product ? (
                        <>
                            <p className="truncate text-sm font-semibold text-gray-900">{product.product_name}</p>
                            <p className="text-xs text-gray-400">
                                {isExplicit ? 'Your selected product' : 'Suggested for you'}
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-gray-400">No product selected yet</p>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap shrink-0 items-center gap-2 sm:justify-end">
                {hasScore ? (
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${matchClasses(score)}`}>
                        {Math.round(score)} · {matchLabel(score)}
                    </span>
                ) : null}
                <button
                    type="button"
                    onClick={onChange}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-[#e08a7d] hover:text-[#e08a7d]"
                >
                    Change
                </button>
                {isExplicit ? (
                    <button
                        type="button"
                        onClick={onRemove}
                        aria-label="Remove selection"
                        title="Remove selection"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-gray-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                        <FiX aria-hidden="true" size={16} />
                    </button>
                ) : null}
            </div>
        </div>
    )
}

function BuildRoutinePageContent() {
    const router = useRouter()
    const quizAnswers = useQuizAnswers()
    const [savedProfile, setSavedProfile] = useState(null)

    useEffect(() => {
        const timer = setTimeout(() => {
            setSavedProfile(getSavedSkinProfile()?.profile || null)
        }, 0)
        return () => clearTimeout(timer)
    }, [quizAnswers])

    const scoringProfile = useMemo(() => {
        if (quizAnswers) return quizAnswersToScoringProfile(quizAnswers)
        return savedProfile?.selectedSkinType ? savedProfile : null
    }, [quizAnswers, savedProfile])

    const [activeTime, setActiveTime] = useState('am')
    const [routine, setRoutine] = useState(emptyRoutine)
    const [routineLoaded, setRoutineLoaded] = useState(false)
    const [pickerStep, setPickerStep] = useState(null)
    const [savedMessage, setSavedMessage] = useState('')

    useEffect(() => {
        const saved = getSavedRoutine()
        if (saved?.routine) setRoutine(saved.routine)
        setRoutineLoaded(true)
    }, [])

    // Every Change/Remove persists immediately, the same way the home page's
    // "Add to Routine" picker already does — without this, a refresh before
    // clicking "Save my routine" silently reverted to whatever was last
    // written to storage, bringing back picks the shopper had just removed.
    useEffect(() => {
        if (routineLoaded) saveRoutine(routine)
    }, [routine, routineLoaded])

    // One fetch per fixed step — used only to auto-fill a sensible default so
    // the page never opens empty; "Change" reopens the picker for anything else.
    const cleanserCatalog = useRetailerCatalog({
        search: '', filters: { brand: [], category: BASE_STEPS[0].categories, site: [], price: [] },
        sort: 'score_desc', page: 1, profile: scoringProfile,
    })
    const serumCatalog = useRetailerCatalog({
        search: '', filters: { brand: [], category: BASE_STEPS[1].categories, site: [], price: [] },
        sort: 'score_desc', page: 1, profile: scoringProfile,
    })
    const moisturiserCatalog = useRetailerCatalog({
        search: '', filters: { brand: [], category: BASE_STEPS[2].categories, site: [], price: [] },
        sort: 'score_desc', page: 1, profile: scoringProfile,
    })
    const sunscreenCatalog = useRetailerCatalog({
        search: '', filters: { brand: [], category: BASE_STEPS[3].categories, site: [], price: [] },
        sort: 'score_desc', page: 1, profile: scoringProfile,
    })
    const catalogsByStep = {
        cleanser: cleanserCatalog,
        serum: serumCatalog,
        moisturiser: moisturiserCatalog,
        sunscreen: sunscreenCatalog,
    }

    // The best-scoring product per category is the default shown for an
    // untouched step — a derived value, not state, so there is nothing to
    // sync via an effect: it naturally updates as the catalog fetches land,
    // and a user's own Change selection (stored in `routine`) always takes
    // precedence over it. A step has three states: the key is absent (never
    // touched — show the live suggestion), the key is `null` (explicitly
    // cleared via Remove — show nothing until Change'd), or the key holds a
    // product object (an explicit pick — show it, with Remove available).
    const activeSteps = routine[activeTime]
    const timeSteps = stepsForTime(activeTime)

    const allSteps = timeSteps.map((step) => {
        const rawValue = activeSteps[step.id]
        const isCleared = rawValue === null
        return {
            ...step,
            product: isCleared ? null : rawValue || catalogsByStep[step.id].products?.[0] || null,
            isExplicit: Boolean(rawValue),
        }
    })
    const hasAnyStepProduct = allSteps.some((step) => step.product)
    const anyStepLoading = timeSteps.some((step) =>
        activeSteps[step.id] === undefined && catalogsByStep[step.id].loading,
    )
    const scoredSteps = allSteps.filter((step) => Number.isFinite(Number(step.product?.scoring?.score)))
    const overallScore = scoredSteps.length
        ? Math.round(scoredSteps.reduce((sum, step) => sum + Number(step.product.scoring.score), 0) / scoredSteps.length)
        : null
    const weakestStep = scoredSteps.length
        ? scoredSteps.reduce((weakest, step) =>
            Number(step.product.scoring.score) < Number(weakest.product.scoring.score) ? step : weakest)
        : null

    function updateStepProduct(stepId, product) {
        setRoutine((current) => ({
            ...current,
            [activeTime]: { ...current[activeTime], [stepId]: product },
        }))
    }

    // Explicitly clears a step — set to `null` rather than deleted, so it
    // stays empty ("No product selected yet") instead of silently falling
    // back to the live suggestion. Only "Change" repopulates it after this.
    function removeStepProduct(stepId) {
        setRoutine((current) => ({
            ...current,
            [activeTime]: { ...current[activeTime], [stepId]: null },
        }))
    }

    function handleSave() {
        saveRoutine(routine)
        trackingService.trackEvent(EVENTS.CLICKED_SAVE_MY_MATCH, { source: 'build_routine_page' })
        setSavedMessage('Saved!')
        setTimeout(() => setSavedMessage(''), 2500)
    }

    function handleCompareShop() {
        trackingService.trackEvent(EVENTS.CLICKED_VIEW_ALL_PRODUCTS, { source: 'build_routine_compare' })
        router.push('/AllProducts')
    }

    const profileSummary = [
        ['Skin', scoringProfile?.selectedSkinType],
        ['Sensitive', scoringProfile?.selectedSensitive ? 'Yes' : 'No'],
        ['Concern', (scoringProfile?.selectedFaceBodyConcerns || [])[0]],
        ['Age', scoringProfile?.age],
    ].filter(([, value]) => value)

    return (
        <div className="min-h-screen bg-[#FAF9F6]">
            <Header />
            <RequireQuizGate
                title="Take the skin quiz to build your routine"
                description="Answer a few quick questions so we can match every routine step to your skin."
                navigateToHomeQuiz
            >
                <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d77465]">Your Routine</p>
                    <h2 className="mt-1 font-lato text-2xl font-semibold text-gray-900 sm:text-3xl lg:text-4xl">
                        Build My Routine
                    </h2>
                    <p className="mt-2 max-w-xl text-sm text-gray-500">
                        Add the products you use, see how well each one matches your skin, and build a
                        simple AM &amp; PM routine in one place.
                    </p>

                    {profileSummary.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {profileSummary.map(([label, value]) => (
                                <span
                                    key={label}
                                    className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600"
                                >
                                    {label}: {value}
                                </span>
                            ))}
                        </div>
                    ) : null}

                    <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div>
                            <div className="flex gap-6 overflow-x-auto border-b border-gray-200">
                                {['am', 'pm'].map((time) => (
                                    <button
                                        key={time}
                                        type="button"
                                        onClick={() => setActiveTime(time)}
                                        className={`-mb-px shrink-0 border-b-2 px-1 pb-3 text-sm font-bold uppercase tracking-wide transition-colors ${
                                            activeTime === time
                                                ? 'border-[#e01a7f] text-[#e01a7f]'
                                                : 'border-transparent text-gray-400 hover:text-gray-600'
                                        }`}
                                    >
                                        {time.toUpperCase()} Routine
                                    </button>
                                ))}
                            </div>

                            <div className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
                                {!hasAnyStepProduct && !anyStepLoading ? (
                                    <p className="px-5 py-10 text-center text-sm text-gray-400">
                                        No routine chosen yet.
                                    </p>
                                ) : (
                                    allSteps.map((step, index) => (
                                        <StepRow
                                            key={step.id}
                                            stepNumber={index + 1}
                                            label={step.label}
                                            product={step.product}
                                            loading={catalogsByStep[step.id].loading && !step.product}
                                            isExplicit={step.isExplicit}
                                            onChange={() => setPickerStep(step)}
                                            onRemove={() => removeStepProduct(step.id)}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
                                <p className="text-sm font-semibold text-gray-900">Your routine match</p>
                                {overallScore === null ? (
                                    <p className="mt-2 text-sm text-gray-500">
                                        Pick products for each step to see your routine match.
                                    </p>
                                ) : (
                                    <>
                                        <p className="mt-2 text-3xl font-bold text-gray-900">
                                            {overallScore}
                                            <span className="text-base font-medium text-gray-400">/100</span>
                                        </p>
                                        <p className="mt-1 text-xs leading-relaxed text-gray-500">
                                            {overallScore >= 80
                                                ? 'A strong overall match for your skin.'
                                                : overallScore >= 60
                                                    ? 'A workable routine, with a couple of steps worth a closer look.'
                                                    : 'A few steps here may not suit your skin — worth reviewing.'}
                                            {weakestStep
                                                ? ` Your ${weakestStep.label.toLowerCase()} could be a better fit for your skin profile.`
                                                : ''}
                                        </p>
                                        {weakestStep ? (
                                            <button
                                                type="button"
                                                onClick={() => setPickerStep(weakestStep)}
                                                className="mt-3 w-full rounded-full border border-[#e01a7f] px-4 py-2 text-xs font-semibold text-[#e01a7f] hover:bg-[#fdeef1]"
                                            >
                                                See better {weakestStep.label.toLowerCase()} matches
                                            </button>
                                        ) : null}
                                    </>
                                )}
                            </div>

                            <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
                                <p className="text-sm font-semibold text-gray-900">Ready to shop?</p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Compare prices across platforms before you buy your routine.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleCompareShop}
                                    className="mt-3 w-full rounded-full bg-[#D17A6D]
                                     px-4 py-2.5 text-xs font-semibold text-white
                                      hover:bg-[#D17A8D]"
                                >
                                    Compare prices &amp; shop
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    className="mt-2 w-full rounded-full border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                    {savedMessage || 'Save my routine'}
                                </button>
                            </div>

                            <div className="rounded-2xl bg-[#fdeef1] p-4 sm:p-5">
                                <p className="text-xs font-bold uppercase tracking-wide text-[#c76557]">Roopsee tip</p>
                                <p className="mt-1 text-xs leading-relaxed text-[#9a6b62]">
                                    Your routine can change with your skin. Update your profile anytime to
                                    refresh your product matches.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </RequireQuizGate>

            <ProductPickerModal
                key={pickerStep ? pickerStep.id : 'closed'}
                open={Boolean(pickerStep)}
                onClose={() => setPickerStep(null)}
                title={pickerStep ? `Choose your ${pickerStep.label}` : ''}
                categories={pickerStep?.categories || []}
                allowCategoryChange={false}
                profile={scoringProfile}
                onSelect={(product) => {
                    if (pickerStep) updateStepProduct(pickerStep.id, product)
                    setPickerStep(null)
                }}
            />
        </div>
    )
}

export default function BuildRoutinePage() {
    return <BuildRoutinePageContent />
}