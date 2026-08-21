import { NextResponse } from 'next/server'
import mammoth from 'mammoth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function cleanText(text='') {
  return text
    .replace(/\u0000/g,' ')
    .replace(/\r/g,'\n')
    .replace(/[ \t]+/g,' ')
    .replace(/\n{3,}/g,'\n\n')
    .trim()
}

function splitLines(text='') {
  return cleanText(text).split('\n').map(x=>x.trim()).filter(Boolean)
}

function makeFacts(text='') {
  const lines = splitLines(text)
  const facts = []
  const seen = new Set()
  const yearRx = /\b(19|20)\d{2}\b/
  const actionRx = /\b(led|managed|delivered|owned|drove|coordinated|implemented|built|launched|improved|reduced|created|supported|developed|oversaw|directed|governed|planned|executed|established|introduced|worked|responsible|lead|manage|deliver|drive|coordinate|implement|build|launch|improve|reduce|create|support|develop|oversee|direct|govern|plan|execute|establish|introduce)\b/i
  const signalRx = /\b(project|program|programme|delivery|software|platform|digital|fintech|bank|banking|trading|post-trade|regulatory|compliance|risk|data|analytics|BI|stakeholder|budget|roadmap|release|cutover|hypercare|UAT|SIT|agile|scrum|SAFe|Azure|Jira|Confluence|SQL|Power BI|team|engineering)\b/i

  for (const line of lines) {
    const normalized = line.replace(/^[•\-–—▪◦*]+\s*/,'').trim()
    if (normalized.length < 24 || normalized.length > 420) continue
    const useful = actionRx.test(normalized) || signalRx.test(normalized) || yearRx.test(normalized)
    if (!useful) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    facts.push({
      id:`FACT-${String(facts.length+1).padStart(3,'0')}`,
      text:normalized,
      source:'Master CV',
      verified:true
    })
    if (facts.length >= 80) break
  }

  if (facts.length < 8) {
    for (const line of lines) {
      const normalized=line.replace(/^[•\-–—▪◦*]+\s*/,'').trim()
      if(normalized.length<30||normalized.length>350) continue
      const key=normalized.toLowerCase(); if(seen.has(key)) continue
      seen.add(key)
      facts.push({id:`FACT-${String(facts.length+1).padStart(3,'0')}`,text:normalized,source:'Master CV',verified:true})
      if(facts.length>=30) break
    }
  }
  return facts
}

function inferSkills(text='') {
  const catalog=['Azure DevOps','Jira','Confluence','MS Project','Azure','SQL','Power BI','Agile','Scrum','SAFe','FinTech','Banking','Regulatory','Compliance','Risk','Data','Analytics','BI','SIT','UAT','Cutover','Hypercare','Release','Stakeholder Management','Project Management','Program Management','Delivery Management']
  const lower=text.toLowerCase()
  return catalog.filter(x=>lower.includes(x.toLowerCase()))
}

export async function POST(request){
  try{
    const form = await request.formData()
    const file = form.get('file')
    if(!file || typeof file === 'string') return NextResponse.json({error:'No CV file received.'},{status:400})
    if(file.size > 8*1024*1024) return NextResponse.json({error:'CV is larger than 8 MB.'},{status:400})

    const name=(file.name||'cv').toLowerCase()
    const buffer=Buffer.from(await file.arrayBuffer())
    let text=''

    if(name.endsWith('.pdf')){
      const { CanvasFactory } = await import('pdf-parse/worker')
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: new Uint8Array(buffer), CanvasFactory })
      try {
        const result = await parser.getText()
        text = result.text || ''
      } finally {
        await parser.destroy()
      }
    }else if(name.endsWith('.docx')){
      const result=await mammoth.extractRawText({buffer})
      text=result.value||''
    }else if(name.endsWith('.txt')){
      text=buffer.toString('utf8')
    }else{
      return NextResponse.json({error:'For v0.3 please upload PDF or DOCX. Legacy .doc files are not supported yet.'},{status:400})
    }

    text=cleanText(text)
    if(text.length<100) return NextResponse.json({error:'We could not extract enough text from this CV. Try a text-based PDF or DOCX.'},{status:422})

    const facts=makeFacts(text)
    return NextResponse.json({
      fileName:file.name,
      chars:text.length,
      facts,
      skills:inferSkills(text),
      preview:text.slice(0,1800)
    })
  }catch(error){
    console.error(error)
    return NextResponse.json({error:'CV parsing failed. Please try another PDF or DOCX.'},{status:500})
  }
}
