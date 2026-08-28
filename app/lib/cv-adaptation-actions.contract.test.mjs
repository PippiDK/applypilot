import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')
const best=readFileSync(new URL('../components/best-cv-panel.js',import.meta.url),'utf8')
const chooser=readFileSync(new URL('../components/cv-adaptation-chooser.js',import.meta.url),'utf8')

test('generated CV updates are kept by baseline key so reopening review does not call AI again',()=>{
  assert.match(page,/const \[adaptationResults,setAdaptationResults\]=useState\(\{\}\)/)
  assert.match(page,/const currentAdaptationResult=activeBaselineKey\?adaptationResults\[activeBaselineKey\]\|\|null:null/)
  assert.match(page,/setAdaptationResults\(current=>\(\{\.\.\.current,\[runBaselineKey\]:result\}\)\)/)
})

test('Generate and View are separate controls with Generate disabled after success',()=>{
  assert.match(page,/Generate CV update/)
  assert.match(page,/Generated/)
  assert.match(page,/View CV update/)
  assert.match(page,/disabled=\{!activeAdaptationBaseline\|\|adaptationRun\.loading\|\|Boolean\(currentAdaptationResult\)\}/)
  assert.match(page,/onClick=\{\(\)=>setReviewOpen\(true\)\} disabled=\{!currentAdaptationResult\}/)
})

test('adaptation action row is passed into Best CV panel and removed from Application pack',()=>{
  assert.match(page,/<BestCvPanel[\s\S]*adaptationActions=/)
  const applicationPack=page.indexOf('<div className="section"><h3>Application pack</h3>')
  assert.ok(applicationPack>=0)
  const afterApplicationPack=page.slice(applicationPack,applicationPack+800)
  assert.doesNotMatch(afterApplicationPack,/Adapt & review CV|Generate CV update|View CV update|Open LinkedIn vacancy/)
})

test('Best CV passes action controls into the CV chooser',()=>{
  assert.match(best,/adaptationActions/)
  assert.match(best,/<CvAdaptationChooser[\s\S]*actions=\{adaptationActions\}/)
})

test('CV chooser renders action controls inside the integrated CV workflow section',()=>{
  assert.match(chooser,/cvWorkflowChooser/)
  assert.match(chooser,/\{actions\}/)
})
