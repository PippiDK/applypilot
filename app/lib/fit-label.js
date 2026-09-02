export function fitLabel(scorePercent){
  const score=Number(scorePercent)
  if(score>=90) return 'High'
  if(score>=80) return 'Medium'
  return 'Low'
}
