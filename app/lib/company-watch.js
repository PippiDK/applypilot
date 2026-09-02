export const COMPANY_WATCH_STORAGE_KEY='applypilot-company-watch-v1'

export const TARGET_COMPANIES=[
  'Ambu','Coloplast','Novo Nordisk','Danske Bank','3Shape','DSV','EY','NKT','Vestas','DLF','NoA Ignite Denmark','GN','Tryg','SimCorp','PFA','Nordea','Saxo Bank','Ørsted','Microsoft','COWI','Ascendis Pharma','Novo Holdings','Dassault Systèmes','Copenhagen Merchants'
]

export function defaultCompanyWatch(){return {enabled:true,selected:[...TARGET_COMPANIES]}}

export function normalizeCompanyWatch(value={}){
  const selected=Array.isArray(value?.selected)?value.selected.filter(name=>TARGET_COMPANIES.includes(name)):[...TARGET_COMPANIES]
  return {enabled:value?.enabled!==false,selected:[...new Set(selected)]}
}

export function readCompanyWatch(storage){
  if(!storage?.getItem) return defaultCompanyWatch()
  try{
    const raw=storage.getItem(COMPANY_WATCH_STORAGE_KEY)
    return raw?normalizeCompanyWatch(JSON.parse(raw)):defaultCompanyWatch()
  }catch{return defaultCompanyWatch()}
}

export function writeCompanyWatch(storage,value){
  const next=normalizeCompanyWatch(value)
  try{storage?.setItem?.(COMPANY_WATCH_STORAGE_KEY,JSON.stringify(next))}catch{}
  return next
}
