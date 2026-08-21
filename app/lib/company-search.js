export const NAERUM = { lat: 55.81769, lon: 12.53629 }

// The user only selects radius. Company profile and profession family are intentionally internal.
export const TARGET_ROLE_PATTERNS = [
  /\bsenior\s+(?:it\s+|technical\s+|software\s+|digital\s+)?project\s+manager\b/i,
  /\bit\s+project\s+manager\b/i,
  /\btechnical\s+project\s+manager\b/i,
  /\bdelivery\s+manager\b/i,
  /\btransformation\s+project\s+manager\b/i,
  /\bimplementation\s+manager\b/i,
  /\bplatform\s+delivery\s+lead\b/i,
  /\bsoftware\s+delivery\s+lead\b/i,
]

const TARGET_INDUSTRY = [
  /software|computerprogrammering|informationsteknolog|it-konsulent|it konsulent|saas/i,
  /bank|finans|betaling|payment|fintech|forsikring|insurance/i,
  /telekommunikation|telecom|kommunikationsteknolog/i,
  /energi|elektricitet|gasforsyning|forsyning|utility|utilities/i,
  /logistik|transport|lufttransport|luftfart|maritim|søtransport|skibsfart/i,
  /medicinsk|medtech|healthtech|sundhedsteknolog/i,
  /farmaceut|lægemiddel|pharma/i,
  /rådgivning.*informationsteknolog|informationsteknolog.*rådgivning|technology consulting|it consulting/i,
]

const COMPANY_EXCLUSIONS = [
  /forskning.*bioteknolog|bioteknolog.*forskning|research.*biotech|drug discovery/i,
  /arkitekt|architecture/i,
  /byggeri|bygge-? og anlæg|anlægsvirksomhed|civil engineering|construction|ejendomsudvikling|property development/i,
  /rekruttering|vikarbureau|recruitment|staffing agency/i,
  /reklamebureau|marketingbureau|creative agency|advertising agency/i,
]

const JD_HARD_EXCLUSIONS = [
  /(?:drug discovery|preclinical|wet lab|laboratory research|molecular biology|medicinal chemistry)/i,
  /(?:construction project|civil engineering|building project|architecture project|site manager)/i,
  /(?:hardware r&d|hardware development|product development r&d|manufacturing r&d)/i,
]

export function clean(value='') {
  return String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/\s+/g,' ')
    .trim()
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const r = 6371
  const p1 = lat1 * Math.PI / 180
  const p2 = lat2 * Math.PI / 180
  const dp = (lat2 - lat1) * Math.PI / 180
  const dl = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dp/2)**2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2)**2
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export function professionMatches(title='') {
  const t = clean(title)
  return TARGET_ROLE_PATTERNS.some(rx => rx.test(t))
}

export function mandatoryDanish(jd='') {
  const t = clean(jd)
  return /(?:must|required|mandatory|fluent|professional|native|proficient)[^.!?]{0,45}\bdanish\b/i.test(t)
    || /\bdanish\b[^.!?]{0,45}(?:must|required|mandatory|fluent|professional|native|proficient)/i.test(t)
    || /(?:flydende|professionelt|modersmål)[^.!?]{0,30}\bdansk\b/i.test(t)
}

export function jdHardRejected(jd='') {
  const text = clean(jd)
  if (mandatoryDanish(text)) return 'Mandatory Danish'
  const hit = JD_HARD_EXCLUSIONS.find(rx => rx.test(text))
  return hit ? 'Excluded role/domain' : ''
}

function bestEmployeeCount(records=[]) {
  const values = records
    .map(r => ({
      count: Number(r?.antal),
      from: Number(r?.intervalFra),
      to: Number(r?.intervalTil),
      date: new Date(r?.datoTil || r?.datoFra || r?.registreringsdato || 0).getTime() || 0,
    }))
    .sort((a,b)=>b.date-a.date)
  for (const x of values) {
    if (Number.isFinite(x.count) && x.count >= 0) return x.count
    if (Number.isFinite(x.to) && x.to >= 0) return x.to
    if (Number.isFinite(x.from) && x.from >= 0) return x.from
  }
  return null
}

