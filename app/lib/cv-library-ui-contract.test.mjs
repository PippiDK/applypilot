import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('Search Profile step 1 exposes three CV slots while CV 1 remains the Search source',()=>{
  const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  const component=fs.readFileSync(new URL('../components/cv-library-step.js',import.meta.url),'utf8')

  assert.match(page,/CV_LIBRARY_STORAGE_KEY/)
  assert.match(page,/const cvReadyCount=readyCvs\.length/)
  assert.match(page,/CVs \$\{cvReadyCount\}\/\$\{MAX_CVS\}/)
  assert.match(page,/parseCv\(file,slot=1\)/)
  assert.match(page,/cvText:cvData\.cvText/)
  assert.match(page,/<CvLibraryStep/)

  assert.match(component,/Array\.from\(\{length:MAX_CVS\}/)
  assert.match(component,/CV \{slot\}/)
  assert.match(component,/CV 1 remains the active Search CV for now\./)
  assert.match(component,/1 of 3|of \{MAX_CVS\} CVs ready/)
})
