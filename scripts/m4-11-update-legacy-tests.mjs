import {readFileSync,writeFileSync} from 'node:fs'

const path='app/lib/profile-review.test.mjs'
let source=readFileSync(path,'utf8')

function replaceTest(title,newTest){
  const start=source.indexOf(`test('${title}',()=>{`)
  if(start<0) throw new Error(`M4.11 legacy-test patch failed: ${title} not found`)
  const end=source.indexOf('\n})',start)
  if(end<0) throw new Error(`M4.11 legacy-test patch failed: ${title} end not found`)
  source=source.slice(0,start)+newTest+source.slice(end+3)
}

replaceTest(
  'merged UI restores Application Pack, CV Update Review and Truth Guard',
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
})`
)

replaceTest(
  'CV review shows a neutral empty state when there are no actual wording changes',
`test('M4.11 CV review shows a neutral empty state when Truth Guard offers no changed safe block',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/No safe changes to review\\./)
  assert.match(source,/The selected Source CV remains unchanged\\./)
  assert.doesNotMatch(source,/No usable CV evidence was found for this review/)
})`
)

replaceTest(
  'Version 2 Step 1 UI reviews Summary-only changes without inventing a bullet workflow',
`test('M4.11 UI supersedes the legacy Summary-only review with three Truth-Guard-safe blocks',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.doesNotMatch(source,/buildReviewChanges\\(cvData,active\\)/)
  assert.match(source,/safeAdaptationReviewBlocks/)
  assert.match(source,/Professional Summary/)
  assert.match(source,/Latest role overview/)
  assert.match(source,/Previous role overview/)
  assert.doesNotMatch(source,/bullet workflow/i)
})`
)

writeFileSync(path,source)
console.log('Updated superseded profile-review UI contracts for M4.11')
