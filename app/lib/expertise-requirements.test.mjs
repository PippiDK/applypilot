import test from 'node:test'
import assert from 'node:assert/strict'
import {extractExpertiseRequirements,validateExpertiseRequirements} from './expertise-requirements.js'

const JD=`Lead the end-to-end lifecycle of AI, analytics, and data products from ideation through deployment and value realization.
Minimum 5 years of managing complex cross-functional Data & AI initiatives.
Experience delivering Data, Analytics, Machine Learning, or Generative AI solutions.
Strong awareness of ethical and responsible AI practices.
Build and maintain strong relationships with senior leaders and key decision-makers.`

const MODEL_RESULT={
  requirements:[
    {
      id:'ai-lifecycle',
      capability:'End-to-end AI product lifecycle',
      category:'delivery_execution',
      importance:'core',
      requirement:'Lead the end-to-end lifecycle of AI, analytics, and data products from ideation through deployment and value realization.',
      minimumYears:0,
      evidenceRule:'all_groups',
      evidenceGroups:[
        {label:'AI/data product lifecycle',directEvidenceTerms:['AI product lifecycle','AI delivery','data products'],transferableEvidenceTerms:['end-to-end delivery','product lifecycle','data delivery']}
      ],
      directEvidenceTerms:['AI product lifecycle','AI delivery','data products'],
      transferableEvidenceTerms:['end-to-end delivery','product lifecycle','data delivery'],
      jdEvidence:['Lead the end-to-end lifecycle of AI, analytics, and data products from ideation through deployment and value realization.']
    },
    {
      id:'data-ai-years',
      capability:'5+ years Data & AI initiative leadership',
      category:'required_experience_qualifications',
      importance:'critical',
      requirement:'Minimum 5 years of managing complex cross-functional Data & AI initiatives.',
      minimumYears:5,
      evidenceRule:'all_groups',
      evidenceGroups:[
        {label:'data',directEvidenceTerms:['data initiatives','data platform','analytics initiatives'],transferableEvidenceTerms:['BI initiatives']},
        {label:'AI',directEvidenceTerms:['AI initiatives','artificial intelligence'],transferableEvidenceTerms:[]},
        {label:'initiative leadership',directEvidenceTerms:['managing complex cross-functional','initiative leadership'],transferableEvidenceTerms:['cross-functional delivery']}
      ],
      directEvidenceTerms:['Data & AI initiatives','AI initiatives'],
      transferableEvidenceTerms:['data initiatives','analytics initiatives'],
      jdEvidence:['Minimum 5 years of managing complex cross-functional Data & AI initiatives.']
    },
    {
      id:'ml-genai',
      capability:'ML / Generative AI delivery',
      category:'technical_platform_capabilities',
      importance:'critical',
      requirement:'Experience delivering Data, Analytics, Machine Learning, or Generative AI solutions.',
      minimumYears:0,
      evidenceRule:'any_group',
      evidenceGroups:[
        {label:'Data',directEvidenceTerms:['data delivery','data solutions','data platform'],transferableEvidenceTerms:['Data Warehouse','DWH']},
        {label:'Analytics',directEvidenceTerms:['analytics delivery','analytics solutions','BI','business intelligence'],transferableEvidenceTerms:['Power BI']},
        {label:'Machine Learning',directEvidenceTerms:['Machine Learning','ML delivery'],transferableEvidenceTerms:[]},
        {label:'Generative AI',directEvidenceTerms:['Generative AI','GenAI delivery'],transferableEvidenceTerms:[]}
      ],
      directEvidenceTerms:['Machine Learning','Generative AI','ML delivery','GenAI delivery'],
      transferableEvidenceTerms:['data delivery','analytics delivery','data platform'],
      jdEvidence:['Experience delivering Data, Analytics, Machine Learning, or Generative AI solutions.']
    },
    {
      id:'responsible-ai',
      capability:'Responsible AI',
      category:'domain_functional_expertise',
      importance:'core',
      requirement:'Strong awareness of ethical and responsible AI practices.',
      minimumYears:0,
      evidenceRule:'all_groups',
      evidenceGroups:[
        {label:'Responsible AI',directEvidenceTerms:['Responsible AI','ethical AI'],transferableEvidenceTerms:['AI governance','data governance']}
      ],
      directEvidenceTerms:['Responsible AI','ethical AI'],
      transferableEvidenceTerms:['AI governance','data governance'],
      jdEvidence:['Strong awareness of ethical and responsible AI practices.']
    },
    {
      id:'senior-stakeholders',
      capability:'Senior stakeholder leadership',
      category:'leadership_stakeholder_scope',
      importance:'core',
      requirement:'Build and maintain strong relationships with senior leaders and key decision-makers.',
      minimumYears:0,
      evidenceRule:'all_groups',
      evidenceGroups:[
        {label:'senior stakeholder relationships',directEvidenceTerms:['senior stakeholders','executive stakeholders','senior leaders'],transferableEvidenceTerms:['stakeholder management','executive reporting']}
      ],
      directEvidenceTerms:['senior stakeholders','executive stakeholders','senior leaders'],
      transferableEvidenceTerms:['stakeholder management','executive reporting'],
      jdEvidence:['Build and maintain strong relationships with senior leaders and key decision-makers.']
    }
  ]
}

