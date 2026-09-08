'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import styles from './Animation2.module.css'
import { FiUserCheck, FiCheckSquare, FiTag, FiShoppingBag, FiBell } from 'react-icons/fi'

const HEADINGS = [
    'Know your skin match',
    'Build your best routine',
    'Compare prices',
    'Choose where to buy',
    'Save wishlist and get price alerts',
]

const HEADING_COLORS = ['#0f766e','#0f766e','#0f766e','#0f766e','#0f766e']
const HEADING_ICONS = [FiUserCheck, FiCheckSquare, FiTag, FiShoppingBag, FiBell]

const HOLD_DURATION = 2.8
const TRANSITION_DURATION = 0.35 
const INITIAL_DELAY = 1.2      
export default function Animation2({ className = '', prefix = '' }) {
     const rootRef = useRef(null)
    const trackRef = useRef(null)

    useEffect(() => {
        const media = gsap.matchMedia()

        media.add('(prefers-reduced-motion: no-preference)', () => {
            const track = trackRef.current
            const timeline = gsap.timeline({ repeat: -1 })

            HEADINGS.forEach((_, index) => {
                timeline.to(track, {
                    yPercent: -((index + 1) * 100) / (HEADINGS.length + 1),
                    duration: TRANSITION_DURATION,
                    ease: 'power4.out',
                }, index * HOLD_DURATION + INITIAL_DELAY)
            })
            timeline.set(track, { yPercent: 0 })
        }, rootRef)

        return () => media.revert()
    }, [])

    return (
        <span ref={rootRef} className={`${styles['concern-animation']} ${className.split(' ').includes('concern-animation-home') ? styles.home : ''} ${className}`}>
            <span className={styles['accessible-copy']}>
                {prefix ? `${prefix} ` : ''}{HEADINGS.join(', ')}
            </span>
            {prefix && <span aria-hidden="true" className={styles['prefix']}>{prefix}</span>}
            <span className={styles['word-window']} aria-hidden="true">
                <span ref={trackRef} className={styles['word-track']}>
                    {[...HEADINGS, HEADINGS[0]].map((heading, index) => {
                        const Icon = HEADING_ICONS[index % HEADINGS.length]
                        return (
                        <span
                            className={styles['word']}
                            key={`${heading}-${index}`}
                            style={{ color: HEADING_COLORS[index % HEADINGS.length] }}
                        >
                            <span className={styles['heading-icon']}><Icon aria-hidden="true" focusable="false" /></span>
                            <span className={styles['heading-text']}>{heading}</span>
                        </span>
                        )
                    })}
                </span>
                
            </span>
        </span>
    )
}
