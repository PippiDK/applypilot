import {NextResponse} from 'next/server'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60

const SEARCH_URL='https://www.jobindex.dk/jobsoegning?q=project%20manager'

function uniq(values=[]){return [...new Set(values.filter(Boolean))]}

function summarize(html=''){
  const text=String(html)
  const hrefs=uniq([...text.matchAll(/href=["']([^"']+)["']/gi)].map(match=>match[1].replaceAll('&amp;','&')))
  const usefulHrefs=hrefs.filter(href=>!/^javascript:/i.test(href)&&!/(\.css|\.js|\.png|\.svg|\.ico|\.woff2?)(\?|$)/i.test(href))
  const pagination=usefulHrefs.filter(href=>/[?&](?:page|side|start|offset|p)=\d+/i.test(href))
  const jobIds=uniq([...text.matchAll(/\bh\d{5,}\b/gi)].map(match=>match[0]))
  return {
    bytes:Buffer.byteLength(text),
    hasHtml:/<html/i.test(text),
    hasJobindex:/jobindex/i.test(text),
    hrefCount:hrefs.length,
    jobIds:jobIds.slice(0,10),
    paginationSamples:pagination.slice(0,10)
  }
}

export async function GET(){
  const started=Date.now()
  try{
    const searchResponse=await fetch(SEARCH_URL,{
      redirect:'follow',cache:'no-store',
      headers:{'user-agent':'Mozilla/5.0 (compatible; ApplyPilot-Jobindex-Probe/1.0)','accept':'text/html,application/xhtml+xml'}
    })
    const searchHtml=await searchResponse.text()
    const searchSummary=summarize(searchHtml)

    let detail=null
    const firstJobId=searchSummary.jobIds[0]
    if(firstJobId){
      const detailUrl=`https://www.jobindex.dk/vis-job/${firstJobId}`
      const detailResponse=await fetch(detailUrl,{
        redirect:'follow',cache:'no-store',
        headers:{'user-agent':'Mozilla/5.0 (compatible; ApplyPilot-Jobindex-Probe/1.0)','accept':'text/html,application/xhtml+xml'}
      })
      const detailHtml=await detailResponse.text()
      detail={
        jobId:firstJobId,
        requestedUrl:detailUrl,
        finalUrl:detailResponse.url,
        status:detailResponse.status,
        ok:detailResponse.ok,
        contentType:detailResponse.headers.get('content-type'),
        bytes:Buffer.byteLength(detailHtml),
        hasHtml:/<html/i.test(detailHtml),
        hasJobindex:/jobindex/i.test(detailHtml),
        hasDescriptionSignals:/jobbeskrivelse|arbejdsopgaver|about the job|ansvarsomr[aå]der|kvalifikationer/i.test(detailHtml)
      }
    }

    return NextResponse.json({
      probe:'jobindex-vercel-readonly-v3',elapsedMs:Date.now()-started,
      search:{requestedUrl:SEARCH_URL,finalUrl:searchResponse.url,status:searchResponse.status,ok:searchResponse.ok,contentType:searchResponse.headers.get('content-type'),...searchSummary},
      detail
    })
  }catch(error){
    return NextResponse.json({probe:'jobindex-vercel-readonly-v3',elapsedMs:Date.now()-started,error:String(error?.message||error)},{status:502})
  }
}
