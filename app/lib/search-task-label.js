export async function runLabeledSearchTask(label,task){
  const source=String(label??'').trim()||'Search source'
  try{
    return await task()
  }catch(error){
    const message=String(error?.message??'').trim()||'Search request failed'
    const wrapped=new Error(`${source}: ${message}`)
    wrapped.cause=error
    throw wrapped
  }
}
