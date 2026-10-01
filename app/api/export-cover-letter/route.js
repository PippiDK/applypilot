import JSZip from 'jszip'
import {requireUser} from '../../lib/auth/require-user.js'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const text=value=>String(value??'').trim()
const escapeXml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

function safeOutputName(value='cover-letter.docx'){
  const name=String(value||'cover-letter.docx').replace(/[\\/:*?"<>|]+/g,'_').trim()||'cover-letter.docx'
  return name.toLowerCase().endsWith('.docx')?name:`${name}.docx`
}

function paragraphXml(value){
  return `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`
}

function documentXml(letter){
  const paragraphs=String(letter||'').split(/\n+/).map(text).filter(Boolean).map(paragraphXml).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`
}

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const body=await request.json()
    const letter=text(body?.letter)
    if(letter.length<120) return Response.json({error:'A complete cover letter is required.'},{status:400})

    const zip=new JSZip()
    zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`)
    zip.folder('_rels').file('.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`)
    zip.folder('word').file('document.xml',documentXml(letter))
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
