import test from 'node:test'
import assert from 'node:assert/strict'
import {semanticProfileExclusion} from './profile-semantic-exclusions.js'

const erpRules=[{evaluation:'deterministic',operator:'exclude',category:'domain',value:'ERP specialist roles',originalText:'ERP specialist roles'}]
const erpAliasRules=[{evaluation:'deterministic',operator:'avoid',category:'role',value:'SAP specialist roles',originalText:'Avoid SAP specialist roles'}]
const rndRules=[{evaluation:'deterministic',operator:'exclude',category:'domain',value:'R&D roles',originalText:'R&D roles'}]

const sapJob={title:'SAP S/4HANA Public Cloud Finance Project Manager',description:'SAP ERP implementation and configuration.'}
const rndJob={title:'Senior Project Manager, Global R&D',description:'Research and development projects.'}

test('ERP user exclusion semantically rejects ERP specialism',()=>{
  const reason=semanticProfileExclusion(sapJob,erpRules,{domain:'EXCLUDED_SPECIALISM',evidence:['erp']})
  assert.equal(reason,'Search Profile exclusion: ERP specialist roles')
})

test('SAP alias user exclusion maps to ERP specialism',()=>{
  const reason=semanticProfileExclusion(sapJob,erpAliasRules,{domain:'EXCLUDED_SPECIALISM',evidence:['erp']})
  assert.equal(reason,'Search Profile exclusion: Avoid SAP specialist roles')
})

test('R&D user exclusion semantically rejects R&D specialism',()=>{
  const reason=semanticProfileExclusion(rndJob,rndRules,{domain:'EXCLUDED_SPECIALISM',evidence:['r&d']})
  assert.equal(reason,'Search Profile exclusion: R&D roles')
})

test('semantic exclusion is not invented without a user rule',()=>{
  assert.equal(semanticProfileExclusion(sapJob,[],{domain:'EXCLUDED_SPECIALISM',evidence:['erp']}),null)
  assert.equal(semanticProfileExclusion(rndJob,[],{domain:'EXCLUDED_SPECIALISM',evidence:['r&d']}),null)
})

test('unrelated domain exclusion is not broadened into ERP or R&D',()=>{
  const rules=[{evaluation:'deterministic',operator:'exclude',category:'domain',value:'medical devices',originalText:'medical devices'}]
  assert.equal(semanticProfileExclusion(sapJob,rules,{domain:'EXCLUDED_SPECIALISM',evidence:['erp']}),null)
  assert.equal(semanticProfileExclusion(rndJob,rules,{domain:'EXCLUDED_SPECIALISM',evidence:['r&d']}),null)
})

test('non-exclusion rule semantics do not activate the semantic gate',()=>{
  const rules=[{evaluation:'deterministic',operator:'prefer',category:'domain',value:'ERP specialist roles',originalText:'Prefer ERP specialist roles'}]
  assert.equal(semanticProfileExclusion(sapJob,rules,{domain:'EXCLUDED_SPECIALISM',evidence:['erp']}),null)
})
