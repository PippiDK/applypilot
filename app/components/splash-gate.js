'use client'

import {useState} from 'react'
import {SPLASH_MOTION} from '../lib/splash-motion.js'
import styles from './splash-gate.module.css'

export default function SplashGate({children}){
  const [entered,setEntered]=useState(false)
  if(entered) return children

  return <div className={styles.splash}>
    <div className={styles.center}>
      <div className={styles.logoWrap} aria-label="ApplyPilot animated logo">
        <svg className={styles.logo} viewBox="0 0 440 330" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="applyPilotMint" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a8ffd8"/>
              <stop offset="48%" stopColor="#66efb0"/>
              <stop offset="100%" stopColor="#2fbf85"/>
            </linearGradient>
            <filter id="applyPilotGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <path className={styles.letterA} d="M128 254 L206 58 H244 L324 254 H278 L257 202 H190 L170 254 Z M205 164 H243 L224 112 Z" fill="url(#applyPilotMint)"/>
          <path className={styles.flightGlow} d={SPLASH_MOTION.path}/>
          <path className={styles.flightPath} d={SPLASH_MOTION.path}/>
          <circle className={styles.flightDot} r="7">
            <animateMotion dur="1.7s" begin="0.22s" fill="freeze" path={SPLASH_MOTION.path}/>
          </circle>
          <path className={styles.flightTip} d="M346 113 L371 124 L349 141 Z"/>
        </svg>
      </div>

      <div className={styles.wordmark} style={{'--wordmark-start-scale':SPLASH_MOTION.wordmarkStartScale}}>
        <span>Apply</span><b>Pilot</b>
      </div>
      <div className={styles.tagline}>SEARCH LESS. <span>APPLY BETTER.</span></div>
    </div>

    <button className={styles.enter} style={{color:SPLASH_MOTION.entryColor}} onClick={()=>setEntered(true)}>{SPLASH_MOTION.entryLabel}</button>
  </div>
}
