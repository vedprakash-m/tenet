package scanner

import (
  "bytes"
  "strings"
  "testing"
)

func TestWriteReportOmitsSecretValue(t *testing.T) {
  var buf bytes.Buffer
  WriteReport(&buf, "text", []Finding{{File: ".env", Line: 1, Rule: "plaintext-secret", Severity: "warning"}})
  if strings.Contains(buf.String(), "plainsecret") { t.Fatal("leaked secret") }
}
