import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CVR = 'https://grunddata.filarkiv.dk/v1/cvr'
const DAWA = 'https://api.dataforsyningen.dk'
const NAERUM = { lat: 55.8175, lon: 12.5377 }
const ALLOWED_RADIUS = new Set([10,20,30,40,50])

// Internal Employer Profile. Not exposed as a user setting.
const TARGET_INDUSTRY = [
  /software|computerprogrammer|informationsteknolog|it[- ]?service|it[- ]?konsulent|saas|cloud|databehandling|webhosting|cyber/i,
  /bank|finans|kredit|betaling|payment|fintech|forsikring|insurance|pension/i,
  /telekommunikation|telecom|satellit|kommunikationsteknolog/i,
  /elektricitet|energi|gasforsyning|fjernvarme|forsyning|utility/i,
  /logistik|transport|lufttransport|luftfart|maritim|søtransport|skibsfart|spedition/i,
  /medicinsk udstyr|medicoteknik|medtech|healthtech|sundhedsteknolog/i,
  /farmaceut|lægemiddel|pharma/i,
  /rådgivning.*informationsteknolog|informationsteknolog.*rådgivning|technology consulting|it consulting/i,
]

const EXCLUDED_INDUSTRY = [
  /forskning.*bioteknolog|bioteknolog.*forskning|drug discovery|biotech research/i,
  /arkitekt|architecture/i,
  /byggeri|bygge-? og anlæg|anlægsvirksomhed|civil engineering|construction|ejendomsudvikling|property development/i,
  /rekruttering|vikarbureau|recruitment|staffing/i,
  /reklamebureau|marketingbureau|creative agency|advertising agency/i,
]

// CVR employee bands. Target industries are accepted from 20+ employees;
// companies in other industries enter the candidate universe only at 100+.
const TARGET_EMPLOYEE_BANDS = ['20-49','50-99','100-199','200-499','500-999','1000+']
const LARGE_EMPLOYEE_BANDS = ['100-199','200-499','500-999','1000+']

function clean(v=''){return String(v??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}
function findObjectArray(value,predicate,depth=0){
  if(depth>5||value==null) return []
  if(Array.isArray(value)){
    if(value.some(item=>predicate(item))) return value
    for(const item of value){
      const found=findObjectArray(item,predicate,depth+1)
      if(found.length) return found
    }
    return []
  }
  if(typeof value==='object'){
    for(const child of Object.values(value)){
      const found=findObjectArray(child,predicate,depth+1)
      if(found.length) return found
    }
  }
  return []
}
function companyRows(v){
  return findObjectArray(v,x=>x&&typeof x==='object'&&('Cvrnr' in x||'cvrnr' in x||'CVR' in x))
}
function branchRows(v){
  return findObjectArray(v,x=>x&&typeof x==='object'&&('Kode' in x||'kode' in x)&&('Navn' in x||'navn' in x))
}
function chunk(items,size){const out=[];for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));return out}
function uniq(items,key){const seen=new Set();return items.filter(x=>{const k=key(x);if(!k||seen.has(k))return false;seen.add(k);return true})}

async function fetchJson(url,timeout=12000){
  const res=await fetch(url,{headers:{'user-agent':'ApplyPilot/0.8.1 company-discovery','accept':'application/json'},signal:AbortSignal.timeout(timeout),cache:'no-store'})
  if(!res.ok) throw new Error(`${new URL(url).hostname}: ${res.status}`)
  return res.json()
}

function haversineKm(a,b){
  const R=6371, rad=x=>x*Math.PI/180
  const dLat=rad(b.lat-a.lat), dLon=rad(b.lon-a.lon)
  const x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2
  return 2*R*Math.asin(Math.sqrt(x))
}

function branchName(company){
  const branches=company?.Brancher||company?.brancher||[]
  if(!Array.isArray(branches)) return ''
  const main=branches.find(b=>b?.isHovedBranche===true||b?.IsHovedBranche===true)||branches[0]
  return clean(main?.Navn||main?.navn||'')
}
function branchCode(company){
  const branches=company?.Brancher||company?.brancher||[]
  if(!Array.isArray(branches)) return ''
  const main=branches.find(b=>b?.isHovedBranche===true||b?.IsHovedBranche===true)||branches[0]
  return String(main?.Kode||main?.kode||'')
}
function location(company){return company?.Beliggenhed||company?.beliggenhed||{}}
function companyCvr(company){return String(company?.Cvrnr||company?.cvrnr||company?.CVR||'')}
function companyName(company){return clean(company?.Navn||company?.navn||'')}
function closed(company){return !!(company?.OphoersDato||company?.ophoersDato)}
function accessPointId(company){
  const l=location(company)
  return clean(l?.Adgangspunkt||l?.adgangspunkt||l?.AdgangspunktId||l?.adgangspunktid||'')
}
function addressText(company){
  const l=location(company)
  const street=clean(l?.Vejstykke?.Navn||l?.vejstykke?.navn||'')
  const no=clean(l?.HusnrFra||l?.husnrFra||l?.husnr||'')
  const post=clean(l?.Postdistrikt?.Kode||l?.Postdistrikt?.kode||l?.Postdistrikt?.Nr||l?.postdistrikt?.kode||'')
  const city=clean(l?.Postdistrikt?.Navn||l?.postdistrikt?.navn||l?.Kommune?.Navn||l?.kommune?.navn||'')
  return [street&&`${street}${no?' '+no:''}`,post,city].filter(Boolean).join(', ')
}
function cityName(company){
  const l=location(company)
  return clean(l?.Postdistrikt?.Navn||l?.postdistrikt?.navn||l?.Kommune?.Navn||l?.kommune?.navn||'')
}

