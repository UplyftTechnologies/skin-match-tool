'use client'
import { usePathname } from "next/navigation";

const STEPS = ['Take Quiz', 'Check Skin Match', 'Compare Products', 'Buy']

export default function QuizSteps() {
  const pathname = usePathname();
  const showNavigationFlow = pathname === "/";

  return (
    <section aria-label="How it works" 
    className="bg-white px-4 py-6 sm:px-6 sm:py-">
      {showNavigationFlow && (
        <nav
          aria-label="How Roopsee works"
          className=" bg-white px-1 lg:px-4"
        >
          <ol className="relative mx-auto grid max-w-2xl grid-cols-4 py-2.5 sm:py-3">
            <span
              aria-hidden="true"
              className="absolute left-[12.5%] right-[12.5%] top-[17px] h-px bg-[#ead8d3] sm:top-[19px]"
            />
            {["Take Quiz", "Check Skin Match", "Compare Products", "Buy"].map((label) => (
              <li
                key={label}
                className="relative flex min-w-0 flex-col items-center gap-1.5 px-1 text-center text-[9px] font-medium leading-tight text-gray-600 sm:text-xs"
              >
                <span className="relative z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#d9aaa2] bg-white sm:h-4 sm:w-4">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#e8c8c2]" />
                </span>
                <span className="block max-w-full">{label}</span>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </section>
  )
}
