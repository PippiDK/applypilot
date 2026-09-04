import {NextResponse} from 'next/server'
import {requireUser} from '../../lib/auth/require-user.js'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60

const CVR='https://grunddata.filarkiv.dk/v1/cvr'
const DAWA='https://api.dataforsyningen.dk'
const BLOO='https://bloo.dk/api/v1'
const NAERUM={lat:55.8175,lon:12.5377}
const ALLOWED_RADIUS=new Set([10,20,30,40,50])

const CONSULTANCY_INDUSTRY=/management consulting|business consulting|virksomhedsrådgivning|driftsledelse|technology consulting|it consulting|it[- ]?konsulent/i
const TARGET_INDUSTRY=[
  /software|computerprogrammer|informationsteknolog|it[- ]?service|it[- ]?konsulent|saas|cloud|databehandling|webhosting|cyber/i,
  /bank|finans|kredit|betaling|payment|fintech|forsikring|insurance|pension/i,
  /telekommunikation|telecom|satellit|kommunikationsteknolog/i,
  /elektricitet|energi|gasforsyning|fjernvarme|forsyning|utility/i,
  /logistik|transport|lufttransport|luftfart|maritim|søtransport|skibsfart|spedition/i,
  /medicinsk|dentale instrumenter|medicoteknik|medtech|healthtech|sundhedsteknolog/i,
  /farmaceut|lægemiddel|pharma/i,
  /rådgivning.*informationsteknolog|informationsteknolog.*rådgivning|technology consulting|it consulting/i,
  /management consulting|business consulting|virksomhedsrådgivning|driftsledelse/i,
]
const EXCLUDED_INDUSTRY=[
  /forskning.*bioteknolog|bioteknolog.*forskning|drug discovery|biotech research/i,
  /arkitekt|architecture/i,
  /byggeri|bygge-? og anlæg|anlægsvirksomhed|civil engineering|construction|ejendomsudvikling|property development/i,
  /rekruttering|vikarbureau|recruitment|staffing/i,
  /reklamebureau|marketingbureau|creative agency|advertising agency/i,
]
const TARGET_BRANCH_CODES=[
  '582100','582900','620100','620200','620300','620900','631100','631200',
  '621000','622000','629000','631000','639100','639200',
  '611000','612000','613000','619000',
  '641100','641900','649100','649210','649220','649230','649900',
  '651100','651200','652000','653010','653020','661100','661200','661900','662100','662200','662900',
  '351100','351200','351300','351400','352100','352200','352300','353000',
  '491000','492000','493100','493200','494100','494200','495000',
  '501000','502000','503000','504000','511000','512100','512200',
  '521000','522100','522200','522300','522400','522900','531000','532000',
  '211000','212000','325000','702200'
]

function clean(value=''){return String(value??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}
function chunk(items,size){const out=[];for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));return out}
function uniq(items,key){const seen=new Set();return items.filter(item=>{const id=key(item);if(!id||seen.has(id))return false;seen.add(id);return true})}

