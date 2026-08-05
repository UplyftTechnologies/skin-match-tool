'use client'
import { useState, useEffect } from 'react'
import DontKnowSkinTypeModal from '../DontKnowSkinTypeModal'
import { trackingService } from '@/lib/tracking/trackingClient.js'
import { EVENTS } from '@/lib/tracking/events.js'
import { getSessionId } from '@/lib/tracking/identity'
import { quizAnswersToResultProfile } from '@/lib/quiz-profile'
import { supabase } from '@/lib/supabase/client'
import { saveSkinProfile } from '@/lib/profile-storage'
import { REQUEST_LOGIN_EVENT } from '@/components/homeComponents/Products'

const skinTypes = ['Oily', 'Dry', 'Normal', 'Combination', 'I dont know']
const sensitiveOptions = ['Yes', 'No']
const concerns = [
    'Acne', 'Body acne', 'Dryness',
    'Open pores', 'Dark spots', 'Melasma',
    'Barrier repair', 'Uneven skin', 'Comedones',
    'Wrinkles', 'redness', 'Dehydration',
    'Dullness', 'Tanning', 'None',
]
const specialConditions = ['Excessive dryness', 'Pregnancy', 'Breast feeding', 'None']
const maleRestrictedConditions = ['Pregnancy', 'Breast feeding']
const ageOptions = ['Teen', 'Adult']
const genderOptions = ['Female', 'Male', 'Other', 'Prefer not to say']

