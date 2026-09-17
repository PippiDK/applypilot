import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source=fs.readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')

test('CV library is the only persisted full CV copy',()=>{
  assert.equal(source.includes('localStorage.setItem(SOURCE_CV_STORAGE_KEY'),false)
})

test('old duplicate CV storage is cleared before replacement library write',()=>{
  const clearSource=source.indexOf('localStorage.removeItem(SOURCE_CV_STORAGE_KEY)',source.indexOf('async function parseCv'))
  const clearLegacy=source.indexOf('localStorage.removeItem(LEGACY_CV_STORAGE_KEY)',clearSource)
  const writeLibrary=source.indexOf('localStorage.setItem(CV_LIBRARY_STORAGE_KEY,JSON.stringify(nextLibrary))',clearLegacy)
  assert.ok(clearSource>=0)
  assert.ok(clearLegacy>clearSource)
  assert.ok(writeLibrary>clearLegacy)
})

test('hydration migrates canonical library before removing obsolete duplicate keys',()=>{
  const canonical=source.indexOf('if(readyCvCount(library)>0) localStorage.setItem(CV_LIBRARY_STORAGE_KEY,JSON.stringify(library))')
  const primary=source.indexOf('if(primaryCv){',canonical)
  const clearSource=source.indexOf('localStorage.removeItem(SOURCE_CV_STORAGE_KEY)',primary)
  const clearLegacy=source.indexOf('localStorage.removeItem(LEGACY_CV_STORAGE_KEY)',clearSource)
  assert.ok(canonical>=0)
  assert.ok(primary>canonical)
  assert.ok(clearSource>primary)
  assert.ok(clearLegacy>clearSource)
})
