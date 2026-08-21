import { NextResponse } from 'next/server'
import { searchLinkedIn } from '../../lib/linkedin-search.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request){
  try{
    const body=await request.json().catch(()=>({}))
    const freshnessDays=[1,3,7,14].includes(Number(body?.freshnessDays))?Number(body.freshnessDays):7
    const result=await searchLinkedIn({freshnessDays})
    console.log('linkedin-search',JSON.stringify({coverage:result.coverage.status,stats:result.stats,diagnostics:result.diagnostics}))
    return NextResponse.json({...result,fetchedAt:new Date().toISOString()})
  }catch(error){
    console.error('linkedin-search error',error)
    return NextResponse.json({error:String(error?.message||'LinkedIn public search failed')},{status:502})
  }
}
