import test from 'node:test'
import assert from 'node:assert/strict'
import {jobnetRoleContextGuard} from './jobnet-role-context-guard.js'

test('keeps clear IT delivery and IT project leadership roles',()=>{
  assert.equal(jobnetRoleContextGuard({title:'IT Delivery Manager til VISUE',fullJd:'Ansvar for software delivery, platform releases and stakeholders.'}).pass,true)
  assert.equal(jobnetRoleContextGuard({title:'Erfaren projektleder til større, samfundskritiske it-projekter',fullJd:'Du driver komplekse digitale systemleverancer.'}).pass,true)
  assert.equal(jobnetRoleContextGuard({title:'Fra idé til drift – vil du stå i spidsen for vores IT-projekter?',fullJd:'Digital platform, system integration og go-live.'}).pass,true)
})

test('keeps generic Project Manager only when JD confirms technology context',()=>{
  assert.equal(jobnetRoleContextGuard({title:'Senior Project Manager',fullJd:'Lead software platform implementation, releases and IT stakeholders.'}).pass,true)
  assert.equal(jobnetRoleContextGuard({title:'Senior Project Manager',fullJd:'Lead construction projects and contractor schedules.'}).pass,false)
})

test('rejects construction project roles',()=>{
  assert.equal(jobnetRoleContextGuard({title:'Projektleder til Større Byggerier i Center for Ejendomme',fullJd:'Byggeri, entreprenører og ejendomme.'}).pass,false)
  assert.equal(jobnetRoleContextGuard({title:'Projektleder med baggrund som kloakmester søges til Dansk Fundering',fullJd:'Fundering og byggeplads.'}).pass,false)
  assert.equal(jobnetRoleContextGuard({title:'Projekt- og byggeledere til vejgenopretningsprojekter i København',fullJd:'Vejanlæg og byggeledelse.'}).pass,false)
})

test('rejects academic and health research roles even when project words appear',()=>{
  assert.equal(jobnetRoleContextGuard({title:'Postdoc in an EU project at Section for Health Services Research',fullJd:'Research project and data analysis.'}).pass,false)
  assert.equal(jobnetRoleContextGuard({title:'Associate Professor in International Implementation of Musculoskeletal Treatment Programmes',fullJd:'Academic implementation research.'}).pass,false)
  assert.equal(jobnetRoleContextGuard({title:'PhD Scholarship within the Research Project Not Liking School',fullJd:'Research project.'}).pass,false)
})

test('rejects admin and hands-on specialist false positives',()=>{
  assert.equal(jobnetRoleContextGuard({title:'Sagsbehandler til Facility Management til Forsvarets nye Digital Backbone',fullJd:'Digital backbone administration.'}).pass,false)
  assert.equal(jobnetRoleContextGuard({title:'Sagsbehandler til administration og HR til Digital Backbone',fullJd:'Digital HR administration.'}).pass,false)
  assert.equal(jobnetRoleContextGuard({title:'IT-Infrastruktur specialist med mulighed for specialisering i netscaler',fullJd:'Hands-on network infrastructure specialist.'}).pass,false)
})


test('v2 requires multiple concrete IT delivery signals for generic project titles',()=>{
  assert.equal(jobnetRoleContextGuard({title:'Senior Project Manager',fullJd:'Lead software platform implementation, releases and IT stakeholders.'}).pass,true)
  assert.equal(jobnetRoleContextGuard({title:'Projektleder til udvikling af fremtidens palliative tilbud til børn og unge',fullJd:'Udvikling af palliative tilbud, samarbejde med kliniske interessenter og projektplanlægning.'}).pass,false)
  assert.equal(jobnetRoleContextGuard({title:'International projektledelse i Miljøstyrelsen',fullJd:'Internationalt miljøarbejde, myndighedssamarbejde og projektledelse.'}).pass,false)
  assert.equal(jobnetRoleContextGuard({title:'Junior projektleder inden for anskaffelser',fullJd:'Anskaffelser, udbud, kontrakter og leverandørsamarbejde.'}).pass,false)
})

test('v2 trusts explicit technology delivery titles without weakening generic-title gate',()=>{
  assert.equal(jobnetRoleContextGuard({title:'Global Program Director - Digital Transformation',fullJd:'Transformation programme leadership.'}).pass,true)
  assert.equal(jobnetRoleContextGuard({title:'IT Project Manager',fullJd:'Lead enterprise change and stakeholders.'}).pass,true)
})
