package scanner

import "strings"

type Finding struct {
  File string `json:"file"`
  Line int `json:"line"`
  Rule string `json:"rule"`
  Severity string `json:"severity"`
}

func ShouldSkipDir(name string) bool {
  return name == ".git" || name == "vendor" || name == "node_modules"
}

func CheckLine(file string, lineNo int, text string) *Finding {
  if strings.Contains(text, "API_KEY=") || strings.Contains(text, "SECRET=") {
    return &Finding{File: file, Line: lineNo, Rule: "plaintext-secret", Severity: "warning"}
  }
  return nil
}
