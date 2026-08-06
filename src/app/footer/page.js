import Link from 'next/link'
import { FiArrowRight, FiInstagram, FiMail } from 'react-icons/fi'
import { FaFacebook, FaYoutube } from 'react-icons/fa'

const footerLinks = [
  {
    title: 'Roopsee',
    links: [
      { label: 'How it works', href: '/how-it-works' },
      { label: 'Contact', href: 'mailto:hello@roopsee.com' },
    ],
  },
]

const socialLinks = [
  { label: 'Instagram', href: 'https://www.instagram.com/roopsee_india/', icon: FiInstagram },
  { label: 'Facebook', href: 'https://www.facebook.com/people/Roopsee-India', icon: FaFacebook },
  { label: 'YouTube', href: 'https://www.youtube.com/@Roopsee_India', icon: FaYoutube },
]

export default function FooterPage() {
  return (
    <main className="flex min-h- items-end bg-[#fffefa]">
      <footer className="w-full bg-[#171417] text-[#f8f3ee]">
        <div className="mx-auto max-w-7xl px-5 pb-6 pt-12 sm:px-8 sm:pt-16 lg:px-10 lg:pb-8 lg:pt-20 xl:px-14 2xl:max-w-[90rem]">
          <div className="grid gap-12 border-b border-white/15 pb-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.7fr_0.7fr_1.2fr] lg:gap-10 lg:pb-16 xl:gap-16">
            <div className="max-w-sm xl:max-w-md">
              <Link
                href="/"
                className="inline-block text-[32px] font-semibold leading-none tracking-[-0.04em] text-white xl:text-[36px]"
                aria-label="Roopsee home"
              >
                roopsee<span className="text-[#ff00e6]">.</span>
              </Link>
              <p className="mt-5 font-cormorant text-2xl italic leading-snug text-white/85 sm:text-[28px] xl:text-[30px]">
                Better skincare starts with knowing your skin.
              </p>
              <p className="mt-4 max-w-xs font-lato text-xs leading-5 text-white/55 xl:max-w-sm xl:text-sm">
                Personalised product matches scored for your skin across 500+ beauty brands.
              </p>
            </div>

            {footerLinks.map((group) => (
              <nav key={group.title} aria-label={`${group.title} links`}>
                <h2 className="font-lato text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                  {group.title}
                </h2>
                <ul className="mt-5 space-y-3.5">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="font-lato text-sm text-white/80 transition-colors hover:text-[#ff8ff4]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            <div className="sm:col-span-2 lg:col-span-1">
              <h2 className="font-lato text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                Skin notes, delivered
              </h2>
              <p className="mt-5 max-w-sm font-lato text-sm leading-6 text-white/70">
                Product discoveries, routine tips and price-drop updates—without the clutter.
              </p>
              <form className="mt-6 flex max-w-sm border-b border-white/40" action="#">
                <FiMail className="mt-3 shrink-0 text-white/55" aria-hidden="true" />
                <label htmlFor="footer-email" className="sr-only">Email address</label>
                <input
                  id="footer-email"
                  name="email"
                  type="email"
                  placeholder="Your email address"
                  autoComplete="email"
                  required
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-lato text-sm text-white outline-none placeholder:text-white/35"
                />
                <button
                  type="submit"
                  className="flex h-10 w-10 shrink-0 items-center justify-center text-white transition-colors hover:text-[#ff8ff4]"
                  aria-label="Subscribe to newsletter"
                >
                  <FiArrowRight size={19} />
                </button>
              </form>
            </div>
          </div>

          <div className="flex flex-col gap-6 pt-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/70 transition hover:border-[#ff8ff4] hover:text-[#ff8ff4]"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>

            <div className="flex flex-col gap-3 font-lato text-[10px] text-white/40 lg:flex-row lg:items-center lg:gap-6">
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <a href="mailto:hello@roopsee.com" className="transition hover:text-white">Privacy enquiries</a>
              </div>
              <p>© {new Date().getFullYear()} Roopsee. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
