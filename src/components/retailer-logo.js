'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Amazon from '@/assets/images/amazon.png'
import Tira from '@/assets/images/tiira.png'
import Nyka from '@/assets/images/nyka.webp'
import { siteName } from '@/lib/site-name'

export { siteName }

const SITE_LOGOS = { nykaa: Nyka, tira: Tira, amazon: Amazon }

// No local logo file for these yet — domains taken from real product_url
// values already stored per retailer in retailer_products, not guessed, so
// the fallback fetch always points at the retailer's real site.
const SITE_LOGO_DOMAINS = {
    purplle: 'purplle.com',
    broadway: 'broadwaylive.in',
    kindlife: 'kindlife.in',
}

const ONLINE_LOGO_TIMEOUT_MS = 3000

// A fetched-from-the-web logo has no local guarantee it exists or loads —
// some hosts return a broken/zero-byte image without ever firing the <img>
// element's error event, which would otherwise leave a broken-image icon on
// screen forever. Belt and braces: fall back to the text badge on error, on
// a load that resolves to a zero-size image, or simply on a timeout if
// neither of those fires within a few seconds.
function OnlineLogo({ domain, alt, height, className }) {
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        setFailed(false)
        const timer = setTimeout(() => setFailed(true), ONLINE_LOGO_TIMEOUT_MS)
        return () => clearTimeout(timer)
    }, [domain])

    if (failed) {
        return <span className={`font-bold ${className}`}>{alt}</span>
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element -- external
        // logo can't go through next/image without whitelisting the domain.
        <img
            src={`https://logo.clearbit.com/${domain}`}
            alt={alt}
            height={height}
            style={{ height, width: 'auto' }}
            className={`object-contain ${className}`}
            onError={() => setFailed(true)}
            onLoad={(event) => {
                if (event.currentTarget.naturalWidth === 0) setFailed(true)
            }}
        />
    )
}

export default function RetailerLogo({ site, height = 18, className = '' }) {
    if (site === 'roopsee') {
        return (
            <span
                className={`font-semibold text-black ${className}`}
                style={{ fontSize: height * 0.62, letterSpacing: '-0.02em' }}
            >
                roopsee<span style={{ color: '#ff00e6' }}>.</span>
            </span>
        )
    }

    const logo = SITE_LOGOS[site]
    if (logo) {
        return (
            <Image
                src={logo}
                alt={siteName(site)}
                height={height}
                width={height * 3}
                style={{ height, width: 'auto' }}
                className={`object-contain ${className}`}
            />
        )
    }

    const domain = SITE_LOGO_DOMAINS[site]
    if (domain) {
        return <OnlineLogo domain={domain} alt={siteName(site)} height={height} className={className} />
    }

    return <span className={`font-bold ${className}`}>{siteName(site)}</span>
}
