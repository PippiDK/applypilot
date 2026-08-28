import {useState} from 'react'
import styles from './cv-library-step.module.css'
import {MAX_CVS,getCvSlot,readyCvCount} from '../lib/cv-library.js'

export default function CvLibraryStep({library,loadingSlot=null,error='',primarySkills=[],onUpload,onRemove}){
  const [confirmSlot,setConfirmSlot]=useState(null)
  const count=readyCvCount(library)
  const slots=Array.from({length:MAX_CVS},(_,index)=>{
    const slot=index+1
    return {slot,cv:getCvSlot(library,slot)}
  })
  const confirmCv=confirmSlot?getCvSlot(library,confirmSlot):null

  function confirmRemove(){
    if(!confirmSlot) return
    const slot=confirmSlot
    setConfirmSlot(null)
    onRemove?.(slot)
  }

  return <div className="wizard">
    <h3>Upload your CVs</h3>
    <p>Upload up to three Word CVs for vacancy-specific selection and tailored DOCX download. CV 1 remains the active Search CV for now. Source files remain unchanged and are not stored in the database.</p>

    <div className={styles.slotList}>
      {slots.map(({slot,cv})=><div className={styles.slot} key={slot}>
        <div className={styles.slotMeta}>
          <small>CV {slot}</small>
          <b className={cv?styles.ready:styles.empty}>{cv?'✓ Ready':'Empty'}</b>
        </div>
        <div className={styles.fileName}>{cv?.fileName||'No CV uploaded'}</div>
        <div className={`${styles.slotActions} ${cv?'':styles.singleAction}`}>
          <label className={styles.slotAction}>
            <input type="file" accept=".docx" onChange={event=>{const file=event.target.files?.[0]; if(file) onUpload?.(file,slot); event.target.value=''}} disabled={Boolean(loadingSlot)}/>
            {loadingSlot===slot?'Analysing…':cv?'Replace':'Upload CV'}
          </label>
          {cv&&<button type="button" className={styles.removeAction} onClick={()=>setConfirmSlot(slot)} disabled={Boolean(loadingSlot)}>Remove</button>}
        </div>
      </div>)}
    </div>

    {error&&<div className="errorBox"><b>CV upload failed</b><span>{error}</span></div>}

    {count>0&&<div className="successBox">
      <b>✓ {count} of {MAX_CVS} CVs ready</b>
      <span>{getCvSlot(library,1)?.skills?.length?`Detected signals from CV 1: ${(primarySkills.length?primarySkills:getCvSlot(library,1).skills).slice(0,8).join(' · ')}`:getCvSlot(library,1)?'CV 1 remains the active Search CV for now.':'Upload CV 1 to enable Search.'}</span>
    </div>}

    {confirmSlot&&confirmCv&&<div className={styles.confirmBackdrop} onMouseDown={event=>{if(event.target===event.currentTarget)setConfirmSlot(null)}}>
      <div className={styles.confirmModal} role="dialog" aria-modal="true" aria-labelledby="remove-cv-title">
        <div className={styles.confirmBrand}>ApplyPilot</div>
        <h4 id="remove-cv-title">Remove CV {confirmSlot}?</h4>
        <p>This removes <b>{confirmCv.fileName}</b> from this CV slot. Other CV slots will not move.</p>
        <div className={styles.confirmActions}>
          <button type="button" className={styles.confirmCancel} onClick={()=>setConfirmSlot(null)}>Cancel</button>
          <button type="button" className={styles.confirmRemove} onClick={confirmRemove}>Remove CV</button>
        </div>
      </div>
    </div>}
  </div>
}
