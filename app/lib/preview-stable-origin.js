const text=value=>String(value??'').trim()

export function stablePreviewRedirectUrl({vercelEnv,branchUrl,requestUrl,method='GET',accept=''}={}){
  if(text(vercelEnv)!=='preview') return null
  if(!/^GET|HEAD$/i.test(text(method)||'GET')) return null
  if(!text(accept).toLowerCase().includes('text/html')) return null

  const stableHost=text(branchUrl).replace(/^https?:\/\//i,'').replace(/\/$/,'')
  if(!stableHost) return null

  let current
  try{current=new URL(requestUrl)}catch{return null}
  if(current.host===stableHost) return null

  current.protocol='https:'
  current.host=stableHost
  return current.toString()
}
