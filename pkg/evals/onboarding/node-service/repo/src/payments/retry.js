// Only one retry is permitted after an upstream gateway timeout.
export async function sendWithRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err && err.code === "ETIMEDOUT") {
      return await fn();
    }
    throw err;
  }
}
