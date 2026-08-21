import assert from 'node:assert/strict'
import {
  haversineKm, professionMatches, companyProfileDecision, corporateDomainFromEmails,
  careerLinks, jobLinks, jdHardRejected, fullJobDescription
} from './company-search.js'

assert.ok(haversineKm(55.81769,12.53629,55.81769,12.53629)<0.001)
assert.equal(professionMatches('Senior IT Project Manager'),true)
assert.equal(professionMatches('Senior Project Manager, Drug Discovery'),true)
assert.equal(jdHardRejected('Senior Project Manager leading drug discovery and laboratory research.'),'Excluded role/domain')
assert.equal(professionMatches('Building Surveyor'),false)
assert.equal(companyProfileDecision({branches:[{vaerdiTekst:'Computerprogrammering'}],employment:[{antal:55}]}).pass,true)
assert.equal(companyProfileDecision({branches:[{vaerdiTekst:'Arkitektvirksomhed'}],employment:[{antal:500}]}).pass,false)
assert.equal(companyProfileDecision({branches:[{vaerdiTekst:'Detailhandel'}],employment:[{antal:3000}]}).pass,true)
assert.equal(companyProfileDecision({branches:[{vaerdiTekst:'Detailhandel'}],employment:[{antal:35}]}).pass,false)
assert.equal(corporateDomainFromEmails([{vaerdi:'jobs@example.dk'}]),'example.dk')
assert.equal(corporateDomainFromEmails([{vaerdi:'x@gmail.com'}]),'')
const home='<a href="/about">About</a><a href="/careers">Careers</a>'
assert.equal(careerLinks(home,'https://example.dk')[0].url,'https://example.dk/careers')
const careers='<a href="/jobs/senior-it-project-manager">Senior IT Project Manager</a><a href="/jobs/scientist">Scientist</a>'
assert.equal(jobLinks(careers,'https://example.dk').length,1)
assert.equal(jdHardRejected('You must be fluent in Danish.'),'Mandatory Danish')
assert.equal(jdHardRejected('Lead drug discovery project delivery.'),'Excluded role/domain')
assert.equal(fullJobDescription('<p>'+('delivery '.repeat(80))+'</p>').length>500,true)
console.log('company-search core tests passed')