async function fetchJson(url,timeout=15000){
  const res=await fetch(url,{headers:{'user-agent':'ApplyPilot/1.0 company-discovery','accept':'application/json'},signal:AbortSignal.timeout(timeout),cache:'no-store'})
  if(!res.ok) throw new Error(`${new URL(url).hostname}: ${res.status}`)
  return res.json()
}
function haversineKm(a,b){
  const R=6371,rad=value=>value*Math.PI/180
  const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon)
  const x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2
  return 2*R*Math.asin(Math.sqrt(x))
}
function findObjectArray(value,predicate,depth=0){
  if(depth>6||value==null)return []
  if(Array.isArray(value)){
    if(value.some(item=>predicate(item)))return value
    for(const item of value){const found=findObjectArray(item,predicate,depth+1);if(found.length)return found}
    return []
  }
  if(typeof value==='object'){
    for(const child of Object.values(value)){const found=findObjectArray(child,predicate,depth+1);if(found.length)return found}
  }
  return []
}
function companyRows(value){return findObjectArray(value,item=>item&&typeof item==='object'&&('Cvrnr'in item||'cvrnr'in item||'CVR'in item||'CVRnr'in item))}
function location(company){return company?.Beliggenhed||company?.beliggenhed||{}}
function companyCvr(company){return String(company?.Cvrnr||company?.cvrnr||company?.CVRnr||company?.CVR||'')}
function companyName(company){return clean(company?.Navn||company?.navn||'')}
function closed(company){return Boolean(company?.OphoersDato||company?.ophoersDato)}
function addressId(company){const value=location(company);return clean(value?.AdresseId||value?.adresseId||value?.adresseid||'')}
function branchName(company){
  const branches=company?.Brancher||company?.brancher||[]
  if(!Array.isArray(branches))return ''
  const main=branches.find(branch=>branch?.isHovedBranche===true||branch?.IsHovedBranche===true)||branches[0]
  return clean(main?.Navn||main?.navn||'')
}
function branchCode(company){
  const branches=company?.Brancher||company?.brancher||[]
  if(!Array.isArray(branches))return ''
  const main=branches.find(branch=>branch?.isHovedBranche===true||branch?.IsHovedBranche===true)||branches[0]
  return String(main?.Kode||main?.kode||'')
}
function cityName(company){
  const value=location(company)
  return clean(value?.Postdistrikt?.PostDistrikt||value?.postdistrikt?.postDistrikt||value?.postdistrikt?.postdistrikt||value?.Kommune?.Navn||value?.kommune?.navn||'')
}
function addressText(company){
  const value=location(company)
  const street=clean(value?.Vejstykke?.Navn||value?.vejstykke?.navn||'')
  const number=clean(value?.HusnrFra||value?.husnrFra||value?.husnr||'')
  const post=clean(value?.Postdistrikt?.PostNr||value?.postdistrikt?.postNr||value?.postdistrikt?.postnr||'')
  const city=cityName(company)
  return [street&&`${street}${number?' '+number:''}`,post,city].filter(Boolean).join(', ')
}
function employerPass(company){
  const industry=branchName(company)
  if(EXCLUDED_INDUSTRY.some(pattern=>pattern.test(industry)))return false
  return TARGET_INDUSTRY.some(pattern=>pattern.test(industry))||TARGET_BRANCH_CODES.includes(branchCode(company).padStart(6,'0'))
}
function employerType(company){
  const industry=branchName(company)
  return CONSULTANCY_INDUSTRY.test(industry)||branchCode(company).padStart(6,'0')==='702200'?'Consultancy':'Company'
}

