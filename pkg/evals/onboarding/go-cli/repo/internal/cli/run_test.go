package cli

import (
  "bytes"
  "os"
  "path/filepath"
  "testing"
)

func TestRunDefaultWarningExitsOne(t *testing.T) {
  dir := t.TempDir()
  _ = os.WriteFile(filepath.Join(dir, ".env"), []byte("API_KEY=plainsecret123\n"), 0600)
  var out, err bytes.Buffer
  code := Run([]string{dir}, &out, &err)
  if code != 1 { t.Fatalf("expected exit 1 on warning finding, got %d", code) }
}

func TestRunUnknownFlagExitsTwo(t *testing.T) {
  var out, err bytes.Buffer
  if code := Run([]string{"--format=csv"}, &out, &err); code != 2 { t.Fatalf("got %d", code) }
}
