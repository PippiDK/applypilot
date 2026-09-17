import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source=fs.readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')

test('successful CV upload invalidates only that CV role cache after library persistence',()=>{
  const parseStart=source.indexOf('async function parseCv')
  const libraryWrite=source.indexOf('localStorage.setItem(CV_LIBRARY_STORAGE_KEY,JSON.stringify(nextLibrary))',parseStart)
  const cacheClear=source.indexOf('clearSearchProfileCache({storage:localStorage,sourceVersion:saved.sourceVersion})',libraryWrite)
  const libraryState=source.indexOf('setCvLibrary(nextLibrary)',cacheClear)
  assert.ok(parseStart>=0)
  assert.ok(libraryWrite>parseStart)
  assert.ok(cacheClear>libraryWrite)
  assert.ok(libraryState>cacheClear)
})
