const text=value=>String(value??'')

function decodeXml(value=''){
  return text(value)
    .replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16)))
    .replace(/&#(\d+);/g,(_,num)=>String.fromCodePoint(Number(num)))
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'")
}

function escapeXml(value=''){
  return text(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function normalize(value=''){
  return decodeXml(value)
    .normalize('NFKC')
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g,'')
    .replace(/\s+/g,' ')
    .trim()
}

function paragraphText(xml=''){
  return [...text(xml).matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(match=>decodeXml(match[1])).join('')
}

function splitWords(value,count){
  const words=normalize(value).split(' ').filter(Boolean)
  const chunks=[]
  let offset=0
  for(let i=0;i<count;i++){
    const remaining=count-i
    const take=i===count-1?words.length-offset:Math.max(1,Math.round((words.length-offset)/remaining))
    chunks.push(words.slice(offset,offset+take).join(' '))
    offset+=take
  }
  return chunks
}

function splitForParagraphs(value,count){
  const clean=normalize(value)
  if(count<=1) return [clean]
  const sentences=(clean.match(/[^.!?]+(?:[.!?]+[”"')\]]*|$)/g)||[]).map(item=>item.trim()).filter(Boolean)
  if(sentences.length<count) return splitWords(clean,count)
  const chunks=[]
  let offset=0
  for(let i=0;i<count;i++){
    const remainingParagraphs=count-i
    const remainingSentences=sentences.length-offset
    const take=i===count-1?remainingSentences:Math.max(1,Math.round(remainingSentences/remainingParagraphs))
    chunks.push(sentences.slice(offset,offset+take).join(' '))
    offset+=take
  }
  return chunks
}

function replaceParagraphText(paragraph,value){
  let used=false
  const escaped=escapeXml(value)
  const updated=paragraph.replace(/<w:t\b([^>]*)>[\s\S]*?<\/w:t>/g,(match,attrs)=>{
    if(used) return `<w:t${attrs}></w:t>`
    used=true
    const nextAttrs=/xml:space=/.test(attrs)?attrs:`${attrs} xml:space="preserve"`
    return `<w:t${nextAttrs}>${escaped}</w:t>`
  })
  if(!used) throw new Error('DOCX source section has no editable text run.')
  return updated
}

function findParagraphRange(paragraphs,originalText,used){
  const wanted=normalize(originalText)
  for(let start=0;start<paragraphs.length;start++){
    if(used.has(start)) continue
    let combined=''
    for(let end=start;end<paragraphs.length&&end<start+24;end++){
      if(used.has(end)) break
      const current=normalize(paragraphs[end].text)
      if(current) combined=normalize(combined?`${combined} ${current}`:current)
      if(combined===wanted) return {start,end}
      if(combined.length>wanted.length+80) break
    }
  }
  return null
}

export function replaceDocxBlocks(documentXml,replacements=[]){
  const xml=text(documentXml)
  if(!xml) throw new Error('DOCX document.xml is empty.')
  const paragraphRegex=/<w:p\b[\s\S]*?<\/w:p>/g
  const paragraphs=[]
  for(const match of xml.matchAll(paragraphRegex)) paragraphs.push({xml:match[0],index:match.index,text:paragraphText(match[0])})
  const updated=new Map()
  const used=new Set()

  for(const replacement of Array.isArray(replacements)?replacements:[]){
    const originalText=normalize(replacement?.originalText)
    const newText=normalize(replacement?.newText)
    if(!originalText||!newText) continue
    const range=findParagraphRange(paragraphs,originalText,used)
    if(!range) throw new Error('DOCX source section could not be found. Please re-upload the matching source DOCX.')
    const count=range.end-range.start+1
    const chunks=splitForParagraphs(newText,count)
    for(let i=0;i<count;i++){
      const paragraphIndex=range.start+i
      used.add(paragraphIndex)
      updated.set(paragraphIndex,replaceParagraphText(paragraphs[paragraphIndex].xml,chunks[i]||''))
    }
  }

  let output=''
  let cursor=0
  paragraphs.forEach((paragraph,index)=>{
    output+=xml.slice(cursor,paragraph.index)
    output+=updated.get(index)||paragraph.xml
    cursor=paragraph.index+paragraph.xml.length
  })
  output+=xml.slice(cursor)
  return output
}
