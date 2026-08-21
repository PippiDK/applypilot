from __future__ import annotations

import re
from pathlib import Path
from typing import Any
import yaml

from .models import Job, MatchResult, ScoreBreakdown


def load_profile(path: str | Path) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9æøå+/# .&-]", " ", (text or "").lower())).strip()


def _hits(text: str, terms: list[str]) -> list[str]:
    t = _norm(text)
    found: list[str] = []
    for term in terms:
        token = _norm(term)
        if not token:
            continue
        pattern = rf"(?<![a-z0-9æøå]){re.escape(token)}(?![a-z0-9æøå])"
        if re.search(pattern, t, re.I):
            found.append(term)
    return found


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?;])\s+|\n+", text or "") if s.strip()]


def _mandatory_danish(text: str) -> bool:
    for sentence in _sentences(text):
        s = _norm(sentence)
        if not re.search(r"\b(danish|dansk)\b", s):
            continue
        if re.search(r"\b(not required|not mandatory|optional|preferred|an advantage|advantage|nice to have|beneficial|plus)\b", s):
            # A clause such as "English is required; Danish is preferred" is not mandatory Danish.
            continue
        patterns = [
            r"\b(danish|dansk)\b.{0,45}\b(is required|required|mandatory|must|proficient|proficiency|fluent|professional|native|near-native|kræves|påkrævet|flydende)\b",
            r"\b(required|mandatory|must|proficient|proficiency|fluent|professional|native|near-native|kræves|påkrævet|flydende)\b.{0,45}\b(danish|dansk)\b",
            r"\b(speak|write|communicate in)\b.{0,25}\b(danish|dansk)\b.{0,25}\b(fluently|professionally)\b",
        ]
        if any(re.search(p, s, re.I) for p in patterns):
            return True
    return False


def _technology_hits(text: str, profile: dict) -> list[str]:
    return _hits(text, profile["technology_delivery_signals"])


def _ownership_hits(text: str, profile: dict) -> list[str]:
    return _hits(text, profile["delivery_ownership_signals"])


def _rnd_primary(job: Job, profile: dict) -> bool:
    title = _norm(job.title)
    body = _norm(job.description)
    tech = _technology_hits(body, profile)
    strong_corporate_it = len(set(x.lower() for x in tech)) >= 3 and any(
        phrase in body for phrase in ["enterprise", "platform", "digital transformation", "corporate it", "business systems", "infrastructure", "cloud", "systems integration"]
    )

    if re.search(r"\b(r&d|research|drug discovery|laboratory|hardware)\b.*\b(project manager|program manager|programme manager|project lead)\b", title):
        return True
    if re.search(r"\b(project manager|program manager|programme manager|project lead)\b.*\b(r&d|research|drug discovery|laboratory|hardware)\b", title):
        return True

    primary_patterns = [
        r"\b(lead|manage|own|deliver|responsible for)\b.{0,60}\b(scientific research|research programme|drug discovery|laboratory development|hardware development|medical device development|new physical product|product r&d)\b",
        r"\b(scientific research|research programme|drug discovery|laboratory development|hardware development|medical device development|new physical product|product r&d)\b.{0,60}\b(project|programme|program|development lifecycle)\b",
    ]
    if any(re.search(p, body, re.I) for p in primary_patterns) and not strong_corporate_it:
        return True

    rnd_hits = _hits(job.description, profile["hard_filters"]["rnd_body_signals"])
    return len(rnd_hits) >= 2 and len(tech) < 3


def _construction_primary(job: Job, profile: dict) -> bool:
    text = _norm(f"{job.title} {job.description}")
    construction_patterns = [
        r"\bconstruction project(s)?\b",
        r"\bbuilding construction\b",
        r"\bcivil engineering\b",
        r"\bconstruction site\b",
        r"\bsite manager\b",
        r"\bcapital construction\b",
        r"\bbuilding project(s)?\b",
    ]
    if not any(re.search(p, text, re.I) for p in construction_patterns):
        return False
    tech = _technology_hits(text, profile)
    corporate = _hits(text, ["enterprise software", "digital transformation", "systems integration", "platform implementation", "cloud", "cyber security", "enterprise applications", "business systems"])
    return len(tech) < 4 or len(corporate) < 2


