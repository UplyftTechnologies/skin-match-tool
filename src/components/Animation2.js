'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import Image from 'next/image'
import styles from './Animation2.module.css'
import skinMatchImage from '../assets/svgimages/f1.png'
import routineImage from '../assets/svgimages/f2.png'
import comparePricesImage from '../assets/svgimages/f3.png'
import shopImage from '../assets/svgimages/f4.png'
import priceAlertsImage from '../assets/svgimages/f5.png'
import doctorVerifiedImage from '../assets/svgimages/f6.png'

const HEADINGS = [
    'Know your skin match',
    'Build your best routine',
    'Compare prices',
    'Choose where to buy',
    'Save wishlist and get price alerts',
    'Doctor verified',
]

const HEADING_COLORS = HEADINGS.map(() => '#000')
const ICON_IMAGES = [
    skinMatchImage,
    routineImage,
    comparePricesImage,
    shopImage,
    priceAlertsImage,
    doctorVerifiedImage,
]

const HOLD_DURATION = 2.8
const TRANSITION_DURATION = 0.35 
const INITIAL_DELAY = 1.2      
export default function Animation2({ className = '', prefix = '' }) {
     const rootRef = useRef(null)
    const trackRef = useRef(null)
    const iconRefs = useRef([])
    const textRefs = useRef([])

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

            // Icon slides in from alternating sides, heading fades/slides in
            // just after — synced to the same moment each row becomes active.
            const rowCount = HEADINGS.length + 1
            for (let row = 0; row < rowCount; row += 1) {
                const startTime = row === 0 ? 0 : (row - 1) * HOLD_DURATION + INITIAL_DELAY
                const fromLeft = row % 2 === 0
                const icon = iconRefs.current[row]
                const text = textRefs.current[row]

                if (icon) {
                    timeline.fromTo(icon,
                        { xPercent: fromLeft ? -160 : 160, opacity: 0 },
                        { xPercent: 0, opacity: 1, duration: 0.45, ease: 'power2.out' },
                        startTime)
                }
                if (text) {
                    timeline.fromTo(text,
                        { opacity: 0, y: 8 },
                        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
                        startTime + 0.12)
                }
            }
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
                        return (
                        <span
                            className={styles['word']}
                            key={`${heading}-${index}`}
                            style={{ color: HEADING_COLORS[index % HEADINGS.length] }}
                        >
                            <span className={styles['heading-icon']} ref={(el) => { iconRefs.current[index] = el }}>
                                <Image src={ICON_IMAGES[index % HEADINGS.length]}
                                width={40} height={40} sizes="40px" alt="" />
                            </span>
                            <span className={`${styles['heading-text']} text-[#000]`} ref={(el) => { textRefs.current[index] = el }}>{heading}</span>
                        </span>
                        )
                    })}
                </span>
                
            </span>
        </span>
    )
}

