import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CV_LIBRARY_STORAGE_KEY,
  MAX_CVS,
  createCvLibrary,
  normalizeCvLibrary,
  upsertCvSlot,
  removeCvSlot,
  getCvSlot,
  getPrimaryCv,
  readyCvCount,
} from './cv-library.js'

function cv(version,name){
  return {
    schemaVersion:1,
    status:'ready',
    fileName:name,
    fileSize:123,
    fileType:'application/pdf',
    sourceVersion:version,
    chars:180,
    cvText:`Senior delivery manager ${version} `.repeat(8),
    summary:'Summary',
    facts:[],
    skills:['Jira'],
    preview:'Preview',
    parsedAt:'2026-08-26T10:00:00.000Z',
  }
}

test('CV library has a configurable MVP limit of three slots',()=>{
  assert.equal(CV_LIBRARY_STORAGE_KEY,'applypilot-cv-library')
  assert.equal(MAX_CVS,3)
  const library=createCvLibrary()
  assert.equal(library.cvs.length,3)
  assert.deepEqual(library.cvs,[null,null,null])
})

test('legacy single Source CV migrates into CV 1 without changing its source data',()=>{
  const legacy=cv('v1','delivery.pdf')
  const library=normalizeCvLibrary(null,legacy)
  assert.equal(getCvSlot(library,1).id,'cv-1')
  assert.equal(getCvSlot(library,1).slot,1)
  assert.equal(getCvSlot(library,1).fileName,'delivery.pdf')
  assert.equal(getCvSlot(library,1).sourceVersion,'v1')
  assert.equal(getPrimaryCv(library).sourceVersion,'v1')
  assert.equal(getCvSlot(library,2),null)
  assert.equal(getCvSlot(library,3),null)
  assert.equal(readyCvCount(library),1)
})

test('CV 2 and CV 3 are stored independently while CV 1 remains the Search source',()=>{
  let library=normalizeCvLibrary(null,cv('v1','one.pdf'))
  library=upsertCvSlot(library,2,cv('v2','two.pdf'))
  library=upsertCvSlot(library,3,cv('v3','three.pdf'))
  assert.equal(getPrimaryCv(library).fileName,'one.pdf')
  assert.equal(getCvSlot(library,2).fileName,'two.pdf')
  assert.equal(getCvSlot(library,3).fileName,'three.pdf')
  assert.equal(readyCvCount(library),3)
})

test('replacing one slot does not modify the other CVs',()=>{
  let library=createCvLibrary()
  library=upsertCvSlot(library,1,cv('v1','one.pdf'))
  library=upsertCvSlot(library,2,cv('v2','two.pdf'))
  library=upsertCvSlot(library,3,cv('v3','three.pdf'))
  library=upsertCvSlot(library,2,cv('v4','two-new.pdf'))
  assert.equal(getCvSlot(library,1).sourceVersion,'v1')
  assert.equal(getCvSlot(library,2).sourceVersion,'v4')
  assert.equal(getCvSlot(library,3).sourceVersion,'v3')
})

test('same sourceVersion cannot occupy two different slots',()=>{
  let library=createCvLibrary()
  library=upsertCvSlot(library,1,cv('same','one.pdf'))
  assert.throws(()=>upsertCvSlot(library,2,cv('same','duplicate.pdf')),/already uploaded as CV 1/i)
})

test('removing CV 2 leaves CV 1 and CV 3 in their original slots',()=>{
  let library=createCvLibrary()
  library=upsertCvSlot(library,1,cv('v1','one.pdf'))
  library=upsertCvSlot(library,2,cv('v2','two.pdf'))
  library=upsertCvSlot(library,3,cv('v3','three.pdf'))
  library=removeCvSlot(library,2)
  assert.equal(getCvSlot(library,1).fileName,'one.pdf')
  assert.equal(getCvSlot(library,2),null)
  assert.equal(getCvSlot(library,3).fileName,'three.pdf')
  assert.equal(readyCvCount(library),2)
})

test('removing CV 1 does not promote CV 2 or CV 3',()=>{
  let library=createCvLibrary()
  library=upsertCvSlot(library,1,cv('v1','one.pdf'))
  library=upsertCvSlot(library,2,cv('v2','two.pdf'))
  library=upsertCvSlot(library,3,cv('v3','three.pdf'))
  library=removeCvSlot(library,1)
  assert.equal(getPrimaryCv(library),null)
  assert.equal(getCvSlot(library,2).fileName,'two.pdf')
  assert.equal(getCvSlot(library,3).fileName,'three.pdf')
  assert.equal(readyCvCount(library),2)
})

test('slot number must stay within the MVP limit',()=>{
  const library=createCvLibrary()
  assert.throws(()=>upsertCvSlot(library,4,cv('v4','four.pdf')),/CV slot must be between 1 and 3/i)
  assert.throws(()=>removeCvSlot(library,4),/CV slot must be between 1 and 3/i)
})
