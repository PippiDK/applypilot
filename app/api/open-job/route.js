import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const JOBNET = 'https://jobnet.dk/bff'

export async function GET(request){
  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source')
  const id = searchParams.get('id')

  if(source !== 'jobnet' || !id){
    return NextResponse.json({ error: 'Invalid job link.' }, { status: 400 })
  }

  try{
    const res = await fetch(`${JOBNET}/FindJob/JobAdDetails/${encodeURIComponent(id)}?incrementViews=false`, {
      headers: { 'x-csrf': '1' },
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
    })
    if(!res.ok) throw new Error(`Jobnet: ${res.status}`)

    const data = await res.json()
    const target = data?.application?.url
    if(target){
      const url = new URL(target)
      if(url.protocol === 'http:' || url.protocol === 'https:') return NextResponse.redirect(url)
    }

    return NextResponse.redirect(new URL('https://jobnet.dk/find-job'))
  }catch(error){
    console.error('open-job Jobnet redirect error', error)
    return NextResponse.redirect(new URL('https://jobnet.dk/find-job'))
  }
}
