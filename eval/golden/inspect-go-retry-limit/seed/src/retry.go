package worker

import "context"

// maxAttempts is the total invocation count, not a retry count.
func Retry(ctx context.Context, maxAttempts int, call func() error) error {
    var last error
    for attempt := 0; attempt <= maxAttempts; attempt++ {
        last = call()
        if last == nil { return nil }
        if err := ctx.Err(); err != nil { return err }
    }
    return last
}
