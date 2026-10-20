import test from 'node:test'
import assert from 'node:assert/strict'
import {extractEtteplanJobLinks,searchEtteplanJobs,ETTEPLAN_CAREERS_URL} from './etteplan-jobylon-source.js'
const url='https://emp.jobylon.com/jobs/123456-etteplan-project-manager/'
function htmlDetail({published='2026-10-19',place='Herlev, Denmark',contract=false}={}){
 return '<html><head><script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Technical Project Manager',datePosted:published,jobLocation:{address:{addressLocality:place.split(',')[0],addressCountry:place.split(',')[1]?.trim()||''}},employmentType:contract?'CONTRACTOR':'FULL_TIME'})+'</script></head><body><h1>Technical Project Manager</h1><p>'+('Full responsibilities and skills. '.repeat(40))+'</p></body></html>'
}
const response=(body)=>({ok:true,text:async()=>body})
function fetcher(detail){return async u=>response(u===ETTEPLAN_CAREERS_URL?'<a href="'+url+'">Apply now</a>':detail)}
test('finds and deduplicates Jobylon job urls',()=>{
 assert.deepEqual(extractEtteplanJobLinks('<a href="'+url+'">A</a><a href="'+url+'">B</a>').map(x=>x.id),['123456'])
})
test('parses a Danish permanent job with full JD and verified publication date',async()=>{
 const result=await searchEtteplanJobs({freshnessDays:5,now:new Date('2026-10-20T12:00:00Z'),fetcher:fetcher(htmlDetail())})
 assert.equal(result.jobs.length,1)
 assert.equal(result.jobs[0].company,'Etteplan')
 assert.equal(result.jobs[0].employmentType,'Permanent')
 assert.ok(result.jobs[0].fullJd.length>500)
 assert.equal(result.jobs[0].consultantPortal.id,'etteplan')
})
test('includes contract jobs and rejects non-Danish postings',async()=>{
 const options={freshnessDays:5,now:new Date('2026-10-20T12:00:00Z')}
 const contract=await searchEtteplanJobs({...options,fetcher:fetcher(htmlDetail({contract:true}))})
 assert.equal(contract.jobs[0].employmentType,'Contract')
 const foreign=await searchEtteplanJobs({...options,fetcher:fetcher(htmlDetail({place:'Espoo, Finland'}))})
 assert.equal(foreign.jobs.length,0)
})
test('does not fabricate date for undated Jobylon job',async()=>{
 const undated=await searchEtteplanJobs({freshnessDays:5,now:new Date('2026-10-20T12:00:00Z'),fetcher:fetcher(htmlDetail({published:null}))})
 assert.equal(undated.jobs.length,0)
 assert.equal(undated.stats.undated,1)
})
