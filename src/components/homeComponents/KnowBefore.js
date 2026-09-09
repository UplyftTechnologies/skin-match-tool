'use client'

import Animation2 from '../Animation2'
import SkincareCharacter from './SkincareCharacter'
import styles from './KnowBeforeHeading.module.css'
import Image from 'next/image'
import mmsimg from "../../assets/images/mms.png"
/* previous design (kept for reference, not in use)
export default function KnowBefore() {
  return (
      <section aria-labelledby="skin-match-heading" className="relative overflow-hidden
       bg-[#F8EEEB] bg-[linear-gradient(120deg,#F8EEEB_0%,#FFF9F3_50%,_100%)] px-4 py-3 sm:px-6 sm:py-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h3 id="skin-match-heading" className={`${styles.heading} whitespace-nowrap font-cormorant
          text-[clamp(1.5rem,8vw,3.5rem)] font-medium leading-[1.12] tracking-[-0.025em]
           text-[#253b33] sm:text-[clamp(2rem,5vw,3.5rem)]`}>
            <span className="heading-intro">Skin match</span>{' '}<em className="relative inline-block whitespace-nowrap font-normal italic text-[#0f766e]">
              tool
              <svg aria-hidden="true" viewBox="0 0 220 16" preserveAspectRatio="none"
               className="absolute -bottom-2.5 left-0 h-2.5 w-full text-[#aac4ae]">
                <path className={styles.underline} pathLength="1" d="M4 11 C58 5 139 3 216 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </em>
          </h3>
          <div className="mt-4 flex w-full max-w-[560px] items-center gap-3 rounded-2xl border border-[#EADFD3] bg-[#FBF6EF] p-3 shadow-sm sm:mt-6 sm:gap-4 sm:p-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full sm:h-20 sm:w-20">
              <SkincareCharacter />
            </div>
            <div className="flex min-h-[3.5rem] flex-1 items-center justify-center rounded-xl bg-[#D8E7E6] px-3 py-2 sm:min-h-[4rem] sm:px-4">
              <Animation2 className="concern-animation-home" />
            </div>
          </div>
        </div>
      </section>
  )
}
*/

export default function KnowBefore() {
  return (
      <section aria-labelledby="skin-match-heading" className="relative overflow-hidden
       bg-[#fff]
        bg-[length:16px_16px] px-2 py-0 sm:px-6 sm:py-8">
        {/* <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h3 id="skin-match-heading" className={`${styles.heading} whitespace-nowrap font-cormorant
          text-[12px] font-medium leading-[1.12] tracking-[-0.025em]
           text-[#253b33] sm:text-[40px]`}>
            Skin <em className="font-normal italic">match</em> tool
          </h3>
        </div> */}
        <div className="mt-1 flex w-full lg:w-[60%] mx-auto items-center
         gap-4 rounded-sm bg-[#FAF6EF] p-3 sm:mt-5 sm:gap-5 sm:p-5">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full sm:h-24 sm:w-24">
           <Image src={mmsimg} width={96} height={96} sizes="96px" alt="" />
          </div>
          <div className="flex w-full
            items-center justify-center rounded-lg bg-[#D8E7E6]
            px-1 py-2 sm:px-4">
            <Animation2 className="concern-animation-home" />
          </div>
        </div>
      </section>
  )
}
