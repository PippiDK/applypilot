import test from 'node:test'
import assert from 'node:assert/strict'
import * as library from './search-profile-library.js'

const cv=(slot,sourceVersion=`sha-${slot}`,fileName=`cv-${slot}.pdf`)=>({id:`cv-${slot}`,slot,sourceVersion,fileName})
const roles=(primaryRoles=[],adjacentRoles=[])=>({primaryRoles,adjacentRoles})

test('builds independent role profiles without consolidating professions',()=>{
  const profiles=[
    library.buildCvRoleProfile(cv(1),roles(['Carpenter'],['Joiner'])),
    library.buildCvRoleProfile(cv(2),roles(['Sales Representative'],['Account Manager'])),
    library.buildCvRoleProfile(cv(3),roles(['Singer'],['Vocalist']))
  ]
  assert.deepEqual(profiles.map(p=>p.primaryRoles[0]),['Carpenter','Sales Representative','Singer'])
  assert.deepEqual(profiles.map(p=>p.cvId),['cv-1','cv-2','cv-3'])
})

test('combines primary roles from all CVs in stable slot order',()=>{
  const profiles=[
    library.buildCvRoleProfile(cv(3),roles(['Singer'],[])),
    library.buildCvRoleProfile(cv(1),roles(['Carpenter'],[])),
    library.buildCvRoleProfile(cv(2),roles(['Sales Representative'],[]))
  ]
  const combined=library.combineCvRoleProfiles(profiles)
  assert.deepEqual(combined.primaryRoles,['Carpenter','Sales Representative','Singer'])
})

test('promotes a role to primary when any CV classifies it primary',()=>{
  const profiles=[
    library.buildCvRoleProfile(cv(1),roles(['Project Manager'],['Delivery Lead'])),
    library.buildCvRoleProfile(cv(2),roles(['  delivery   lead  '],['Transformation Lead']))
  ]
  const combined=library.combineCvRoleProfiles(profiles)
  assert.deepEqual(combined.primaryRoles,['Project Manager','delivery lead'])
  assert.deepEqual(combined.adjacentRoles,['Transformation Lead'])
})

test('deduplicates roles case and whitespace insensitively and records all supporting CVs',()=>{
  const profiles=[
    library.buildCvRoleProfile(cv(1),roles(['Senior IT Project Manager'],[])),
    library.buildCvRoleProfile(cv(2),roles([' senior   it project manager '],[])),
    library.buildCvRoleProfile(cv(3),roles([],['SENIOR IT PROJECT MANAGER']))
  ]
  const combined=library.combineCvRoleProfiles(profiles)
  assert.deepEqual(combined.primaryRoles,['Senior IT Project Manager'])
  assert.deepEqual(combined.adjacentRoles,[])
  assert.deepEqual(combined.roleSources,[{
    role:'Senior IT Project Manager',
    cvIds:['cv-1','cv-2','cv-3'],
    support:[
      {cvId:'cv-1',kind:'primary'},
      {cvId:'cv-2',kind:'primary'},
      {cvId:'cv-3',kind:'adjacent'}
    ]
  }])
})

test('one-CV union preserves the CV role proposal semantics',()=>{
  const profile=library.buildCvRoleProfile(cv(1),roles(['Senior Project Manager'],['Delivery Manager']))
  const combined=library.combineCvRoleProfiles([profile])
  assert.deepEqual(combined.primaryRoles,['Senior Project Manager'])
  assert.deepEqual(combined.adjacentRoles,['Delivery Manager'])
})

test('library fingerprint is stable by slot and changes only with CV membership/sourceVersion or builder version',()=>{
  const a=library.searchProfileLibraryFingerprint([cv(2,'b'),cv(1,'a')],'roles-v1')
  const b=library.searchProfileLibraryFingerprint([cv(1,'a'),cv(2,'b')],'roles-v1')
  const replaced=library.searchProfileLibraryFingerprint([cv(1,'a'),cv(2,'b2')],'roles-v1')
  const removed=library.searchProfileLibraryFingerprint([cv(1,'a')],'roles-v1')
  const newBuilder=library.searchProfileLibraryFingerprint([cv(1,'a'),cv(2,'b')],'roles-v2')
  assert.equal(a,b)
  assert.notEqual(a,replaced)
  assert.notEqual(a,removed)
  assert.notEqual(a,newBuilder)
})
