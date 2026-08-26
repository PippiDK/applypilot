import {isSourceCvReady,normalizeStoredSourceCv} from './source-cv.js'

export const CV_LIBRARY_STORAGE_KEY='applypilot-cv-library'
export const MAX_CVS=3

function validSlot(slot){
  const value=Number(slot)
  if(!Number.isInteger(value)||value<1||value>MAX_CVS) throw new Error(`CV slot must be between 1 and ${MAX_CVS}.`)
  return value
}

function slotRecord(value,slot){
  const normalized=normalizeStoredSourceCv(value)
  if(!normalized||!isSourceCvReady(normalized)) return null
  return {...normalized,id:`cv-${slot}`,slot}
}

export function createCvLibrary(){
  return {schemaVersion:1,maxCvs:MAX_CVS,cvs:Array(MAX_CVS).fill(null)}
}

export function normalizeCvLibrary(value,legacyCv=null){
  const library=createCvLibrary()
  const source=Array.isArray(value?.cvs)?value.cvs:[]
  const seen=new Set()

  source.slice(0,MAX_CVS).forEach((item,index)=>{
    if(!item) return
    const slot=Number.isInteger(Number(item.slot))?Number(item.slot):index+1
    if(slot<1||slot>MAX_CVS) return
    const record=slotRecord(item,slot)
    if(!record||seen.has(record.sourceVersion)) return
    seen.add(record.sourceVersion)
    library.cvs[slot-1]=record
  })

  if(!library.cvs[0]){
    const legacy=slotRecord(legacyCv,1)
    if(legacy && !seen.has(legacy.sourceVersion)) library.cvs[0]=legacy
  }

  return library
}

export function getCvSlot(library,slot){
  const index=validSlot(slot)-1
  return normalizeCvLibrary(library).cvs[index]||null
}

export function getPrimaryCv(library){
  return getCvSlot(library,1)
}

export function readyCvCount(library){
  return normalizeCvLibrary(library).cvs.filter(Boolean).length
}

export function upsertCvSlot(library,slot,value){
  const target=validSlot(slot)
  const record=slotRecord(value,target)
  if(!record) throw new Error('CV requires a complete parsed Source CV record.')

  const next=normalizeCvLibrary(library)
  const duplicateIndex=next.cvs.findIndex((item,index)=>index!==target-1 && item?.sourceVersion===record.sourceVersion)
  if(duplicateIndex>=0) throw new Error(`This CV is already uploaded as CV ${duplicateIndex+1}.`)

  next.cvs[target-1]=record
  return next
}
