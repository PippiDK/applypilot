const text=value=>String(value??'').replace(/\s+/g,' ').trim()
const roleKey=value=>text(value).toLowerCase()

function cleanRoles(values=[]){
  const out=[]
  const seen=new Set()
  for(const raw of Array.isArray(values)?values:[]){
    const role=text(raw)
    const key=roleKey(role)
    if(!key||seen.has(key)) continue
    seen.add(key)
    out.push(role)
  }
  return out
}

export function buildCvRoleProfile(cv={},roles={}){
  const cvId=text(cv.id)||(`cv-${Number(cv.slot)||1}`)
  const slot=Number(cv.slot)||1
  const primaryRoles=cleanRoles(roles.primaryRoles)
  const primaryKeys=new Set(primaryRoles.map(roleKey))
  const adjacentRoles=cleanRoles(roles.adjacentRoles).filter(role=>!primaryKeys.has(roleKey(role)))
  return {
    cvId,
    slot,
    sourceVersion:text(cv.sourceVersion),
    fileName:text(cv.fileName),
    primaryRoles,
    adjacentRoles
  }
}

export function combineCvRoleProfiles(profiles=[]){
  const sorted=(Array.isArray(profiles)?profiles:[]).filter(Boolean).slice().sort((a,b)=>(Number(a.slot)||0)-(Number(b.slot)||0))
  const primaryRoles=[]
  const adjacentRoles=[]
  const primaryByKey=new Map()
  const adjacentByKey=new Map()

  for(const profile of sorted){
    for(const role of cleanRoles(profile.primaryRoles)){
      const key=roleKey(role)
      if(primaryByKey.has(key)) continue
      primaryByKey.set(key,role)
      primaryRoles.push(role)
    }
  }

  for(const profile of sorted){
    for(const role of cleanRoles(profile.adjacentRoles)){
      const key=roleKey(role)
      if(primaryByKey.has(key)||adjacentByKey.has(key)) continue
      adjacentByKey.set(key,role)
      adjacentRoles.push(role)
    }
  }

  const canonicalByKey=new Map([...primaryByKey,...adjacentByKey])
  const supportByKey=new Map()
  for(const profile of sorted){
    const cvId=text(profile.cvId)||(`cv-${Number(profile.slot)||1}`)
    for(const [kind,values] of [['primary',profile.primaryRoles],['adjacent',profile.adjacentRoles]]){
      for(const role of cleanRoles(values)){
        const key=roleKey(role)
        if(!canonicalByKey.has(key)) continue
        if(!supportByKey.has(key)) supportByKey.set(key,[])
        const support=supportByKey.get(key)
        if(!support.some(item=>item.cvId===cvId&&item.kind===kind)) support.push({cvId,kind})
      }
    }
  }

  const roleSources=[...primaryRoles,...adjacentRoles].map(role=>{
    const key=roleKey(role)
    const support=supportByKey.get(key)||[]
    return {role,cvIds:[...new Set(support.map(item=>item.cvId))],support}
  })

  return {primaryRoles,adjacentRoles,roleSources}
}

export function searchProfileLibraryFingerprint(cvs=[],builderVersion=''){
  const version=text(builderVersion)
  const parts=(Array.isArray(cvs)?cvs:[])
    .filter(cv=>text(cv?.sourceVersion))
    .slice()
    .sort((a,b)=>(Number(a.slot)||0)-(Number(b.slot)||0))
    .map(cv=>`${Number(cv.slot)||0}:${text(cv.id)}:${text(cv.sourceVersion)}`)
  return [version,...parts].join('|')
}
