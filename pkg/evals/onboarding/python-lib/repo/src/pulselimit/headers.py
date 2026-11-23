import math

def retry_after_seconds(missing_tokens: float, refill_per_sec: float) -> int:
    if missing_tokens <= 0:
        return 0
    return math.ceil(missing_tokens / refill_per_sec)
