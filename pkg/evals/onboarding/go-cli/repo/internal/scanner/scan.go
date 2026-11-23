package scanner

import (
  "encoding/json"
  "fmt"
  "io"
  "io/fs"
  "os"
  "path/filepath"
  "sort"
  "strings"
)

const MaxFileBytes = 1048576

func ScanDir(root string) ([]Finding, error) {
  var out []Finding
  err := filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
    if err != nil { return err }
    if d.IsDir() { if ShouldSkipDir(d.Name()) { return filepath.SkipDir }; return nil }
    info, err := d.Info(); if err != nil || info.Size() > MaxFileBytes { return nil }
    data, err := os.ReadFile(p); if err != nil { return err }
    rel := filepath.ToSlash(p)
    for i, line := range strings.Split(string(data), "\n") {
      if f := CheckLine(rel, i+1, line); f != nil { out = append(out, *f) }
    }
    return nil
  })
  sort.Slice(out, func(i, j int) bool { if out[i].File != out[j].File { return out[i].File < out[j].File }; return out[i].Line < out[j].Line })
  return out, err
}

func WriteReport(w io.Writer, format string, findings []Finding) {
  if format == "json" { _ = json.NewEncoder(w).Encode(findings); return }
  for _, f := range findings { fmt.Fprintf(w, "%s:%d [%s] %s\n", f.File, f.Line, f.Severity, f.Rule) }
}
