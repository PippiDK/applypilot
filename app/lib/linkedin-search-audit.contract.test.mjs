import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const stablePath=new URL('./linkedin-stable-search.js',import.meta.url)
const helperPath=new URL('./linkedin-search-audit.js',import.meta.url)

const terminalStages=[
  'PRE_DETAIL_TITLE_REJECT','DETAIL_FAILED','DETAIL_INCOMPLETE','FRESHNESS_REJECT',
  'ROLE_GATE_REJECT','DISCOVERY_CANDIDATE_REJECT','HARD_EXCLUSION','BELOW_60','KEPT',
]

test('stable search exposes an audit terminal stage for every existing rejection/keep branch',async()=>{
  const source=await readFile(stablePath,'utf8')
  for(const stage of terminalStages) assert.match(source,new RegExp(`stage:'${stage}'`),`missing ${stage}`)
  assert.match(source,/audit:auditList\(auditById\)/)
})

test('audit helper allow-list cannot copy CV or JD source payloads',async()=>{
  const source=await readFile(helperPath,'utf8')
  assert.match(source,/ALLOWED_PATCH_KEYS=new Set\(\['title','company','stage','decision','reason','score'\]\)/)
  assert.doesNotMatch(source,/description[^\n]*safe\[/)
  assert.doesNotMatch(source,/cvText[^\n]*safe\[/)
})
