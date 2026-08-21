import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CVR = 'https://grunddata.filarkiv.dk/v1/cvr'
const DAWA = 'https://api.dataforsyningen.dk'
const BLOO = 'https://bloo.dk/api/v1'
const NAERUM = { lat: 55.8175, lon: 12.5377 }
const ALLOWED_RADIUS = new Set([10,20,30,40,50])

// Agreed employer universe for Step 1. User does not configure these.
const TARGET_INDUSTRY = [
  /software|computerprogrammer|informationsteknolog|it[- ]?service|it[- ]?konsulent|saas|cloud|databehandling|webhosting|cyber/i,
  /bank|finans|kredit|betaling|payment|fintech|forsikring|insurance|pension/i,
  /telekommunikation|telecom|satellit|kommunikationsteknolog/i,
  /elektricitet|energi|gasforsyning|fjernvarme|forsyning|utility/i,
  /logistik|transport|lufttransport|luftfart|maritim|søtransport|skibsfart|spedition/i,
  /medicinsk|dentale instrumenter|medicoteknik|medtech|healthtech|sundhedsteknolog/i,
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

// Six-digit DB07/DB25 codes. /cvr/geometri explicitly supports six-digit
// branchekode and multi-value search, so discovery can be done in one call.
const TARGET_BRANCH_CODES = [
  '582100','582900','620100','620200','620300','620900','631100','631200',
  '621000','622000','629000','631000','639100','639200',
  '611000','612000','613000','619000',
  '641100','641900','649100','649210','649220','649230','649900',
  '651100','651200','652000','653010','653020','661100','661200','661900','662100','662200','662900',
  '351100','351200','351300','351400','352100','352200','352300','353000',
  '491000','492000','493100','493200','494100','494200','495000',
  '501000','502000','503000','504000','511000','512100','512200',
  '521000','522100','522200','522300','522400','522900','531000','532000',
  '211000','212000','325000'
]

function clean(v=''){return String(v??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}
function chunk(items,size){const out=[];for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));return out}
function uniq(items,key){const seen=new Set();return items.filter(x=>{const k=key(x);if(!k||seen.has(k))return false;seen.add(k);return true})}

async function fetchJson(url,timeout=15000){
  const res=await fetch(url,{headers:{'user-agent':'ApplyPilot/0.8.4 company-discovery','accept':'application/json'},signal:AbortSignal.timeout(timeout),cache:'no-store'})
  if(!res.ok) throw new Error(`${new URL(url).hostname}: ${res.status}`)
  return res.json()
}

function haversineKm(a,b){
  const R=6371, rad=x=>x*Math.PI/180
  const dLat=rad(b.lat-a.lat), dLon=rad(b.lon-a.lon)
  const x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2
  return 2*R*Math.asin(Math.sqrt(x))
}

function findObjectArray(value,predicate,depth=0){
  if(depth>6||value==null) return []
  if(Array.isArray(value)){
    if(value.some(item=>predicate(item))) return value
    for(const item of value){const found=findObjectArray(item,predicate,depth+1);if(found.length)return found}
    return []
  }
  if(typeof value==='object'){
    for(const child of Object.values(value)){const found=findObjectArray(child,predicate,depth+1);if(found.length)return found}
  }
  return []
}
function companyRows(v){return findObjectArray(v,x=>x&&typeof x==='object'&&('Cvrnr' in x||'cvrnr' in x||'CVR' in x||'CVRnr' in x))}

