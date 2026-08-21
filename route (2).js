import { NextResponse } from 'next/server'
import { generateText } from 'ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(text='') {
  return String(text).replace(/\s+/g,' ').trim()
}

function words(text='') {
  return clean(text).toLowerCase().match(/[a-z0-9][a-z0-9+.#/-]{2,}/g) || []
}

function meaningfulChange(original, updated, jd) {
  const a = clean(original)
  const b = clean(updated)
  if (!a || !b || a === b) return false
  if (b.length < Math.max(35, a.length * 0.55) || b.length > a.length * 1.8) return false

  const aw = new Set(words(a))
  const bw = new Set(words(b))
  const union = new Set([...aw, ...bw])
  let common = 0
  for (const w of aw) if (bw.has(w)) common++
  const jaccard = union.size ? common / union.size : 1

  const jdWords = new Set(words(jd).filter(w => w.length > 4))
  const newRelevant = [...bw].filter(w => !aw.has(w) && jdWords.has(w))

  // Reject tiny grammar/word-removal changes. Keep a rewrite if wording materially
  // changes OR it safely brings at least two JD-relevant terms into focus.
  return jaccard < 0.88 || newRelevant.length >= 2
}

function protectedClaims(text='') {
  const numbers = clean(text).match(/\b\d+(?:[.,]\d+)?%?\b/g) || []
  const acronyms = clean(text).match(/\b[A-Z][A-Z0-9+&/-]{2,}\b/g) || []
  return [...new Set([...numbers, ...acronyms])]
}

function protectedClaimsSupported(updated, source) {
  const src = clean(source).toLowerCase()
  return protectedClaims(updated).every(token => src.includes(token.toLowerCase()))
}

function extractJson(text='') {
  const raw = String(text).trim()
  try { return JSON.parse(raw) } catch {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()) } catch {}
  }
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)) } catch {}
  }
  throw new Error('AI returned invalid structured output.')
}

export async function POST(request) {
  try {
    const body = await request.json()
    const jd = clean(body?.jd)
    const role = clean(body?.role)
    const company = clean(body?.company)
    const facts = Array.isArray(body?.facts) ? body.facts : []

    if (jd.length < 80) return NextResponse.json({ error: 'The job description is too short for reliable tailoring.' }, { status: 400 })
    if (!facts.length) return NextResponse.json({ error: 'No verified CV evidence was supplied.' }, { status: 400 })

    const evidence = facts
      .filter(f => f && f.id && clean(f.text).length >= 30)
      .slice(0, 80)
      .map(f => ({ id: String(f.id), text: clean(f.text) }))

    const prompt = `You are the CV tailoring engine for ApplyPilot.

TARGET ROLE: ${role}
COMPANY: ${company}

FULL JOB DESCRIPTION:
${jd}

VERIFIED MASTER-CV EVIDENCE:
${evidence.map(x => `${x.id}: ${x.text}`).join('\n')}

TASK
Propose 2-5 MEANINGFUL CV wording changes that make the candidate's existing experience read as more relevant to THIS specific job description.

NON-NEGOTIABLE TRUTH RULES
1. Use only claims already supported by the supplied CV evidence. Never invent skills, employers, achievements, numbers, technologies, responsibilities, seniority, scope, team size or outcomes.
2. Every proposed change must be anchored to exactly one sourceId from the supplied evidence. Do not combine unrelated facts.
3. Preserve the factual meaning of the source. You may change emphasis, order, terminology and phrasing.
4. Do NOT propose cosmetic edits, punctuation fixes, article removal, or trivial wording changes.
5. Do NOT propose a change when the source is already optimally phrased for the JD.
6. Prefer wording that reflects the vocabulary and priorities of the JD ONLY when the source evidence genuinely supports that meaning.
7. Each rewrite should sound like a strong senior IT/project/delivery CV bullet, not like keyword stuffing.
8. The reason must identify the specific JD priority the rewrite makes clearer.

Return ONLY valid JSON in exactly this shape:
{
  "priorities": ["short JD priority", "..."],
  "changes": [
    {
      "sourceId": "FACT-001",
      "updated": "meaningfully tailored CV wording",
      "why": "specific reason tied to this JD",
      "termsAligned": ["term 1", "term 2"]
    }
  ]
}

If fewer than 2 safe meaningful changes exist, return only the changes that genuinely improve relevance. Never manufacture a change to hit a quota.`

    const result = await generateText({
      model: process.env.AI_MODEL || 'openai/gpt-5.5',
      prompt,
      temperature: 0.2,
    })

    const parsed = extractJson(result.text)
    const byId = new Map(evidence.map(x => [x.id, x.text]))
    const accepted = []

    for (const item of Array.isArray(parsed?.changes) ? parsed.changes : []) {
      const sourceId = String(item?.sourceId || '')
      const original = byId.get(sourceId)
      const updated = clean(item?.updated)
      if (!original || !updated) continue
      if (!protectedClaimsSupported(updated, original)) continue
      if (!meaningfulChange(original, updated, jd)) continue

      accepted.push({
        id: sourceId,
        sourceId,
        original,
        updated: /[.!?]$/.test(updated) ? updated : `${updated}.`,
        why: clean(item?.why) || 'Rephrased to make verified experience more relevant to this job description.',
        termsAligned: Array.isArray(item?.termsAligned) ? item.termsAligned.map(clean).filter(Boolean).slice(0, 6) : [],
      })
      if (accepted.length >= 5) break
    }

    return NextResponse.json({
      model: process.env.AI_MODEL || 'openai/gpt-5.5',
      priorities: Array.isArray(parsed?.priorities) ? parsed.priorities.map(clean).filter(Boolean).slice(0, 8) : [],
      changes: accepted,
      unsupportedClaims: 0,
    })
  } catch (error) {
    console.error('tailor-cv error', error)
    const message = String(error?.message || '')
    const auth = /auth|credential|token|api key|oidc|unauthorized|401/i.test(message)
    return NextResponse.json({
      error: auth
        ? 'AI tailoring is not authenticated yet. Enable Vercel AI Gateway OIDC or add AI_GATEWAY_API_KEY.'
        : 'AI tailoring failed. Please retry this job description.',
      detail: process.env.NODE_ENV === 'development' ? message : undefined,
    }, { status: 500 })
  }
}
