import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source=fs.readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')

test('uploaded CV is marked dirty and forced through fresh role analysis',()=>{
  assert.match(source,/const \[pendingRoleReanalysisCvIds,setPendingRoleReanalysisCvIds\]=useState\(\[\]\)/)
  assert.match(source,/setPendingRoleReanalysisCvIds\(current=>Array\.from\(new Set\(\[\.\.\.current,uploadedCv\.id\]\)\)\)/)
  assert.match(source,/void buildProfileRoles\(\{forceCvIds:pendingRoleReanalysisCvIds\}\)/)
})

test('CV1 refresh cannot restore stale role fields into the draft',()=>{
  assert.match(source,/function resetRoleDraft\(value=\{\}\)/)
  assert.match(source,/setDraft\(current=>resetRoleDraft\(resumeToProfile\(current,primaryCv\)\)\)/)
  assert.doesNotMatch(source,/setDraft\(current=>resumeToProfile\(current,primaryCv\)\)/)
})
