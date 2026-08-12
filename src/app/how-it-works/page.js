import Header from '@/components/header'
import { FiArrowRight, FiCheck, FiHeart, FiSliders, FiStar, FiUser } from 'react-icons/fi'
import PageViewTracker from '@/components/tracking/page-view-tracker'
import HowItWorksCta from '@/components/tracking/how-it-works-cta'
import { EVENTS } from '@/lib/tracking/events'

export const metadata = {
  title: 'How It Works',
  description: 'See how Roopsee uses your skin profile to score and organise skincare products for you.',
}

const steps = [
  {
    number: '01',
    icon: FiUser,
    title: 'Tell us about your skin',
    text: 'Share your skin type, sensitivity, age and the concern you want to focus on. It only takes a minute.',
    detail: 'Your answers create a personal skin profile.',
  },
  {
    number: '02',
    icon: FiSliders,
    title: 'We compare the catalogue',
    text: 'Roopsee evaluates products across 500+ brands against the needs in your profile.',
    detail: 'Every result is organised around your answers.',
  },
  {
    number: '03',
    icon: FiStar,
    title: 'See your match scores',
    text: 'Products are grouped into clear match levels, so you can understand what fits and where to use caution.',
    detail: '90+ Great Match · 50–89 Caution · Below 50 Not Recommended',
  },
  {
    number: '04',
    icon: FiHeart,
    title: 'Save and shop smarter',
    text: 'Compare your matches, save favourites to your wishlist and return whenever your skin goals change.',
    detail: 'Update your profile anytime for refreshed results.',
  },
]

const values = [
  'Personalised to the profile you create',
  'Easy-to-read product match bands',
  'Hundreds of skincare brands in one place',
  'A profile you can update as your skin changes',
]

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[#fffefa] text-[#171417]">
      <Header />
      <PageViewTracker eventName={EVENTS.PAGE_VIEWED_HOW_IT_WORKS} properties={{ page_type: 'how_it_works' }} />

      <main>
        <section className="relative overflow-hidden border-b border-[#eadfea] px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
          <div className="absolute -right-28 -top-32 h-80 w-80 rounded-full bg-[#f4dff2] blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-36 -left-28 h-72 w-72 rounded-full bg-[#dcece8] blur-3xl" aria-hidden="true" />

          <div className="relative mx-auto max-w-4xl text-center">
            <p className="font-lato text-[10px] font-bold uppercase tracking-[0.24em] text-[#a15091]">
              Personalised skincare, made clearer
            </p>
            <h1 className="mt-5 font-cormorant text-5xl font-medium leading-[0.95] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              How your skin becomes<br className="hidden sm:block" /> a smarter <em className="font-normal">match</em>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl font-lato text-sm leading-6 text-[#655c65] sm:text-base sm:leading-7">
              A few thoughtful questions help us organise a large skincare catalogue around you—not the other way around.
            </p>
            <HowItWorksCta
              href="/#match-my-skin"
              position="hero"
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#171417] px-6 py-3.5 font-lato text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#a15091]"
            >
              Find my match <FiArrowRight size={16} />
            </HowItWorksCta>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-xl sm:mb-14">
              <p className="font-lato text-[10px] font-bold uppercase tracking-[0.22em] text-[#a15091]">Four simple steps</p>
              <h2 className="mt-3 font-cormorant text-4xl leading-none sm:text-5xl">From quiz to clarity</h2>
            </div>

            <div className="grid gap-px overflow-hidden rounded-2xl border border-[#e5dce5] bg-[#e5dce5] md:grid-cols-2 xl:grid-cols-4">
              {steps.map(({ number, icon: Icon, title, text, detail }) => (
                <article key={number} className="group bg-white p-6 sm:p-8">
                  <div className="flex items-center justify-between">
                    <span className="font-cormorant text-lg italic text-[#a15091]">{number}</span>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f4edf3] text-[#713564] transition group-hover:bg-[#171417] group-hover:text-white">
                      <Icon size={19} />
                    </span>
                  </div>
                  <h3 className="mt-10 font-cormorant text-[27px] font-medium leading-tight">{title}</h3>
                  <p className="mt-4 font-lato text-sm leading-6 text-[#706770]">{text}</p>
                  <p className="mt-7 border-t border-[#eee8ed] pt-5 font-lato text-[11px] leading-5 text-[#9a7091]">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#eee6ee] px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="font-lato text-[10px] font-bold uppercase tracking-[0.22em] text-[#814474]">What you get</p>
              <h2 className="mt-3 max-w-lg font-cormorant text-4xl leading-[1.02] sm:text-5xl">
                Less guesswork.<br /><em>More confident choices.</em>
              </h2>
              <p className="mt-6 max-w-lg font-lato text-sm leading-7 text-[#655c65]">
                Your score is a practical comparison tool designed to make a crowded catalogue easier to explore. It helps you narrow options based on the skin information you provide.
              </p>
            </div>

            <div className="rounded-2xl bg-[#171417] p-6 text-white shadow-[0_24px_60px_rgba(45,30,43,0.15)] sm:p-9">
              <ul className="space-y-5">
                {values.map((value) => (
                  <li key={value} className="flex items-start gap-4 font-lato text-sm leading-6 text-white/80">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#90f5da] text-[#171417]">
                      <FiCheck size={13} strokeWidth={3} />
                    </span>
                    {value}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="px-5 py-16 text-center sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-cormorant text-4xl leading-none sm:text-5xl">Ready to meet your matches?</h2>
            <p className="mt-5 font-lato text-sm leading-6 text-[#706770]">Create your skin profile for free and explore products scored for you.</p>
            <HowItWorksCta
              href="/#match-my-skin"
              position="closing"
              className="mt-7 inline-flex items-center gap-3 rounded-full border border-[#171417] px-6 py-3.5 font-lato text-xs font-bold uppercase tracking-[0.14em] transition hover:bg-[#171417] hover:text-white"
            >
              Take the skin quiz <FiArrowRight size={16} />
            </HowItWorksCta>
          </div>
        </section>
      </main>
    </div>
  )
}
