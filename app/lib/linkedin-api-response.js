// LinkedIn API boundaries may receive infrastructure-generated text/HTML errors.
// Treat them as failures with the actual HTTP status, never as successful JSON.
export async function readLinkedInApiJson(response,{phase='LinkedIn search'}={}){
  const status=Number(response?.status)||0
  const http=status?'HTTP '+status:'HTTP status unavailable'
  let body
  try{body=await response.text()}
  catch{throw new Error(phase+': '+http+'; response body could not be read')}
  let data
  try{data=JSON.parse(body)}
  catch{
    const reason=status===413?'request exceeded the server size limit':status>=500?'server returned a non-JSON error response':'response was not valid JSON'
    throw new Error(phase+': '+http+'; '+reason)
  }
  if(!data||typeof data!=='object'||Array.isArray(data)) throw new Error(phase+': '+http+'; unexpected JSON response')
  if(!response.ok)throw new Error(phase+': '+http+'; '+String(data.error||'request failed'))
  return data
}
