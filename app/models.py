from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, HttpUrl

RemoteType = Literal["remote", "hybrid", "onsite", "unknown"]
RemoteEligibility = Literal["DENMARK CONFIRMED", "DENMARK EXCLUDED", "UNVERIFIED", "NOT APPLICABLE"]
EmploymentType = Literal["permanent", "fixed-term", "contract", "unknown"]
VacancyStatus = Literal["VERIFIED ACTIVE", "ACTIVE VIA THIRD PARTY", "UNVERIFIED", "CLOSED"]
HistoryStatus = Literal["NEW", "UPDATED", "SEEN"]
CoverageStatus = Literal["SEARCHED", "ACCESS LIMITED", "NOT ACCESSIBLE", "NO RELEVANT RESULTS"]
Verdict = Literal["Strong fit", "Plausible fit", "Stretch fit", "Poor fit"]
Action = Literal["Apply", "Consider", "Hold", "Reject"]


class Job(BaseModel):
    source: str
    source_job_id: str
    company: str
    title: str
    location: str
    country: Optional[str] = None
    remote_type: RemoteType = "unknown"
    remote_eligibility: RemoteEligibility = "NOT APPLICABLE"
    employment_type: EmploymentType = "unknown"
    salary_min_dkk_month: Optional[int] = None
    salary_max_dkk_month: Optional[int] = None
    description: str = ""
    full_jd_verified: bool = False
    original_url: HttpUrl
    official_url: Optional[HttpUrl] = None
    published_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    vacancy_status: VacancyStatus = "ACTIVE VIA THIRD PARTY"


class ScoreBreakdown(BaseModel):
    responsibilities_delivery: float = Field(ge=0, le=10)
    experience_domain: float = Field(ge=0, le=10)
    geography_work_model: float = Field(ge=0, le=10)
    career_compensation: float = Field(ge=0, le=10)


class MatchResult(BaseModel):
    score: float = Field(ge=0, le=10)
    verdict: Verdict
    action: Action
    match: list[str]
    gaps: list[str]
    hard_exclusion: bool = False
    hard_exclusion_reason: Optional[str] = None
    explanation: str
    breakdown: ScoreBreakdown


class EvaluatedJob(BaseModel):
    job: Job
    evaluation: MatchResult
    history_status: HistoryStatus = "NEW"


class EvaluationRequest(BaseModel):
    job: Job
    resume_text: str = Field(min_length=50)


class SearchRequest(BaseModel):
    resume_text: str = Field(min_length=50)
    freshness_days: int = Field(default=7, ge=1, le=30)
    max_results: int = Field(default=10, ge=1, le=10)
    only_new_or_updated: bool = True


class SourceCoverage(BaseModel):
    source: str
    channel: str
    status: CoverageStatus
    detail: Optional[str] = None
    fetched: int = 0
    search_requests: int = 0
    search_failures: int = 0
    search_rows: int = 0
    detail_requests: int = 0
    detail_failures: int = 0
    incomplete_details: int = 0


class SearchStats(BaseModel):
    fetched: int = 0
    full_jd_verified: int = 0
    deduplicated: int = 0
    cheap_filter_passed: int = 0
    full_jd_evaluated: int = 0
    worthwhile: int = 0


class SearchResponse(BaseModel):
    jobs: list[EvaluatedJob]
    coverage: list[SourceCoverage]
    stats: SearchStats
