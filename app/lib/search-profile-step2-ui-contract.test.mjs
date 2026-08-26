import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('Search Profile step 2 combines all ready CVs while legacy Search keeps CV 1',()=>{
  const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  const component=fs.readFileSync(new URL('../components/search-profile-roles-step.js',import.meta.url),'utf8')

  assert.match(page,/requestSearchProfileRoles/)
  assert.match(page,/readSearchProfileCache/)
  assert.match(page,/writeSearchProfileCache/)
  assert.match(page,/buildProfileRoles/)
  assert.match(page,/rolesSourceVersion/)
  assert.match(page,/cvText:cvData\.cvText/)
  assert.match(page,/<SearchProfileRolesStep/)

  assert.match(component,/PRIMARY ROLES/)
  assert.match(component,/ADJACENT ROLES/)
  assert.match(component,/Generated from \{readyLabel\}/)
  assert.match(component,/all ready CVs/)
  assert.match(component,/You can edit/)
  assert.match(component,/Retry/)
})
