# Fixed read-only attribute protocol. Input paths are data, never commands.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
[Console]::OutputEncoding = $utf8
$inputStream = [Console]::OpenStandardInput()
$chunk = [byte[]]::new(8192)
$frame = [byte[]]::new(1048576)
$cursor = 0
$available = 0
try {
    while ($true) {
        $frameLength = 0
        while ($true) {
            if ($cursor -eq $available) {
                $available = $inputStream.Read($chunk, 0, $chunk.Length)
                $cursor = 0
                if ($available -eq 0) {
                    if ($frameLength -eq 0) { exit 0 }
                    exit 2
                }
            }
            $newline = [Array]::IndexOf($chunk, [byte]10, $cursor, ($available - $cursor))
            $end = if ($newline -ge 0) { $newline } else { $available }
            $count = $end - $cursor
            if ($count -gt ($frame.Length - $frameLength)) { exit 2 }
            [Array]::Copy($chunk, $cursor, $frame, $frameLength, $count)
            $frameLength += $count
            $cursor = $end
            if ($newline -ge 0) {
                $cursor++
                break
            }
        }
        $text = $utf8.GetString($frame, 0, $frameLength)
        $request = ConvertFrom-Json -InputObject $text
        $keys = @($request.PSObject.Properties.Name)
        if ($keys.Count -ne 2 -or $keys -notcontains 'id' -or $keys -notcontains 'paths') { exit 2 }
        if ($request.id -isnot [long] -and $request.id -isnot [int]) { exit 2 }
        if ($request.id -le 0 -or $request.id -gt 9007199254740991) { exit 2 }
        if ($request.paths -isnot [array] -or $request.paths.Count -lt 1 -or $request.paths.Count -gt 128) { exit 2 }
        $rows = @()
        foreach ($sourcePath in $request.paths) {
            if ($sourcePath -isnot [string] -or $sourcePath.Length -gt 32767 -or
                $sourcePath -notmatch '^[A-Za-z]:\\' -or $sourcePath.IndexOf([char]0) -ge 0) { exit 2 }
            try {
                $attributes = [IO.File]::GetAttributes($sourcePath)
                $rows += @{ ok = $true; reparsePoint = (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) }
            } catch {
                $rows += @{ ok = $false; reparsePoint = $true }
            }
        }
        $response = @{ id = $request.id; rows = @($rows) } | ConvertTo-Json -Depth 4 -Compress
        if ($utf8.GetByteCount($response) -gt 1048576) { exit 2 }
        [Console]::Out.WriteLine($response)
        [Console]::Out.Flush()
    }
} catch {
    exit 2
}
