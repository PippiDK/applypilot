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


def _match_categories(text: str, categories: dict[str, list[str]]) -> dict[str, list[str]]:
    value = _norm(text)
    matched: dict[str, list[str]] = {}
    for name, patterns in categories.items():
        hits = [pattern for pattern in patterns if re.search(pattern, value, re.I | re.S)]
        if hits:
            matched[name] = hits
    return matched


# These are semantic-ish evidence groups rather than exact keyword counts.  They
# intentionally capture equivalent wording such as "take end-to-end ownership",
# "lead delivery", "manage scope/timeline", etc.
RESPONSIBILITY_CATEGORIES = {
    "end_to_end": [
        r"\bend[- ]to[- ]end\b.{0,80}\b(deliver|delivery|project|programme|program|execution|ownership)\b",
        r"\b(full lifecycle|full life cycle)\b",
        r"\b(own|owns|owned|take|takes|taking)\b.{0,35}\b(full|end[- ]to[- ]end)?\s*(delivery|lifecycle|project|programme|program)\b",
        r"\blead and deliver\b",
        r"\blead delivery\b",
    ],
    "scope_schedule": [
        r"\b(scope|timeline|timelines|schedule|schedules|milestone|milestones)\b",
        r"\b(on time|within scope|delivery plan|project plan|integrated plan)\b",
    ],
    "risk_dependencies": [r"\brisks?\b", r"\bdependencies\b", r"\braid\b", r"\bissues?\b.{0,25}\bdependencies\b"],
    "budget_financial": [
        r"\bbudget(s|ing)?\b",
        r"\bfinancial (management|tracking|control|performance|forecast|forecasting)\b",
        r"\bcapex\b|\bopex\b|\bcost control\b|\bforecasting\b",
    ],
    "accountability_outcomes": [
        r"\baccountab(le|ility)\b",
        r"\bdelivery outcomes?\b",
        r"\b(tangible|measurable|successful|business) outcomes?\b",
        r"\bdeliver measurable business value\b",
        r"\bresponsible for\b.{0,55}\b(delivery|execution|outcomes?)\b",
    ],
    "cross_functional": [
        r"\bcross[- ]functional\b",
        r"\bacross (business|product|technology|engineering).{0,70}(teams|stakeholders|functions)\b",
        r"\b(business and technology|product and engineering|architecture and engineering)\b",
    ],
    "stakeholders": [
        r"\bsenior stakeholders?\b",
        r"\bexecutive (communication|reporting|stakeholders?|leadership|forums?)\b",
        r"\bstakeholder (management|alignment|expectations|communication)\b",
        r"\bsteerco\b|\bsteering committee\b",
    ],
    "governance": [
        r"\bgovernance\b",
        r"\bdecision framework\b",
        r"\bprogress reporting\b",
        r"\bproject reporting\b",
    ],
    "roadmap_planning": [
        r"\broadmap(s)?\b",
        r"\bstrategic planning\b",
        r"\bplanning\b.{0,35}\b(execution|delivery|portfolio|project|program)\b",
        r"\bprioritisation\b|\bprioritization\b",
    ],
    "implementation_release": [
        r"\bimplementation\b|\bmigration\b|\btransition\b",
        r"\brelease readiness\b|\brelease\b|\buat\b|\bcutover\b|\bgo[- ]live\b|\bhypercare\b|\bhandover\b",
        r"\bdeployment lifecycle\b|\bdeployment project\b",
    ],
    "team_leadership": [
        r"\b(lead|leading|manage|managing|coordinate|coordinating)\b.{0,55}\b(teams|project managers|engineering teams|agile teams)\b",
        r"\blead without formal authority\b",
        r"\bfunctional leadership\b",
    ],
}

