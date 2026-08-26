import { NextResponse } from 'next/server'
import { searchLinkedInStable } from '../../lib/linkedin-stable-search.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Throwaway benchmark probe. No user CV data is stored here.
// The synthetic text intentionally contains every evidence family used by
// experienceScore so any job that still falls below 60 cannot be rescued
// merely by choosing a different real CV.
const MAX_EVIDENCE_CV = `
Senior IT Project Delivery Manager.
End-to-end project delivery and delivery management across enterprise software platforms and business systems.
Systems integration and integrations. Digital transformation, technology transformation, IT transformation and data transformation.
Agile, Scrum, SAFe and hybrid delivery. Data platforms, data warehouse DWH, Power BI, BI and data engineering.
Financial IT, fintech, banking, trading, post-trade, payments, financial data, regulatory reporting, compliance and AML.
Governance, PMO, steering committee, risk management, risks, dependencies and RAID.
Senior stakeholder management, executive communication and executive reporting. Budget management, financial control and forecasting.
Release readiness, release, UAT, cutover, go-live, hypercare and handover. Distributed international teams and offshore delivery.
Implementation, migration, deployment and transition. Azure, cloud, Databricks and Snowflake.
`.trim()

export async function GET(request){
  if(process.env.VERCEL_ENV !== 'preview'){
    return NextResponse.json({error:'Not found'},{status:404})
  }

  const {searchParams}=new URL(request.url)
  const key=String(searchParams.get('key')||'')
  const expected=String(process.env.VERCEL_GIT_COMMIT_SHA||'')
  if(!expected || key !== expected){
    return NextResponse.json({error:'Not found'},{status:404})
  }

  try{
    const result=await searchLinkedInStable({freshnessDays:14,resume:MAX_EVIDENCE_CV})
    return NextResponse.json({
      benchmark:'cv-sensitivity-14d',
      note:'Synthetic maximum-evidence CV; no user CV data used server-side.',
      fetchedAt:new Date().toISOString(),
      ...result,
    })
  }catch(error){
    console.error('cv-benchmark-dataset error',error)
    return NextResponse.json({error:String(error?.message||'Benchmark dataset failed')},{status:502})
  }
}
