# Fixed read-only attribute protocol. Input paths are data, never commands.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
try {
    while ($true) {
        $line = New-Object System.Text.StringBuilder
        while ($true) {
            $unit = [Console]::In.Read()
            if ($unit -eq -1) {
                if ($line.Length -eq 0) { exit 0 }
                exit 2
            }
            if ($unit -eq 10) { break }
            if ($line.Length -ge 1048576) { exit 2 }
            [void]$line.Append([char]$unit)
        }
        $text = $line.ToString()
        if ($utf8.GetByteCount($text) -gt 1048576) { exit 2 }
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
