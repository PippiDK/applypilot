const FULL_JD_MIN_LENGTH=500
const JOBINDEX_HOSTS=new Set(['jobindex.dk','www.jobindex.dk'])

function clean(value){return String(value??'').trim()}
function hostname(value=''){
  try{return new URL(String(value??'')).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}
}
function hostMatches(host,domain){return host===domain||host.endsWith(`.${domain}`)}
function decodeEntities(value=''){
  const named={nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',aelig:'æ',AElig:'Æ',oslash:'ø',Oslash:'Ø',aring:'å',Aring:'Å',ndash:'–',mdash:'—',bull:'•'}
  return String(value??'')
    .replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16)))
    .replace(/&#(\d+);/g,(_,num)=>String.fromCodePoint(Number(num)))
    .replace(/&([A-Za-z]+);/g,(match,name)=>Object.prototype.hasOwnProperty.call(named,name)?named[name]:match)
}
function plain(value=''){
  return decodeEntities(String(value??'')
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi,' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi,' ')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi,' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi,' ')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi,' ')
    .replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<\/p\s*>|<\/li\s*>|<\/h[1-6]\s*>/gi,'\n')
    .replace(/<[^>]+>/g,' '))
    .replace(/\s+/g,' ')
    .trim()
}
function attr(tag,name){
  const match=String(tag??'').match(new RegExp(`\\b${name}=["']([^"']*)["']`,'i'))
  return match?decodeEntities(match[1]).trim():''
}
function metaContent(html,name){
  const wanted=String(name??'').toLowerCase()
  for(const match of String(html??'').matchAll(/<meta\b[^>]*>/gi)){
    const tag=match[0]
    const key=(attr(tag,'property')||attr(tag,'name')).toLowerCase()
    if(key===wanted) return attr(tag,'content')
  }
  return ''
}
function classTokenMatch(tag,classNeedle){
  const classes=attr(tag,'class').split(/\s+/).filter(Boolean)
  return classes.includes(classNeedle)
}
function balancedClassBlocks(html,classNeedle){
  const text=String(html??'')
  const blocks=[]
  const opening=/<([a-z0-9]+)\b[^>]*>/gi
  let match
  while((match=opening.exec(text))){
    if(!classTokenMatch(match[0],classNeedle)) continue
    const tagName=match[1].toLowerCase()
    const start=opening.lastIndex
    const tags=new RegExp(`<\\/?${tagName}\\b[^>]*>`,'gi')
    tags.lastIndex=start
    let depth=1
    let token
    let end=text.length
    while((token=tags.exec(text))){
      if(/^<\//.test(token[0])) depth--
      else if(!/\/>$/.test(token[0])) depth++
      if(depth===0){end=token.index;break}
    }
    blocks.push(text.slice(start,end))
  }
  return blocks
}
function usable(value){return clean(value).length>=FULL_JD_MIN_LENGTH}
function best(...values){
  return values.flat().map(value=>plain(value)).filter(usable).reduce((longest,value)=>value.length>longest.length?value:longest,'')
}

export function recoverExternalFullJd(html='',url=''){
  const host=hostname(url)
  let value=''
  if(hostMatches(host,'egecarpets.com')) value=best(balancedClassBlocks(html,'job-detail-description'))
  else if(hostMatches(host,'cruitconsult.dk')) value=best(balancedClassBlocks(html,'col1'))
  else if(hostMatches(host,'avature.net')) value=best(balancedClassBlocks(html,'article--details'))
  else if(hostMatches(host,'youngcrm.com')) value=best(metaContent(html,'og:description'),metaContent(html,'description'))
  return usable(value)?value:''
}

export function recoverJobindexCanonicalFullJd(html='',url=''){
  const host=hostname(url)
  if(host&&!JOBINDEX_HOSTS.has(host)) return ''
  const value=best(balancedClassBlocks(html,'jobadd'))
  return usable(value)?value:''
}

export function ennovaMindkeyDetailUrl(wrapperUrl='',html=''){
  let wrapper
  try{wrapper=new URL(String(wrapperUrl??''))}catch{return ''}
  if(!hostMatches(wrapper.hostname.toLowerCase().replace(/^www\./,''),'ennova.com')) return ''
  const vid=clean(wrapper.searchParams.get('VID')||wrapper.searchParams.get('vid'))
  if(!/^\d+$/.test(vid)) return ''
  const match=String(html??'').match(/https:\/\/mkjobennova\.azurewebsites\.net\/[^"'<>\s]*details\.aspx/i)
  if(!match) return ''
  try{
    const target=new URL(decodeEntities(match[0]))
    if(target.hostname.toLowerCase()!=='mkjobennova.azurewebsites.net') return ''
    target.searchParams.set('VID',vid)
    return target.toString()
  }catch{return ''}
}
