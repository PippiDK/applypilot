import {readFileSync,writeFileSync} from 'node:fs'

const path='app/lib/profile-review.test.mjs'
let source=readFileSync(path,'utf8')

function replaceExact(oldText,newText,label){
  if(!source.includes(oldText)) throw new Error(`M4.11 legacy-test patch failed: ${label} anchor not found`)
  source=source.replace(oldText,newText)
}

replaceExact(
`test('merged UI restores Application Pack, CV Update Review and Truth Guard',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/Application pack/)
  assert.match(source,/Review CV changes/)
  assert.match(source,/CV UPDATE REVIEW/)
  assert.match(source,/Truth Guard active/)
  assert.match(source,/Truth Guard active · 0 unsupported claims/)
  assert.match(source,/Accept all safe changes/)
  assert.match(source,/Keep original/)
  assert.match(source,/Accept change/)
})`,
`test('merged UI keeps Application Pack and exposes the M4.11 Truth-Guard review flow',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/Application pack/)
  assert.match(source,/Adapt & review CV/)
  assert.match(source,/CV UPDATE REVIEW/)
  assert.match(source,/Truth Guard complete/)
  assert.match(source,/Only Truth-Guard-safe UPDATED text is shown/)
  assert.match(source,/Accept all safe changes/)
  assert.match(source,/Keep original/)
  assert.match(source,/Accept change/)
})`,
'application pack review contract'
)

replaceExact(
`test('CV review shows a neutral empty state when there are no actual wording changes',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/No Summary change proposed\./)
  assert.doesNotMatch(source,/No usable CV evidence was found for this review/)
})`,
`test('M4.11 CV review shows a neutral empty state when Truth Guard offers no changed safe block',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/No safe changes to review\./)
  assert.match(source,/The selected Source CV remains unchanged\./)
  assert.doesNotMatch(source,/No usable CV evidence was found for this review/)
})`,
'empty review contract'
)

replaceExact(
`test('Version 2 Step 1 UI reviews Summary-only changes without inventing a bullet workflow',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/buildReviewChanges\(cvData,active\)/)
  assert.doesNotMatch(source,/buildReviewChanges\(reviewFacts,active\)/)
  assert.match(source,/CV Summary update/)
  assert.match(source,/No Summary change proposed\./)
  assert.match(source,/<span>SUMMARY<\/span>/)
})`,
`test('M4.11 UI supersedes the legacy Summary-only review with three Truth-Guard-safe blocks',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.doesNotMatch(source,/buildReviewChanges\(cvData,active\)/)
  assert.match(source,/safeAdaptationReviewBlocks/)
  assert.match(source,/Professional Summary/)
  assert.match(source,/Latest role overview/)
  assert.match(source,/Previous role overview/)
  assert.doesNotMatch(source,/bullet workflow/i)
})`,
'legacy summary-only UI contract'
)

writeFileSync(path,source)
console.log('Updated superseded profile-review UI contracts for M4.11')
