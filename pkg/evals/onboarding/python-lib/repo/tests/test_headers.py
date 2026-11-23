from pulselimit import retry_after_seconds

def test_retry_after_rounds_up():
    assert retry_after_seconds(1.2, 1.0) == 2
    assert retry_after_seconds(0, 1.0) == 0
