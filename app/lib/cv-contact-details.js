const text=value=>String(value??'').trim()

function cleanLines(value=''){
  return String(value??'').replace(/\r/g,'\n').split('\n').map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean)
}

function firstEmail(value=''){
  const match=String(value??'').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return text(match?.[0])
}

function firstLinkedIn(value=''){
  const match=String(value??'').match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Z0-9_%\-./]+/i)
  if(!match?.[0]) return ''
  const raw=match[0].replace(/[),.;]+$/,'')
  return /^https?:\/\//i.test(raw)?raw:`https://${raw}`
}

function firstPhone(lines=[]){
  for(const line of lines.slice(0,24)){
    if(/@|linkedin|https?:\/\//i.test(line)) continue
    const matches=line.match(/(?:\+\d{1,3}[\s().-]*)?(?:\d[\s().-]*){8,15}/g)||[]
    for(const candidate of matches){
      const digits=candidate.replace(/\D/g,'')
      if(digits.length<8||digits.length>15) continue
      if(!/[+() .-]/.test(candidate)) continue
      return candidate.trim().replace(/[),.;]+$/,'')
    }
  }
  return ''
}

function probableName(line=''){
  const value=text(line)
  if(!value||value.length>70||/[\d@:/]/.test(value)) return false
  if(/^(curriculum vitae|cv|resume|professional summary|profile|summary)$/i.test(value)) return false
  const words=value.split(/\s+/).filter(Boolean)
  if(words.length<2||words.length>5) return false
  return words.every(word=>/^[\p{Lu}][\p{L}'’.-]*$/u.test(word))
}

export function extractCvContactDetails(cvText=''){
  const lines=cleanLines(cvText)
  const email=firstEmail(cvText)
  const linkedIn=firstLinkedIn(cvText)
  const phone=firstPhone(lines)
  const name=lines.slice(0,18).find(line=>line!==email&&line!==phone&&!/linkedin/i.test(line)&&probableName(line))||''
  return {name:text(name),email,phone:text(phone),linkedIn}
}
