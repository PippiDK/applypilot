'use client'

import {useEffect,useState} from 'react'
import {usePathname} from 'next/navigation'
import {SPLASH_MOTION} from '../lib/splash-motion.js'
import styles from './splash-gate.module.css'

export default function SplashGate({children}){
  const pathname=usePathname()
  const [entered,setEntered]=useState(false)

  // Manual Control is an internal tool, not a new app entrance. Once visited,
  // returning to ApplyPilot via client navigation must not replay the splash.
  useEffect(()=>{
    if(pathname==='/night-flight-control') setEntered(true)
  },[pathname])
  if(entered||pathname==='/night-flight-control') return children

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
      <div className={styles.logoStage} aria-label="ApplyPilot approved Flight Path A">
        <div className={styles.logoApproach}>
          <img className={styles.approvedLogo} src={SPLASH_MOTION.logoAsset} alt="" aria-hidden="true"/>
        </div>
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
