Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Web

$docxPath = 'c:\Users\AD\Downloads\LineWatch_BanGiao_Code_Nhom_CapNhat_MVP\sources\LineWatch_PhanCong_23Khung_QuyUocDuLieu_HuongDanGhep.docx'
$outPath = 'c:\Users\AD\Downloads\New folder (2)\_contract_content.txt'

$zip = [System.IO.Compression.ZipFile]::OpenRead($docxPath)
$entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' }
$reader = New-Object System.IO.StreamReader($entry.Open())
$xml = $reader.ReadToEnd()
$reader.Close()
$zip.Dispose()

$xml = $xml -replace '</w:p>', "`n"
$xml = $xml -replace '<w:br[^>]*/>', "`n"
$xml = $xml -replace '<w:tab[^>]*/>', "`t"
$text = $xml -replace '<[^>]+>', ''
$text = [System.Web.HttpUtility]::HtmlDecode($text)

$text | Out-File -FilePath $outPath -Encoding UTF8
Write-Output "Wrote $outPath"
