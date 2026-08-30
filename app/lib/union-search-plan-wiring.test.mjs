import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const pageUrl=new URL('../page.js',import.meta.url)

test('page wires the edited draft into a saved Union Search Plan preview',async()=>{
  const source=await readFile(pageUrl,'utf8')
  assert.match(source,/import \{buildUnionSearchPlan,UNION_SEARCH_PLAN_VERSION\} from '\.\/lib\/union-search-plan\.js'/)
  assert.match(source,/import SearchPlanPreview from '\.\/components\/search-plan-preview\.js'/)
  assert.match(source,/const draftUnionSearchPlan=useMemo\(\(\)=>buildUnionSearchPlan\(\{/)
  assert.match(source,/primaryRoles:draftPrimaryRoles/)
  assert.match(source,/adjacentRoles:draftAdjacentRoles/)
  assert.match(source,/roleSources:Array\.isArray\(draft\.roleSources\)\?draft\.roleSources:\[\]/)
  assert.match(source,/cvRoleProfiles:Array\.isArray\(draft\.cvRoleProfiles\)\?draft\.cvRoleProfiles:\[\]/)
  assert.match(source,/unionSearchPlan:draftUnionSearchPlan/)
  assert.match(source,/unionSearchPlanVersion:UNION_SEARCH_PLAN_VERSION/)
  assert.match(source,/unionSearchPlanFingerprint:draftUnionSearchPlan\.fingerprint/)
  assert.match(source,/<SearchPlanPreview plan=\{draftUnionSearchPlan\}\/>/)
})

test('saved Union Search Plan drives multi-source LIVE while LinkedIn compatibility stays behind its adapter',async()=>{
  const source=await readFile(pageUrl,'utf8')
  const searchStart=source.indexOf('async function search(){')
  const searchEnd=source.indexOf('\n  function startProfile()',searchStart)
  assert.ok(searchStart>=0&&searchEnd>searchStart,'search() block must be found')
  const searchBlock=source.slice(searchStart,searchEnd)

  assert.match(searchBlock,/fetch\('\/api\/multi-source-search'/)
  assert.match(searchBlock,/unionSearchPlan:profile\.unionSearchPlan/)
  assert.match(searchBlock,/cvText:cvData\.cvText/)
  assert.match(searchBlock,/enabledSources:selectedSources/)
  assert.doesNotMatch(searchBlock,/fetch\('\/api\/linkedin-profile-search'/)
  assert.doesNotMatch(searchBlock,/fetch\('\/api\/linkedin-search'/)
})
