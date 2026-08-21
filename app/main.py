from pathlib import Path
from fastapi import FastAPI

from .models import EvaluationRequest, MatchResult, SearchRequest, SearchResponse
from .pipeline import SearchPipeline
from .scoring import evaluate_job, load_profile
from .sources import LinkedInPublicSource

BASE = Path(__file__).parent.parent
PROFILE = load_profile(BASE / "config" / "yulia_profile.yaml")

SOURCE = LinkedInPublicSource(PROFILE["discovery_queries"])
PIPELINE = SearchPipeline(PROFILE, SOURCE, BASE / "data" / "search_history.json")

app = FastAPI(title="ApplyPilot LinkedIn E2E", version="0.3.1")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "0.3.1",
        "milestone": "LinkedIn public search -> full JD -> evaluator",
        "active_connector": SOURCE.name,
    }


@app.post("/evaluate", response_model=MatchResult)
def evaluate(request: EvaluationRequest):
    return evaluate_job(request.job, PROFILE, request.resume_text)


@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    return await PIPELINE.run(
        resume_text=request.resume_text,
        freshness_days=request.freshness_days,
        max_results=request.max_results,
        only_new_or_updated=request.only_new_or_updated,
    )