TECHNOLOGY_CATEGORIES = {
    "it_software": [r"\binformation technology\b", r"\bit project\b", r"\bgroup it\b", r"\bcorporate it\b", r"\bsoftware\b", r"\btechnology\b"],
    "digital_transformation": [r"\bdigital transformation\b", r"\btechnology transformation\b", r"\bit transformation\b", r"\bdigital\b.{0,40}\b(project|delivery|initiative|transformation)\b"],
    "platform": [r"\bplatform(s)?\b", r"\benterprise applications?\b", r"\bbusiness systems?\b", r"\bapi(s)?\b"],
    "engineering": [r"\bengineering teams?\b", r"\bsoftware engineering\b", r"\btechnical implementation\b", r"\bdevelopment workflows?\b"],
    "infrastructure_cloud": [r"\binfrastructure\b", r"\bcloud\b", r"\bdata centre\b|\bdata center\b", r"\bcybersecurity\b|\bcyber security\b"],
    "data": [r"\bdata platform(s)?\b", r"\bdata transformation\b", r"\bdata engineering\b", r"\bdatabricks\b", r"\bsnowflake\b", r"\banalytics\b|\bbi\b"],
    "integration": [r"\bsystems? integration\b", r"\bintegration projects?\b", r"\bintegrations?\b", r"\bmigration\b.{0,35}\b(platform|system|technology|data)\b"],
    "automation_ai": [r"\bautomation\b", r"\bai strategy\b|\bai transformation\b|\bai-enabled\b", r"\bengineering tooling\b"],
    "financial_technology": [r"\bfintech\b", r"\bbanking platform\b", r"\btrading systems?\b", r"\bpost[- ]trade\b", r"\bpayments?\b", r"\bfinancial data\b"],
}

EVIDENCE_CATEGORIES = {
    "project_delivery": [r"\bend[- ]to[- ]end\b", r"\bproject delivery\b", r"\bdelivery management\b", r"\bfull lifecycle\b"],
    "platform": [r"\bplatform(s)?\b", r"\benterprise software\b", r"\benterprise applications?\b", r"\bbusiness systems?\b"],
    "integration": [r"\bsystems? integration\b", r"\bintegrations?\b"],
    "transformation": [r"\b(digital|technology|it|enterprise|data) transformation\b", r"\btransformation initiatives?\b"],
    "agile": [r"\bagile\b", r"\bscrum\b", r"\bsafe\b", r"\bhybrid delivery\b"],
    "data": [r"\bdata platform(s)?\b", r"\bdata warehouse\b|\bdwh\b", r"\bpower bi\b|\bbi\b", r"\bdata engineering\b"],
    "financial": [r"\bfinancial it\b", r"\bfintech\b", r"\bbanking\b|\bbank\b", r"\btrading\b", r"\bpost[- ]trade\b", r"\bpayments?\b"],
    "regulatory": [r"\bregulatory\b", r"\bcompliance\b", r"\baml\b", r"\brisk & compliance\b"],
    "governance": [r"\bgovernance\b", r"\bpmo\b", r"\bsteerco\b|\bsteering committee\b"],
    "risk_dependency": [r"\brisk (management|control|reporting)?\b", r"\brisks?\b", r"\bdependencies\b", r"\braid\b"],
    "stakeholders": [r"\bstakeholder (management|alignment|communication|expectations)\b", r"\bsenior stakeholders?\b", r"\bexecutive communication\b|\bexecutive reporting\b"],
    "budget": [r"\bbudget(s|ing)?\b", r"\bfinancial management\b", r"\bfinancial control\b", r"\bforecasting\b"],
    "release": [r"\brelease readiness\b|\brelease\b", r"\buat\b", r"\bcutover\b", r"\bgo[- ]live\b", r"\bhypercare\b", r"\bhandover\b"],
    "distributed": [r"\bdistributed\b", r"\boffshore\b", r"\binternational teams?\b", r"\bacross (countries|regions|denmark and india)\b"],
    "implementation": [r"\bimplementation\b", r"\bmigration\b", r"\bdeployment\b", r"\btransition\b"],
    "cloud": [r"\bazure\b", r"\bcloud\b", r"\bdatabricks\b", r"\bsnowflake\b"],
}


def _mandatory_danish(text: str) -> bool:
    for sentence in _sentences(text):
        s = _norm(sentence)
        if not re.search(r"\b(danish|dansk)\b", s):
            continue
        # Explicitly optional/preferred Danish overrides nearby generic language requirements.
        if re.search(r"\b(not required|not mandatory|optional|preferred|an advantage|advantage|nice to have|beneficial|plus|desirable)\b", s):
            continue
        patterns = [
            r"\b(danish|dansk)\b.{0,55}\b(is required|required|mandatory|must|proficient|proficiency|fluent|fluency|professional|native|near-native|kræves|påkrævet|flydende)\b",
            r"\b(required|mandatory|must|proficient|proficiency|fluent|fluency|professional|native|near-native|kræves|påkrævet|flydende)\b.{0,55}\b(danish|dansk)\b",
            r"\b(speak|write|communicate in)\b.{0,30}\b(danish|dansk)\b.{0,30}\b(fluently|professionally)\b",
        ]
        if any(re.search(p, s, re.I) for p in patterns):
            return True
    return False


