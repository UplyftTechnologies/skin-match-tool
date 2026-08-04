'use client'
import { useState, useEffect } from 'react'
import DontKnowSkinTypeModal from '../DontKnowSkinTypeModal'
import { trackingService } from '@/lib/tracking/trackingClient.js'
import { EVENTS } from '@/lib/tracking/events.js'

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
                setConditions(Array.isArray(savedAnswers.conditions) ? savedAnswers.conditions : [])
                setAge(savedAnswers.age || '')
                setGender(savedAnswers.gender || '')
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
        setConditions((prev) => {
            const isSelected = prev.includes(item)
            trackOption('special_conditions', item)
            return isSelected ? prev.filter((c) => c !== item) : [...prev, item]
        })
    }

    const handleSkinTypeSelect = (type) => {
        setSkinType(type)
        trackOption('skin_type', type)
        if (type === 'I dont know') {
            setShowGuideModal(true)
        }
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

    const handleSubmit = () => {
        const answers = {
            skinType,
            sensitive,
            concerns: selectedConcerns,
            conditions,
            age,
            gender,
        }

        trackingService.trackEvent(EVENTS.QUIZ_COMPLETED, {
            skin_type: skinType,
            sensitive,
            concerns: selectedConcerns,
            conditions,
            age,
            gender,
        })

        sessionStorage.setItem('roopsee-quiz-answers', JSON.stringify(answers))
        window.dispatchEvent(new CustomEvent('roopsee-quiz-answers-updated', {
            detail: answers,
        }))
        document.getElementById('products')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        })
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
                        <section>
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
                        </section>

                        {/* Sensitive */}
                        <section>
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
                        </section>

                        {/* Age / Gender */}
                        <section>
                            <h2 className="font-cormorant text-[21px] font-[500] italic text-gray-900 mb-1">Tell us more about you</h2>

                            <div className="grid grid-cols-2 gap-2">
                                {/* Age dropdown */}
                                <div className="relative w-full">
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
                                </div>

                                {/* Gender dropdown */}
                                <div className="relative w-full">
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
                                </div>
                            </div>

                        </section>

                        {/* Concerns */}
                        <section className="md:col-span-2 lg:col-span-3">
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
                        </section>

                        {/* Special conditions */}
                        <section className="md:col-span-2 lg:col-span-3">
                            <h2 className="font-cormorant text-[21px] font-[500] italic text-gray-900 mb-1">Special conditions</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {specialConditions.map((item) => (
                                    <Pill
                                        key={item}
                                        label={item}
                                        selected={conditions.includes(item)}
                                        onClick={() => toggleCondition(item)}
                                    />
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Submit */}
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="w-full md:w-64 font-lato mt-8 text-sm tracking-widest capitalize 
                     text-[#ff7e67] border border-[#e08a7d] rounded-[20px] py-2 hover:bg-[#d17a6d] hover:text-white
                      transition-colors duration-300"
                        >
                            Find my match
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
