export function visibleElementKey(value){
  const raw=String(value??'').trim()
  if(!raw) return ''
  const leaf=raw.includes('$')?raw.slice(raw.lastIndexOf('$')+1):raw.replace(/^\./,'')
  return leaf.replace(/=2/g,':').replace(/=0/g,'=')
}
