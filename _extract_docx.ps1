Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Web

$docxPath = 'c:\Users\AD\Downloads\LineWatch_GiaoViec_SuaCode_Thang.docx'
$outPath = 'c:\Users\AD\Downloads\New folder (2)\_docx_content.txt'

$zip = [System.IO.Compression.ZipFile]::OpenRead($docxPath)
$entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' }
$reader = New-Object System.IO.StreamReader($entry.Open())
$xml = $reader.ReadToEnd()
$reader.Close()
$zip.Dispose()

# Insert newlines for paragraph and break markers before stripping tags
$xml = $xml -replace '</w:p>', "`n"
$xml = $xml -replace '<w:br[^>]*/>', "`n"
$xml = $xml -replace '<w:tab[^>]*/>', "`t"
$text = $xml -replace '<[^>]+>', ''
$text = [System.Web.HttpUtility]::HtmlDecode($text)

$text | Out-File -FilePath $outPath -Encoding UTF8
Write-Output "Wrote $outPath"