async function municipalitiesForRadius(radiusKm){
  const circle=`${NAERUM.lon},${NAERUM.lat},${radiusKm*1000}`
  const rows=await fetchJson(`${DAWA}/kommuner?cirkel=${encodeURIComponent(circle)}&struktur=mini&per_side=100`,8000)
  return (Array.isArray(rows)?rows:[]).map(item=>({code:String(item?.kode||'').padStart(4,'0'),name:clean(item?.navn||'')})).filter(item=>item.code)
}
function extractCvrIds(value,found=new Set(),depth=0){
  if(depth>8||value==null)return found
  if(Array.isArray(value)){for(const item of value)extractCvrIds(item,found,depth+1);return found}
  if(typeof value==='object'){
    for(const [key,child]of Object.entries(value)){
      if(/cvr/i.test(key)){const match=String(child??'').match(/\b\d{8}\b/);if(match)found.add(match[0])}
      extractCvrIds(child,found,depth+1)
    }
  }
  return found
}
async function discoverCvrIds(municipalities){
  const qs=new URLSearchParams()
  qs.set('kommunekode',municipalities.map(item=>item.code).join('|'))
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
  return {rows:uniq(all,companyCvr),failed}
}
async function blooFallback(ids){
  const rows=[]
  for(const id of ids.slice(0,20)){
    try{
      const value=await fetchJson(`${BLOO}/virksomhed/${encodeURIComponent(id)}`,8000)
      const data=value?.data||value
      if(!data?.cvrNummer)continue
      const address=data?.adresse||{}
      rows.push({
        Cvrnr:data.cvrNummer,Navn:data.navn,OphoersDato:data.ophoersdato||null,
        Beliggenhed:{AdresseId:'',Kommune:{Navn:address?.kommune?.kommuneNavn||''},Vejstykke:{Navn:address?.vejnavn||''},HusnrFra:address?.husnummerFra||'',Postdistrikt:{PostNr:address?.postnummer||'',PostDistrikt:address?.postdistrikt||''}},
        Brancher:[{Kode:data?.branche?.kode||'',Navn:data?.branche?.tekst||'',isHovedBranche:true}],
        __blooAddress:[address?.vejnavn,address?.husnummerFra,address?.postnummer,address?.postdistrikt].filter(Boolean).join(' '),
        __employees:Number(data?.ansatte)||null,
      })
    }catch{}
  }
  return rows
}
async function geocodeCompanies(companies){
  const byId=new Map()
  const withIds=companies.filter(company=>addressId(company))
  for(const group of chunk(withIds.map(addressId),75)){
    try{
      const rows=await fetchJson(`${DAWA}/adresser?id=${encodeURIComponent(group.join('|'))}&struktur=nestet&per_side=1000`,9000)
      for(const item of Array.isArray(rows)?rows:[]){
        const coords=item?.adgangsadresse?.adgangspunkt?.koordinater
        if(item?.id&&Array.isArray(coords)&&coords.length>=2)byId.set(String(item.id).toLowerCase(),{lat:Number(coords[1]),lon:Number(coords[0])})
      }
    }catch{}
  }
  for(const company of companies.filter(item=>!addressId(item)&&item.__blooAddress)){
    try{
      const rows=await fetchJson(`${DAWA}/adresser?q=${encodeURIComponent(company.__blooAddress)}&per_side=1&struktur=nestet`,6000)
      const coords=rows?.[0]?.adgangsadresse?.adgangspunkt?.koordinater
      if(Array.isArray(coords)&&coords.length>=2)byId.set(`cvr:${companyCvr(company)}`,{lat:Number(coords[1]),lon:Number(coords[0])})
    }catch{}
  }
  return byId
}

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user)return auth.response
  try{
    const body=await request.json().catch(()=>({}))
    const radiusKm=Number(body?.radiusKm)
    if(!ALLOWED_RADIUS.has(radiusKm))return NextResponse.json({error:'Radius must be 10, 20, 30, 40 or 50 km.'},{status:400})

    const municipalities=await municipalitiesForRadius(radiusKm)
    if(!municipalities.length)throw new Error('Could not resolve municipalities around Nærum.')
    const discoveredIds=await discoverCvrIds(municipalities)
    if(!discoveredIds.length)throw new Error('CVR discovery returned no company IDs.')

    const details=await fetchCompaniesByCvr(discoveredIds)
    let candidates=details.rows
    let usedFallback=false
    if(!candidates.length){candidates=await blooFallback(discoveredIds);usedFallback=true}

    const active=candidates.filter(company=>!closed(company)&&employerPass(company))
    const geo=await geocodeCompanies(active)
    const companies=[]
    for(const company of active){
      const key=addressId(company)?addressId(company).toLowerCase():`cvr:${companyCvr(company)}`
      const point=geo.get(key)
      if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lon))continue
      const distanceKm=haversineKm(NAERUM,point)
      if(distanceKm>radiusKm)continue
      companies.push({
        cvr:companyCvr(company),name:companyName(company),city:cityName(company),address:addressText(company)||company.__blooAddress||'',
        distanceKm:Number(distanceKm.toFixed(1)),industry:branchName(company)||'Industry not stated',industryCode:branchCode(company),
        sizeBand:company.__employees?`${company.__employees}`:'',employerType:employerType(company),
      })
    }
    companies.sort((a,b)=>a.distanceKm-b.distanceKm||a.name.localeCompare(b.name,'da'))

    console.log('company-search stages',JSON.stringify({radiusKm,municipalities:municipalities.length,discoveredIds:discoveredIds.length,detailRows:candidates.length,detailBatchFailures:details.failed,usedFallback,profilePassed:active.length,geocoded:geo.size,matched:companies.length}))
    return NextResponse.json({companies,meta:{radiusKm,source:usedFallback?'CVR geometry + BLOO fallback':'CVR public data',municipalitiesScanned:municipalities.length,candidatesFetched:candidates.length,employerProfilePassed:active.length,addressesGeocoded:geo.size,companiesMatched:companies.length}})
  }catch(error){
    console.error('company-search error',error)
    return NextResponse.json({error:error?.message||'Company search failed.'},{status:502})
  }
}
