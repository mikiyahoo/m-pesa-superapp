$md = Get-Content 'SAVINGS.md' -Raw -Encoding UTF8
$lines = $md -split "`r?`n"

$pats = @{
  'paren-space  ' = '\(\s+[`A-Za-z]'
  'space-paren  ' = '[`A-Za-z0-9] \)'
  'empty-cell   ' = '\|\s*\|\s*\|'
  'colon-orphan ' = '[A-Za-z] :'
  'dash-orphan  ' = '[A-Za-z,] —[ ]*$'
  'dash-line    ' = '^\*\*.*\*\* —[ ]*$'
  'paren3dig    ' = '\(\d{3}\)'
  'num-pair     ' = '\d{3,4}\s*/\s*\d{3,4}'
  'dbl-space    ' = '\S  +\S'
  'paren-comma  ' = '\(\s*,|,\s*\)'
}
foreach ($k in $pats.Keys) {
  "### $k"
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pats[$k]) { "  {0}: {1}" -f ($i + 1), $lines[$i].Trim() }
  }
}
