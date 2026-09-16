'use client'
import { usePathname } from "next/navigation";
import { FiEdit3, FiCheckCircle, FiShoppingBag, FiShoppingCart } from "react-icons/fi";

const STEPS = [
  { label: 'Take Quiz', icon: FiEdit3 },
  { label: 'Check Skin Match', icon: FiCheckCircle },
  { label: 'Compare Prices', icon: FiShoppingBag },
  { label: 'Buy', icon: FiShoppingCart },
]

export default function QuizSteps() {
  const pathname = usePathname();
  const showNavigationFlow = pathname === "/";

  return (
    <section aria-label="How it works" 
    className="bg-white px-4 py-6 sm:px-6 sm:py-">
      {showNavigationFlow && (
        <nav
          aria-label="How Roopsee works"
          className=" bg-white  lg:px-4"
        >
          <ol className="relative mx-auto grid max-w-2xl grid-cols-4 py-2.5 sm:py-3">
            <span
              aria-hidden="true"
              className="absolute left-[12.5%] right-[12.5%] top-[22px] h-px bg-[#ead8d3] sm:top-[26px]"
            />
            {STEPS.map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="relative flex min-w-0 flex-col items-center gap-1.5 px-1
                 text-center text-[9px] font-medium leading-tight text-gray-600
                  sm:text-[17px]"
              >
                <span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border
                 border-[#d9aaa2] bg-white sm:h-10 sm:w-10">
                  <Icon aria-hidden="true" className="h-3 w-3 text-[#d17a6d] sm:h-5 sm:w-5" />
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
