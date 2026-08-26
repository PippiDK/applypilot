export function fitLabel(scorePercent){
  const score=Number(scorePercent)
  if(score>=75) return 'High'
  if(score>=60) return 'Medium'
  return 'Low'
}
