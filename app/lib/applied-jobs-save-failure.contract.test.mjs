import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const mainSearchPath=new URL('../main-search-base.js',import.meta.url)
const archivePath=new URL('../components/applied-jobs-archive.js',import.meta.url)

test('Applied History save failures are visible and canonical state is restored',()=>{
  const source=readFileSync(mainSearchPath,'utf8')
  const archive=readFileSync(archivePath,'utf8')

  assert.match(source,/fetchAppliedJobs/)
  assert.match(source,/setAppliedSaveError/)
  assert.doesNotMatch(source,/persistAppliedJobs\(next\)[\s\S]{0,160}\.catch\(\(\)=>\{\}\)/)
  assert.match(archive,/Applied History save failed/)
  assert.match(archive,/role="alert"/)
})