async function municipalitiesForRadius(radiusKm){
  const circle=`${NAERUM.lon},${NAERUM.lat},${radiusKm*1000}`
  const url=`${DAWA}/kommuner?cirkel=${encodeURIComponent(circle)}&struktur=mini&per_side=100`
  const rows=await fetchJson(url,8000)
  return (Array.isArray(rows)?rows:[]).map(x=>({code:String(x?.kode||''),name:clean(x?.navn||'')})).filter(x=>x.code)
}

async function targetBranchCodes(){
  const data=await fetchJson(`${CVR}/branchekoder?format=json`,12000)
  const rows=branchRows(data)
  return rows
    .filter(x=>TARGET_INDUSTRY.some(rx=>rx.test(clean(x?.Navn||x?.navn||''))))
    .map(x=>String(x?.Kode||x?.kode||''))
    .filter(Boolean)
}

async function cvrCompanies(params){
  const qs=new URLSearchParams()
  for(const [k,v] of Object.entries(params)) if(v) qs.set(k,v)
  qs.set('format','json')
  const data=await fetchJson(`${CVR}/virksomheder?${qs}`,14000)
  return companyRows(data)
}

async function loadCandidateCompanies(municipalities,branchCodes){
  const municipalityPipe=municipalities.map(x=>x.code).join('|')
  const tasks=[]

  // Target employer industries, but only 20+ employees.
  for(const codeChunk of chunk(branchCodes,35)){
    for(const employees of TARGET_EMPLOYEE_BANDS){
      tasks.push(cvrCompanies({kommunekode:municipalityPipe,branchekode:codeChunk.join('|'),ansatte:employees})
        .then(rows=>rows.map(x=>({...x,__sizeBand:employees,__candidateType:'Target industry'}))))
    }
  }

  // Large enterprises are candidates even when their primary CVR industry is not IT.
  for(const employees of LARGE_EMPLOYEE_BANDS){
    tasks.push(cvrCompanies({kommunekode:municipalityPipe,ansatte:employees})
      .then(rows=>rows.map(x=>({...x,__sizeBand:employees,__candidateType:'Large enterprise'}))))
  }

  const settled=await Promise.allSettled(tasks)
  const rows=[]
  for(const r of settled) if(r.status==='fulfilled') rows.push(...r.value)
  return uniq(rows,x=>companyCvr(x))
}

async function geocodeAccessPoints(companies){
  const ids=uniq(companies.map(accessPointId).filter(Boolean),x=>x)
  const map=new Map()
  for(const group of chunk(ids,75)){
    try{
      const url=`${DAWA}/adgangsadresser?id=${encodeURIComponent(group.join('|'))}&struktur=nestet&per_side=1000`
      const rows=await fetchJson(url,9000)
      for(const x of Array.isArray(rows)?rows:[]){
        const coords=x?.adgangspunkt?.koordinater
        const id=clean(x?.id||x?.adgangspunkt?.id||'')
        if(id&&Array.isArray(coords)&&coords.length>=2){
          const lon=Number(coords[0]),lat=Number(coords[1])
          if(Number.isFinite(lat)&&Number.isFinite(lon)) map.set(id.toLowerCase(),{lat,lon})
        }
      }
    }catch{}
  }
  return map
}

function employerPass(company){
  const industry=branchName(company)
  if(EXCLUDED_INDUSTRY.some(rx=>rx.test(industry))) return false
  if(company.__candidateType==='Target industry') return TARGET_INDUSTRY.some(rx=>rx.test(industry))
  return company.__candidateType==='Large enterprise'
}

export async function POST(request){
  try{
    const body=await request.json().catch(()=>({}))
    const radiusKm=Number(body?.radiusKm)
    if(!ALLOWED_RADIUS.has(radiusKm)) return NextResponse.json({error:'Radius must be 10, 20, 30, 40 or 50 km.'},{status:400})

    const [municipalities,branchCodes]=await Promise.all([
      municipalitiesForRadius(radiusKm),
      targetBranchCodes(),
    ])
    if(!municipalities.length) throw new Error('Could not resolve municipalities around Nærum.')
    if(!branchCodes.length) throw new Error('Could not resolve target CVR industries.')

    const candidates=await loadCandidateCompanies(municipalities,branchCodes)
    const active=candidates.filter(x=>!closed(x)&&employerPass(x))
    const geo=await geocodeAccessPoints(active)

    const companies=[]
    for(const company of active){
      const point=geo.get(accessPointId(company).toLowerCase())
      if(!point) continue // strict radius: no coordinates, no result
      const distanceKm=haversineKm(NAERUM,point)
      if(distanceKm>radiusKm) continue
      companies.push({
        cvr:companyCvr(company),
        name:companyName(company),
        city:cityName(company),
        address:addressText(company),
        distanceKm:Number(distanceKm.toFixed(1)),
        industry:branchName(company)||'Industry not stated',
        industryCode:branchCode(company),
        sizeBand:company.__sizeBand||'',
        employerType:company.__candidateType,
      })
    }

    companies.sort((a,b)=>a.distanceKm-b.distanceKm||a.name.localeCompare(b.name,'da'))

    return NextResponse.json({
      companies,
      meta:{
        radiusKm,
        source:'CVR public data',
        municipalitiesScanned:municipalities.length,
        candidatesFetched:candidates.length,
        companiesMatched:companies.length,
      }
    })
  }catch(error){
    console.error('company-search error',error)
    return NextResponse.json({error:error?.message||'Company search failed.'},{status:502})
  }
}
