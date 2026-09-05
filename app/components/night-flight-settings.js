'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SEARCH_AREAS } from '../lib/job-list-filters.js'
import { DEFAULT_NIGHT_FLIGHT_SETTINGS, NIGHT_FLIGHT_SOURCES, normalizeNightFlightSettings } from '../lib/night-flight-settings.js'
import { requestNightFlightSettings, saveNightFlightSettings } from '../lib/night-flight-settings-client.js'
import styles from './night-flight-settings.module.css'

const initialSettings=()=>normalizeNightFlightSettings(DEFAULT_NIGHT_FLIGHT_SETTINGS)

export default function NightFlightSettings(){
  const [headerHost,setHeaderHost]=useState(null)
  const [open,setOpen]=useState(false)
  const [saved,setSaved]=useState(initialSettings)
  const [draft,setDraft]=useState(initialSettings)
  const [status,setStatus]=useState({loading:false,saving:false,loaded:false,error:'',notice:''})

  useEffect(()=>{
    setHeaderHost(document.querySelector('.headerActions'))
  },[])

  useEffect(()=>{
    if(!open) return
    let active=true
    setStatus({loading:true,saving:false,loaded:false,error:'',notice:''})
    requestNightFlightSettings()
      .then(settings=>{
        if(!active) return
        const next=normalizeNightFlightSettings(settings)
        setSaved(next)
        setDraft(next)
        setStatus({loading:false,saving:false,loaded:true,error:'',notice:''})
      })
      .catch(error=>{
        if(!active) return
        setStatus({loading:false,saving:false,loaded:false,error:error?.message||'Night Flight settings could not be loaded.',notice:''})
      })
    return ()=>{active=false}
  },[open])

  useEffect(()=>{
    if(!open) return
    const onKeyDown=event=>{
      if(event.key!=='Escape') return
      setDraft(saved)
      setStatus({loading:false,saving:false,loaded:false,error:'',notice:''})
      setOpen(false)
    }
    window.addEventListener('keydown',onKeyDown)
    return ()=>window.removeEventListener('keydown',onKeyDown)
  },[open,saved])

  const sourceError=draft.sources.length===0?'Select at least one source.':''

  function closeWithoutSaving(){
    setDraft(saved)
    setStatus({loading:false,saving:false,loaded:false,error:'',notice:''})
    setOpen(false)
  }

  function toggleSource(id){
    setDraft(current=>({
      ...current,
      sources:current.sources.includes(id)?current.sources.filter(value=>value!==id):[...current.sources,id],
    }))
    setStatus(current=>({...current,error:'',notice:''}))
  }

  function toggleArea(id){
    setDraft(current=>({
      ...current,
      areas:current.areas.includes(id)?current.areas.filter(value=>value!==id):[...current.areas,id],
    }))
    setStatus(current=>({...current,error:'',notice:''}))
  }

  async function persistDraft(){
    if(sourceError){
      setStatus(current=>({...current,error:sourceError,notice:''}))
      return
    }
    setStatus(current=>({...current,saving:true,error:'',notice:''}))
    try{
      const persisted=await saveNightFlightSettings(draft)
      const next=normalizeNightFlightSettings(persisted)
      setSaved(next)
      setDraft(next)
      setStatus({loading:false,saving:false,loaded:true,error:'',notice:'Saved'})
    }catch(error){
      setStatus(current=>({...current,saving:false,error:error?.message||'Night Flight settings could not be saved.',notice:''}))
    }
  }

  const trigger=headerHost?createPortal(
    <button type="button" className={styles.trigger} onClick={()=>setOpen(true)}>⚙️ Settings</button>,
    headerHost
  ):null

  const dialog=open?createPortal(
    <div className={styles.backdrop} onMouseDown={event=>{if(event.target===event.currentTarget) closeWithoutSaving()}}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="night-flight-settings-title">
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>NIGHT FLIGHT</p>
            <h2 id="night-flight-settings-title">Night Flight Settings</h2>
            <p className={styles.description}>Prepares matches from the last completed day overnight.</p>
          </div>
          <button type="button" className={styles.close} aria-label="Close Night Flight Settings" onClick={closeWithoutSaving}>×</button>
        </div>

        {status.loading?<div className={styles.loading}>Loading settings…</div>:<>
          <label className={styles.masterToggle}>
            <input type="checkbox" checked={draft.enabled} disabled={!status.loaded||status.saving} onChange={event=>setDraft(current=>({...current,enabled:event.target.checked}))}/>
            <span><b>Run Night Flight automatically</b><small>Uses the latest saved Search Profile for the last completed day.</small></span>
          </label>

          <fieldset className={styles.group} disabled={!status.loaded||status.saving}>
            <legend>Sources</legend>
            <div className={styles.checkGrid}>
              {NIGHT_FLIGHT_SOURCES.map(source=><label key={source.id} className={styles.option}>
                <input type="checkbox" checked={draft.sources.includes(source.id)} onChange={()=>toggleSource(source.id)}/>
                <span>{source.label}</span>
              </label>)}
            </div>
            {sourceError&&<p className={styles.validation}>{sourceError}</p>}
          </fieldset>

          <fieldset className={styles.group} disabled={!status.loaded||status.saving}>
            <legend>Match areas</legend>
            <div className={styles.areaGrid}>
              {SEARCH_AREAS.map(area=><label key={area.id} className={styles.option}>
                <input type="checkbox" checked={draft.areas.includes(area.id)} onChange={()=>toggleArea(area.id)}/>
                <span>{area.label}</span>
              </label>)}
            </div>
            <p className={styles.hint}>No areas selected = all areas</p>
          </fieldset>
        </>}

        {status.error&&<p className={styles.error} role="alert">{status.error}</p>}
        {status.notice&&<p className={styles.saved} aria-live="polite">{status.notice}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={closeWithoutSaving}>Cancel</button>
          <button type="button" className={styles.save} disabled={!status.loaded||status.saving||Boolean(sourceError)} onClick={persistDraft}>Save</button>
          {status.saving&&<span className={styles.saving} aria-live="polite">Saving…</span>}
        </div>
      </section>
    </div>,
    document.body
  ):null

  return <>{trigger}{dialog}</>
}
