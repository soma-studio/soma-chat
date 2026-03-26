'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useScrollDirection } from '@/hooks/useScrollDirection'

const SITE_URL = 'https://somastudio.xyz'

const NAV_LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/nos-services', label: 'Nos services' },
  { href: '/projets', label: 'Projets' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
]

const CALENDLY_URL = 'https://calendly.com/hello-somastudio/30min'

// "Nos services" is always active since this is a service sub-page
const ACTIVE_INDEX = 1

export function Navbar() {
  const scrollDirection = useScrollDirection()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const pillIndex = hoveredIndex ?? ACTIVE_INDEX

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <header
        className={`fixed left-0 right-0 top-0 z-[9999] transition-all duration-300 ${
          scrollDirection === 'down' && !isMobileMenuOpen
            ? '-translate-y-full'
            : 'translate-y-0'
        }`}
      >
        <div className="mx-auto px-4">
          <nav
            className={`mx-auto mt-4 flex w-fit items-center gap-8 rounded-[100px] px-6 py-3 transition-all duration-300 ${
              isScrolled
                ? 'bg-white/90 shadow-sm backdrop-blur-md'
                : 'bg-white'
            }`}
          >
            {/* Logo */}
            <a
              href={SITE_URL}
              className="text-xl font-black tracking-tight text-[#000]"
              style={{ fontFamily: 'var(--font-roboto)' }}
            >
              SOMA
            </a>

            {/* Desktop Navigation */}
            <ul
              className="hidden items-center gap-1 min-[992px]:flex"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {NAV_LINKS.map((link, idx) => (
                <li
                  key={link.href}
                  className="relative"
                  onMouseEnter={() => setHoveredIndex(idx)}
                >
                  {pillIndex === idx && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-[100px] bg-[#0e1527]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <a
                    href={`${SITE_URL}${link.href}`}
                    className={`relative z-10 block rounded-[100px] px-5 py-2.5 text-[13px] font-medium uppercase tracking-wider transition-colors duration-300 ${
                      pillIndex === idx
                        ? 'text-white'
                        : 'text-[#333] hover:text-[#000]'
                    }`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            {/* CTA + Mobile Toggle */}
            <div className="flex items-center gap-4">
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden rounded-[100px] bg-[#0e1527] px-5 py-2.5 text-[13px] font-medium uppercase tracking-wider text-white transition-all duration-300 hover:bg-[#19284c] min-[992px]:block"
              >
                Prendre RDV
              </a>

              {/* Hamburger */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="flex flex-col gap-1.5 min-[992px]:hidden"
                aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                aria-expanded={isMobileMenuOpen}
              >
                <span
                  className={`block h-[1.5px] w-6 bg-[#000] transition-all duration-300 ${
                    isMobileMenuOpen ? 'translate-y-2 rotate-45' : ''
                  }`}
                />
                <span
                  className={`block h-[1.5px] w-6 bg-[#000] transition-all duration-300 ${
                    isMobileMenuOpen ? 'opacity-0' : ''
                  }`}
                />
                <span
                  className={`block h-[1.5px] w-6 bg-[#000] transition-all duration-300 ${
                    isMobileMenuOpen ? '-translate-y-2 -rotate-45' : ''
                  }`}
                />
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[9998] bg-white pt-24">
          <div className="flex flex-col items-center gap-6 px-8 py-12">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={`${SITE_URL}${link.href}`}
                className={`text-lg font-medium ${
                  link.href === NAV_LINKS[ACTIVE_INDEX].href ? 'text-[#000]' : 'text-[#717171]'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 rounded-[100px] bg-[#0e1527] px-8 py-3 text-[13px] font-medium uppercase tracking-wider text-white"
            >
              Prendre RDV
            </a>
          </div>
        </div>
      )}

      {/* Spacer for fixed navbar */}
      <div className="h-24" aria-hidden="true" />
    </>
  )
}
