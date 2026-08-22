import { createHash } from 'node:crypto'

const SUMMARY_HEADINGS=/^(professional\s+summary|summary|professional\s+profile|profile|career\s+summary|executive\s+summary)$/i
const EXPERIENCE_HEADINGS=/^(professional\s+experience|work\s+experience|experience|employment|career\s+history)$/i
const STOP_HEADINGS=/^(education(?:\s+and\s+professional\s+development)?|professional\s+development|certifications?|skills|core\s+competenc(?:e|es|ies)|key\s+skills|technical\s+skills|tools(?:\s*&\s*platforms)?|data\s*&\s*reporting\s+platforms|courses?|languages?)$/i
const MAJOR_HEADING=/^(professional\s+summary|summary|professional\s+profile|profile|career\s+summary|executive\s+summary|professional\s+experience|work\s+experience|experience|employment|career\s+history|education(?:\s+and\s+professional\s+development)?|professional\s+development|certifications?|skills|core\s+competenc(?:e|es|ies)|key\s+skills|technical\s+skills|tools(?:\s*&\s*platforms)?|data\s*&\s*reporting\s+platforms|courses?|languages?)$/i
const DATE_RANGE=/\b(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?((?:19|20)\d{2})\s*(?:[-–—]|to)\s*(?:(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?((?:19|20)\d{2})|(Present|Current|Now))\b/i
const BULLET=/^[•▪◦*\-–—]\s+/
const ROLE_SUBHEADING=/^(key\s+achievements|achievements|selected\s+achievements|responsibilities|key\s+responsibilities)$/i

function normalizeText(value=''){
  return String(value??'')
    .normalize('NFKC')
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g,'')
    .replace(/\r/g,'\n')
    .replace(/[ \t]+/g,' ')
    .replace(/\n{3,}/g,'\n\n')
    .trim()
}

function linesOf(value=''){
  return normalizeText(value).split('\n').map(line=>line.trim()).filter(Boolean)
}

function wordCount(value=''){
  const text=String(value??'').trim()
  return text?text.split(/\s+/).length:0
}

export function roleLengthWindow(count){
  const words=Math.max(0,Number(count)||0)
  const tolerance=Math.max(Math.round(words*0.15),8)
  return {min:Math.max(0,words-tolerance),max:words+tolerance,tolerance}
}

function extractSummary(lines){
  const headingIndex=lines.findIndex(line=>SUMMARY_HEADINGS.test(line))
  if(headingIndex<0) return {id:'professional_summary',eligible:false,reason:'Professional Summary not found.',text:''}
  let end=lines.length
  for(let i=headingIndex+1;i<lines.length;i++){
    if(MAJOR_HEADING.test(lines[i])){ end=i; break }
  }
  const text=lines.slice(headingIndex+1,end).join(' ').trim()
  if(!text) return {id:'professional_summary',eligible:false,reason:'Professional Summary is empty.',text:''}
  return {id:'professional_summary',eligible:true,text,wordCount:wordCount(text)}
}

function dateInfo(line){
  const match=String(line).match(DATE_RANGE)
  if(!match) return null
  return {
    dateText:match[0].trim(),
    startYear:Number(match[1]),
    endYear:match[3]?9999:Number(match[2]),
    openEnded:Boolean(match[3])
  }
}

function headerFor(lines,dateIndex,date){
  const line=lines[dateIndex]
  const normalizedDate=date.dateText.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  const before=line.replace(new RegExp(`\\s*\\|?\\s*${normalizedDate}\\s*$`,'i'),'').trim()
  if(before&&before!==line){
    const parts=before.split('|').map(x=>x.trim()).filter(Boolean)
    if(parts.length>=2){
      const left=parts[0]
      if(left.includes(',')){
        const comma=left.indexOf(',')
        return {title:left.slice(0,comma).trim(),company:left.slice(comma+1).trim(),headerStart:dateIndex,contentStart:dateIndex+1}
      }
      return {title:parts[0],company:parts[1],headerStart:dateIndex,contentStart:dateIndex+1}
    }
    if(parts.length===1) return {title:parts[0],company:'',headerStart:dateIndex,contentStart:dateIndex+1}
  }

  const company=lines[dateIndex-1]&&!MAJOR_HEADING.test(lines[dateIndex-1])?lines[dateIndex-1]:''
  const title=lines[dateIndex-2]&&!MAJOR_HEADING.test(lines[dateIndex-2])?lines[dateIndex-2]:''
  const headerStart=title?dateIndex-2:company?dateIndex-1:dateIndex
  return {title,company,headerStart,contentStart:dateIndex+1}
}

function stableRoleId({title,company,dateText,ordinal}){
  const key=[title,company,dateText,ordinal].map(x=>String(x??'').trim().toLowerCase()).join('|')
  return `role:${createHash('sha256').update(key).digest('hex').slice(0,12)}`
}

function firstStopIndex(lines,start){
  for(let i=start;i<lines.length;i++) if(STOP_HEADINGS.test(lines[i])) return i
  return lines.length
}

function detectRoles(lines){
  const experienceHeading=lines.findIndex(line=>EXPERIENCE_HEADINGS.test(line))
  const scanStart=experienceHeading>=0?experienceHeading+1:0
  const scanEnd=firstStopIndex(lines,scanStart)
  const candidates=[]

  for(let i=scanStart;i<scanEnd;i++){
    const date=dateInfo(lines[i])
    if(!date) continue
    const header=headerFor(lines,i,date)
    candidates.push({dateIndex:i,...date,...header})
  }

  return candidates.map((candidate,index)=>{
    const next=candidates[index+1]
    const sectionEnd=next?next.headerStart:scanEnd
    const sectionLines=lines.slice(candidate.headerStart,sectionEnd)
    const contentLines=lines.slice(candidate.contentStart,sectionEnd)
    const overview=[]
    for(const line of contentLines){
      if(BULLET.test(line)) break
      if(ROLE_SUBHEADING.test(line)) break
      if(MAJOR_HEADING.test(line)) break
      overview.push(line)
    }
    const title=candidate.title||''
    const company=candidate.company||''
    return {
      id:stableRoleId({title,company,dateText:candidate.dateText,ordinal:index}),
      title,
      company,
      dateText:candidate.dateText,
      startYear:candidate.startYear,
      endYear:candidate.endYear,
      openEnded:candidate.openEnded,
      ordinal:index,
      sectionText:sectionLines.join('\n').trim(),
      overviewText:overview.join(' ').trim(),
      overviewWordCount:wordCount(overview.join(' '))
    }
  })
}

function chronologicalRoles(roles){
  return [...roles].sort((a,b)=>
    (b.endYear-a.endYear)||
    (b.startYear-a.startYear)||
    (a.ordinal-b.ordinal)
  )
}

export function detectCvStructure(cvText=''){
  const lines=linesOf(cvText)
  const professionalSummary=extractSummary(lines)
  const employmentSections=detectRoles(lines)
  const ordered=chronologicalRoles(employmentSections)
  return {
    professionalSummary,
    employmentSections,
    latestRole:ordered[0]||null,
    previousRole:ordered[1]||null
  }
}