export function companyProfileDecision({branches=[], employment=[]}={}) {
  const branchText = branches.map(b => clean(b?.vaerdiTekst || b?.tekst || b?.text || '')).join(' · ')
  if (!branchText) return {pass:false,reason:'Company industry is unknown'}
  if (COMPANY_EXCLUSIONS.some(rx => rx.test(branchText))) return {pass:false,reason:'Company type excluded'}

  const employees = bestEmployeeCount(employment)
  if (!Number.isFinite(employees)) return {pass:false,reason:'Company size is unknown'}
  const targetIndustry = TARGET_INDUSTRY.some(rx => rx.test(branchText))

  if (employees >= 100) return {pass:true,employees,branchText,targetIndustry}
  if (employees >= 20 && targetIndustry) return {pass:true,employees,branchText,targetIndustry}
  return {pass:false,reason:'Company does not meet employer profile',employees,branchText,targetIndustry}
}

export function corporateDomainFromEmails(emails=[]) {
  const blocked = /^(gmail|googlemail|hotmail|outlook|live|icloud|me|yahoo|protonmail|proton)\./i
  for (const item of emails) {
    const value = clean(item?.vaerdi || item?.value || item)
    const m = value.match(/@([^\s>]+)$/)
    if (!m) continue
    const domain = m[1].toLowerCase().replace(/[),.;]+$/,'')
    if (!blocked.test(domain) && domain.includes('.')) return domain
  }
  return ''
}

export function absoluteUrl(href='', base='') {
  try {
    const url = new URL(href, base)
    if (!/^https?:$/.test(url.protocol)) return ''
    return url.toString()
  } catch { return '' }
}

export function extractLinks(html='', base='') {
  const out=[]
  const rx=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m=rx.exec(String(html)))) {
    const url=absoluteUrl(m[1],base)
    if (!url) continue
    const text=clean(m[2])
    out.push({url,text})
  }
  return out
}

export function careerLinks(html='', base='') {
  const marker=/(careers?|jobs?|karriere|ledige[- ]?stillinger|vacancies|open[- ]?positions|join[- ]?us|work[- ]?with[- ]?us)/i
  const seen=new Set()
  return extractLinks(html,base).filter(x=>marker.test(`${x.text} ${x.url}`)).filter(x=>{
    if(seen.has(x.url)) return false
    seen.add(x.url);return true
  }).slice(0,8)
}

export function jobLinks(html='', base='') {
  const seen=new Set()
  const links=extractLinks(html,base).filter(x=>professionMatches(x.text) || professionMatches(decodeURIComponent(x.url).replace(/[-_/]+/g,' ')))
  return links.filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true}).slice(0,20)
}

export function htmlTitle(html='') {
  const h1=String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
  if(h1 && clean(h1[1])) return clean(h1[1])
  const title=String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  return title ? clean(title[1]).replace(/\s+[|–—-]\s+[^|–—-]+$/,'').trim() : ''
}

export function fullJobDescription(html='') {
  const text=clean(html)
  return text.length >= 500 ? text.slice(0,30000) : ''
}

// Broad municipal superset used only to avoid downloading CVR files for all Denmark.
// Exact inclusion is decided later from the company's address coordinates and the selected radius.
const MUNICIPALITIES = {
  10:['0230','0223','0173','0157'],
  20:['0230','0223','0173','0157','0159','0190','0201','0210','0151','0163'],
  30:['0230','0223','0173','0157','0159','0190','0201','0210','0151','0163','0101','0147','0219','0240','0217','0175','0165','0169'],
  40:['0230','0223','0173','0157','0159','0190','0201','0210','0151','0163','0101','0147','0219','0240','0217','0175','0165','0169','0167','0153','0187','0183','0185','0270','0250'],
  50:['0230','0223','0173','0157','0159','0190','0201','0210','0151','0163','0101','0147','0219','0240','0217','0175','0165','0169','0167','0153','0187','0183','0185','0270','0250','0155','0253','0269','0265'],
}

export function municipalityCodes(radiusKm) {
  const r=Number(radiusKm)
  const key=r<=10?10:r<=20?20:r<=30?30:r<=40?40:50
  return MUNICIPALITIES[key]
}
