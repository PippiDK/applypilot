'use client'

import {useState} from 'react'
import {SPLASH_MOTION} from '../lib/splash-motion.js'
import styles from './splash-gate.module.css'

const FINAL_A='M242 90 Q238 90 235 100 L122 386 H178 L210 303 H345 L378 386 H432 L317 100 Q314 90 308 90 Z M278 158 L235 267 H317 Z'
const FINAL_CUT='M123 386 C 210 326 300 267 408 227'
const FINAL_CURVE='M171 404 C 235 337 308 276 407 228'
const FINAL_TIP='M397 207 L447 207 L414 240 Z'

export default function SplashGate({children}){
  const [entered,setEntered]=useState(false)
  if(entered) return children

  const motionStyle={
    '--path-delay':`${SPLASH_MOTION.pathDelayMs}ms`,
    '--path-duration':`${SPLASH_MOTION.pathDurationMs}ms`,
    '--logo-reveal-delay':`${SPLASH_MOTION.finalLogoRevealMs}ms`,
    '--logo-reveal-duration':`${SPLASH_MOTION.finalLogoDurationMs}ms`,
    '--motion-fade-duration':`${SPLASH_MOTION.motionFadeMs}ms`,
    '--wordmark-delay':`${SPLASH_MOTION.wordmarkDelayMs}ms`,
    '--wordmark-duration':`${SPLASH_MOTION.wordmarkDurationMs}ms`,
    '--wordmark-start-scale':SPLASH_MOTION.wordmarkStartScale,
    '--wordmark-spacing':`${SPLASH_MOTION.wordmarkLetterSpacingEm}em`,
    '--apply-weight':SPLASH_MOTION.wordmarkApplyWeight,
    '--pilot-weight':SPLASH_MOTION.wordmarkPilotWeight,
  }

  return <div className={styles.splash} style={motionStyle}>
    <div className={styles.center}>
      <div className={styles.logoStage} aria-label="ApplyPilot animated Flight Path A logo">
        <svg className={styles.logo} viewBox="0 0 544 473" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="applyPilotMint" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#91f3c5"/>
              <stop offset="48%" stopColor="#5be4a7"/>
              <stop offset="100%" stopColor="#27bf83"/>
            </linearGradient>
            <filter id="applyPilotGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <g className={styles.motionLayer}>
            <path className={styles.motionGlow} d={SPLASH_MOTION.motionPath}/>
            <path className={styles.motionPath} d={SPLASH_MOTION.motionPath}/>
            <path className={styles.motionTip} d={SPLASH_MOTION.motionTip}/>
          </g>

          <g className={styles.finalLogo}>
            <rect className={styles.logoFrame} x="59" y="18" width="445" height="444" rx="82"/>
            <path className={styles.finalA} d={FINAL_A} fill="url(#applyPilotMint)" fillRule="evenodd"/>
            <path className={styles.finalCut} d={FINAL_CUT}/>
            <path className={styles.finalCurve} d={FINAL_CURVE}/>
            <circle className={styles.finalStart} cx="171" cy="404" r="15"/>
            <path className={styles.finalTip} d={FINAL_TIP}/>
          </g>
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