test('extracts grounded structured professional requirements using injected AI only for JD interpretation',async()=>{
  let captured
  const modelCall=async args=>{captured=args; return structuredClone(MODEL_RESULT)}
  const result=await extractExpertiseRequirements({title:'Assoc Director AI Product Manager',company:'Novo Nordisk',description:JD},modelCall)
  assert.equal(result.requirements.length,5)
  assert.equal(result.requirements[1].importance,'critical')
  assert.equal(result.requirements[1].minimumYears,5)
  assert.equal(result.requirements[2].category,'technical_platform_capabilities')
  assert.equal(result.requirements[2].evidenceRule,'any_group')
  assert.equal(result.requirements[2].evidenceGroups.length,4)
  assert.match(captured.instructions,/Do not evaluate the candidate/i)
  assert.match(captured.instructions,/alternatives.*or.*any_group/is)
  assert.match(captured.instructions,/and.*all_groups/is)
  assert.equal(captured.input.jobDescription,JD)
})

test('rejects AI requirements whose quoted evidence is not present in the JD',async()=>{
  const bad=structuredClone(MODEL_RESULT)
  bad.requirements[0].jdEvidence=['Invented requirement not in source JD.']
  await assert.rejects(
    ()=>extractExpertiseRequirements({title:'AI Product Manager',description:JD},async()=>bad),
    /not found in the job description/i
  )
})

test('rejects invented minimum years when the grounded JD evidence does not state that duration',()=>{
  const bad=structuredClone(MODEL_RESULT)
  bad.requirements[0].minimumYears=7
  assert.throws(()=>validateExpertiseRequirements(bad,JD),/minimum years/i)
})

test('accepts all five approved expertise categories and three importance levels',()=>{
  const value={requirements:[
    {...MODEL_RESULT.requirements[0],id:'a',category:'delivery_execution',importance:'critical'},
    {...MODEL_RESULT.requirements[0],id:'b',category:'domain_functional_expertise',importance:'core'},
    {...MODEL_RESULT.requirements[0],id:'c',category:'technical_platform_capabilities',importance:'supporting'},
    {...MODEL_RESULT.requirements[0],id:'d',category:'leadership_stakeholder_scope',importance:'core'},
    {...MODEL_RESULT.requirements[1],id:'e',category:'required_experience_qualifications',importance:'critical'}
  ]}
  assert.equal(validateExpertiseRequirements(value,JD),value)
})

test('Expertise requirement extraction gets a dedicated larger output-token budget',async()=>{
  let captured
  const modelCall=async args=>{captured=args; return structuredClone(MODEL_RESULT)}
  await extractExpertiseRequirements({title:'Assoc Director AI Product Manager',company:'Novo Nordisk',description:JD},modelCall)
  assert.equal(captured.maxOutputTokens,12000)
})
