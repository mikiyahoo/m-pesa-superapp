$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$path = (Resolve-Path 'SAVINGS.md').Path
$md = [System.IO.File]::ReadAllText($path, $utf8)

# R1: `name` (NNNN)  /  `name()` (NNNN)  ->  `name`
$md = [regex]::Replace($md, '(`[^`]+`)\s*\(\d{3,4}\)', '$1')
# R2: `name` (NNNN, ...  ->  `name` (
$md = [regex]::Replace($md, '(`[^`]+`)\s*\(\d{3,4},', '$1 (')
# R3: `name` NNNN  (bare, no parens)  ->  `name`
$md = [regex]::Replace($md, '(`[^`]+`)[ \t]+(\d{3,4})(?![\d])', '$1')
# R7: `name`, NNNN  ->  `name`
$md = [regex]::Replace($md, '(`[^`]+`),\s*(\d{3,4})(?![\d])', '$1')
# R4: (NNNN<endash>NNNN)  ->  (removed)
$md = [regex]::Replace($md, '\(\d{3,4}\u2013\d{3,4}\)', '')
# R5: bare NNNN<endash>NNNN  ->  (removed)
$md = [regex]::Replace($md, '\d{3,4}\u2013\d{3,4}', '')
# R6: trailing code-comment line numbers
$md = [regex]::Replace($md, '(?m)[ \t]*//\s*\d{3,4}[ \t]*\r?$', '')

[System.IO.File]::WriteAllText($path, $md, $utf8)
'stripped.'