function location(company){return company?.Beliggenhed||company?.beliggenhed||{}}
function companyCvr(company){return String(company?.Cvrnr||company?.cvrnr||company?.CVRnr||company?.CVR||'')}
function companyName(company){return clean(company?.Navn||company?.navn||'')}
function closed(company){return !!(company?.OphoersDato||company?.ophoersDato)}
function addressId(company){const l=location(company);return clean(l?.AdresseId||l?.adresseId||l?.adresseid||'')}
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
function cityName(company){
  const l=location(company)
  return clean(l?.Postdistrikt?.PostDistrikt||l?.postdistrikt?.postDistrikt||l?.postdistrikt?.postdistrikt||l?.Kommune?.Navn||l?.kommune?.navn||'')
}
function addressText(company){
  const l=location(company)
  const street=clean(l?.Vejstykke?.Navn||l?.vejstykke?.navn||'')
  const no=clean(l?.HusnrFra||l?.husnrFra||l?.husnr||'')
  const post=clean(l?.Postdistrikt?.PostNr||l?.postdistrikt?.postNr||l?.postdistrikt?.postnr||'')
  const city=cityName(company)
  return [street&&`${street}${no?' '+no:''}`,post,city].filter(Boolean).join(', ')
}

async function municipalitiesForRadius(radiusKm){
  const circle=`${NAERUM.lon},${NAERUM.lat},${radiusKm*1000}`
  const rows=await fetchJson(`${DAWA}/kommuner?cirkel=${encodeURIComponent(circle)}&struktur=mini&per_side=100`,8000)
  return (Array.isArray(rows)?rows:[]).map(x=>({code:String(x?.kode||'').padStart(4,'0'),name:clean(x?.navn||'')})).filter(x=>x.code)
}

function extractCvrIds(value,found=new Set(),depth=0){
  if(depth>8||value==null) return found
  if(Array.isArray(value)){for(const item of value)extractCvrIds(item,found,depth+1);return found}
  if(typeof value==='object'){
    for(const [k,v] of Object.entries(value)){
      if(/cvr/i.test(k)){
        const m=String(v??'').match(/\b\d{8}\b/)
        if(m) found.add(m[0])
      }
      extractCvrIds(v,found,depth+1)
    }
  }
  return found
}

async function discoverCvrIds(municipalities){
  const qs=new URLSearchParams()
  qs.set('kommunekode',municipalities.map(x=>x.code).join('|'))
  qs.set('branchekode',TARGET_BRANCH_CODES.join('|'))
  qs.set('format','geojson')
  const data=await fetchJson(`${CVR}/geometri?${qs}`,20000)
  return [...extractCvrIds(data)]
}

async function fetchCompaniesByCvr(ids){
  const all=[]
  let failed=0
  for(const group of chunk(ids,40)){
    try{
      const qs=new URLSearchParams({cvrnr:group.join('|'),format:'json'})
      const data=await fetchJson(`${CVR}/virksomheder?${qs}`,18000)
      all.push(...companyRows(data))
    }catch{failed++}
  }
  return {rows:uniq(all,x=>companyCvr(x)),failed}
}

async function blooFallback(ids){
  const rows=[]
  for(const id of ids.slice(0,20)){
    try{
      const v=await fetchJson(`${BLOO}/virksomhed/${encodeURIComponent(id)}`,8000)
      const d=v?.data||v
      if(!d?.cvrNummer) continue
      const a=d?.adresse||{}
      rows.push({
        Cvrnr:d.cvrNummer,
        Navn:d.navn,
        OphoersDato:d.ophoersdato||null,
        Beliggenhed:{
          AdresseId:'',
          Kommune:{Navn:a?.kommune?.kommuneNavn||''},
          Vejstykke:{Navn:a?.vejnavn||''},
          HusnrFra:a?.husnummerFra||'',
          Postdistrikt:{PostNr:a?.postnummer||'',PostDistrikt:a?.postdistrikt||''}
        },
        Brancher:[{Kode:d?.branche?.kode||'',Navn:d?.branche?.tekst||'',isHovedBranche:true}],
        __blooAddress:[a?.vejnavn,a?.husnummerFra,a?.postnummer,a?.postdistrikt].filter(Boolean).join(' '),
        __employees:Number(d?.ansatte)||null,
      })
    }catch{}
  }
  return rows
}

