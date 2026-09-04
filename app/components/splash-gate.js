'use client'

import {useState} from 'react'
import {SPLASH_MOTION} from '../lib/splash-motion.js'
import styles from './splash-gate.module.css'

const FINAL_A='M242 90 Q238 90 235 100 L122 386 H178 L210 303 H345 L378 386 H432 L317 100 Q314 90 308 90 Z M278 158 L235 267 H317 Z'
const FINAL_CUT='M123 386 C 210 326 300 267 408 227'
const FINAL_CURVE='M171 404 C 235 337 308 276 407 228'
const FINAL_TIP='M397 207 L447 207 L414 240 Z'

function seconds(ms){return `${ms/1000}s`}

function PaperPlane(){
  return <g className={styles.paperPlaneFlight}>
    <g className={styles.paperPlane} transform="translate(-15 -10) scale(1.05)">
      <path className={styles.planeBody} d="M0 2 L32 10 L3 19 L9 11 Z"/>
      <path className={styles.planeFold} d="M9 11 L32 10 M9 11 L14 18"/>
    </g>
    <animateMotion path={SPLASH_MOTION.planeOrbitPath} begin={seconds(SPLASH_MOTION.planeDelayMs)} dur={seconds(SPLASH_MOTION.planeDurationMs)} rotate="auto" fill="freeze"/>
    <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.03;.09;.86;1" begin={seconds(SPLASH_MOTION.planeDelayMs)} dur={seconds(SPLASH_MOTION.planeDurationMs)} fill="freeze"/>
  </g>
}

export default function SplashGate({children}){
  const [entered,setEntered]=useState(false)
  if(entered) return children

  const motionStyle={
    '--logo-delay':`${SPLASH_MOTION.logoZoomDelayMs}ms`,
    '--logo-duration':`${SPLASH_MOTION.logoZoomDurationMs}ms`,
    '--logo-start-scale':SPLASH_MOTION.logoStartScale,
    '--plane-delay':`${SPLASH_MOTION.planeDelayMs}ms`,
    '--plane-duration':`${SPLASH_MOTION.planeDurationMs}ms`,
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
      <div className={styles.logoStage} aria-label="ApplyPilot glowing Flight Path A with paper-plane fly-by">
        <svg className={styles.logo} viewBox="0 0 560 500" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="flightPathMint" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a8f8d4"/>
              <stop offset="48%" stopColor="#63e9ae"/>
              <stop offset="100%" stopColor="#2fc488"/>
            </linearGradient>
            <filter id="logoMintGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <path className={styles.orbitTrailGlow} d={SPLASH_MOTION.planeOrbitPath}/>
          <path className={styles.orbitTrail} d={SPLASH_MOTION.planeOrbitPath}/>

          <g className={styles.logoApproach}>
            <g className={styles.logoGlow}>
              <rect className={styles.logoFrame} x="59" y="18" width="445" height="444" rx="82"/>
              <path className={styles.letterA} d={FINAL_A} fill="url(#flightPathMint)" fillRule="evenodd"/>
              <path className={styles.logoCut} d={FINAL_CUT}/>
              <path className={styles.arcGlow} d={FINAL_CURVE}/>
              <path className={styles.arc} d={FINAL_CURVE}/>
              <circle className={styles.finalStart} cx="171" cy="404" r="15"/>
              <path className={styles.arcTip} d={FINAL_TIP}/>
            </g>
          </g>

          <PaperPlane/>
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
