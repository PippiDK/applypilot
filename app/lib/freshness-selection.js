const COPENHAGEN_TIME_ZONE='Europe/Copenhagen'
const DAY_MS=86400000

export const FRESHNESS_OPTIONS=[
  {id:'today',label:'Today',requestDays:1},
  {id:'yesterday',label:'Yesterday',requestDays:3},
  {id:'5d',label:'5 days',requestDays:7},
  {id:'10d',label:'10 days',requestDays:14},
]

const optionFor=selection=>FRESHNESS_OPTIONS.find(option=>option.id===selection)||FRESHNESS_OPTIONS[2]

function copenhagenDateKey(value){
  const date=value instanceof Date?value:new Date(value)
  if(!Number.isFinite(date.getTime())) return null
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:COPENHAGEN_TIME_ZONE,
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
  }).formatToParts(date)
  const part=type=>parts.find(item=>item.type===type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function publishedDate(item){
  const value=item?.job?.publishedAt??item?.publishedAt
  const date=value?new Date(value):null
  return date&&Number.isFinite(date.getTime())?date:null
}

export function freshnessRequestDays(selection){
  return optionFor(selection).requestDays
}

export function freshnessSelectionFromDays(days){
  const requested=Number(days)
  return FRESHNESS_OPTIONS.find(option=>option.requestDays===requested)?.id||'5d'
}

export function freshnessResultLabel(selection){
  if(selection==='today') return 'Today'
  if(selection==='yesterday') return 'Yesterday'
  if(selection==='10d') return 'Newest 10 days'
  return 'Newest 5 days'
}

export function filterItemsByFreshnessSelection(items=[],selection='5d',now=new Date()){
  const current=now instanceof Date?now:new Date(now)
  if(!Number.isFinite(current.getTime())) return []

  if(selection==='today'){
    const target=copenhagenDateKey(current)
    return (Array.isArray(items)?items:[]).filter(item=>{
      const published=publishedDate(item)
      return published&&copenhagenDateKey(published)===target
    })
  }

  if(selection==='yesterday'){
    const target=copenhagenDateKey(new Date(current.getTime()-DAY_MS))
    return (Array.isArray(items)?items:[]).filter(item=>{
      const published=publishedDate(item)
      return published&&copenhagenDateKey(published)===target
    })
  }

  const horizonDays=selection==='10d'?10:5
  const maxAge=horizonDays*DAY_MS
  return (Array.isArray(items)?items:[]).filter(item=>{
    const published=publishedDate(item)
    if(!published) return false
    const age=current.getTime()-published.getTime()
    return age>=0&&age<=maxAge
  })
}
