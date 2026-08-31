import { clampScore, getScoreBand } from '@/lib/score-band'

export default function ScoreBadge({ score }) {
    const value = clampScore(score)
    const band = getScoreBand(value)

    const progressDeg = Math.min(100, Math.max(0, value)) * 3.6

    return (
        <div
            className="absolute right-2 top-2 z-10 flex h-12 w-12 items-center justify-center rounded-full p-[3px] md:h-16 md:w-16"
            style={{
                background: `conic-gradient(${band.ring} ${progressDeg}deg, rgba(255,255,255,0.55) ${progressDeg}deg)`,
                boxShadow: `0 6px 16px ${band.glow}, 0 1px 3px rgba(0,0,0,0.08)`,
            }}
            aria-label={`Match score ${value}, ${band.label.toLowerCase()}`}
        >
            <div
                className="flex h-full w-full flex-col items-center justify-center rounded-full text-white ring-2 ring-white/80"
                style={{ backgroundColor: band.fill }}
            >
                <strong className="text-[14px] font-extrabold leading-none tracking-tight md:text-lg">
                    {value}
                </strong>
                <span className="mt-1 text-[7px] font-bold leading-none tracking-widest opacity-90 md:text-[8px]">
                    {band.label}
                </span>
            </div>
        </div>
    )
}