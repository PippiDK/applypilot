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

test('saved Union Search Plan drives profile LIVE while legacy fallback stays isolated',async()=>{
  const source=await readFile(pageUrl,'utf8')
  const searchStart=source.indexOf('async function search(){')
  const searchEnd=source.indexOf('\n  function startProfile()',searchStart)
  assert.ok(searchStart>=0&&searchEnd>searchStart,'search() block must be found')
  const searchBlock=source.slice(searchStart,searchEnd)
  const legacyStart=searchBlock.indexOf("res=await fetch('/api/linkedin-search'")
  const legacyEnd=searchBlock.indexOf('\n      }',legacyStart)
  assert.ok(legacyStart>=0&&legacyEnd>legacyStart,'legacy LinkedIn fallback block must be found')
  const legacyBlock=searchBlock.slice(legacyStart,legacyEnd)

  assert.match(searchBlock,/fetch\('\/api\/linkedin-profile-search'/)
  assert.match(searchBlock,/unionSearchPlan:profile\.unionSearchPlan/)
  assert.match(searchBlock,/exclusionRules:Array\.isArray\(profile\.exclusionRules\)\?profile\.exclusionRules:\[\]/)
  assert.match(searchBlock,/previousCandidates:poolSnapshot\.candidates/)
  assert.match(searchBlock,/previousVerifiedJobs:poolSnapshot\.verifiedJobs/)
  assert.match(legacyBlock,/JSON\.stringify\(\{freshnessDays,cvText:cvData\.cvText\}\)/)
  assert.doesNotMatch(legacyBlock,/unionSearchPlan|primaryRoles|adjacentRoles|exclusionRules/)
})
