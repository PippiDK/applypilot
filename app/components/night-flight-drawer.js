'use client'
import {useEffect,useState} from 'react'
import styles from './night-flight-drawer.module.css'

export default function NightFlightDrawer({children}){
  const [open,setOpen]=useState(false)

  useEffect(()=>{
    if(!open) return
    const onKeyDown=event=>{
      if(event.key==='Escape') setOpen(false)
    }
    window.addEventListener('keydown',onKeyDown)
    return ()=>window.removeEventListener('keydown',onKeyDown)
  },[open])

  return <>
    <button type="button" className={styles.tab} onClick={()=>setOpen(true)} aria-label="Open Night Flight" aria-expanded={open}>
      <span>NIGHT FLIGHT</span>
    </button>
    <div className={`${styles.backdrop} ${open?styles.visible:''}`} aria-hidden={!open} onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
      <aside className={styles.drawer} aria-label="Night Flight">
        <div className={styles.heading}>
          <div><p className={styles.eyebrow}>NIGHT FLIGHT</p><h2>Night Flight</h2></div>
          <button type="button" className={styles.close} aria-label="Close Night Flight" onClick={()=>setOpen(false)}>×</button>
        </div>
        <section className={styles.section}>
          <h3>Morning Review</h3>
          <div id="nightFlightReviewHost" className={styles.reviewHost}/>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div><h3>Automation</h3><p>Run Night Flight automatically using your saved Search Profile.</p></div>
            <div id="nightFlightSettingsHost" className={styles.settingsHost}/>
          </div>
        </section>
        {children}
      </aside>
    </div>
  </>
}
