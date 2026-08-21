from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from ..models import Job, SourceCoverage


@dataclass
class FetchResult:
    jobs: list[Job]
    coverage: SourceCoverage


class JobSource(ABC):
    name: str
    channel: str

    @abstractmethod
    async def fetch(self, freshness_days: int, include_remote_eu: bool) -> FetchResult:
        raise NotImplementedError
