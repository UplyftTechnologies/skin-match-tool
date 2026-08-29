'use client'
import { useEffect } from 'react'
import { IoClose } from 'react-icons/io5'

export default function RequireQuizModal({ open, onClose }) {
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

    const handleTakeQuiz = () => {
        onClose()
        requestAnimationFrame(() => {
            const quiz = document.getElementById('match-my-skin')
            if (quiz) {
                quiz.scrollIntoView({ behavior: 'smooth', block: 'start' })
            } else {
                window.location.href = '/MatchStudio#match-my-skin'
            }
        })
    }

    return (
        <div className="fixed inset-0 z-[var(--z-overlay)] bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl w-full max-w-sm p-6 relative text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
                >
                    <IoClose size={22} />
                </button>

                <h2 className="font-cormorant italic text-2xl md:text-3xl text-gray-900 mb-2 pr-6">
                    Find the products to avoid
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                    Fill in the quiz to know which product you should NOT buy as per your skin.
                </p>

                <button
                    type="button"
                    onClick={handleTakeQuiz}
                    className="w-full font-lato text-sm tracking-widest capitalize text-[#ff7e67] border border-[#e08a7d] rounded-[10px] py-2 hover:bg-[#d17a6d] hover:text-white transition-colors duration-300"
                >
                    Take the skin quiz
                </button>
            </div>
        </div>
    )
}
