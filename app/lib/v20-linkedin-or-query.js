// Manual LinkedIn query helper, independent of Apply Pilot discovery.
export function rolesToLinkedInOrQuery(value){
  const roles=Array.isArray(value)?value:String(value??'').split(',')
  const seen=new Set()
  return roles.map(role=>String(role??'').trim()).filter(role=>{
    const key=role.toLocaleLowerCase('en')
    if(!role||seen.has(key))return false
    seen.add(key)
    return true
  }).map(role=>'"'+role.replace(/"/g,'').trim()+'"').join(' OR ')
}