def _technology_categories(text: str) -> dict[str, list[str]]:
    return _match_categories(text, TECHNOLOGY_CATEGORIES)


def _responsibility_categories(text: str) -> dict[str, list[str]]:
    return _match_categories(text, RESPONSIBILITY_CATEGORIES)


def _rnd_primary(job: Job, profile: dict) -> bool:
    title = _norm(job.title)
    body = _norm(job.description)
    tech = _technology_categories(body)
    explicit_corporate_it = bool(re.search(r"\b(corporate it|group it|enterprise (software|platform|applications)|digital transformation|it transformation|business systems|technology platform)\b", body))

    title_rnd = bool(re.search(r"\b(r&d|research|drug discovery|laboratory|medical device r&d|hardware development|computer vision)\b", title))
    if title_rnd and not explicit_corporate_it:
        return True

    primary_patterns = [
        r"\b(lead|manage|own|deliver|responsible for)\b.{0,70}\b(scientific research|research programme|drug discovery|laboratory development|hardware development|medical device development|new physical product|product r&d|computer vision)\b",
        r"\b(scientific research|research programme|drug discovery|laboratory development|hardware development|medical device development|new physical product|product r&d|computer vision)\b.{0,70}\b(project|programme|program|development lifecycle|roadmap)\b",
    ]
    if any(re.search(p, body, re.I) for p in primary_patterns) and not explicit_corporate_it:
        return True

    rnd_hits = _hits(job.description, profile["hard_filters"]["rnd_body_signals"])
    return len(rnd_hits) >= 2 and len(tech) <= 1 and not explicit_corporate_it


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
        r"\bmep\b.{0,30}\b(construction|building|contractor)\b",
    ]
    if not any(re.search(p, text, re.I) for p in construction_patterns):
        return False
    tech = _technology_categories(text)
    # A construction company can still have corporate IT roles. Require explicit corporate-tech evidence to keep it.
    corporate_it = bool(re.search(r"\b(corporate it|group it|enterprise software|digital transformation|systems integration|cloud platform|enterprise applications|business systems)\b", text))
    return not corporate_it or len(tech) <= 1


def _explicit_non_tech_primary(job: Job) -> str | None:
    text = _norm(f"{job.title} {job.description}")
    tech = _technology_categories(text)
    if re.search(r"\b(marketing campaign|creative agency|advertising campaign|brand campaign)\b", text) and len(tech) <= 1:
        return "Role is primarily marketing / creative project delivery without technology ownership"
    if re.search(r"\b(retail rollout|store rollout|shop rollout|store opening programme|store opening program)\b", text) and len(tech) <= 1:
        return "Role is primarily retail rollout without technology ownership"
    return None


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

    non_tech = _explicit_non_tech_primary(job)
    if non_tech:
        return non_tech

    responsibilities = _responsibility_categories(text)
    bau_hits = _hits(text, profile["hard_filters"]["bau_support_signals"])
    coord_hits = _hits(text, profile["hard_filters"]["coordination_only_signals"])

    if re.search(r"\bno (meaningful )?ownership\b", _norm(text)) or re.search(r"\bwithout (meaningful )?ownership\b", _norm(text)):
        return "Role is coordination-only with no meaningful delivery ownership"

    # Only use absence of ownership as a hard filter when it is decisive, not merely
    # because one exact keyword is missing.  This prevents false rejections of JDs
    # phrased as "take end-to-end ownership", "drive execution", etc.
    if len(bau_hits) >= 2 and len(responsibilities) <= 2:
        return "Role is primarily BAU / support / service operations"

    if len(coord_hits) >= 2 and len(responsibilities) <= 2:
        return "Role is primarily coordination/facilitation without delivery ownership"

    if len(responsibilities) == 0:
        return "No meaningful delivery ownership is evidenced in the JD"

    return None


