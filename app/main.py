from pathlib import Path
from fastapi import FastAPI

from .models import EvaluationRequest, MatchResult, SearchRequest, SearchResponse
from .pipeline import SearchPipeline
from .scoring import evaluate_job, load_profile
from .sources import JobnetSource, TheHubSource, RemoteOKSource, WeWorkRemotelySource

BASE = Path(__file__).parent.parent
PROFILE = load_profile(BASE / "config" / "yulia_profile.yaml")

SOURCES = [
    JobnetSource(PROFILE["discovery_queries"]),
    TheHubSource(pages=3),
    RemoteOKSource(),
    WeWorkRemotelySource(),
]
PIPELINE = SearchPipeline(PROFILE, SOURCES, BASE / "data" / "search_history.json")

app = FastAPI(title="ApplyPilot Search + Matching Engine", version="0.2.0")


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.2.0", "active_connectors": [s.name for s in SOURCES]}


@app.post("/evaluate", response_model=MatchResult)
def evaluate(request: EvaluationRequest):
    return evaluate_job(request.job, PROFILE, request.resume_text)


@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    return await PIPELINE.run(
        resume_text=request.resume_text,
        freshness_days=request.freshness_days,
        max_results=request.max_results,
        include_remote_eu=request.include_remote_eu,
        only_new_or_updated=request.only_new_or_updated,
    )
