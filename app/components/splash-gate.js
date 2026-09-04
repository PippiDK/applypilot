'use client'

import {useState} from 'react'
import {SPLASH_MOTION} from '../lib/splash-motion.js'
import styles from './splash-gate.module.css'

const MARK_A='M160 318 L221 121 Q225 108 238 108 H254 Q267 108 271 121 L332 318 H289 L274 270 H207 L192 318 Z M219 229 H262 L241 158 Z'
const MARK_CUT='M147 307 C 211 279 274 237 356 194'
const MARK_ARC='M151 313 C 205 289 266 247 356 194'
const MARK_TIP='M345 178 L376 188 L353 211 Z'
const SCAN='M82 304 L397 136'

export default function SplashGate({children}){
  const [entered,setEntered]=useState(false)
  if(entered) return children

  const motionStyle={
    '--scan-delay':`${SPLASH_MOTION.scanDelayMs}ms`,
    '--scan-duration':`${SPLASH_MOTION.scanDurationMs}ms`,
    '--mark-delay':`${SPLASH_MOTION.markDelayMs}ms`,
    '--mark-duration':`${SPLASH_MOTION.markDurationMs}ms`,
    '--arc-delay':`${SPLASH_MOTION.arcDelayMs}ms`,
    '--arc-duration':`${SPLASH_MOTION.arcDurationMs}ms`,
    '--wordmark-delay':`${SPLASH_MOTION.wordmarkDelayMs}ms`,
    '--wordmark-duration':`${SPLASH_MOTION.wordmarkDurationMs}ms`,
    '--wordmark-start-scale':SPLASH_MOTION.wordmarkStartScale,
    '--wordmark-spacing':`${SPLASH_MOTION.wordmarkLetterSpacingEm}em`,
    '--apply-weight':SPLASH_MOTION.wordmarkApplyWeight,
    '--pilot-weight':SPLASH_MOTION.wordmarkPilotWeight,
    '--tagline-delay':`${SPLASH_MOTION.taglineDelayMs}ms`,
    '--entry-delay':`${SPLASH_MOTION.entryDelayMs}ms`,
  }

  return <div className={styles.splash} style={motionStyle}>
    <div className={styles.center}>
      <div className={styles.logoStage} aria-label="ApplyPilot Precision Launch logo animation">
        <svg className={styles.logo} viewBox="0 0 480 420" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="precisionMint" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a8f8d4"/>
              <stop offset="48%" stopColor="#63e9ae"/>
              <stop offset="100%" stopColor="#2fc488"/>
            </linearGradient>
            <linearGradient id="scanMint" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#65edb2" stopOpacity="0"/>
              <stop offset="50%" stopColor="#b9ffe1" stopOpacity=".95"/>
              <stop offset="100%" stopColor="#65edb2" stopOpacity="0"/>
            </linearGradient>
            <filter id="precisionGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <path className={styles.scanBeam} d={SCAN}/>

          <rect className={styles.logoFrame} x="80" y="42" width="320" height="320" rx="68"/>
          <path className={styles.letterA} d={MARK_A} fill="url(#precisionMint)" fillRule="evenodd"/>
          <path className={styles.logoCut} d={MARK_CUT}/>
          <path className={styles.arcGlow} d={MARK_ARC}/>
          <path className={styles.arc} d={MARK_ARC}/>
          <path className={styles.arcTip} d={MARK_TIP}/>
        </svg>
      </div>

      <div className={styles.wordmark}>
        <span>Apply</span><b>Pilot</b>
      </div>
      <div className={styles.tagline}>SEARCH LESS. <span>APPLY BETTER.</span></div>
    </div>

    <button className={styles.enter} style={{color:SPLASH_MOTION.entryColor}} onClick={()=>setEntered(true)}>
      {SPLASH_MOTION.entryLabel}
    </button>
  </div>
}
