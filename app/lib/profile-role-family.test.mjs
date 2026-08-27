import test from 'node:test'
import assert from 'node:assert/strict'
import {classifyProfileRoleFamily} from './profile-role-family.js'

const cases=[
  ['Senior IT Project Manager','delivery-management'],
  ['Technical Program Manager','delivery-management'],
  ['IT Delivery Lead','delivery-management'],
  ['PMO Manager','delivery-management'],
  ['Senior IT-projektleder med teknisk indsigt','delivery-management'],
  ['Erfaren programleder til digitale leverancer','delivery-management'],
  ['Implementation Manager','implementation-transformation'],
  ['Transformation Project Manager','implementation-transformation'],
  ['Regulatory Affairs Specialist','specialist'],
  ['Senior Manufacturing IT / OT Specialist','specialist'],
  ['Software Engineering Manager','software-builder'],
  ['Senior Software Developer','software-builder'],
  ['Product Owner','product'],
  ['Senior Product Manager','product'],
  ['Enterprise Architect','architecture'],
  ['IT-Arkitekt til digitalisering','architecture'],
  ['Senior Business Analyst','analysis'],
  ['Senior Test Manager','quality-test'],
  ['Director, Transformation Office','executive'],
]

for(const [title,family] of cases){
  test(`${title} -> ${family}`,()=>{
    const result=classifyProfileRoleFamily({title,description:'Example description'})
    assert.equal(result.family,family)
    assert.ok(Array.isArray(result.evidence))
  })
}

test('specific specialist family wins over generic project references in description',()=>{
  const result=classifyProfileRoleFamily({
    title:'Regulatory Affairs Specialist',
    description:'Support projects, project plans and project managers while owning regulatory submissions.',
  })
  assert.equal(result.family,'specialist')
})

test('generic manager without professional family evidence is other',()=>{
  const result=classifyProfileRoleFamily({title:'Senior Manager',description:'Lead a team and stakeholders.'})
  assert.equal(result.family,'other')
})
