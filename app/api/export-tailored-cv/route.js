import JSZip from 'jszip'
import {requireUser} from '../../lib/auth/require-user.js'
import {replaceDocxBlocks} from '../../lib/docx-replacer.js'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const ALLOWED_BLOCKS=new Set(['professional_summary','latest_role_overview','previous_role_overview'])

function safeOutputName(value='tailored-cv.docx'){
  const name=String(value||'tailored-cv.docx').replace(/[\\/:*?"<>|]+/g,'_').trim()||'tailored-cv.docx'
  return name.toLowerCase().endsWith('.docx')?name:`${name}.docx`
}

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const form=await request.formData()
    const file=form.get('file')
    if(!file||typeof file==='string') return Response.json({error:'Source DOCX is required.'},{status:400})
    if(!String(file.name||'').toLowerCase().endsWith('.docx')) return Response.json({error:'Please upload the matching source DOCX file.'},{status:400})
    if(file.size>8*1024*1024) return Response.json({error:'CV is larger than 8 MB.'},{status:400})

    let replacements=[]
    try{ replacements=JSON.parse(String(form.get('replacements')||'[]')) }catch{ return Response.json({error:'Invalid CV update data.'},{status:400}) }
    if(!Array.isArray(replacements)||replacements.length>3) return Response.json({error:'Only the three reviewed CV sections can be updated.'},{status:400})
    if(replacements.some(item=>!ALLOWED_BLOCKS.has(String(item?.blockId||'')))) return Response.json({error:'Unsupported CV section.'},{status:400})

    const source=Buffer.from(await file.arrayBuffer())
    let output=source
    if(replacements.length){
      const zip=await JSZip.loadAsync(source)
      const documentFile=zip.file('word/document.xml')
      if(!documentFile) return Response.json({error:'This DOCX does not contain an editable Word document.'},{status:422})
      const documentXml=await documentFile.async('string')
      zip.file('word/document.xml',replaceDocxBlocks(documentXml,replacements))
      output=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})
    }

    const outputName=safeOutputName(form.get('outputName'))
    return new Response(output,{status:200,headers:{
      'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(outputName)}`,
      'Cache-Control':'no-store'
    }})
  }catch(error){
    console.error(error)
    return Response.json({error:error?.message||'Tailored DOCX could not be created.'},{status:422})
  }
}
