import test from 'node:test'
import assert from 'node:assert/strict'
import {buildNightFlightProfileState} from './night-flight-profile-sync.js'

test('Night Flight profile fingerprint is stable for the same profile and CV',()=>{
  const input={searchProfile:{roles:['Delivery Manager'],locations:['copenhagen_north']},cv:{cvText:'Verified CV text',sourceVersion:'cv-v1'}}
  const first=buildNightFlightProfileState(input)
  const second=buildNightFlightProfileState(input)
  assert.equal(first.profile_fingerprint,second.profile_fingerprint)
  assert.equal(first.cv_source_version,'cv-v1')
  assert.equal(first.cv_text,'Verified CV text')
})

test('Night Flight profile fingerprint changes when Search Profile or primary CV changes',()=>{
  const base=buildNightFlightProfileState({searchProfile:{roles:['Delivery Manager']},cv:{cvText:'CV A',sourceVersion:'cv-v1'}})
  const changedProfile=buildNightFlightProfileState({searchProfile:{roles:['Project Manager']},cv:{cvText:'CV A',sourceVersion:'cv-v1'}})
  const changedCv=buildNightFlightProfileState({searchProfile:{roles:['Delivery Manager']},cv:{cvText:'CV B',sourceVersion:'cv-v2'}})
  assert.notEqual(base.profile_fingerprint,changedProfile.profile_fingerprint)
  assert.notEqual(base.profile_fingerprint,changedCv.profile_fingerprint)
})

test('Night Flight profile state safely represents a removed primary CV',()=>{
  const state=buildNightFlightProfileState({searchProfile:{savedAt:'2026-09-04T18:00:00.000Z'},cv:null})
  assert.equal(state.cv_text,'')
  assert.equal(state.cv_source_version,'')
  assert.equal(state.profile_fingerprint.length,64)
})
