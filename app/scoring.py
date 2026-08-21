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
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9æøå+/# .-]", " ", (text or "").lower())).strip()


def _hits(text: str, terms: list[str]) -> list[str]:
    t = _norm(text)
    found = []
    for term in terms:
        token = _norm(term)
        if not token:
            continue
        # Token boundaries prevent short signals such as "IT" / "BI" from
        # matching inside unrelated words (e.g. "with", "ability").
        pattern = rf"(?<![a-z0-9æøå]){re.escape(token)}(?![a-z0-9æøå])"
        if re.search(pattern, t, re.I):
            found.append(term)
    return found


def _regex_any(text: str, patterns: list[str]) -> bool:
    return any(re.search(p, text or "", re.I | re.S) for p in patterns)


def _mandatory_danish(text: str) -> bool:
    return _regex_any(text, [
        r"(?:must|required|mandatory|fluent|professional|native|proficient)[^.!?]{0,45}\bdanish\b",
        r"\bdanish\b[^.!?]{0,45}(?:must|required|mandatory|fluent|professional|native|proficient)",
        r"(?:flydende|professionelt|professionel|kræver|påkrævet)[^.!?]{0,35}\bdansk\b",
        r"\bdansk\b[^.!?]{0,35}(?:flydende|professionelt|professionel|kræves|påkrævet)",
    ])


def _technology_delivery_present(text: str, profile: dict) -> bool:
    tech = _hits(text, profile["technology_delivery_signals"])
    delivery = _hits(text, profile["delivery_ownership_signals"])
    return bool(tech) and bool(delivery)


def _hard_exclusion(job: Job, profile: dict) -> str | None:
    title = _norm(job.title)
    text = f"{job.title}\n{job.description}"

    if _mandatory_danish(text):
        return "Mandatory professional/fluent Danish is explicitly required"

    if re.search(r"\b(assistant|coordinator)\b", title, re.I) and not re.search(r"\bmanager\b", title, re.I):
        return "Assistant / coordinator level role"

    rnd_title = _regex_any(title, profile["hard_filters"]["rnd_title_patterns"])
    rnd_body_hits = _hits(job.description, profile["hard_filters"]["rnd_body_signals"])
    if rnd_title or len(rnd_body_hits) >= 2:
        return "Role is primarily R&D / scientific / hardware product development"

    bau_hits = _hits(text, profile["hard_filters"]["bau_support_signals"])
    delivery_hits = _hits(text, profile["delivery_ownership_signals"])
    if len(bau_hits) >= 2 and len(delivery_hits) < 2:
        return "Role is primarily BAU / support / service operations"

    coord_hits = _hits(text, profile["hard_filters"]["coordination_only_signals"])
    if len(coord_hits) >= 2 and len(delivery_hits) < 2:
        return "Coordination-only role without meaningful delivery ownership"

    if not _technology_delivery_present(text, profile):
        return "No meaningful technology/digital delivery ownership is evidenced"

    if "program manager" in title or "programme manager" in title or "programleder" in title:
        if len(delivery_hits) < 2:
            return "Program Manager role is not sufficiently execution/delivery oriented"

    product_title = bool(re.search(r"\b(product owner|product manager|product delivery|platform product)\b", title, re.I))
    if product_title:
        product_execution = _hits(text, profile["product_role_required_signals"])
        if len(product_execution) < 2:
            return "Product role lacks sufficient delivery execution ownership"

    return None


def _responsibility_score(job: Job, profile: dict) -> tuple[float, list[str], list[str]]:
    hits = _hits(job.description, profile["delivery_ownership_signals"])
    release_hits = _hits(job.description, profile["release_lifecycle_signals"])
    positive = len(set(hits + release_hits))
    score = min(10.0, 3.0 + positive * 0.75)
    notes: list[str] = []
    gaps: list[str] = []
    if hits:
        notes.append("Delivery ownership: " + ", ".join(hits[:4]))
    if release_hits:
        notes.append("Lifecycle ownership: " + ", ".join(release_hits[:3]))
    if score < 7.0:
        gaps.append("Delivery ownership is weaker than the target profile")
    return round(score, 1), notes, gaps


