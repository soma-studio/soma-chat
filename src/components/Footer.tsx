const SITE_URL = 'https://somastudio.xyz'

const NAV_LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/nos-services', label: 'Nos services' },
  { href: '/projets', label: 'Projets' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
]

const LEGAL_LINKS = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/cgv', label: 'CGV' },
  { href: '/confidentialite', label: 'Confidentialité' },
]

const SOCIAL_LINKS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/soma-studio-it' },
  { label: 'Medium', href: 'https://medium.com/@hello_48962' },
]

const CALENDLY_URL = 'https://calendly.com/hello-somastudio/30min'
const WHATSAPP_URL = 'https://wa.me/message/FXICCYFMW5LSI1'
const CONTACT_EMAIL = 'hello@somastudio.xyz'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-[#d9d9d9] bg-white">
      <div className="mx-auto max-w-[1100px] px-[40px] py-16">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 gap-12 min-[992px]:grid-cols-3">
          {/* Column 1: Brand */}
          <div>
            <p
              className="text-2xl font-black tracking-tight text-[#000]"
              style={{ fontFamily: 'var(--font-roboto)' }}
            >
              SOMA
            </p>
            <p className="mt-3 text-[13px] text-[#717171]">
              Next gen. studio
            </p>
          </div>

          {/* Column 2: Navigation */}
          <div>
            <p className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-[#000]">
              Navigation
            </p>
            <ul className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={`${SITE_URL}${link.href}`}
                    className="text-[13px] text-[#717171] transition-colors duration-300 hover:text-[#000]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Contact & Socials */}
          <div>
            <p className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-[#000]">
              Contact
            </p>
            <ul className="flex flex-col gap-3">
              <li>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-[13px] text-[#717171] transition-colors duration-300 hover:text-[#000]"
                >
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#717171] transition-colors duration-300 hover:text-[#000]"
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#717171] transition-colors duration-300 hover:text-[#000]"
                >
                  Calendly
                </a>
              </li>
            </ul>

            <p className="mb-4 mt-8 text-[13px] font-semibold uppercase tracking-wider text-[#000]">
              Suivez-nous
            </p>
            <ul className="flex gap-4">
              {SOCIAL_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-[#717171] transition-colors duration-300 hover:text-[#000]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-[#d9d9d9] pt-8 min-[992px]:flex-row">
          <p className="text-[13px] text-[#717171]">
            &copy; {currentYear} SOMA Studio. Tous droits réservés.
          </p>
          <ul className="flex gap-6">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={`${SITE_URL}${link.href}`}
                  className="text-[13px] text-[#717171] transition-colors duration-300 hover:text-[#000]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
