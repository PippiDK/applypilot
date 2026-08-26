'use client'
import styles from './search-profile-location-step.module.css'

const LOCATION_LABELS=[['Denmark','Denmark'],['EU/EMEA','EU / EMEA'],['Worldwide','Worldwide']]
const WORK_MODEL_LABELS=[['hybrid','Hybrid'],['onsite','On-site'],['remote','Remote']]

export default function SearchProfileLocationStep({locations=[],workModels=[],onToggleLocation,onToggleWorkModel}){
  return <div className="wizard">
    <h3>Where can you work?</h3>
    <p>Choose where you want ApplyPilot to search and which work models you accept.</p>

    <div className={styles.group}>
      <small>WHERE</small>
      <div className="choiceGrid">
        {LOCATION_LABELS.map(([value,label])=>{
          const selected=locations.includes(value)
          return <button type="button" key={value} onClick={()=>onToggleLocation(value)} className={selected?'choice selected':'choice'}>{selected?'✓ ':''}{label}</button>
        })}
      </div>
    </div>

    <div className={styles.group}>
      <small>WORK MODEL</small>
      <div className="choiceGrid">
        {WORK_MODEL_LABELS.map(([value,label])=>{
          const selected=workModels.includes(value)
          return <button type="button" key={value} onClick={()=>onToggleWorkModel(value)} className={selected?'choice selected':'choice'}>{selected?'✓ ':''}{label}</button>
        })}
      </div>
    </div>
  </div>
}