async function geocodeCompanies(companies){
  const byId=new Map()
  const withIds=companies.filter(c=>addressId(c))
  for(const group of chunk(withIds.map(addressId),75)){
    try{
      const rows=await fetchJson(`${DAWA}/adresser?id=${encodeURIComponent(group.join('|'))}&struktur=nestet&per_side=1000`,9000)
      for(const x of Array.isArray(rows)?rows:[]){
        const coords=x?.adgangsadresse?.adgangspunkt?.koordinater
        if(x?.id&&Array.isArray(coords)&&coords.length>=2) byId.set(String(x.id).toLowerCase(),{lat:Number(coords[1]),lon:Number(coords[0])})
      }
    }catch{}
  }
  // Fallback for BLOO records (no DAR id): geocode their public address text.
  for(const c of companies.filter(c=>!addressId(c)&&c.__blooAddress)){
    try{
      const rows=await fetchJson(`${DAWA}/adresser?q=${encodeURIComponent(c.__blooAddress)}&per_side=1&struktur=nestet`,6000)
      const coords=rows?.[0]?.adgangsadresse?.adgangspunkt?.koordinater
      if(Array.isArray(coords)&&coords.length>=2) byId.set(`cvr:${companyCvr(c)}`,{lat:Number(coords[1]),lon:Number(coords[0])})
    }catch{}
  }
  return byId
}

function employerPass(company){
  const industry=branchName(company)
  if(EXCLUDED_INDUSTRY.some(rx=>rx.test(industry))) return false
  return TARGET_INDUSTRY.some(rx=>rx.test(industry)) || TARGET_BRANCH_CODES.includes(branchCode(company).padStart(6,'0'))
}

export async function POST(request){
  try{
    const body=await request.json().catch(()=>({}))
    const radiusKm=Number(body?.radiusKm)
    if(!ALLOWED_RADIUS.has(radiusKm)) return NextResponse.json({error:'Radius must be 10, 20, 30, 40 or 50 km.'},{status:400})

    const municipalities=await municipalitiesForRadius(radiusKm)
    if(!municipalities.length) throw new Error('Could not resolve municipalities around Nærum.')

    const discoveredIds=await discoverCvrIds(municipalities)
    if(!discoveredIds.length) throw new Error('CVR discovery returned no company IDs.')

    let details=await fetchCompaniesByCvr(discoveredIds)
    let candidates=details.rows
    let usedFallback=false
    if(!candidates.length){
      candidates=await blooFallback(discoveredIds)
      usedFallback=true
    }

    const active=candidates.filter(x=>!closed(x)&&employerPass(x))
    const geo=await geocodeCompanies(active)
    const companies=[]
    for(const company of active){
      const key=addressId(company)?addressId(company).toLowerCase():`cvr:${companyCvr(company)}`
      const point=geo.get(key)
      if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lon)) continue
      const distanceKm=haversineKm(NAERUM,point)
      if(distanceKm>radiusKm) continue
      companies.push({
        cvr:companyCvr(company),
        name:companyName(company),
        city:cityName(company),
        address:addressText(company)||company.__blooAddress||'',
        distanceKm:Number(distanceKm.toFixed(1)),
        industry:branchName(company)||'Industry not stated',
        industryCode:branchCode(company),
        sizeBand:company.__employees?`${company.__employees}`:'',
        employerType:'Target industry',
      })
    }
    companies.sort((a,b)=>a.distanceKm-b.distanceKm||a.name.localeCompare(b.name,'da'))

    console.log('company-search stages',JSON.stringify({radiusKm,municipalities:municipalities.length,discoveredIds:discoveredIds.length,detailRows:candidates.length,detailBatchFailures:details.failed,usedFallback,profilePassed:active.length,geocoded:geo.size,matched:companies.length}))

    return NextResponse.json({
      companies,
      meta:{
        radiusKm,
        source:usedFallback?'CVR geometry + BLOO fallback':'CVR public data',
        municipalitiesScanned:municipalities.length,
        candidatesFetched:candidates.length,
        employerProfilePassed:active.length,
        addressesGeocoded:geo.size,
        companiesMatched:companies.length,
      }
    })
  }catch(error){
    console.error('company-search error',error)
    return NextResponse.json({error:error?.message||'Company search failed.'},{status:502})
  }
}
