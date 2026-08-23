'use client'

import { useEffect, useState } from 'react'
import { useQuizAnswers } from '@/hooks/use-quiz-answers'
import RequireQuizModal from '@/components/RequireQuizModal'

export default function GlobalQuizPrompt() {
    const quizAnswers = useQuizAnswers()
    const [open, setOpen] = useState(false)
    const [reminderCount, setReminderCount] = useState(0)

    useEffect(() => {
        if (quizAnswers !== null) return undefined

        const delay = reminderCount === 0 ? 15000 : 10000
        const timer = window.setTimeout(() => setOpen(true), delay)
        return () => window.clearTimeout(timer)
    }, [quizAnswers, reminderCount])

    const handleClose = () => {
        setOpen(false)
        setReminderCount((count) => count + 1)
    }

    return <RequireQuizModal open={open && !quizAnswers} onClose={handleClose} />
}
