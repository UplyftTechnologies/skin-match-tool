export default function ScoreBadge({ score }) {
    const value = Number.isFinite(Number(score)) ? Math.round(Number(score)) : 0
    const band = value >= 80
        ? { label: 'GREAT', color: 'bg-[#16845d]' }
        : value >= 70
            ? { label: 'GOOD', color: 'bg-[#3f8f72]' }
            : value >= 50
                ? { label: 'CAUTION', color: 'bg-[#d28a32]' }
                : { label: 'LOW', color: 'bg-[#c75b57]' }

    return (
        <div
            className={`absolute right-2 top-2 z-10 flex h-14 w-14 flex-col items-center justify-center rounded-full text-white shadow-lg md:h-16 md:w-16 ${band.color}`}
            aria-label={`Match score ${value}, ${band.label.toLowerCase()}`}
        >
            <strong className="text-base font-extrabold leading-none md:text-lg">{value}</strong>
            <span className="mt-0.5 text-[8px] font-extrabold leading-none tracking-wide md:text-[9px]">
                {band.label}
            </span>
        </div>
    )
}
