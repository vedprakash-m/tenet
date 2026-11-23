import threading
from .clock import now_monotonic

class TokenBucket:
    def __init__(self, capacity: float, refill_per_sec: float, clock=now_monotonic):
        if capacity <= 0 or refill_per_sec <= 0:
            raise ValueError("capacity and refill rate must be positive")
        self.capacity = capacity
        self.refill_per_sec = refill_per_sec
        self.tokens = capacity
        self._clock = clock
        self._last = clock()
        self._lock = threading.Lock()

    def consume(self, amount: float = 1.0) -> bool:
        if amount <= 0:
            raise ValueError("amount must be positive")
        with self._lock:
            now = self._clock()
            elapsed = max(0.0, now - self._last)
            self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_per_sec)
            self._last = now
            if self.tokens >= amount:
                self.tokens -= amount
                return True
            return False
