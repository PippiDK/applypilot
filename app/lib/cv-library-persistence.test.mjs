import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import * as cvLibrary from './cv-library.js'
import {buildSourceCvRecord,SOURCE_CV_STORAGE_KEY,LEGACY_CV_STORAGE_KEY} from './source-cv.js'

class MemoryStorage{
  constructor(){this.map=new Map()}
  getItem(key){return this.map.has(key)?this.map.get(key):null}
  setItem(key,value){this.map.set(key,String(value))}
  removeItem(key){this.map.delete(key)}
}

function sourceCv(version,label){
  return buildSourceCvRecord({
    fileName:`${label}.docx`,
    sourceVersion:version,
    fileType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    cvText:`${label} `.repeat(80),
    summary:`${label} summary`,
    skills:['Delivery'],
  },'2026-09-17T12:00:00.000Z')
}

test('CV library persistence keeps CV1 only once and replaces the old slot version',()=>{
  assert.equal(typeof cvLibrary.persistCvLibrary,'function','CV library needs one canonical persistence function')

  const oldCv1=sourceCv('cv1-old','Old CV1')
  const newCv1=sourceCv('cv1-new','New CV1')
  const cv2=sourceCv('cv2-current','CV2')
  const cv3=sourceCv('cv3-current','CV3')

  let library=cvLibrary.createCvLibrary()
  library=cvLibrary.upsertCvSlot(library,1,oldCv1)
  library=cvLibrary.upsertCvSlot(library,2,cv2)
  library=cvLibrary.upsertCvSlot(library,3,cv3)

  const storage=new MemoryStorage()
  storage.setItem(cvLibrary.CV_LIBRARY_STORAGE_KEY,JSON.stringify(library))
  storage.setItem(SOURCE_CV_STORAGE_KEY,JSON.stringify(oldCv1))
  storage.setItem(LEGACY_CV_STORAGE_KEY,JSON.stringify(oldCv1))

  const replaced=cvLibrary.upsertCvSlot(library,1,newCv1)
  cvLibrary.persistCvLibrary(storage,replaced)

  const persisted=JSON.parse(storage.getItem(cvLibrary.CV_LIBRARY_STORAGE_KEY))
  assert.equal(persisted.cvs[0].sourceVersion,'cv1-new')
  assert.equal(persisted.cvs[1].sourceVersion,'cv2-current')
  assert.equal(persisted.cvs[2].sourceVersion,'cv3-current')
  assert.equal(persisted.cvs.some(item=>item?.sourceVersion==='cv1-old'),false)
  assert.equal(storage.getItem(SOURCE_CV_STORAGE_KEY),null)
  assert.equal(storage.getItem(LEGACY_CV_STORAGE_KEY),null)
})

test('Main Search persists CV data only through the CV library',()=>{
  const source=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
  assert.match(source,/persistCvLibrary\(localStorage,\s*library\)/)
  assert.match(source,/persistCvLibrary\(localStorage,\s*nextLibrary\)/)
  assert.doesNotMatch(source,/localStorage\.setItem\(SOURCE_CV_STORAGE_KEY/)
})

// Final TEST verification trigger after the one-shot patch commit.
