import {isSourceCvReady} from './source-cv.js'

const text=value=>String(value??'').trim()
const selectionsObject=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{}

export function readyAdaptationChoices(cvLibrary){
  const cvs=Array.isArray(cvLibrary?.cvs)?cvLibrary.cvs:[]
  return cvs.filter(isSourceCvReady)
}

export function selectAdaptationCv(currentSelections,{jobKey,cvId,readyCvs}={}){
  const key=text(jobKey)
  const id=text(cvId)
  if(!key) throw new Error('A vacancy is required before choosing a CV for adaptation.')
  const choices=Array.isArray(readyCvs)?readyCvs.filter(isSourceCvReady):[]
  if(!choices.some(cv=>cv.id===id)) throw new Error('Selected CV is not ready for adaptation.')
  return {...selectionsObject(currentSelections),[key]:id}
}

export function selectedAdaptationCv(selections,jobKey,readyCvs){
  const key=text(jobKey)
  if(!key) return null
  const selectedId=text(selectionsObject(selections)[key])
  if(!selectedId) return null
  const choices=Array.isArray(readyCvs)?readyCvs.filter(isSourceCvReady):[]
  return choices.find(cv=>cv.id===selectedId)||null
}
