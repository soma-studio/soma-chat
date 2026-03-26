'use client'

import { useState, useEffect } from 'react'

type ScrollDirection = 'up' | 'down'

export function useScrollDirection(threshold = 10): ScrollDirection {
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>('up')

  useEffect(() => {
    let lastScrollY = window.scrollY

    const updateScrollDirection = () => {
      const scrollY = window.scrollY
      const direction: ScrollDirection = scrollY > lastScrollY ? 'down' : 'up'

      if (
        Math.abs(scrollY - lastScrollY) > threshold &&
        direction !== scrollDirection
      ) {
        setScrollDirection(direction)
      }

      lastScrollY = scrollY > 0 ? scrollY : 0
    }

    window.addEventListener('scroll', updateScrollDirection, { passive: true })
    return () => window.removeEventListener('scroll', updateScrollDirection)
  }, [scrollDirection, threshold])

  return scrollDirection
}
