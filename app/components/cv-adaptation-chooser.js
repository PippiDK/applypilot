'use client'
import {useMemo} from 'react'
import {readyAdaptationChoices} from '../lib/cv-adaptation-selection.js'
import styles from './cv-adaptation-chooser.module.css'

const text=value=>String(value??'').trim()
const cvLabel=cv=>cv?.slot?`CV ${cv.slot}`:'CV'

export default function CvAdaptationChooser({cvLibrary,recommendedCvId='',selectedCvId='',onSelectCv}){
  const choices=useMemo(()=>readyAdaptationChoices(cvLibrary),[cvLibrary])
  const recommended=text(recommendedCvId)
  const selected=text(selectedCvId)
  const selectedCv=choices.find(cv=>cv.id===selected)||null

  if(!choices.length) return null

  return <section className={styles.card}>
    <div className={styles.head}>
      <div><p className="eyebrow">CHOOSE CV TO ADAPT</p><p className={styles.intro}>Best CV is a recommendation. You choose which ready CV to adapt.</p></div>
      <span className={styles.status}>{selectedCv?`${cvLabel(selectedCv)} selected`:'Not selected'}</span>
    </div>
    <div className={styles.choices}>
      {choices.map(cv=>{const isRecommended=cv.id===recommended;const isSelected=cv.id===selected;return <button
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
  </section>
}
