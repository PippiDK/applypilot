import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyCvEvidenceGrounding,deterministicTruthCheck} from './evidence-guard.js'

function fixture(sourcePhrase){
  const sectionText=`Senior Project Manager\n${sourcePhrase}`
  const structure={
    professionalSummary:{id:'professional_summary',eligible:false,text:''},
    latestRole:{id:'role:latest'},
    previousRole:null,
    employmentSections:[{id:'role:latest',sectionText}]
  }
  return {sourceCvText:`Professional Experience\n${sectionText}`,structure}
}

test('accepts AI hyphenation when PDF extraction contains U+FFFE between the same word parts',()=>{
  const source='Partnered closely with Architecture, Development, QA, and Operations teams to maintain aligned cross\uFFFEfunctional execution, improve coordination, and support predictable delivery outcomes.'
  const {sourceCvText,structure}=fixture(source)
  const excerpt='Partnered closely with Architecture, Development, QA, and Operations teams to maintain aligned cross-functional execution, improve coordination, and support predictable delivery outcomes.'
  assert.equal(verifyCvEvidenceGrounding(sourceCvText,structure,[{id:'E3',requirementId:'P4',sectionId:'role:latest',excerpt}]),true)
})

test('accepts AI hyphenation when PDF extraction joins the same word parts',()=>{
  const source='Partnered closely with Architecture, Development, QA, and Operations teams to maintain aligned crossfunctional execution, improve coordination, and support predictable delivery outcomes.'
  const {sourceCvText,structure}=fixture(source)
  const excerpt='Partnered closely with Architecture, Development, QA, and Operations teams to maintain aligned cross-functional execution, improve coordination, and support predictable delivery outcomes.'
  assert.equal(verifyCvEvidenceGrounding(sourceCvText,structure,[{id:'E3',requirementId:'P4',sectionId:'role:latest',excerpt}]),true)
})

test('still rejects semantic rewriting rather than separator-only PDF artifacts',()=>{
  const source='Partnered closely with Architecture, Development, QA, and Operations teams to maintain aligned crossfunctional execution, improve coordination, and support predictable delivery outcomes.'
  const {sourceCvText,structure}=fixture(source)
  const excerpt='Led Architecture, Development, QA, and Operations teams with full ownership of cross-functional execution and delivery outcomes.'
  assert.throws(()=>verifyCvEvidenceGrounding(sourceCvText,structure,[{id:'E3',requirementId:'P4',sectionId:'role:latest',excerpt}]),/not found/i)
})

test('Truth Guard uses the same PDF-artifact-safe grounding for cited evidence',()=>{
  const source='Partnered closely with Architecture, Development, QA, and Operations teams to maintain aligned cross\uFFFEfunctional execution, improve coordination, and support predictable delivery outcomes.'
  const {sourceCvText,structure}=fixture(source)
  const excerpt='Partnered closely with Architecture, Development, QA, and Operations teams to maintain aligned cross-functional execution, improve coordination, and support predictable delivery outcomes.'
  const evidence={matches:[{id:'E3',requirementId:'P4',sectionId:'role:latest',excerpt}],unsupportedRequirementIds:[]}
  const baseline={cvId:'cv-1',sourceVersion:'sha256:cv1',cvText:sourceCvText}
  const block={blockId:'latest_role_overview',status:'generated',originalText:'Original role overview.',tailoredText:'Partnered closely with Architecture, Development, QA, and Operations teams to maintain aligned cross-functional execution, improve coordination, and support predictable delivery outcomes.',claims:[{text:'Partnered closely with Architecture, Development, QA, and Operations teams to maintain aligned cross-functional execution, improve coordination, and support predictable delivery outcomes.',evidenceIds:['E3']}]}
  const result=deterministicTruthCheck({block,evidence,structure,baseline})
  assert.equal(result.verdict,'PASS')
  assert.equal(result.safeText,block.tailoredText)
})
