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
                        return (
                        <span
                            className={styles['word']}
                            key={`${heading}-${index}`}
                            style={{ color: HEADING_COLORS[index % HEADINGS.length] }}
                        >
                            <span className={styles['heading-icon']}>
                                <Image src={ICON_IMAGES[index % HEADINGS.length]}
                                width={40} height={40} sizes="40px" alt="" />
                            </span>
                            <span className={`${styles['heading-text']} text-[#000]`}>{heading}</span>
                        </span>
                        )
                    })}
                </span>
                
            </span>
        </span>
    )
}

