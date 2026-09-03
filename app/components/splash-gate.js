'use client'

import {useState} from 'react'
import {SPLASH_MOTION} from '../lib/splash-motion.js'
import styles from './splash-gate.module.css'

const A_SHAPE='M126 256 L202 64 Q205 56 214 56 H238 Q247 56 250 64 L326 256 H280 L260 204 H188 L170 256 Z M204 166 H244 L224 112 Z'
const A_CUT='M108 224 C 177 190 249 151 340 112'

export default function SplashGate({children}){
  const [entered,setEntered]=useState(false)
  if(entered) return children

  const motionStyle={
    '--path-delay':`${SPLASH_MOTION.pathDelayMs}ms`,
    '--path-duration':`${SPLASH_MOTION.pathDurationMs}ms`,
    '--wordmark-delay':`${SPLASH_MOTION.wordmarkDelayMs}ms`,
    '--wordmark-duration':`${SPLASH_MOTION.wordmarkDurationMs}ms`,
    '--wordmark-start-scale':SPLASH_MOTION.wordmarkStartScale,
    '--wordmark-spacing':`${SPLASH_MOTION.wordmarkLetterSpacingEm}em`,
    '--apply-weight':SPLASH_MOTION.wordmarkApplyWeight,
    '--pilot-weight':SPLASH_MOTION.wordmarkPilotWeight,
  }

  return <div className={styles.splash} style={motionStyle}>
    <div className={styles.center}>
      <div className={styles.logoWrap} aria-label="ApplyPilot animated Flight Path A logo">
        <svg className={styles.logo} viewBox="0 0 440 330" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="applyPilotMint" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a8ffd8"/>
              <stop offset="48%" stopColor="#66efb0"/>
              <stop offset="100%" stopColor="#2fbf85"/>
            </linearGradient>
            <filter id="applyPilotGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <rect className={styles.logoFrame} x="48" y="20" width="344" height="290" rx="52"/>
          <path className={styles.letterA} d={A_SHAPE} fill="url(#applyPilotMint)"/>
          <path className={styles.cutPath} d={A_CUT}/>

          <path className={styles.flightGlow} d={SPLASH_MOTION.path}/>
          <path className={styles.flightPath} d={SPLASH_MOTION.path}/>
          <circle className={styles.flightStart} cx="96" cy="244" r="8"/>
          <circle className={styles.flightDot} r="4.5">
            <animateMotion dur={`${SPLASH_MOTION.pathDurationMs/1000}s`} begin={`${SPLASH_MOTION.pathDelayMs/1000}s`} fill="freeze" path={SPLASH_MOTION.path}/>
          </circle>
          <path className={styles.flightTip} d="M346 96 L374 105 L352 126 Z"/>
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
