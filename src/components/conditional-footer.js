'use client'

import { usePathname } from 'next/navigation'
import FooterPage from '@/app/footer/page'

// /login is a dedicated full-viewport auth screen (its own dark sidebar,
// no site chrome) — the global footer stacked underneath it looks like a
// layout bug, not a design choice, so it's the one route excluded here.
const HIDDEN_ON = ['/login']

export default function ConditionalFooter() {
    const pathname = usePathname()
    if (HIDDEN_ON.includes(pathname)) return null
    return <FooterPage />
}
