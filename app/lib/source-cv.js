export const SOURCE_CV_STORAGE_KEY='applypilot-source-cv'
export const LEGACY_CV_STORAGE_KEY='applypilot-master-cv'

const MIN_SOURCE_CV_CHARS=100

function text(value=''){
  return String(value??'').trim()
}

function numberOrNull(value){
  const number=Number(value)
  return Number.isFinite(number)&&number>=0?number:null
}

export function isSourceCvReady(value){
  if(!value||typeof value!=='object') return false
  const cvText=text(value.cvText)
  return value.status==='ready' && Boolean(text(value.fileName)) && Boolean(text(value.sourceVersion)) && cvText.length>=MIN_SOURCE_CV_CHARS
}

export function buildSourceCvRecord(payload={},parsedAt=new Date().toISOString()){
  const cvText=text(payload.cvText)
  const fileName=text(payload.fileName)
  const sourceVersion=text(payload.sourceVersion)

  if(!fileName) throw new Error('Source CV filename is missing.')
  if(cvText.length<MIN_SOURCE_CV_CHARS) throw new Error('Source CV requires complete extracted text.')
  if(!sourceVersion) throw new Error('Source CV version is missing.')

  return {
    schemaVersion:1,
    status:'ready',
    fileName,
    fileSize:numberOrNull(payload.fileSize),
    fileType:text(payload.fileType),
    sourceVersion,
    chars:cvText.length,
    cvText,
    summary:text(payload.summary),
    facts:Array.isArray(payload.facts)?payload.facts:[],
    skills:Array.isArray(payload.skills)?payload.skills:[],
    preview:text(payload.preview),
    parsedAt:text(parsedAt)||new Date().toISOString()
  }
}

export function normalizeStoredSourceCv(value){
  if(!value||typeof value!=='object') return null

  const cvText=text(value.cvText)
  const normalized={
    ...value,
    schemaVersion:1,
    fileName:text(value.fileName),
    fileSize:numberOrNull(value.fileSize),
    fileType:text(value.fileType),
    sourceVersion:text(value.sourceVersion),
    chars:cvText.length||numberOrNull(value.chars)||0,
    cvText,
    summary:text(value.summary),
    facts:Array.isArray(value.facts)?value.facts:[],
    skills:Array.isArray(value.skills)?value.skills:[],
    preview:text(value.preview),
    parsedAt:text(value.parsedAt)
  }

  normalized.status=Boolean(normalized.fileName)&&Boolean(normalized.sourceVersion)&&cvText.length>=MIN_SOURCE_CV_CHARS?'ready':'needs-reupload'
  return normalized
}
