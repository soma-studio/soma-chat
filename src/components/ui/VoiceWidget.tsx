'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const VOICE_BASE = process.env.NEXT_PUBLIC_VOICE_URL || 'https://voice.somastudio.xyz'
const EMBED_URL = `${VOICE_BASE}/embed?siteId=somastudio-xyz`

const EXCLUDED_PATHS = ['/admin']

function useOrientation() {
  const [isLandscape, setIsLandscape] = useState(false)
  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isLandscape
}

/* ═══════════════════════════════════════════════════════════════════════
   SPHERE BUTTON — Animated wireframe sphere with 10 latitude lines
   ═══════════════════════════════════════════════════════════════════════ */

const SPHERE_COLORS: [number, number, number][] = [
  [200, 50, 220],
  [50, 180, 230],
  [230, 150, 50],
  [200, 70, 200],
  [140, 60, 240],
  [60, 200, 210],
  [225, 120, 65],
  [175, 85, 215],
  [170, 50, 230],
  [45, 190, 220],
]

const LATITUDES = [-82, -65, -48, -30, -12, 6, 24, 42, 60, 78]

function SphereCanvas({ targetIntensity }: { targetIntensity: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const tRef = useRef(0)
  const intensityRef = useRef(0.15)

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return

    cvs.width = 112
    cvs.height = 112
    ctx.setTransform(2, 0, 0, 2, 0, 0)

    const draw = () => {
      const w = 56, h = 56
      const cx = w / 2, cy = h / 2
      const radius = 22
      ctx.clearRect(0, 0, w, h)

      tRef.current += 0.016
      const time = tRef.current

      intensityRef.current += (targetIntensity - intensityRef.current) * 0.025
      const intensity = intensityRef.current

      const globalPhase = time * 0.8
      const freq1 = 3.2, freq2 = 5.8, freq3 = 1.6

      for (let li = 0; li < LATITUDES.length; li++) {
        const latDeg = LATITUDES[li]
        const latRad = (latDeg * Math.PI) / 180
        const yPos = cy - Math.sin(latRad) * radius
        const sliceR = Math.cos(latRad) * radius

        if (sliceR < 1) continue

        const latFactor = Math.pow(Math.cos(latRad), 3)
        const waveAmp = radius * 0.24 * latFactor

        const [baseR, baseG, baseB] = SPHERE_COLORS[li]
        const rv = Math.min(255, baseR + Math.floor(intensity * 40))
        const gv = Math.min(255, baseG + Math.floor(intensity * 30))
        const bv = Math.min(255, baseB + Math.floor(intensity * 20))
        const alpha = 0.3 + intensity * 0.55
        const lineWidth = 1.2 + intensity * 1.5

        ctx.beginPath()
        ctx.strokeStyle = `rgba(${rv},${gv},${bv},${alpha.toFixed(3)})`
        ctx.lineWidth = lineWidth
        ctx.lineCap = 'round'

        const steps = 60
        for (let s = 0; s <= steps; s++) {
          const progress = s / steps
          const arcAngle = Math.PI + progress * Math.PI

          const px = cx + Math.cos(arcAngle) * sliceR
          const edgeFade = Math.pow(Math.sin(progress * Math.PI), 0.5)
          const wave =
            Math.sin(arcAngle * freq1 + globalPhase) * waveAmp * 0.55 +
            Math.sin(arcAngle * freq2 + globalPhase * 1.3) * waveAmp * 0.28 +
            Math.sin(arcAngle * freq3 + globalPhase * 0.6) * waveAmp * 0.22
          const py = yPos + wave * edgeFade

          if (s === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    draw()

    return () => cancelAnimationFrame(rafRef.current)
  }, [targetIntensity])

  return (
    <canvas
      ref={canvasRef}
      width={112}
      height={112}
      style={{ width: 56, height: 56, display: 'block' }}
    />
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   VOICE WIDGET
   ═══════════════════════════════════════════════════════════════════════ */

export default function VoiceWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)
  const [sphereIntensity, setSphereIntensity] = useState(0.15)
  const audioPlayedRef = useRef(false)
  const mountTimeRef = useRef(Date.now())
  const pathname = usePathname()
  const isLandscape = useOrientation()

  const isExcluded = EXCLUDED_PATHS.some((p) => pathname.startsWith(p))

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (isOpen) return
    const alreadyShown = sessionStorage.getItem('soma-voice-greeted')
    if (alreadyShown) return

    const showTimer = setTimeout(() => {
      setShowGreeting(true)
      setSphereIntensity(1.0)
      sessionStorage.setItem('soma-voice-greeted', '1')
    }, 5000)

    return () => clearTimeout(showTimer)
  }, [isOpen])

  useEffect(() => {
    const playGreeting = () => {
      if (audioPlayedRef.current || !showGreeting) return
      if (Date.now() - mountTimeRef.current < 5000) return
      audioPlayedRef.current = true
      try {
        const audio = new Audio('/greeting.mp3')
        audio.volume = 0.7
        audio.play().catch(() => {})
      } catch {}
      document.removeEventListener('click', playGreeting)
      document.removeEventListener('scroll', playGreeting)
    }
    document.addEventListener('click', playGreeting)
    document.addEventListener('scroll', playGreeting)
    return () => {
      document.removeEventListener('click', playGreeting)
      document.removeEventListener('scroll', playGreeting)
    }
  }, [showGreeting])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen])

  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen, isMobile])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== VOICE_BASE) return
      if (event.data?.type !== 'soma-voice-event') return
      if (
        typeof window !== 'undefined' &&
        (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
      ) {
        ;(window as unknown as { gtag: (...args: unknown[]) => void }).gtag(
          'event',
          event.data.event,
          {
            event_category: 'voice_widget',
            ...event.data.data,
          },
        )
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const handleOpen = useCallback(() => {
    setShowGreeting(false)
    setIsOpen(true)
  }, [])

  if (isExcluded) return null

  const panelStyle: React.CSSProperties = isMobile
    ? {}
    : isLandscape
      ? { width: 'min(85vw, 900px)', height: 'min(70vh, 600px)' }
      : { width: 'min(420px, 85vw)', height: 'min(80vh, 700px)' }

  return (
    <>
      <AnimatePresence>
        {showGreeting && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={handleOpen}
            className="fixed bottom-8 right-[5.5rem] z-50 cursor-pointer rounded-2xl border border-[rgba(232,168,124,0.2)] px-4 py-3 shadow-lg backdrop-blur-sm max-[767px]:right-[5rem] max-[767px]:max-w-[200px]"
            style={{
              background: 'linear-gradient(135deg, rgba(232,168,124,0.12) 0%, rgba(232,168,124,0.06) 100%)',
            }}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowGreeting(false) }}
              className="absolute right-1 top-1 cursor-pointer text-[#717171] transition-colors hover:text-[#333]"
              aria-label="Fermer"
            >
              <X size={12} />
            </button>
            <p className="text-sm font-medium text-[#e8a87c] whitespace-nowrap max-[767px]:whitespace-normal">
              Besoin d&apos;aide ? Parlez-moi !
            </p>
            <div
              className="absolute right-[-6px] top-1/2 -translate-y-1/2 h-3 w-3 rotate-45 border-r border-t border-[rgba(232,168,124,0.2)]"
              style={{ background: 'rgba(232,168,124,0.10)' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2 }}
            onClick={handleOpen}
            className="fixed bottom-6 right-6 z-50 cursor-pointer overflow-hidden rounded-full"
            style={{ width: 56, height: 56 }}
            role="button"
            aria-label="Assistant vocal SOMA Studio"
          >
            <SphereCanvas targetIntensity={sphereIntensity} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <div
        className={[
          'fixed z-[10001] overflow-hidden border border-[#d9d9d9] shadow-2xl',
          'max-[767px]:inset-0 max-[767px]:rounded-none max-[767px]:border-0',
          'min-[768px]:left-1/2 min-[768px]:top-1/2 min-[768px]:-translate-x-1/2 min-[768px]:-translate-y-1/2 min-[768px]:rounded-2xl',
        ].join(' ')}
        style={{
          visibility: isOpen ? 'visible' : 'hidden',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          background: '#f9f9f9',
          ...panelStyle,
        }}
      >
        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#d9d9d9] bg-white text-[#717171] transition-colors hover:bg-[#f0f0f0] hover:text-[#333333]"
          aria-label="Fermer l'assistant vocal"
        >
          <X size={16} />
        </button>

        <iframe
          src={EMBED_URL}
          className="absolute inset-0 z-[1] h-full w-full border-0"
          allow="microphone"
          title="Assistant vocal SOMA Studio"
        />
      </div>
    </>
  )
}
