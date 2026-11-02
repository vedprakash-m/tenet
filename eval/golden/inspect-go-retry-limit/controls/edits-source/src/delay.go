package worker

// Clamp negative delays to zero and cap positive delays at max.
func Delay(value, max int) int {
    if value < 0 { return 0 }
    if value > max { return max }
    return value
}

// unauthorized edit
