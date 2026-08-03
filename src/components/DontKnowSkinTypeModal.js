'use client'
import { useEffect } from 'react'
import Image from 'next/image'
import { IoClose } from 'react-icons/io5'
import Face1 from '@/assets/icons/face1.webp'
import Face2 from '@/assets/icons/face2.webp'
import Face3 from '@/assets/icons/face3.jpeg'
import Face4 from '@/assets/icons/face4.jpeg'
import Face5 from '@/assets/icons/face5.webp'

const steps = [
    {
        icon: Face1,
        text: (
            <>Wash your face with gentle cleanser and wait 30 minutes without applying anything</>
        ),
    },
    {
        icon: Face2,
        text: (
            <>If your whole face looks shiny or greasy, you have <b>oily skin</b>.</>
        ),
    },
    {
        icon: Face3,
        text: (
            <>If your skin feels tight, rough, or flaky, you have <b>dry skin</b>.</>
        ),
    },
    {
        icon: Face4,
        text: (
            <>
                If only your forehead, nose, and chin feel oily but your cheeks feel normal or
                dry, you likely have <b>combination skin</b>.
            </>
        ),
    },
    {
        icon: Face5,
        text: (
            <>
                If your skin feels balanced, not too oily, not too dry, and comfortable, you
                likely have <b>normal skin</b>.
            </>
        ),
    },
]

export default function DontKnowSkinTypeModal({ open, onClose }) {
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [open])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
                >
                    <IoClose size={22} />
                </button>

                <h2 className="font-cormorant italic text-2xl md:text-3xl text-[#ff00e6] mb-6 pr-6">
                    Don&apos;t know your skin type?
                </h2>

                <div className="flex flex-col gap-6">
                    {steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-10 h-10 relative">
                                <Image
                                    src={step.icon}
                                    alt=""
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <p className="text-sm md:text-base text-gray-800 leading-relaxed">{step.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}