import {NextResponse} from 'next/server'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60

const SEARCH_URL='https://www.jobindex.dk/jobsoegning?q=project%20manager'

function summarize(html=''){
  const text=String(html)
  const jobLinks=[...text.matchAll(/href=["']([^"']*jobannonce[^"']*|[^"']*job[^"']*)["']/gi)].map(match=>match[1])
  const pagination=[...text.matchAll(/href=["']([^"']*(?:page|side|start|offset)=[^"']*)["']/gi)].map(match=>match[1])
  return {
    bytes:Buffer.byteLength(text),
    hasHtml:/<html/i.test(text),
    hasJobindex:/jobindex/i.test(text),
    jobLinkSamples:[...new Set(jobLinks)].slice(0,5),
    paginationSamples:[...new Set(pagination)].slice(0,5)
  }
}

export async function GET(){
  const started=Date.now()
  try{
    const searchResponse=await fetch(SEARCH_URL,{
      redirect:'follow',
      cache:'no-store',
      headers:{
        'user-agent':'Mozilla/5.0 (compatible; ApplyPilot-Jobindex-Probe/1.0)',
        'accept':'text/html,application/xhtml+xml'
      }
    })
    const searchHtml=await searchResponse.text()
    const searchSummary=summarize(searchHtml)

    let detail=null
    const firstRelative=searchSummary.jobLinkSamples[0]
    if(firstRelative){
      const detailUrl=new URL(firstRelative,searchResponse.url||SEARCH_URL).toString()
      const detailResponse=await fetch(detailUrl,{
        redirect:'follow',
        cache:'no-store',
        headers:{
          'user-agent':'Mozilla/5.0 (compatible; ApplyPilot-Jobindex-Probe/1.0)',
          'accept':'text/html,application/xhtml+xml'
        }
      })
      const detailHtml=await detailResponse.text()
      detail={
        requestedUrl:detailUrl,
        finalUrl:detailResponse.url,
        status:detailResponse.status,
        ok:detailResponse.ok,
        contentType:detailResponse.headers.get('content-type'),
        summary:summarize(detailHtml)
      }
    }

    return NextResponse.json({
      probe:'jobindex-vercel-readonly-v1',
      elapsedMs:Date.now()-started,
      search:{
        requestedUrl:SEARCH_URL,
        finalUrl:searchResponse.url,
        status:searchResponse.status,
        ok:searchResponse.ok,
        contentType:searchResponse.headers.get('content-type'),
        ...searchSummary
      },
      detail
    })
  }catch(error){
    return NextResponse.json({
      probe:'jobindex-vercel-readonly-v1',
      elapsedMs:Date.now()-started,
      error:String(error?.message||error)
    },{status:502})
  }
}
