import asyncio
import uuid
from datetime import datetime, timedelta
from threading import Lock

from src.environment import Environment
from src.types import Point, SearchState
from src.strategies.base import Strategy


class SessionEntry:
    def __init__(
        self,
        env: Environment,
        belief,
        strategy: Strategy,
        state: SearchState,
        box: Point,
    ):
        self.env = env
        self.belief = belief
        self.strategy = strategy
        self.state = state
        self.box = box
        self.last_accessed = datetime.utcnow()

    def touch(self):
        self.last_accessed = datetime.utcnow()


class SessionStore:
    def __init__(self, ttl_minutes: int = 30):
        self._sessions: dict[str, SessionEntry] = {}
        self._lock = Lock()
        self._ttl = timedelta(minutes=ttl_minutes)

    def create(self, env, belief, strategy, state, box) -> str:
        sid = str(uuid.uuid4())
        with self._lock:
            self._sessions[sid] = SessionEntry(env, belief, strategy, state, box)
        return sid

    def get(self, sid: str) -> SessionEntry | None:
        with self._lock:
            entry = self._sessions.get(sid)
            if entry:
                entry.touch()
            return entry

    def delete(self, sid: str) -> None:
        with self._lock:
            self._sessions.pop(sid, None)

    async def cleanup_loop(self):
        while True:
            await asyncio.sleep(300)  # check every 5 minutes
            cutoff = datetime.utcnow() - self._ttl
            with self._lock:
                expired = [k for k, v in self._sessions.items() if v.last_accessed < cutoff]
                for k in expired:
                    del self._sessions[k]
