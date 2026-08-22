import { isSourceCvReady } from './source-cv.js'

const text=value=>String(value??'').trim()

export function buildTailoringInput(cvData,item){
  if(!isSourceCvReady(cvData)) throw new Error('Please Upload Your CV')

  const job=item?.job||{}
  const title=text(job.title)
  const description=text(job.description||job.jd)
  if(!title||!description) throw new Error('A usable job description is required for CV tailoring.')

  return {
    sourceCv:{
      sourceVersion:text(cvData.sourceVersion),
      fileName:text(cvData.fileName),
      cvText:text(cvData.cvText)
    },
    job:{
      sourceJobId:text(job.sourceJobId),
      title,
      company:text(job.company),
      location:text(job.location),
      description
    }
  }
}
