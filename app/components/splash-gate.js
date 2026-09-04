'use client'

import {useState} from 'react'
import {SPLASH_MOTION} from '../lib/splash-motion.js'
import styles from './splash-gate.module.css'

const MARK_A='M160 318 L221 121 Q225 108 238 108 H254 Q267 108 271 121 L332 318 H289 L274 270 H207 L192 318 Z M219 229 H262 L241 158 Z'
const MARK_CUT='M147 307 C 211 279 274 237 356 194'
const MARK_ARC='M151 313 C 205 289 266 247 356 194'
const MARK_TIP='M345 178 L376 188 L353 211 Z'

function seconds(ms){return `${ms/1000}s`}

function PaperPlane({front=false}){
  const delay=front?SPLASH_MOTION.planeFrontDelayMs:SPLASH_MOTION.planeDelayMs
  const duration=front?SPLASH_MOTION.planeFrontDurationMs:SPLASH_MOTION.planeBackDurationMs
  const path=front?SPLASH_MOTION.planeFrontPath:SPLASH_MOTION.planeBackPath
  return <g className={front?styles.planeFront:styles.planeBack}>
    <g className={styles.paperPlane} transform={front?'translate(-13 -9) scale(.95)':'translate(-13 -9) scale(.72)'}>
      <path className={styles.planeBody} d="M0 1 L30 9 L2 18 L8 10 Z"/>
      <path className={styles.planeFold} d="M8 10 L30 9 M8 10 L13 17"/>
    </g>
    <animateMotion path={path} begin={seconds(delay)} dur={seconds(duration)} rotate="auto" fill="freeze"/>
    <animate attributeName="opacity" values={front?'0;0;.96;.96;0':'0;.56;.56;0'} keyTimes={front?'0;.04;.12;.82;1':'0;.1;.84;1'} begin={seconds(delay)} dur={seconds(duration)} fill="freeze"/>
  </g>
}

export default function SplashGate({children}){
  const [entered,setEntered]=useState(false)
  if(entered) return children

  const motionStyle={
    '--logo-delay':`${SPLASH_MOTION.logoZoomDelayMs}ms`,
    '--logo-duration':`${SPLASH_MOTION.logoZoomDurationMs}ms`,
    '--logo-start-scale':SPLASH_MOTION.logoStartScale,
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
      <div className={styles.logoStage} aria-label="ApplyPilot Approach Fly-by logo animation">
        <svg className={styles.logo} viewBox="0 0 480 420" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="flybyMint" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a8f8d4"/>
              <stop offset="48%" stopColor="#63e9ae"/>
              <stop offset="100%" stopColor="#2fc488"/>
            </linearGradient>
            <filter id="flybyGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <PaperPlane/>

          <g className={styles.logoMark}>
            <rect className={styles.logoFrame} x="80" y="42" width="320" height="320" rx="68"/>
            <path className={styles.letterA} d={MARK_A} fill="url(#flybyMint)" fillRule="evenodd"/>
            <path className={styles.logoCut} d={MARK_CUT}/>
            <path className={styles.arcGlow} d={MARK_ARC}/>
            <path className={styles.arc} d={MARK_ARC}/>
            <path className={styles.arcTip} d={MARK_TIP}/>
          </g>

          <PaperPlane front/>
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
