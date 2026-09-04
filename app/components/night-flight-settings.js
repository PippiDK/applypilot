'use client'

import {useState} from 'react'
import {SEARCH_AREAS} from '../lib/job-list-filters.js'

const SOURCES=[
  {id:'linkedin',label:'LinkedIn'},
  {id:'jobindex',label:'Jobindex'},
  {id:'jobnet',label:'Jobnet'},
]

const DEFAULTS={enabled:false,sources:SOURCES.map(({id})=>id),areas:[]}

const controlStyle={
  border:'1px solid rgba(255,255,255,.14)',
  borderRadius:8,
  background:'rgba(15,15,15,.88)',
  color:'#cfcfcf',
  padding:'7px 10px',
  fontSize:12,
  fontWeight:700,
  cursor:'pointer',
  backdropFilter:'blur(8px)',
  lineHeight:1.4,
}

const secondaryButton={...controlStyle,padding:'8px 14px'}
const primaryButton={...secondaryButton,background:'#dffbf0',color:'#08110d',borderColor:'#dffbf0'}

function cloneSettings(value=DEFAULTS){
  return {
    enabled:value?.enabled===true,
    sources:Array.isArray(value?.sources)?[...value.sources]:[...DEFAULTS.sources],
    areas:Array.isArray(value?.areas)?[...value.areas]:[],
  }
}

export default function NightFlightSettings(){
  const [open,setOpen]=useState(false)
  const [loaded,setLoaded]=useState(false)
  const [saved,setSaved]=useState(()=>cloneSettings())
  const [draft,setDraft]=useState(()=>cloneSettings())
  const [state,setState]=useState({loading:false,saving:false,error:''})

  async function openSettings(){
    setOpen(true)
    setState(current=>({...current,error:''}))
    if(loaded){setDraft(cloneSettings(saved));return}
    setState({loading:true,saving:false,error:''})
    try{
      const response=await fetch('/api/night-flight/settings',{cache:'no-store'})
      const data=await response.json().catch(()=>({}))
      if(!response.ok) throw new Error(data.error||'Night Flight settings could not be loaded.')
      const next=cloneSettings(data.settings)
      setSaved(next)
      setDraft(cloneSettings(next))
      setLoaded(true)
      setState({loading:false,saving:false,error:''})
    }catch(error){
      setState({loading:false,saving:false,error:error?.message||'Night Flight settings could not be loaded.'})
    }
  }

  function cancelSettings(){
    setDraft(cloneSettings(saved))
    setState(current=>({...current,error:''}))
    setOpen(false)
  }

  function toggleSource(id){
    setDraft(current=>({...current,sources:current.sources.includes(id)?current.sources.filter(value=>value!==id):[...current.sources,id]}))
    setState(current=>({...current,error:''}))
  }

  function toggleArea(id){
    setDraft(current=>({...current,areas:current.areas.includes(id)?current.areas.filter(value=>value!==id):[...current.areas,id]}))
  }

  async function saveSettings(){
    if(!draft.sources.length){
      setState(current=>({...current,error:'Select at least one source.'}))
      return
    }
    setState({loading:false,saving:true,error:''})
    try{
      const response=await fetch('/api/night-flight/settings',{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(draft),
      })
      const data=await response.json().catch(()=>({}))
      if(!response.ok) throw new Error(data.error||'Night Flight settings could not be saved.')
      const next=cloneSettings(data.settings||draft)
      setSaved(next)
      setDraft(cloneSettings(next))
      setLoaded(true)
      setState({loading:false,saving:false,error:''})
      setOpen(false)
    }catch(error){
      setState({loading:false,saving:false,error:error?.message||'Night Flight settings could not be saved.'})
    }
  }

  const saveBlocked=state.loading||state.saving||!draft.sources.length

  return <>
    <button type="button" style={controlStyle} onClick={openSettings}>SETTINGS ⚙️</button>
    {open&&<div role="presentation" style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(0,0,0,.68)',display:'grid',placeItems:'center',padding:20}} onMouseDown={event=>{if(event.target===event.currentTarget) cancelSettings()}}>
      <section role="dialog" aria-modal="true" aria-labelledby="night-flight-settings-title" style={{width:'min(560px,96vw)',maxHeight:'86vh',overflow:'auto',background:'#101418',border:'1px solid rgba(255,255,255,.14)',borderRadius:16,padding:22,boxShadow:'0 24px 80px rgba(0,0,0,.45)',color:'#edf2f7'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start'}}>
          <div><h2 id="night-flight-settings-title" style={{margin:'0 0 6px',fontSize:22}}>Night Flight Settings</h2><p style={{margin:0,color:'#9ba9b8',fontSize:13}}>Prepares matches from the last completed day overnight.</p></div>
          <button type="button" aria-label="Close Night Flight settings" onClick={cancelSettings} style={{...controlStyle,padding:'5px 9px'}}>×</button>
        </div>

        {state.loading?<p style={{marginTop:22}}>Loading settings…</p>:<>
          <label style={{display:'flex',gap:10,alignItems:'center',marginTop:24,fontWeight:700}}>
            <input type="checkbox" checked={draft.enabled} onChange={event=>setDraft(current=>({...current,enabled:event.target.checked}))}/>
            Run Night Flight automatically
          </label>

          <div style={{marginTop:24}}><h3 style={{margin:'0 0 10px',fontSize:14}}>Sources</h3>
            <div style={{display:'grid',gap:9}}>{SOURCES.map(source=><label key={source.id} style={{display:'flex',gap:9,alignItems:'center'}}><input type="checkbox" checked={draft.sources.includes(source.id)} onChange={()=>toggleSource(source.id)}/>{source.label}</label>)}</div>
            {!draft.sources.length&&<p style={{margin:'10px 0 0',color:'#ffb4b4',fontSize:12,fontWeight:700}}>Select at least one source.</p>}
          </div>

          <div style={{marginTop:24}}><h3 style={{margin:'0 0 6px',fontSize:14}}>Areas</h3><p style={{margin:'0 0 10px',color:'#9ba9b8',fontSize:12}}>No areas selected = all areas.</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:9}}>{SEARCH_AREAS.map(area=><label key={area.id} style={{display:'flex',gap:9,alignItems:'center'}}><input type="checkbox" checked={draft.areas.includes(area.id)} onChange={()=>toggleArea(area.id)}/>{area.label}</label>)}</div>
          </div>
        </>}

        {state.error&&<p role="alert" style={{margin:'16px 0 0',color:'#ffb4b4',fontSize:12,fontWeight:700}}>{state.error}</p>}
        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:24}}>
          <button type="button" onClick={cancelSettings} style={secondaryButton}>Cancel</button>
          <button type="button" onClick={saveSettings} disabled={saveBlocked} style={{...primaryButton,opacity:saveBlocked?0.55:1,cursor:saveBlocked?'not-allowed':'pointer'}}>{state.saving?'Saving…':'Save'}</button>
        </div>
      </section>
    </div>}
  </>
}
