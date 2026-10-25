// pad(n, width): n as text, left-padded with zeros to at least `width` digits.
export function pad(n, width) {
  return String(n).padStart(width, "0");
}
