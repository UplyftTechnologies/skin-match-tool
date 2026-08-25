'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useQuizAnswers } from '@/hooks/use-quiz-answers'
import RequireQuizModal from '@/components/RequireQuizModal'

const SHOWN_KEY = 'roopsee-quiz-prompt-shown'

export default function GlobalQuizPrompt() {
    const pathname = usePathname()
    const quizAnswers = useQuizAnswers()
    const [open, setOpen] = useState(false)

    const skipPage = pathname?.startsWith('/login')

    useEffect(() => {
        if (skipPage || quizAnswers !== null) return undefined
        if (sessionStorage.getItem(SHOWN_KEY)) return undefined

        const timer = window.setTimeout(() => setOpen(true), 15000)
        return () => window.clearTimeout(timer)
    }, [skipPage, quizAnswers])

    const handleClose = () => {
        setOpen(false)
        sessionStorage.setItem(SHOWN_KEY, '1')
    }

    return <RequireQuizModal open={open && !quizAnswers} onClose={handleClose} />
}
