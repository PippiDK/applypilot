const STATIC_FILE=/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff2?)$/i

export function isApiPath(pathname=''){
  return pathname==='/api'||pathname.startsWith('/api/')
}

export function isPublicPagePath(pathname=''){
  return pathname==='/login'||pathname==='/auth/confirm'||pathname.startsWith('/auth/confirm/')
}

export function isStaticAssetPath(pathname=''){
  return pathname.startsWith('/_next/')||pathname==='/favicon.ico'||STATIC_FILE.test(pathname)
}

export function sanitizeNextPath(value){
  const next=String(value??'').trim()
  if(!next.startsWith('/')||next.startsWith('//')||next.includes('\\')) return '/'
  return next
}

export function normalizeOtpType(value){
  const type=String(value??'').trim()
  return type==='email'||type==='invite'?type:null
}

export function getUserRole(user){
  if(!user) return null
  return user?.app_metadata?.applypilot_role==='admin'?'admin':'user'
}
