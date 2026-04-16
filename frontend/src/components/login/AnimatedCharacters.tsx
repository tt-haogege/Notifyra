import { useState, useEffect, useRef, useCallback } from 'react'
import EyeBall from './EyeBall'
import Pupil from './Pupil'

interface AnimatedCharactersProps {
  isTyping?: boolean
  hasSecret?: boolean
  secretVisible?: boolean
}

export default function AnimatedCharacters({
  isTyping = false,
  hasSecret = false,
  secretVisible = false,
}: AnimatedCharactersProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false)
  const [isBlackBlinking, setIsBlackBlinking] = useState(false)
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false)
  const [isPurplePeeking, setIsPurplePeeking] = useState(false)

  const purpleRef = useRef<HTMLDivElement>(null)
  const blackRef = useRef<HTMLDivElement>(null)
  const yellowRef = useRef<HTMLDivElement>(null)
  const orangeRef = useRef<HTMLDivElement>(null)

  const purplePos = useRef({ faceX: 0, faceY: 0, bodySkew: 0 })
  const blackPos = useRef({ faceX: 0, faceY: 0, bodySkew: 0 })
  const yellowPos = useRef({ faceX: 0, faceY: 0, bodySkew: 0 })
  const orangePos = useRef({ faceX: 0, faceY: 0, bodySkew: 0 })

  const rafId = useRef<number>(0)

  const hiding = hasSecret && secretVisible
  const leaning = isTyping || (hasSecret && !secretVisible)

  const calcPos = useCallback((el: HTMLDivElement | null, target: { faceX: number; faceY: number; bodySkew: number }) => {
    if (!el) return
    const rect = el.getBoundingClientRect()
    const dx = mousePos.x - (rect.left + rect.width / 2)
    const dy = mousePos.y - (rect.top + rect.height / 3)
    target.faceX = Math.max(-15, Math.min(15, dx / 20))
    target.faceY = Math.max(-10, Math.min(10, dy / 30))
    target.bodySkew = Math.max(-6, Math.min(6, -dx / 120))
  }, [mousePos])

  const tick = useCallback(() => {
    calcPos(purpleRef.current, purplePos.current)
    calcPos(blackRef.current, blackPos.current)
    calcPos(yellowRef.current, yellowPos.current)
    calcPos(orangeRef.current, orangePos.current)
    rafId.current = requestAnimationFrame(tick)
  }, [calcPos])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  const setupBlink = useCallback((setter: (v: boolean) => void) => {
    let timeoutId: number
    const go = () => {
      timeoutId = window.setTimeout(() => {
        setter(true)
        window.setTimeout(() => {
          setter(false)
          go()
        }, 150)
      }, Math.random() * 4000 + 3000)
    }
    go()
    return () => clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    const stopPurple = setupBlink(setIsPurpleBlinking)
    const stopBlack = setupBlink(setIsBlackBlinking)
    rafId.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      stopPurple()
      stopBlack()
      cancelAnimationFrame(rafId.current)
    }
  }, [handleMouseMove, setupBlink, tick])

  useEffect(() => {
    if (isTyping) {
      setIsLookingAtEachOther(true)
      const timeout = setTimeout(() => setIsLookingAtEachOther(false), 800)
      return () => clearTimeout(timeout)
    } else {
      setIsLookingAtEachOther(false)
    }
  }, [isTyping])

  useEffect(() => {
    let timeoutId: number
    if (hasSecret && secretVisible) {
      timeoutId = window.setTimeout(() => {
        setIsPurplePeeking(true)
        setTimeout(() => setIsPurplePeeking(false), 800)
      }, Math.random() * 3000 + 2000)
    } else {
      setIsPurplePeeking(false)
    }
    return () => clearTimeout(timeoutId)
  }, [hasSecret, secretVisible])

  const purpleStyle: React.CSSProperties = {
    height: leaning ? '440px' : '400px',
    transform: hiding ? 'skewX(0deg)'
      : leaning ? `skewX(${purplePos.current.bodySkew - 12}deg) translateX(40px)`
      : `skewX(${purplePos.current.bodySkew}deg)`,
  }
  const purpleEyesStyle: React.CSSProperties = {
    left: hiding ? '20px' : isLookingAtEachOther ? '55px' : `${45 + purplePos.current.faceX}px`,
    top: hiding ? '35px' : isLookingAtEachOther ? '65px' : `${40 + purplePos.current.faceY}px`,
    gap: '32px',
  }
  const purpleLookX = hiding ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined
  const purpleLookY = hiding ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined

  const blackStyle: React.CSSProperties = {
    transform: hiding ? 'skewX(0deg)'
      : isLookingAtEachOther ? `skewX(${blackPos.current.bodySkew * 1.5 + 10}deg) translateX(20px)`
      : leaning ? `skewX(${blackPos.current.bodySkew * 1.5}deg)`
      : `skewX(${blackPos.current.bodySkew}deg)`,
  }
  const blackEyesStyle: React.CSSProperties = {
    left: hiding ? '10px' : isLookingAtEachOther ? '32px' : `${26 + blackPos.current.faceX}px`,
    top: hiding ? '28px' : isLookingAtEachOther ? '12px' : `${32 + blackPos.current.faceY}px`,
    gap: '24px',
  }
  const blackLookX = hiding ? -4 : isLookingAtEachOther ? 0 : undefined
  const blackLookY = hiding ? -4 : isLookingAtEachOther ? -4 : undefined

  const orangeStyle: React.CSSProperties = {
    transform: hiding ? 'skewX(0deg)' : `skewX(${orangePos.current.bodySkew}deg)`,
  }
  const orangeEyesStyle: React.CSSProperties = {
    left: hiding ? '50px' : `${82 + orangePos.current.faceX}px`,
    top: hiding ? '85px' : `${90 + orangePos.current.faceY}px`,
    gap: '32px',
  }

  const yellowStyle: React.CSSProperties = {
    transform: hiding ? 'skewX(0deg)' : `skewX(${yellowPos.current.bodySkew}deg)`,
  }
  const yellowEyesStyle: React.CSSProperties = {
    left: hiding ? '20px' : `${52 + yellowPos.current.faceX}px`,
    top: hiding ? '35px' : `${40 + yellowPos.current.faceY}px`,
    gap: '24px',
  }
  const yellowMouthStyle: React.CSSProperties = {
    left: hiding ? '10px' : `${40 + yellowPos.current.faceX}px`,
    top: hiding ? '88px' : `${88 + yellowPos.current.faceY}px`,
  }

  return (
    <div style={{ position: 'relative', width: '550px', height: '400px' }}>
      {/* Blue (was purple) */}
      <div ref={purpleRef} style={{ ...purpleStyle, position: 'absolute', bottom: 0, left: '70px', width: '180px', background: '#3b82f6', borderRadius: '10px 10px 0 0', zIndex: 1, transition: 'all 0.7s ease-in-out', transformOrigin: 'bottom center' }}>
        <div style={{ ...purpleEyesStyle, position: 'absolute', display: 'flex', transition: 'all 0.7s ease-in-out' }}>
          {[0, 1].map(i => (
            <EyeBall key={`p${i}`} size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#2D2D2D" isBlinking={isPurpleBlinking} forceLookX={purpleLookX} forceLookY={purpleLookY} />
          ))}
        </div>
      </div>

      {/* Black */}
      <div ref={blackRef} style={{ ...blackStyle, position: 'absolute', bottom: 0, left: '240px', width: '120px', height: '310px', background: '#2D2D2D', borderRadius: '8px 8px 0 0', zIndex: 2, transition: 'all 0.7s ease-in-out', transformOrigin: 'bottom center' }}>
        <div style={{ ...blackEyesStyle, position: 'absolute', display: 'flex', transition: 'all 0.7s ease-in-out' }}>
          {[0, 1].map(i => (
            <EyeBall key={`b${i}`} size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#2D2D2D" isBlinking={isBlackBlinking} forceLookX={blackLookX} forceLookY={blackLookY} />
          ))}
        </div>
      </div>

      {/* Orange */}
      <div ref={orangeRef} style={{ ...orangeStyle, position: 'absolute', bottom: 0, left: 0, width: '240px', height: '200px', background: '#FF9B6B', borderRadius: '120px 120px 0 0', zIndex: 3, transition: 'all 0.7s ease-in-out', transformOrigin: 'bottom center' }}>
        <div style={{ ...orangeEyesStyle, position: 'absolute', display: 'flex', transition: 'all 0.7s ease-in-out' }}>
          {[0, 1].map(i => (
            <Pupil key={`o${i}`} size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={hiding ? -5 : undefined} forceLookY={hiding ? -4 : undefined} />
          ))}
        </div>
      </div>

      {/* Yellow */}
      <div ref={yellowRef} style={{ ...yellowStyle, position: 'absolute', bottom: 0, left: '310px', width: '140px', height: '230px', background: '#E8D754', borderRadius: '70px 70px 0 0', zIndex: 4, transition: 'all 0.7s ease-in-out', transformOrigin: 'bottom center' }}>
        <div style={{ ...yellowEyesStyle, position: 'absolute', display: 'flex', transition: 'all 0.7s ease-in-out' }}>
          {[0, 1].map(i => (
            <Pupil key={`y${i}`} size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={hiding ? -5 : undefined} forceLookY={hiding ? -4 : undefined} />
          ))}
        </div>
        <div style={{ ...yellowMouthStyle, position: 'absolute', width: '80px', height: '4px', background: '#2D2D2D', borderRadius: '4px', transition: 'all 0.2s ease-out' }} />
      </div>
    </div>
  )
}
