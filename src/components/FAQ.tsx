'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface FAQItem {
  question: string
  answer: string
}

interface FAQProps {
  items: FAQItem[]
  title?: string
}

export function FAQ({ items, title = 'Questions fréquentes' }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx))
  }

  return (
    <div>
      <section className="py-[var(--spacing-section)] max-[991px]:py-[var(--spacing-section-mobile)]">
        <div className="mx-auto max-w-[var(--container-max)] px-[var(--spacing-container)]">
          <div className="text-h3 font-semibold">{title}</div>
          <div className="mt-8 flex flex-col gap-3">
            {items.map((item, idx) => {
              const isOpen = openIndex === idx

              return (
                <motion.div
                  key={idx}
                  layout
                  className="overflow-hidden rounded-2xl border border-border bg-white"
                  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }}
                >
                  <button
                    type="button"
                    onClick={() => toggle(idx)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 px-7 py-5 text-left transition-colors max-[991px]:px-5"
                    aria-expanded={isOpen}
                  >
                    <span className="text-body font-medium text-title-text">
                      {item.question}
                    </span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                      className="flex shrink-0 items-center justify-center rounded-full"
                      style={{
                        width: 28,
                        height: 28,
                        backgroundColor: isOpen ? '#0e1527' : '#f0f0f0',
                      }}
                    >
                      <ChevronDown
                        size={15}
                        style={{ color: isOpen ? '#ffffff' : '#717171' }}
                      />
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          height: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
                          opacity: { duration: 0.25, delay: 0.05 },
                        }}
                        className="overflow-hidden"
                      >
                        <p className="px-7 pb-6 text-body leading-relaxed text-gray max-[991px]:px-5">
                          {item.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