def _responsibility_score(job: Job, profile: dict) -> tuple[float, list[str], list[str]]:
    text = f"{job.title} {job.description}"
    categories = _responsibility_categories(text)
    category_names = set(categories)
    score = 2.2 + min(6.6, len(category_names) * 0.66)
    if "end_to_end" in category_names:
        score += 0.5
    if "accountability_outcomes" in category_names:
        score += 0.4
    if "risk_dependencies" in category_names and "scope_schedule" in category_names:
        score += 0.3
    score = min(10.0, score)

    pretty = {
        "end_to_end": "end-to-end delivery",
        "scope_schedule": "scope/timeline/milestones",
        "risk_dependencies": "risks/dependencies",
        "budget_financial": "budget/financial control",
        "accountability_outcomes": "accountability/outcomes",
        "cross_functional": "cross-functional delivery",
        "stakeholders": "senior stakeholders",
        "governance": "governance/reporting",
        "roadmap_planning": "roadmap/planning",
        "implementation_release": "implementation/release lifecycle",
        "team_leadership": "team leadership",
    }
    strongest = [pretty[name] for name in pretty if name in category_names]
    notes = ["Delivery evidence: " + ", ".join(strongest[:6])] if strongest else []
    gaps: list[str] = []
    if score < 7.0:
        gaps.append("Delivery ownership is weaker than the target profile")
    return round(score, 1), notes, gaps


def _experience_domain_score(job: Job, profile: dict, resume_text: str) -> tuple[float, list[str], list[str]]:
    jd = f"{job.title} {job.description}"
    tech = _technology_categories(jd)
    jd_evidence = _match_categories(jd, EVIDENCE_CATEGORIES)
    cv_evidence = _match_categories(resume_text, EVIDENCE_CATEGORIES)
    overlap = [name for name in EVIDENCE_CATEGORIES if name in jd_evidence and name in cv_evidence]
    fintech = _hits(jd, profile["fintech_priority_terms"])
    regulated_finance = bool(re.search(r"\b(financial services|bank|banking|fintech|regulated industry|regulatory|compliance|risk & compliance)\b", _norm(jd)))

    score = 2.0
    score += min(5.0, len(overlap) * 0.58)
    score += min(1.6, len(tech) * 0.32)
    if fintech or regulated_finance:
        # Financial/regulatory experience is a major positive in the Master Prompt.
        cv_finance = any(name in cv_evidence for name in ["financial", "regulatory"])
        if cv_finance:
            score += 1.1
    score = min(10.0, score)

    pretty = {
        "project_delivery": "end-to-end delivery",
        "platform": "enterprise/platform delivery",
        "integration": "systems integration",
        "transformation": "transformation",
        "agile": "Agile/Hybrid",
        "data": "data/BI",
        "financial": "Financial IT",
        "regulatory": "regulatory/compliance",
        "governance": "governance/PMO",
        "risk_dependency": "risk/dependency management",
        "stakeholders": "stakeholder leadership",
        "budget": "budget/financial control",
        "release": "release/go-live",
        "distributed": "distributed delivery",
        "implementation": "implementation/migration",
        "cloud": "cloud/Azure",
    }
    notes: list[str] = []
    gaps: list[str] = []
    if fintech or regulated_finance:
        notes.append("Financial IT / regulated-domain priority match")
    if overlap:
        notes.append("JD ↔ Master CV evidence: " + ", ".join(pretty[x] for x in overlap[:6]))
    else:
        gaps.append("Direct JD ↔ Master CV evidence overlap is limited")
    if len(tech) == 0:
        gaps.append("Technology/digital scope is not explicit in the JD")
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
    body = _norm(job.description)
    score = 5.5
    notes: list[str] = []
    gaps: list[str] = []

    if any(x in title for x in ["senior", "lead", "principal"]):
        score += 1.5
        notes.append("Senior/lead positioning is preserved")
    elif any(x in title for x in ["manager", "program", "programme", "projektleder"]):
        score += 0.5

    # Program/portfolio roles dominated by people management are a negative in the Master Prompt.
    people_mgmt_signals = sum(
        bool(re.search(pattern, body))
        for pattern in [
            r"\bmanage a team of project managers\b",
            r"\bmanaging a team of project managers\b",
            r"\bhiring and retaining\b",
            r"\bperformance management\b",
            r"\bmanaging aspirations\b",
            r"\bresource utilization\b",
        ]
    )
    if people_mgmt_signals >= 2:
        score -= 2.0
        gaps.append("Role carries substantial people-management responsibility relative to hands-on delivery")

    if re.search(r"\b(only for selected|selected high-stakes|direct .* accountability only for selected)\b", body) and re.search(r"\bportfolio\b", body):
        score -= 0.7
        gaps.append("Direct project ownership appears limited to selected initiatives")

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
    elif job.vacancy_status == "CLOSED":
        exclusion = "Vacancy is closed or its explicit application deadline has passed"
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
