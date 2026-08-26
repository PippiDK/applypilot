import styles from './cv-library-step.module.css'
import {MAX_CVS,getCvSlot,readyCvCount} from '../lib/cv-library.js'

export default function CvLibraryStep({library,loadingSlot=null,error='',primarySkills=[],onUpload}){
  const count=readyCvCount(library)
  const slots=Array.from({length:MAX_CVS},(_,index)=>{
    const slot=index+1
    return {slot,cv:getCvSlot(library,slot)}
  })

  return <div className="wizard">
    <h3>Upload your CVs</h3>
    <p>Upload up to three CVs for later vacancy-specific selection. CV 1 remains the active Search CV for now. Uploaded source files remain unchanged.</p>

    <div className={styles.slotList}>
      {slots.map(({slot,cv})=><div className={styles.slot} key={slot}>
        <div className={styles.slotMeta}>
          <small>CV {slot}</small>
          <b className={cv?styles.ready:styles.empty}>{cv?'✓ Ready':'Empty'}</b>
        </div>
        <div className={styles.fileName}>{cv?.fileName||'No CV uploaded'}</div>
        <label className={styles.slotAction}>
          <input type="file" accept=".pdf,.docx" onChange={event=>{const file=event.target.files?.[0]; if(file) onUpload?.(file,slot); event.target.value=''}} disabled={Boolean(loadingSlot)}/>
          {loadingSlot===slot?'Analysing…':cv?'Replace':'Upload CV'}
        </label>
      </div>)}
    </div>

    {error&&<div className="errorBox"><b>CV upload failed</b><span>{error}</span></div>}

    {count>0&&<div className="successBox">
      <b>✓ {count} of {MAX_CVS} CVs ready</b>
      <span>{getCvSlot(library,1)?.skills?.length?`Detected signals from CV 1: ${(primarySkills.length?primarySkills:getCvSlot(library,1).skills).slice(0,8).join(' · ')}`:'CV 1 remains the active Search CV for now.'}</span>
    </div>}
  </div>
}
