// Diagnostic labels are fixed enums: never persist CV/JD excerpts or model output.
export const VALIDATION_DIAGNOSTIC_CODES=new Set([
  'CV_EVIDENCE_NOT_IN_SOURCE',
  'JD_EVIDENCE_NOT_IN_DESCRIPTION',
  'UNSAFE_JD_EVIDENCE',
  'CV_EVIDENCE_MISSING',
  'CV_EVIDENCE_INVALID',
  'CV_EVIDENCE_UNEXPECTED',
  'JD_EVIDENCE_MISSING',
  'DUPLICATE_REQUIREMENT_ID',
  'INVALID_REQUIREMENT_COUNT',
  'INVALID_REQUIREMENT_FIELD',
  'OTHER_VALIDATION',
])

export function safeValidationDiagnosticCode(error){
  const message=String(error?.message??'')
  if(/^Source CV evidence for .+ was not found in Source CV\.$/.test(message)) return 'CV_EVIDENCE_NOT_IN_SOURCE'
  if(/^JD evidence for .+ was not found in the job description\.$/.test(message)) return 'JD_EVIDENCE_NOT_IN_DESCRIPTION'
  if(/^Unsafe prompt-like JD evidence in .+\.$/.test(message)) return 'UNSAFE_JD_EVIDENCE'
  if(/^Source CV evidence is required for .+\.$/.test(message)) return 'CV_EVIDENCE_MISSING'
  if(/^Invalid Source CV evidence for .+\.$/.test(message)) return 'CV_EVIDENCE_INVALID'
  if(/^NOT_EVIDENCED must not contain Source CV evidence for .+\.$/.test(message)) return 'CV_EVIDENCE_UNEXPECTED'
  if(/^JD evidence is required for .+\.$/.test(message)) return 'JD_EVIDENCE_MISSING'
  if(message==='Expertise Match requirement IDs must be unique.') return 'DUPLICATE_REQUIREMENT_ID'
  if(message==='Expertise Match must contain 1 to 18 grounded requirements.') return 'INVALID_REQUIREMENT_COUNT'
  if(/^Expertise Match text is required for .+\.$|^Invalid Expertise Match (?:category|importance|status) for .+\.$|^Invalid minimum years for .+\.$/.test(message)) return 'INVALID_REQUIREMENT_FIELD'
  return 'OTHER_VALIDATION'
}
