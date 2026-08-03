'use client'
import { useState } from 'react'
import DontKnowSkinTypeModal from '../DontKnowSkinTypeModal'

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

function Pill({ label, selected, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{ fontSize: '13px' }}
            className={`w-full md:text-base py-[8px] px-1 rounded-[3px] border transition-colors duration-200
        ${selected
                    ? 'bg-[#D8E7E6] border-[#D8E7E6] text-gray-900'
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
    const [concern, setConcern] = useState(null)
    const [conditions, setConditions] = useState([])
    const [age, setAge] = useState(null)
    const [gender, setGender] = useState(null)
    const [showGuideModal, setShowGuideModal] = useState(false)

    const toggleCondition = (item) => {
        setConditions((prev) =>
            prev.includes(item) ? prev.filter((c) => c !== item) : [...prev, item]
        )
    }

    const handleSkinTypeSelect = (type) => {
        setSkinType(type)
        if (type === 'I dont know') {
            setShowGuideModal(true)
        }
    }

    return (
        <div className='bg-[#FFFFFF]'>
            <div className="max-w-md  mx-auto px-4 py-6 lg:max-w-[80%] md:py-12">
                <h1 style={{ letterSpacing: '0.1em' }} className="font-lato text-2xl md:text-3xl text-center mb-6 md:mb-10">
                    MATCH MY SKIN
                </h1>

                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-2 lg:gap-y-4">

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
                                    onClick={() => setSensitive(opt)}
                                />
                            ))}
                        </div>
                    </section>

                    {/* Age / Gender */}
                    <section>
                        <h2 className="font-cormorant text-[21px] font-[500] italic text-gray-900 mb-1">Tell us more about you</h2>
                        <div className="grid grid-cols-2 gap-2">
                            <Pill label="Age" selected={age === 'Age'} onClick={() => setAge('Age')} />
                            <Pill label="Gender" selected={gender === 'Gender'} onClick={() => setGender('Gender')} />
                        </div>
                    </section>

                    {/* Concerns - wider section, spans full row on desktop */}
                    <section className="md:col-span-2 lg:col-span-3">
                        <h2 className="font-cormorant text-[21px] font-[500] italic text-gray-900 mb-1">
                            Choose your skin concern <span className="text-gray-400 text-sm">(Choose 1)</span>
                        </h2>
                        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                            {concerns.map((item) => (
                                <Pill
                                    key={item}
                                    label={item}
                                    selected={concern === item}
                                    onClick={() => setConcern(item)}
                                />
                            ))}
                        </div>
                    </section>

                    {/* Special conditions - spans full row on desktop */}
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
                        className="w-full md:w-64 font-lato mt-8 text-sm tracking-widest capitalize 
                     text-[#ff7e67] border border-[#e08a7d] rounded-[20px] py-2 hover:bg-[#d17a6d] hover:text-white
                      transition-colors duration-300"
                    >
                        Find my match
                    </button>
                </div>
            </div>
        </div>
    )
}