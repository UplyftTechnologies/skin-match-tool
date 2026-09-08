'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'

export default function SkincareCharacter() {
  const root = useRef(null)

  useEffect(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to('[data-body]', { y: -3, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      gsap.to('[data-hand]', { rotation: -7, svgOrigin: '166 179', duration: 1.3, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      gsap.timeline({ repeat: -1, repeatDelay: 3.2 })
        .to('[data-eye]', { scaleY: 0.1, transformOrigin: '50% 50%', duration: 0.1 })
        .to('[data-eye]', { scaleY: 1, duration: 0.12 })
      gsap.to('[data-sparkle]', { opacity: 0.25, scale: 0.65, transformOrigin: '50% 50%', duration: 1.4, stagger: 0.4, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }, root)
    return () => media.revert()
  }, [])

  return (
    <svg ref={root} viewBox="0 0 240 240" className="h-full w-full" aria-hidden="true" focusable="false">
      <circle cx="120" cy="124" r="93" fill="#D8E7E6" opacity="0.65" />
      <circle cx="120" cy="124" r="105" fill="none" stroke="#FAF7F2" strokeWidth="1.5" />
      <ellipse cx="120" cy="221" rx="60" ry="5" fill="#355D59" opacity="0.08" />
      <g data-body="">
        <path d="M66 137V88C66 24 169 22 177 85L183 162H60Z" fill="#43332E" />
        <path d="M61 217L67 179Q74 155 103 155H139Q173 158 179 184L186 217Z" fill="#D17A6D" />
        <path d="M103 137V159Q120 178 139 159V135" fill="#C98D69" />
        <path d="M95 157L120 178L145 157L156 169L137 193L120 178L104 193L85 169Z" fill="#FAF7F2" />
        <ellipse cx="78" cy="104" rx="9" ry="13" fill="#DDA47E" />
        <ellipse cx="162" cy="104" rx="9" ry="13" fill="#DDA47E" />
        <path d="M79 79Q120 40 161 79V112C161 142 137 157 120 157S79 140 79 112Z" fill="#E9B58F" />
        <path d="M76 88Q76 48 116 46Q155 39 166 88Q137 82 117 60Q100 82 76 88Z" fill="#43332E" />
        <path d="M72 76Q118 28 169 76" fill="none" stroke="#FAF7F2" strokeWidth="12" strokeLinecap="round" />
        <path d="M111 51Q95 24 117 29L125 44Q145 21 148 37Q148 50 129 53Z" fill="#FAF7F2" />
        <path d="M91 98Q98 94 105 98M135 98Q142 94 149 98" fill="none" stroke="#674637" strokeWidth="2" strokeLinecap="round" />
        <g fill="#43332E">
          <ellipse data-eye="" cx="100" cy="107" rx="2.5" ry="3.5" />
          <ellipse data-eye="" cx="140" cy="107" rx="2.5" ry="3.5" />
        </g>
        <path d="M119 110L116 121H121" fill="none" stroke="#C98D69" strokeWidth="2" strokeLinecap="round" />
        <path d="M110 132Q120 140 131 131" fill="none" stroke="#9A5344" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="92" cy="121" rx="7" ry="3" fill="#D17A6D" opacity="0.35" />
        <path d="M144 118L150 115M145 123L152 120" stroke="#FFFDFA" strokeWidth="4" strokeLinecap="round" />
        <g data-hand="">
          <path d="M166 180Q187 165 161 135L150 120" fill="none" stroke="#E9B58F" strokeWidth="13" strokeLinecap="round" />
          <path d="M149 121L145 115" stroke="#E9B58F" strokeWidth="6" strokeLinecap="round" />
        </g>
        <path d="M78 183Q79 207 115 200" fill="none" stroke="#E9B58F" strokeWidth="13" strokeLinecap="round" />
        <rect x="104" y="180" width="31" height="25" rx="6" fill="#FAF7F2" />
        <rect x="102" y="177" width="35" height="7" rx="3" fill="#0F766E" />
        <path d="M115 194H125" stroke="#D17A6D" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round">
        <path data-sparkle="" d="M39 91V103M33 97H45" />
        <path data-sparkle="" d="M199 58V76M190 67H208" />
        <path data-sparkle="" d="M205 157V167M200 162H210" />
      </g>
    </svg>
  )
}