def _experience_domain_score(job: Job, profile: dict, resume_text: str) -> tuple[float, list[str], list[str]]:
    jd = f"{job.title} {job.description}"
    profile_domain = _hits(jd, profile["priority_domains"])
    fintech = _hits(jd, profile["fintech_priority_terms"])

    # Candidate-specific overlap: only count terms actually present in BOTH JD and supplied Master CV text.
    evidence_terms = profile["resume_evidence_terms"]
    jd_terms = set(_hits(jd, evidence_terms))
    cv_terms = set(_hits(resume_text, evidence_terms))
    overlap = sorted(jd_terms & cv_terms)

    score = 3.0
    score += min(3.0, len(profile_domain) * 0.6)
    score += min(3.0, len(overlap) * 0.5)
    if fintech:
        score += 1.0
    score = min(10.0, score)

    notes: list[str] = []
    gaps: list[str] = []
    if fintech:
        notes.append("Financial IT / FinTech priority: " + ", ".join(fintech[:4]))
    if overlap:
        notes.append("JD ↔ Master CV evidence overlap: " + ", ".join(overlap[:5]))
    elif profile_domain:
        gaps.append("Priority domain is present in the JD but direct Master CV evidence overlap is limited")
    else:
        gaps.append("Priority IT/software/platform domain is not strongly evidenced")
    return round(score, 1), notes, gaps


def _geography_score(job: Job, profile: dict) -> tuple[float, list[str], list[str]]:
    loc = _norm(job.location)
    notes: list[str] = []
    gaps: list[str] = []

    if job.remote_type == "remote":
        remote_text = _norm(f"{job.location} {job.description}")
        if _regex_any(remote_text, [r"\bdenmark\b", r"\bdanmark\b", r"\beu\b", r"european union", r"\beea\b", r"\bnordic\b"]):
            return 10.0, ["Remote role appears compatible with Denmark/EU"], gaps
        gaps.append("REMOTE ELIGIBILITY — UNVERIFIED")
        return 6.0, notes, gaps

    preferred = profile["geography"]["preferred_locations"]
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
        return 7.0, ["Copenhagen / Capital Region"], gaps

    if "denmark" in loc or "danmark" in loc or (job.country and _norm(job.country) in ["denmark", "danmark"]):
        gaps.append("Location is in Denmark but outside the preferred corridor")
        return 5.5, notes, gaps

    gaps.append("Location / work model is not clearly within the target geography")
    return 3.5, notes, gaps


def _career_compensation_score(job: Job, profile: dict) -> tuple[float, list[str], list[str]]:
    title = _norm(job.title)
    score = 6.0
    notes: list[str] = []
    gaps: list[str] = []

    if any(x in title for x in ["senior", "lead", "principal"]):
        score += 1.5
        notes.append("Senior/lead positioning is preserved")
    elif any(x in title for x in ["manager", "program", "programme", "projektleder"]):
        score += 0.5

    if job.salary_min_dkk_month is None and job.salary_max_dkk_month is None:
        gaps.append("Compensation: Insufficient data")
    else:
        salary = job.salary_max_dkk_month or job.salary_min_dkk_month or 0
        if job.employment_type == "contract":
            if salary >= profile["compensation"]["contract_min_dkk_month_equivalent"]:
                score += 2.0
                notes.append("Contract compensation provides an acceptable premium")
            else:
                score -= 2.5
                gaps.append("Contract compensation lacks a clear premium")
        elif salary >= profile["compensation"]["permanent_target_dkk_month"]:
            score += 2.0
            notes.append("Compensation is at/above preferred level")
        elif salary >= profile["compensation"]["permanent_acceptable_min_dkk_month"]:
            score += 1.0
            notes.append("Compensation is within acceptable range")
        elif salary < profile["compensation"]["permanent_strong_negative_below_dkk_month"]:
            score -= 4.0
            gaps.append("Compensation is a strong negative")
        elif salary < profile["compensation"]["permanent_negative_below_dkk_month"]:
            score -= 2.0
            gaps.append("Compensation is below preferred range")
        else:
            score -= 0.5
            gaps.append("Compensation is below preferred range and needs compensating advantages")

    return round(max(0.0, min(10.0, score)), 1), notes, gaps


def evaluate_job(job: Job, profile: dict, resume_text: str) -> MatchResult:
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
            explanation="Rejected by a decisive hard filter from the Master Job Search Prompt.",
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

    w = profile["weights"]
    score = round(
        resp * w["responsibilities_delivery"]
        + exp * w["experience_domain"]
        + geo * w["geography_work_model"]
        + career * w["career_compensation"],
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

    match = (resp_notes + exp_notes + geo_notes + career_notes)[:4]
    gaps = (resp_gaps + exp_gaps + geo_gaps + career_gaps)[:3]

    return MatchResult(
        score=score,
        verdict=verdict,
        action=action,
        match=match,
        gaps=gaps,
        hard_exclusion=False,
        explanation=(
            f"Score {score}/10: 40% actual responsibilities/delivery ownership, "
            "25% experience & domain match against the supplied Master CV, "
            "20% geography/work model, 15% career/compensation value."
        ),
        breakdown=breakdown,
    )
