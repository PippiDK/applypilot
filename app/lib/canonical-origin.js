const LIVE_HOST='applypilot-auvraen-platform.vercel.app'

const clean=value=>String(value??'').trim()

function hostFrom(value){
  const text=clean(value)
  if(!text) return ''
  try{
    return new URL(text.includes('://')?text:`https://${text}`).host
  }catch{
    return ''
  }
}

function targetHost({vercelEnv,branchUrl}){
  if(clean(vercelEnv)==='production') return LIVE_HOST
  if(clean(vercelEnv)==='preview') return hostFrom(branchUrl)
  return ''
}

export function canonicalAppRedirectUrl({
  vercelEnv='',
  branchUrl='',
  requestUrl='',
  method='GET',
  accept='',
}={}){
  if(clean(method).toUpperCase()!=='GET') return null
  if(!clean(accept).toLowerCase().includes('text/html')) return null

  let current
  try{current=new URL(requestUrl)}catch{return null}

  const host=targetHost({vercelEnv,branchUrl})
  if(!host||current.host===host) return null

  current.protocol='https:'
  current.host=host
  return current.toString()
}

export function canonicalAuthRedirectOrigin({
  vercelEnv='',
  branchUrl='',
  currentOrigin='',
}={}){
  const host=targetHost({vercelEnv,branchUrl})
  if(host) return `https://${host}`
  try{return new URL(currentOrigin).origin}catch{return clean(currentOrigin)}
}