def _hard_exclusion(job: Job, profile: dict) -> str | None:
    title = _norm(job.title)
    text = f"{job.title}\n{job.description}"

    if _mandatory_danish(text):
        return "Mandatory professional/fluent Danish is explicitly required"

    if job.remote_type == "remote" and job.remote_eligibility == "DENMARK EXCLUDED":
        return "Remote role explicitly excludes employment from Denmark"

    if re.search(r"\b(assistant|coordinator)\b", title, re.I) and not re.search(r"\b(manager|lead)\b", title, re.I):
        return "Assistant / coordinator level role"

    if _construction_primary(job, profile):
        return "Role is primarily construction / building / civil engineering delivery"

    if _rnd_primary(job, profile):
        return "Role is primarily R&D / scientific / hardware product development"

    tech_hits = _technology_hits(text, profile)
    ownership_hits = _ownership_hits(text, profile)
    bau_hits = _hits(text, profile["hard_filters"]["bau_support_signals"])
    coord_hits = _hits(text, profile["hard_filters"]["coordination_only_signals"])

    if re.search(r"\bno (meaningful )?ownership\b", _norm(text)) or re.search(r"\bwithout (meaningful )?ownership\b", _norm(text)):
        return "Role is coordination-only with no meaningful delivery ownership"

    if len(bau_hits) >= 2 and len(ownership_hits) < 2:
        return "Role is primarily BAU / support / service operations"

    if len(coord_hits) >= 2 and len(ownership_hits) < 2:
        return "Role is primarily coordination/facilitation without delivery ownership"

    if not tech_hits or not ownership_hits:
        return "No meaningful technology/digital delivery ownership is evidenced in the JD"

    return None


def _responsibility_score(job: Job, profile: dict) -> tuple[float, list[str], list[str]]:
    text = f"{job.title} {job.description}"
    ownership = _ownership_hits(text, profile)
    release = _hits(text, profile["release_lifecycle_signals"])
    score = 2.5 + min(5.5, len(set(x.lower() for x in ownership)) * 0.7) + min(2.0, len(set(x.lower() for x in release)) * 0.4)
    score = min(10.0, score)
    notes: list[str] = []
    gaps: list[str] = []
    if ownership:
        notes.append("Delivery ownership: " + ", ".join(ownership[:4]))
    if release:
        notes.append("Release / go-live lifecycle: " + ", ".join(release[:3]))
    if score < 7.0:
        gaps.append("Delivery ownership is weaker than the target profile")
    return round(score, 1), notes, gaps


def _experience_domain_score(job: Job, profile: dict, resume_text: str) -> tuple[float, list[str], list[str]]:
    jd = f"{job.title} {job.description}"
    domain = _hits(jd, profile["priority_domains"])
    fintech = _hits(jd, profile["fintech_priority_terms"])
    evidence_terms = profile["resume_evidence_terms"]
    jd_terms = set(_hits(jd, evidence_terms))
    cv_terms = set(_hits(resume_text, evidence_terms))
    overlap = sorted(jd_terms & cv_terms)

    score = 2.5 + min(3.0, len(set(x.lower() for x in domain)) * 0.55) + min(3.5, len(overlap) * 0.45)
    if fintech:
        score += 1.0
    score = min(10.0, score)

    notes: list[str] = []
    gaps: list[str] = []
    if fintech:
        notes.append("Financial IT / FinTech priority: " + ", ".join(fintech[:4]))
    if overlap:
        notes.append("JD ↔ Master CV evidence: " + ", ".join(overlap[:5]))
    else:
        gaps.append("Direct JD ↔ Master CV evidence overlap is limited")
    if not domain:
        gaps.append("Priority IT/software/platform domain is not strongly evidenced")
    return round(score, 1), notes, gaps


def _geography_score(job: Job, profile: dict) -> tuple[float, list[str], list[str]]:
    loc = _norm(job.location)
    notes: list[str] = []
    gaps: list[str] = []
    preferred = profile["geography"]["preferred_locations"]

    if job.remote_type == "remote":
        if job.remote_eligibility == "DENMARK CONFIRMED":
            return 10.0, ["Remote employment from Denmark is explicitly supported"], gaps
        if job.remote_eligibility == "UNVERIFIED":
            gaps.append("REMOTE ELIGIBILITY — UNVERIFIED")
            return 5.0, notes, gaps

    if any(_norm(x) in loc for x in preferred):
        if job.remote_type == "hybrid":
            return 10.0, ["Preferred geography + hybrid"], gaps
        return 9.0, ["Preferred geographic corridor"], gaps

    if any(x in loc for x in ["copenhagen", "københavn", "capital region", "hovedstaden"]):
        if job.remote_type == "hybrid":
            return 8.0, ["Copenhagen / Capital Region hybrid"], gaps
        if job.remote_type == "onsite":
            gaps.append("Central Copenhagen onsite attendance may be unattractive")
            return 5.5, notes, gaps
        return 7.0, ["Copenhagen / Capital Region; work model not verified"], gaps

    if "denmark" in loc or "danmark" in loc or (job.country and _norm(job.country) in ["denmark", "danmark"]):
        gaps.append("Location is in Denmark but outside the preferred corridor")
        return 5.0, notes, gaps

    gaps.append("Location is outside the target Denmark geography")
    return 2.0, notes, gaps


