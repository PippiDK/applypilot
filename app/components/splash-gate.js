'use client'

import {useState} from 'react'
import {SPLASH_MOTION} from '../lib/splash-motion.js'
import styles from './splash-gate.module.css'

function seconds(ms){return `${ms/1000}s`}

function PaperPlane(){
  return <g className={styles.paperPlaneFlight}>
    <g className={styles.paperPlane} transform="translate(-16 -11) scale(1.08)">
      <path className={styles.planeBody} d="M0 2 L34 10 L3 20 L10 11 Z"/>
      <path className={styles.planeWing} d="M10 11 L34 10 L17 16 Z"/>
      <path className={styles.planeFold} d="M10 11 L17 16"/>
    </g>
    <animateMotion
      path={SPLASH_MOTION.planeOrbitPath}
      begin={seconds(SPLASH_MOTION.planeDelayMs)}
      dur={seconds(SPLASH_MOTION.planeDurationMs)}
      rotate="auto"
      fill="freeze"
    />
    <animate
      attributeName="opacity"
      values="0;0;1;1;0"
      keyTimes="0;.025;.08;.88;1"
      begin={seconds(SPLASH_MOTION.planeDelayMs)}
      dur={seconds(SPLASH_MOTION.planeDurationMs)}
      fill="freeze"
    />
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
      <div className={styles.logoStage} aria-label="ApplyPilot approved Flight Path A with paper-plane orbit">
        <svg className={styles.logo} viewBox="0 0 700 600" role="img" aria-hidden="true">
          <defs>
            <filter id="planeGlow" x="-70%" y="-70%" width="240%" height="240%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <path className={styles.orbitTrailGlow} pathLength="1" d={SPLASH_MOTION.planeOrbitPath}/>
          <path className={styles.orbitTrail} pathLength="1" d={SPLASH_MOTION.planeOrbitPath}/>

          <g className={styles.logoApproach}>
            <image
              className={styles.approvedLogo}
              href={SPLASH_MOTION.logoAsset}
              x="50"
              y="10"
              width="560"
              height="560"
              preserveAspectRatio="xMidYMid meet"
            />
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
