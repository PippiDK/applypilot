'use client'
import { useState } from 'react'

const RADII=[10,20,30,40,50]

export default function Home(){
  const [radiusKm,setRadiusKm]=useState(30)
  const [companies,setCompanies]=useState([])
  const [state,setState]=useState({loading:false,error:'',meta:null})

  async function search(){
    setState({loading:true,error:'',meta:null})
    setCompanies([])
    try{
      const res=await fetch('/api/company-search',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({radiusKm})
      })
      const data=await res.json()
      if(!res.ok) throw new Error(data.error||'Company search failed.')
      setCompanies(Array.isArray(data.companies)?data.companies:[])
      setState({loading:false,error:'',meta:data.meta||null})
    }catch(error){
      setState({loading:false,error:error.message||'Company search failed.',meta:null})
    }
  }

  return <main>
    <header><div><div className="brand">ApplyPilot</div><div className="tag">Search less. Apply better.</div></div></header>

    <section className="hero">
      <div><p className="eyebrow">STEP 1 · COMPANY DISCOVERY</p><h1>Find relevant employers around Nærum.</h1><p>Choose only the maximum distance. Employer type is filtered internally.</p></div>
      <div className="metric"><b>{state.loading?'…':companies.length}</b><span>companies</span></div>
    </section>

    <section className="companyControls">
      <div><small>MAXIMUM DISTANCE FROM NÆRUM</small><div className="radiusChoices">{RADII.map(km=><button key={km} className={radiusKm===km?'choice selected':'choice'} onClick={()=>setRadiusKm(km)}>{km} km</button>)}</div></div>
      <button className="primary companySearchButton" onClick={search} disabled={state.loading}>{state.loading?'Searching companies…':'Search companies'}</button>
    </section>

    {state.error&&<div className="errorBox searchNotice"><b>Company search failed</b><span>{state.error}</span></div>}
    {state.meta&&<div className="searchMeta"><span><b>{state.meta.companiesMatched}</b> companies matched</span><span>{state.meta.candidatesFetched} candidates checked</span><span>{state.meta.municipalitiesScanned} municipalities scanned</span><span>Source: {state.meta.source}</span></div>}

    <section className="companyListCard">
      <div className="listHead"><h2>Companies</h2><small>Within {radiusKm} km of Nærum</small></div>
      {!state.loading&&!companies.length&&!state.error&&<div className="emptyJobs">Choose a radius and run company search.</div>}
      {state.loading&&<div className="emptyJobs">Searching CVR company data…</div>}
      {!state.loading&&state.meta&&companies.length===0&&<div className="emptyJobs">No companies passed the agreed employer criteria inside this radius.</div>}
      {companies.map((c,i)=><div className="companyRow" key={c.cvr||`${c.name}-${i}`}>
        <div className="companyIndex">{i+1}</div>
        <div className="companyMain"><b>{c.name}</b><span>{c.address||c.city||'Address unavailable'}</span><small>{c.industry}</small></div>
        <div className="companyFacts"><b>{c.distanceKm} km</b><span>{c.sizeBand?`${c.sizeBand} employees`:c.employerType}</span><small>CVR {c.cvr}</small></div>
      </div>)}
    </section>

    <footer>Step 1 only · company discovery</footer>
  </main>
}
