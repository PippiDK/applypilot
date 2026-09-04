'use client'

import {useState} from 'react'
import styles from './company-discovery.module.css'

const RADII=[10,20,30,40,50]

export default function CompanyDiscovery(){
  const [radiusKm,setRadiusKm]=useState(30)
  const [companies,setCompanies]=useState([])
  const [state,setState]=useState({loading:false,error:'',meta:null})

  async function searchCompanies(){
    if(state.loading) return
    setCompanies([])
    setState({loading:true,error:'',meta:null})
    try{
      const res=await fetch('/api/company-search',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({radiusKm}),
      })
      const data=await res.json()
      if(!res.ok) throw new Error(data.error||'Company search failed.')
      setCompanies(Array.isArray(data.companies)?data.companies:[])
      setState({loading:false,error:'',meta:data.meta||null})
    }catch(error){
      setState({loading:false,error:error.message||'Company search failed.',meta:null})
    }
  }

  return <details className={styles.drawer}>
    <summary className={styles.summary}><span>Companies & consultancies</span><b>TEST</b></summary>
    <div className={styles.panel}>
      <div className={styles.heading}>
        <div><small>EMPLOYER DISCOVERY</small><h2>Companies & consultancies</h2><p>Direct employers plus IT / management consultancies around Nærum. Recruitment and staffing agencies are excluded.</p></div>
        <div className={styles.count}><b>{state.loading?'…':companies.length}</b><span>found</span></div>
      </div>

      <div className={styles.controls}>
        <div><small>MAX DISTANCE FROM NÆRUM</small><div className={styles.radii}>{RADII.map(km=><button key={km} className={radiusKm===km?styles.selected:''} onClick={()=>setRadiusKm(km)}>{km} km</button>)}</div></div>
        <button className={styles.search} disabled={state.loading} onClick={searchCompanies}>{state.loading?'Searching…':'Search companies'}</button>
      </div>

      {state.error&&<div className={styles.error}>{state.error}</div>}
      {state.meta&&<div className={styles.meta}><span><b>{state.meta.companiesMatched??companies.length}</b> matched</span><span>{state.meta.candidatesFetched??0} checked</span><span>{state.meta.municipalitiesScanned??0} municipalities</span></div>}

      <div className={styles.results}>
        {!state.loading&&!state.error&&!state.meta&&<p className={styles.empty}>Choose a radius and run company search.</p>}
        {state.loading&&<p className={styles.empty}>Searching public CVR company data…</p>}
        {!state.loading&&state.meta&&companies.length===0&&<p className={styles.empty}>No companies matched inside this radius.</p>}
        {companies.map((company,index)=><div className={styles.row} key={company.cvr||`${company.name}-${index}`}>
          <div className={styles.index}>{index+1}</div>
          <div className={styles.main}><b>{company.name}</b><span>{company.address||company.city||'Address unavailable'}</span><small>{company.industry}</small></div>
          <div className={styles.facts}><b>{company.distanceKm} km</b><span>{company.employerType||'Company'}</span><small>CVR {company.cvr}</small></div>
        </div>)}
      </div>
    </div>
  </details>
}
