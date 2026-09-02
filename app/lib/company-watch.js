export const COMPANY_WATCH_STORAGE_KEY='applypilot-company-watch-v1'

export const COMPANY_CONNECTORS={
  '3Shape':{status:'connected',connector:'teamtailor',baseUrl:'https://careers.3shape.com'},
  'NoA Ignite Denmark':{status:'connected',connector:'teamtailor',baseUrl:'https://careers-dk.noaignite.com'},
  'Coloplast':{status:'connected',connector:'successfactors',baseUrl:'https://careers.coloplast.com',listingPath:'/go/BusSupport_it/4775001/'},
  'Vestas':{status:'connected',connector:'successfactors',baseUrl:'https://careers.vestas.com',listingPath:'/go/All-Jobs/3298601/'},
  'DSV':{status:'connected',connector:'successfactors',baseUrl:'https://jobs.dsv.com',listingPath:'/go/Jobs%40DSV/2713001/'},
  'NKT':{status:'connected',connector:'successfactors',baseUrl:'https://jobs.nkt.com',searchPath:'/search/'},
  'Tryg':{status:'connected',connector:'successfactors',baseUrl:'https://careers.tryg.com',searchPath:'/Tryg/search/'},
  'SimCorp':{status:'connected',connector:'workday',host:'https://simcorp.wd3.myworkdayjobs.com',tenant:'simcorp',site:'SimCorp_Jobs',locationTokens:['copenhagen','denmark']},
  'Saxo Bank':{status:'connected',connector:'workday',host:'https://saxobank.wd3.myworkdayjobs.com',tenant:'saxobank',site:'CareeratSaxoBank',locationTokens:['copenhagen','hellerup','denmark']},
  'Novo Nordisk':{status:'connected',connector:'successfactors',baseUrl:'https://careers.novonordisk.com',searchPath:'/search/'},
  'Nordea':{status:'connected',connector:'successfactors',baseUrl:'https://careers.nordea.com',searchPath:'/search/'},
  'Danske Bank':{status:'connected',connector:'oracle',host:'https://ejqi.fa.ocs.oraclecloud.eu',site:'CX_1001',country:'Denmark'},
  'DLF':{status:'connected',connector:'successfactors',baseUrl:'https://careers.dlf.com',listingPath:'/go/Greater-Europe/8944455/'},
  'Ascendis Pharma':{status:'connected',connector:'workable',slug:'ascendis-pharma',country:'Denmark'},
  'GN':{status:'connected',connector:'workday',host:'https://gn.wd3.myworkdayjobs.com',tenant:'gn',site:'GN-Careers',locationTokens:['ballerup','denmark']},
}

export const TARGET_COMPANIES=[
  'Ambu','Coloplast','Novo Nordisk','Danske Bank','3Shape','DSV','EY','NKT','Vestas','DLF','NoA Ignite Denmark','GN','Tryg','SimCorp','PFA','Nordea','Saxo Bank','Ørsted','Microsoft','COWI','Ascendis Pharma','Novo Holdings','Dassault Systèmes','Copenhagen Merchants'
]

export function companyConnection(name){return COMPANY_CONNECTORS[name]||{status:'pending',connector:null,baseUrl:null}}
export function connectedCompanyNames(){return TARGET_COMPANIES.filter(name=>companyConnection(name).status==='connected')}

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