function Pill({ disabled = false, label, selected, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{ fontSize: '13px' }}
            className={`w-full md:text-base py-[8px] px-1 rounded-[3px] border transition-colors duration-200
        ${selected
                    ? 'bg-[#D8E7E6] border-[#D8E7E6] text-gray-900'
                    : disabled
                        ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
        >
            {label}
        </button>
    )
}

export default function MatchMySkin() {
    const [skinType, setSkinType] = useState(null)
    const [sensitive, setSensitive] = useState(null)
    const [selectedConcerns, setSelectedConcerns] = useState([])
    const [conditions, setConditions] = useState([])
    const [age, setAge] = useState('')
    const [gender, setGender] = useState('')
    const [showGuideModal, setShowGuideModal] = useState(false)
    const [validationAttempted, setValidationAttempted] = useState(false)
    const [savingQuiz, setSavingQuiz] = useState(false)
    const [saveError, setSaveError] = useState('')

    const missingFields = [
        !skinType && { key: 'skin-type', label: 'Skin type' },
        !sensitive && { key: 'sensitive', label: 'Skin sensitivity' },
        !age && { key: 'age', label: 'Age' },
        !gender && { key: 'gender', label: 'Gender' },
        selectedConcerns.length === 0 && { key: 'concerns', label: 'Skin concern' },
        conditions.length === 0 && { key: 'conditions', label: 'Special condition' },
    ].filter(Boolean)

    const hasFieldError = (key) => validationAttempted
        && missingFields.some((field) => field.key === key)

    useEffect(() => {
        const timer = setTimeout(() => {
            try {
                const savedAnswers = JSON.parse(sessionStorage.getItem('roopsee-quiz-answers') || 'null')
                if (!savedAnswers) return

                setSkinType(savedAnswers.skinType || null)
                setSensitive(savedAnswers.sensitive || null)
                const savedConcerns = Array.isArray(savedAnswers.concerns)
                    ? savedAnswers.concerns
                    : savedAnswers.concern
                        ? [savedAnswers.concern]
                        : []
                setSelectedConcerns(savedConcerns.slice(0, 2))
                const savedGender = savedAnswers.gender || ''
                const savedConditions = Array.isArray(savedAnswers.conditions)
                    ? savedAnswers.conditions
                    : []
                setConditions(
                    savedGender === 'Male'
                        ? savedConditions.filter((item) => !maleRestrictedConditions.includes(item))
                        : savedConditions,
                )
                setAge(savedAnswers.age || '')
                setGender(savedGender)
            } catch {
                sessionStorage.removeItem('roopsee-quiz-answers')
            }
        }, 0)
        return () => clearTimeout(timer)
    }, [])

    const trackOption = (question, value) => {
        trackingService.trackEvent(EVENTS.CLICKED_QUIZ_OPTION, {
            question,
            option: value,
        })
    }

    const toggleCondition = (item) => {
        if (gender === 'Male' && maleRestrictedConditions.includes(item)) return

        setConditions((prev) => {
            const isSelected = prev.includes(item)
            trackOption('special_conditions', item)
            if (isSelected) return prev.filter((condition) => condition !== item)
            if (item === 'None') return ['None']
            return [...prev.filter((condition) => condition !== 'None'), item]
        })
    }

    const handleSkinTypeSelect = (type) => {
        if (type === 'I dont know') {
            setShowGuideModal(true)
            return
        }
        setSkinType(type)
        trackOption('skin_type', type)
    }

    const handleSensitiveSelect = (opt) => {
        setSensitive(opt)
        trackOption('sensitive', opt)
    }

    const handleAgeSelect = (e) => {
        const value = e.target.value
        setAge(value)
        if (value) trackOption('age', value)
    }

    const handleGenderSelect = (e) => {
        const value = e.target.value
        setGender(value)
        if (value === 'Male') {
            setConditions((current) =>
                current.filter((item) => !maleRestrictedConditions.includes(item)),
            )
        }
        if (value) trackOption('gender', value)
    }

    const handleConcernSelect = (item) => {
        setSelectedConcerns((current) => {
            if (current.includes(item)) {
                trackOption('concern', item)
                return current.filter((concern) => concern !== item)
            }

            if (item === 'None') {
                trackOption('concern', item)
                return ['None']
            }

            const withoutNone = current.filter((concern) => concern !== 'None')
            if (withoutNone.length >= 2) return current

            trackOption('concern', item)
            return [...withoutNone, item]
        })
    }

    const handleSubmit = async () => {
        setValidationAttempted(true)

        if (missingFields.length > 0) {
            document.getElementById(`quiz-${missingFields[0].key}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            })
            return
        }

        const answers = {
            skinType,
            sensitive,
            concerns: selectedConcerns,
            conditions,
            age,
            gender,
        }
        const resultProfile = quizAnswersToResultProfile(answers)

        setSavingQuiz(true)
        setSaveError('')

        trackingService.trackEvent(EVENTS.QUIZ_COMPLETED, {
            skin_type: skinType,
            sensitive,
            concerns: selectedConcerns,
            conditions,
            age,
            gender,
        })

        sessionStorage.setItem('roopsee-quiz-answers', JSON.stringify(answers))
        saveSkinProfile(resultProfile)
        window.dispatchEvent(new CustomEvent('roopsee-quiz-answers-updated', {
            detail: answers,
        }))
        document.getElementById('products')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        })

        try {
            const { data: { session } } = await supabase.auth.getSession()

            // Give guests time to review their matches before prompting login.
            // This timer is created only after a successfully completed quiz.
            if (!session) {
                window.setTimeout(() => {
                    window.dispatchEvent(new CustomEvent(REQUEST_LOGIN_EVENT))
                }, 30_000)
            }

            const headers = { 'Content-Type': 'application/json' }
            if (session?.access_token) {
                headers.Authorization = `Bearer ${session.access_token}`
            }

            const response = await fetch('/api/quiz-results', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    profile: resultProfile,
                    guestSessionId: getSessionId(),
                }),
            })
            const payload = await response.json().catch(() => ({}))

            if (!response.ok) {
                throw new Error(payload.error || 'Unable to save your quiz results.')
            }
        } catch (error) {
            console.error('[match-my-skin] Quiz result save failed:', error)
            setSaveError('Your matches are ready, but we could not save your quiz. Please try again.')
            trackingService.trackError('quiz_result_save_failed', {
                message: error.message,
                source: 'home_quiz',
            })
        } finally {
            setSavingQuiz(false)
        }
    }

    return (
        <div>
            <div id="match-my-skin">
            </div>
            <div className='bg-[#FFFFFF]'>
                <div className="max-w-md mx-auto px-4 py-6 md:py-12 lg:max-w-6xl xl:max-w-7xl lg:px-8">
                    <h2 style={{ letterSpacing: '0.1em' }} className="font-lato text-lg uppercase md:text-3xl text-center tracking- mb-1">
                        MATCH MY SKIN
                    </h2>

                    <div className="mt-2 lg:mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-2 lg:gap-x-8 lg:gap-y-5">

                        <DontKnowSkinTypeModal open={showGuideModal} onClose={() => setShowGuideModal(false)} />

                        {/* Skin type */}
                        <section id="quiz-skin-type">
                            <h2 className="font-cormorant text-[21px] font-[500] italic text-gray-900 mb-1">What&apos;s your skin type?</h2>
                            <div className="grid grid-cols-2 gap-2">
                                {skinTypes.map((type) => (
                                    <Pill
                                        key={type}
                                        label={type}
                                        selected={skinType === type}
                                        onClick={() => handleSkinTypeSelect(type)}
                                    />
                                ))}
                            </div>
                            {hasFieldError('skin-type') ? (
                                <p className="mt-1 text-xs font-medium text-red-600" role="alert">Please select your skin type.</p>
                            ) : null}
                        </section>

                        {/* Sensitive */}
                        <section id="quiz-sensitive">
                            <h2 className="font-cormorant text-[21px] font-[500] italic text-gray-900 mb-1">Is your skin sensitive?</h2>
                            <div className="grid grid-cols-2 gap-2">
                                {sensitiveOptions.map((opt) => (
                                    <Pill
                                        key={opt}
                                        label={opt}
                                        selected={sensitive === opt}
                                        onClick={() => handleSensitiveSelect(opt)}
                                    />
                                ))}
                            </div>
                            {hasFieldError('sensitive') ? (
                                <p className="mt-1 text-xs font-medium text-red-600" role="alert">Please select whether your skin is sensitive.</p>
                            ) : null}
                        </section>

                        {/* Age / Gender */}
                        <section>
                            <h2 className="font-cormorant text-[21px] font-[500] italic text-gray-900 mb-1">Tell us more about you</h2>

                            <div className="grid grid-cols-2 gap-2">
                                {/* Age dropdown */}
                                <div id="quiz-age" className="relative w-full">
                                    <select
                                        value={age}
                                        onChange={handleAgeSelect}
                                        style={{ fontSize: '13px', border: '1px solid #D1D5DC', borderRadius: '5px', fontWeight: 400, color: age ? '#374151' : '#6b7280', height: '37px' }}
                                        className="appearance-none w-full md:text-base py-[9px] px-2 pr-7
                                     rounded-[3px] border border-gray-200 bg-white focus:outline-none focus:border-gray-400"
                                    >
                                        <option value="" disabled>Age</option>
                                        {ageOptions.map((opt) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <svg className="pointer-events-none absolute right-2 top-[20px] -translate-y-1/2 w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="none">
                                        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    {hasFieldError('age') ? (
                                        <p className="mt-1 text-xs font-medium text-red-600" role="alert">Please select your age.</p>
                                    ) : null}
                                </div>

                                {/* Gender dropdown */}
                                <div id="quiz-gender" className="relative w-full">
                                    <select
                                        value={gender}
                                        onChange={handleGenderSelect}
                                        style={{ fontSize: '13px', border: '1px solid #D1D5DC', borderRadius: '5px', fontWeight: 400, color: age ? '#374151' : '#6b7280', height: '37px' }}
                                        className="appearance-none w-full md:text-base py-[9px] px-2 pr-7 rounded-[3px] border border-gray-200 bg-white focus:outline-none focus:border-gray-400"
                                    >
                                        <option value="" disabled>Gender</option>
                                        {genderOptions.map((opt) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="none">
                                        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    {hasFieldError('gender') ? (
                                        <p className="mt-1 text-xs font-medium text-red-600" role="alert">Please select your gender.</p>
                                    ) : null}
                                </div>
                            </div>

                        </section>

                        {/* Concerns */}
                        <section id="quiz-concerns" className="md:col-span-2 lg:col-span-3">
                            <h2 className="font-cormorant text-[21px] font-[500] italic text-gray-900 mb-1">
                                Choose your skin concerns <span className="text-gray-400 text-sm">(Choose up to 2)</span>
                            </h2>
                            <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2 lg:gap-3">
                                {concerns.map((item) => (
                                    <Pill
                                        key={item}
                                        label={item}
                                        selected={selectedConcerns.includes(item)}
                                        disabled={selectedConcerns.length >= 2 && item !== 'None' && !selectedConcerns.includes(item)}
                                        onClick={() => handleConcernSelect(item)}
                                    />
                                ))}
                            </div>
                            {hasFieldError('concerns') ? (
                                <p className="mt-1 text-xs font-medium text-red-600" role="alert">Please select at least one skin concern.</p>
                            ) : null}
                        </section>

                        {/* Special conditions */}
                        <section id="quiz-conditions" className="md:col-span-2 lg:col-span-3">
                            <h2 className="font-cormorant text-[21px] font-[500] italic text-gray-900 mb-1">Special conditions</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {specialConditions.map((item) => (
                                    <Pill
                                        key={item}
                                        label={item}
                                        selected={conditions.includes(item)}
                                        disabled={gender === 'Male' && maleRestrictedConditions.includes(item)}
                                        onClick={() => toggleCondition(item)}
                                    />
                                ))}
                            </div>
                            {hasFieldError('conditions') ? (
                                <p className="mt-1 text-xs font-medium text-red-600" role="alert">Please select a special condition, or choose None.</p>
                            ) : null}
                        </section>
                    </div>

                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={savingQuiz}
                            className="w-full md:w-64 font-lato mt-8 text-sm tracking-widest capitalize 
                     text-[#ff7e67] border border-[#e08a7d] rounded-[10px] py-2 hover:bg-[#d17a6d] hover:text-white
                      transition-colors duration-300 disabled:cursor-wait disabled:opacity-60"
                        >
                            {savingQuiz ? 'Saving your quiz…' : 'Find my match'}
                        </button>
                    </div>
                    {saveError ? (
                        <p className="mx-auto mt-3 max-w-md text-center text-xs font-medium text-red-600" role="alert">
                            {saveError}
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
