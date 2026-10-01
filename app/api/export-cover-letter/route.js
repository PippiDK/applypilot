import JSZip from 'jszip'
import {requireUser} from '../../lib/auth/require-user.js'
import {extractCvContactDetails} from '../../lib/cv-contact-details.js'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const text=value=>String(value??'').trim()
const escapeXml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

function safeOutputName(value='cover-letter.docx'){
  const name=String(value||'cover-letter.docx').replace(/[\\/:*?"<>|]+/g,'_').trim()||'cover-letter.docx'
  return name.toLowerCase().endsWith('.docx')?name:`${name}.docx`
}

function runXml(value,{bold=false,size=22,color=''}={}){
  const colorXml=color?`<w:color w:val="${color}"/>`:''
  return `<w:r><w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${colorXml}</w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`
}

function paragraphXml(value,{after=160,before=0,bold=false,size=22,color='',align='left'}={}){
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="${before}" w:after="${after}"/></w:pPr>${runXml(value,{bold,size,color})}</w:p>`
}

function headerTableXml(name,jobTitle){
  if(!name&&!jobTitle) return ''
  const left=name?runXml(name,{bold:true,size:28,color:'111111'}):''
  const right=jobTitle?runXml(jobTitle,{bold:true,size:20,color:'345B4D'}):''
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:bottom w:val="single" w:sz="8" w:space="0" w:color="A8B8B1"/><w:top w:val="nil"/><w:left w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4200"/><w:gridCol w:w="4800"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="4200" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:after="120"/></w:pPr>${left}</w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="120"/></w:pPr>${right}</w:p></w:tc></w:tr></w:tbl>`
}

function documentXml({letter,jobTitle,cvText}){
  const contact=extractCvContactDetails(cvText)
  const header=headerTableXml(contact.name,text(jobTitle))
  const lines=String(letter||'').split(/\n+/).map(text).filter(Boolean)
  if(contact.name){
    for(let index=lines.length-1;index>=Math.max(0,lines.length-4);index--){
      if(lines[index]===contact.name){lines.splice(index,1);break}
    }
  }
  const body=lines.map(value=>paragraphXml(value,{after:170,size:22})).join('')
  const signature=[
    contact.name?paragraphXml(contact.name,{before:70,after:30,bold:true,size:22}):'',
    contact.email?paragraphXml(contact.email,{after:20,size:19,color:'4B5563'}):'',
    contact.phone?paragraphXml(contact.phone,{after:20,size:19,color:'4B5563'}):'',
    contact.linkedIn?paragraphXml(contact.linkedIn,{after:0,size:19,color:'4B5563'}):''
  ].join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${header}<w:p><w:pPr><w:spacing w:after="220"/></w:pPr></w:p>${body}${signature}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="960" w:right="1020" w:bottom="960" w:left="1020" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`
}

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const body=await request.json()
    const letter=text(body?.letter)
    const jobTitle=text(body?.jobTitle)
    const cvText=text(body?.cvText)
    if(letter.length<120) return Response.json({error:'A complete cover letter is required.'},{status:400})

    const zip=new JSZip()
    zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`)
    zip.folder('_rels').file('.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`)
    zip.folder('word').file('document.xml',documentXml({letter,jobTitle,cvText}))
    const output=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})
    const outputName=safeOutputName(body?.outputName)
    return new Response(output,{status:200,headers:{
      'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(outputName)}`,
      'Cache-Control':'no-store'
    }})
  }catch(error){
    console.error('cover_letter_export_failed',error?.message||'unknown')
    return Response.json({error:'Cover letter DOCX could not be created.'},{status:422})
  }
}
