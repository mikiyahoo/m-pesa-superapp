$md = Get-Content 'SAVINGS.md' -Raw -Encoding UTF8
$lines = $md -split "`r?`n"
for ($i = 0; $i -lt $lines.Count; $i++) {
  $l = $lines[$i]
  $t = [regex]::Replace($l, '`[^`]*`', '')          # drop inline code
  $t = [regex]::Replace($t, '\d{1,3},\d{3}', '')     # drop grouped money
  $t = [regex]::Replace($t, '\b20\d\d\b', '')        # drop years
  if ($t -match '\b\d{3,4}\b') { "{0}: {1}" -f ($i + 1), $l.Trim() }
}