import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyCvEvidenceGrounding} from './evidence-guard.js'

function fixture(sourcePhrase){
  const sectionText=`Senior Project Manager\n${sourcePhrase}`
  const structure={
    professionalSummary:{id:'professional_summary',eligible:false,text:''},
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
