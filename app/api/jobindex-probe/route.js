import {NextResponse} from 'next/server'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60

const SEARCH_URL='https://www.jobindex.dk/jobsoegning?q=project%20manager'
const PAGE2_URL='https://www.jobindex.dk/jobsoegning?q=project%20manager&page=2'
const HEADERS={'user-agent':'Mozilla/5.0 (compatible; ApplyPilot-Jobindex-Probe/1.0)','accept':'text/html,application/xhtml+xml'}

function uniq(values=[]){return [...new Set(values.filter(Boolean))]}
function summarize(html=''){
  const text=String(html)
  const jobIds=uniq([...text.matchAll(/\bh\d{5,}\b/gi)].map(match=>match[0]))
  return {bytes:Buffer.byteLength(text),hasHtml:/<html/i.test(text),hasJobindex:/jobindex/i.test(text),jobIds:jobIds.slice(0,20)}
}
async function fetchHtml(url){
  const response=await fetch(url,{redirect:'follow',cache:'no-store',headers:HEADERS})
  const html=await response.text()
  return {response,html,summary:summarize(html)}
}

export async function GET(){
  const started=Date.now()
  try{
    const page1=await fetchHtml(SEARCH_URL)
    const page2=await fetchHtml(PAGE2_URL)
    const firstJobId=page1.summary.jobIds[0]
    let detail=null
    if(firstJobId){
      const detailUrl=`https://www.jobindex.dk/vis-job/${firstJobId}`
      const detailResult=await fetchHtml(detailUrl)
      detail={jobId:firstJobId,requestedUrl:detailUrl,finalUrl:detailResult.response.url,status:detailResult.response.status,ok:detailResult.response.ok,contentType:detailResult.response.headers.get('content-type'),bytes:detailResult.summary.bytes,hasHtml:detailResult.summary.hasHtml,hasJobindex:detailResult.summary.hasJobindex}
    }
    const page2NewIds=page2.summary.jobIds.filter(id=>!page1.summary.jobIds.includes(id))
    return NextResponse.json({
      probe:'jobindex-vercel-readonly-v4',elapsedMs:Date.now()-started,
      page1:{requestedUrl:SEARCH_URL,finalUrl:page1.response.url,status:page1.response.status,ok:page1.response.ok,contentType:page1.response.headers.get('content-type'),...page1.summary},
      page2:{requestedUrl:PAGE2_URL,finalUrl:page2.response.url,status:page2.response.status,ok:page2.response.ok,contentType:page2.response.headers.get('content-type'),...page2.summary,newIdsVsPage1:page2NewIds.slice(0,20)},
      paginationWorks:page2.response.ok&&page2NewIds.length>0,
      detail
    })
  }catch(error){
    return NextResponse.json({probe:'jobindex-vercel-readonly-v4',elapsedMs:Date.now()-started,error:String(error?.message||error)},{status:502})
  }
}