def _career_compensation_score(job: Job, profile: dict) -> tuple[float, list[str], list[str]]:
    title = _norm(job.title)
    score = 5.5
    notes: list[str] = []
    gaps: list[str] = []

    if any(x in title for x in ["senior", "lead", "principal"]):
        score += 1.5
        notes.append("Senior/lead positioning is preserved")
    elif any(x in title for x in ["manager", "program", "programme", "projektleder"]):
        score += 0.5

    low = job.salary_min_dkk_month
    high = job.salary_max_dkk_month
    if low is None and high is None:
        gaps.append("Compensation: Insufficient data")
    elif job.employment_type == "contract":
        guaranteed = low if low is not None else high or 0
        if guaranteed >= profile["compensation"]["contract_min_dkk_month_equivalent"]:
            score += 2.0
            notes.append("Contract compensation has a clear premium")
        else:
            score -= 2.0
            gaps.append("Contract compensation premium is not evidenced")
    else:
        target = profile["compensation"]["permanent_target_dkk_month"]
        acceptable = profile["compensation"]["permanent_acceptable_min_dkk_month"]
        negative = profile["compensation"]["permanent_negative_below_dkk_month"]
        strong_negative = profile["compensation"]["permanent_strong_negative_below_dkk_month"]
        guaranteed = low if low is not None else high or 0
        if low is not None and low >= target:
            score += 2.0
            notes.append("Salary floor is at/above preferred level")
        elif low is not None and low >= acceptable:
            score += 1.0
            notes.append("Salary floor is within acceptable range")
        elif low is not None and high is not None and low < acceptable <= high:
            gaps.append("Salary range overlaps the acceptable level but starts below it")
        elif guaranteed and guaranteed < strong_negative:
            score -= 4.0
            gaps.append("Compensation is a strong negative")
        elif guaranteed and guaranteed < negative:
            score -= 2.0
            gaps.append("Compensation is below preferred range")
        else:
            gaps.append("Compensation needs verification")

    return round(max(0.0, min(10.0, score)), 1), notes, gaps


def evaluate_job(job: Job, profile: dict, resume_text: str) -> MatchResult:
    if not job.full_jd_verified:
        exclusion = "Full Job Description has not been verified from the source detail endpoint"
    else:
        exclusion = _hard_exclusion(job, profile)

    if exclusion:
        zero = ScoreBreakdown(
            responsibilities_delivery=0,
            experience_domain=0,
            geography_work_model=0,
            career_compensation=0,
        )
        return MatchResult(
            score=0,
            verdict="Poor fit",
            action="Reject",
            match=[],
            gaps=[exclusion],
            hard_exclusion=True,
            hard_exclusion_reason=exclusion,
            explanation="Rejected by a decisive Master Prompt hard filter.",
            breakdown=zero,
        )

    resp, resp_notes, resp_gaps = _responsibility_score(job, profile)
    exp, exp_notes, exp_gaps = _experience_domain_score(job, profile, resume_text)
    geo, geo_notes, geo_gaps = _geography_score(job, profile)
    career, career_notes, career_gaps = _career_compensation_score(job, profile)

    breakdown = ScoreBreakdown(
        responsibilities_delivery=resp,
        experience_domain=exp,
        geography_work_model=geo,
        career_compensation=career,
    )
    weights = profile["weights"]
    score = round(
        resp * weights["responsibilities_delivery"]
        + exp * weights["experience_domain"]
        + geo * weights["geography_work_model"]
        + career * weights["career_compensation"],
        1,
    )

    if score >= 9.0:
        verdict, action = "Strong fit", "Apply"
    elif score >= 7.5:
        verdict, action = "Plausible fit", "Consider"
    elif score >= 6.0:
        verdict, action = "Stretch fit", "Hold"
    else:
        verdict, action = "Poor fit", "Reject"

    return MatchResult(
        score=score,
        verdict=verdict,
        action=action,
        match=(resp_notes + exp_notes + geo_notes + career_notes)[:4],
        gaps=(resp_gaps + exp_gaps + geo_gaps + career_gaps)[:3],
        hard_exclusion=False,
        explanation=(
            f"Score {score}/10: 40% responsibilities/delivery ownership, "
            "25% experience & domain evidence against the supplied Master CV, "
            "20% geography/work model, 15% career/compensation value."
        ),
        breakdown=breakdown,
    )
