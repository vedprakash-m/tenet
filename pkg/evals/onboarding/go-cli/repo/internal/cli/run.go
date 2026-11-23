package cli

import (
  "fmt"
  "io"
  "example.com/envseal/internal/scanner"
)

func Run(args []string, out io.Writer, errOut io.Writer) int {
  format := "text"
  strict := false
  root := "."
  for _, a := range args {
    if a == "--format=json" { format = "json" } else if a == "--format=text" { format = "text" } else if a == "--strict" { strict = true } else if a == "--help" { fmt.Fprintln(out, "usage: envseal [--format=text|json] [--strict] [path]"); return 0 } else if len(a) > 0 && a[0] == '-' { fmt.Fprintf(errOut, "unknown flag: %s\n", a); return 2 } else { root = a }
  }
  findings, err := scanner.ScanDir(root)
  if err != nil { fmt.Fprintln(errOut, err); return 2 }
  scanner.WriteReport(out, format, findings)
  if len(findings) > 0 || strict { return 1 }
  return 0
}
