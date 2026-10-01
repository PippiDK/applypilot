'use client'
import {useMemo} from 'react'
import {readyAdaptationChoices} from '../lib/cv-adaptation-selection.js'
import styles from './cv-adaptation-chooser.module.css'

const text=value=>String(value??'').trim()
const cvLabel=cv=>cv?.slot?`CV ${cv.slot}`:'CV'

export default function CvAdaptationChooser({cvLibrary,recommendedCvId='',selectedCvId='',onSelectCv,actions=null}){
  const choices=useMemo(()=>readyAdaptationChoices(cvLibrary),[cvLibrary])
  const recommended=text(recommendedCvId)
  const selected=text(selectedCvId)
  const selectedCv=choices.find(cv=>cv.id===selected)||null

  if(!choices.length) return null

  const singleCv=choices.length===1?choices[0]:null

  return <section className={`${styles.card} cvWorkflowChooser`}>
    <div className={styles.head}>
      <div><p className="eyebrow">{singleCv?'CV FOR THIS JOB':'SELECT CV TO ADAPT'}</p><p className={styles.intro}>{singleCv?'Your ready CV is selected automatically.':'Choose one of your ready CVs. Best CV remains a recommendation.'}</p></div>
      <span className={styles.status}>{singleCv?`${cvLabel(singleCv)} selected`:selectedCv?`${cvLabel(selectedCv)} selected`:'Not selected'}</span>
    </div>
    <div className={styles.choices}>
      {choices.map(cv=>{const isRecommended=cv.id===recommended;const isSelected=singleCv?true:cv.id===selected;return singleCv?<div
        key={cv.id}
        className={`${styles.choice} ${styles.selected}`}
      >
        <span className={styles.cvText}><b>{cvLabel(cv)}</b><small>{cv.fileName}</small></span>
        <span className={styles.badges}><strong>SELECTED</strong></span>
      </div>:<button
        type="button"
        key={cv.id}
        className={`${styles.choice} ${isSelected?styles.selected:''}`}
        aria-pressed={isSelected}
        onClick={()=>onSelectCv?.(cv)}
      >
        <span className={styles.cvText}><b>{cvLabel(cv)}</b><small>{cv.fileName}</small></span>
        <span className={styles.badges}>{isRecommended&&<em>RECOMMENDED</em>}{isSelected&&<strong>SELECTED</strong>}</span>
      </button>})}
    </div>
    {actions}
  </section>
}
