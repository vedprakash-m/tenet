import pytest
from pulselimit import TokenBucket

def test_rejects_non_positive_capacity():
    with pytest.raises(ValueError):
        TokenBucket(0, 1.0)

def test_uses_monotonic_clock_not_wall_clock():
    bucket = TokenBucket(2, 1.0)
    assert bucket._clock.__name__ == "now_monotonic"

def test_consume_respects_capacity():
    t = [10.0]
    bucket = TokenBucket(2, 1.0, clock=lambda: t[0])
    assert bucket.consume(2) is True
    assert bucket.consume(1) is False
