import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('page runs shadow independently while preserving legacy search payload and jobs',async()=>{
  const source=await readFile(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/compareShadowToLegacy/)
  assert.match(source,/ShadowSearchAudit/)
  assert.match(source,/const \[shadowState,setShadowState\]=useState/)
  assert.match(source,/JSON\.stringify\(\{freshnessDays,cvText:cvData\.cvText\}\)/)
  assert.match(source,/JSON\.stringify\(\{freshnessDays,unionSearchPlan:profile\.unionSearchPlan\}\)/)
  assert.match(source,/\/api\/linkedin-shadow-search/)
  const shadowIndex=source.indexOf("fetch('/api/linkedin-shadow-search'")
  const legacyIndex=source.indexOf("await fetch('/api/linkedin-search'")
  assert.ok(shadowIndex>=0&&legacyIndex>=0&&shadowIndex<legacyIndex)
  assert.match(source,/setJobs\(Array\.isArray\(data\.jobs\)\?data\.jobs:\[\]\)/)
  assert.doesNotMatch(source,/setJobs\([^)]*shadow/i)
  assert.match(source,/<SearchAudit audit=\{state\.audit\}\/>[\s\S]{0,300}<ShadowSearchAudit shadowState=\{shadowState\}\/>/)
})
