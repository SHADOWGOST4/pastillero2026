# Genera la versión final del manual: .docx y PDF paginados por Word, en docs/manual-usuario/.
#   .\generar.ps1            → docx y PDF
#   .\generar.ps1 -Revisar   → además, cada página como imagen en paginas/ para revisarla
param(
  [switch]$Revisar,
  [int]$TiempoMaxWord = 180
)
$ErrorActionPreference = 'Stop'
$G = $PSScriptRoot
$Destino = Split-Path $G
$nombre = 'Manual_de_Usuario_Pillbox_v2'
# Word trabaja fuera de OneDrive: abrir con escritura dentro de la carpeta sincronizada puede dejarlo colgado.
$tmp = Join-Path $env:TEMP 'manual_pillbox'
New-Item -ItemType Directory -Force $tmp | Out-Null
$reloj = [Diagnostics.Stopwatch]::StartNew()
function Paso($texto) { '{0,5:N1}s  {1}' -f $reloj.Elapsed.TotalSeconds, $texto }

# Un Word sin ventana es uno que dejó colgado una ejecución anterior: bloquea archivos y hace esperar a esta.
$ocultos = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -eq 0 })
if ($ocultos) { $ocultos | Stop-Process -Force; Paso "cerrados $($ocultos.Count) Word ocultos de antes" }

Push-Location $G
try {
  node build.js --usos; if ($LASTEXITCODE) { throw 'build.js --usos falló' }
  python -I optimizar_img.py; if ($LASTEXITCODE) { throw 'optimizar_img.py falló' }
  node build.js "$tmp\v2_raw.docx"; if ($LASTEXITCODE) { throw 'build.js falló' }
} finally { Pop-Location }
Paso 'docx armado'

# Word va en un proceso aparte con tiempo máximo: si se cuelga en un aviso oculto, se cierra en vez de esperar sin fin.
$antes = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object Id)
$trabajo = Start-Job -ArgumentList $tmp, $nombre {
  param($tmp, $nombre)
  $ErrorActionPreference = 'Stop'
  $w = New-Object -ComObject Word.Application
  $w.Visible = $false; $w.DisplayAlerts = 0
  try {
    $doc = $w.Documents.Open("$tmp\v2_raw.docx", $false, $false, $false)
    foreach ($t in $doc.TablesOfContents) { $t.Update() }
    foreach ($t in $doc.TablesOfFigures) { $t.Update() }
    # La tabla de figuras empuja las páginas: el índice solo necesita renovar sus números.
    foreach ($t in $doc.TablesOfContents) { $t.UpdatePageNumbers() }
    # Los "Detalles en la página X" de Primeros pasos. Los PAGEREF del índice (_Toc…) ya están al día.
    foreach ($f in $doc.Fields) { if ($f.Type -eq 37 -and $f.Code.Text -notmatch '_Toc') { $f.Update() | Out-Null } }
    $doc.EmbedTrueTypeFonts = $true; $doc.SaveSubsetFonts = $false; $doc.DoNotEmbedSystemFonts = $true
    $doc.SaveAs2("$tmp\$nombre.docx", 16)
    $doc.ExportAsFixedFormat("$tmp\$nombre.pdf", 17)
    $doc.Close($false)
  } finally { $w.Quit() }
}
if (-not (Wait-Job $trabajo -Timeout $TiempoMaxWord)) {
  Stop-Job $trabajo
  Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $antes -notcontains $_.Id } | Stop-Process -Force
  throw "Word no terminó en $TiempoMaxWord s y se cerró. Vuelve a ejecutar; si se repite, abre $tmp\v2_raw.docx en Word para ver el aviso."
}
Receive-Job $trabajo
$fallo = if ($trabajo.State -eq 'Failed') { $trabajo.ChildJobs[0].JobStateInfo.Reason.Message }
Remove-Job $trabajo -Force
if ($fallo) { throw "Word falló: $fallo" }
Paso 'Word: índice, figuras, docx y PDF'

python -I "$G\limpiar_fuentes.py" "$tmp\$nombre.docx"; if ($LASTEXITCODE) { throw 'limpiar_fuentes.py falló' }
Copy-Item "$tmp\$nombre.docx", "$tmp\$nombre.pdf" $Destino -Force
Paso 'copiado a docs/manual-usuario'

# Número de páginas y, con -Revisar, cada página como PNG (lector de PDF de Windows).
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$metodos = [System.WindowsRuntimeSystemExtensions].GetMethods()
$asTask = ($metodos | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
$asTaskA = ($metodos | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
function Esperar($op, [Type]$tipo) { $t = $asTask.MakeGenericMethod($tipo).Invoke($null, @($op)); $t.Wait(); $t.Result }
$archivo = Esperar ([Windows.Storage.StorageFile]::GetFileFromPathAsync("$tmp\$nombre.pdf")) ([Windows.Storage.StorageFile])
$pdf = Esperar ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($archivo)) ([Windows.Data.Pdf.PdfDocument])
if ($Revisar) {
  $carpeta = Join-Path $G 'paginas'
  New-Item -ItemType Directory -Force $carpeta | Out-Null
  Remove-Item "$carpeta\*" -ErrorAction SilentlyContinue
  for ($i = 0; $i -lt $pdf.PageCount; $i++) {
    $pagina = $pdf.GetPage($i)
    $flujo = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    $opciones = New-Object Windows.Data.Pdf.PdfPageRenderOptions; $opciones.DestinationWidth = 850
    $t = $asTaskA.Invoke($null, @($pagina.RenderToStreamAsync($flujo, $opciones))); $t.Wait()
    $entrada = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($flujo.GetInputStreamAt(0))
    $salida = [System.IO.File]::Create(('{0}\p{1:D2}.png' -f $carpeta, ($i + 1))); $entrada.CopyTo($salida); $salida.Close(); $pagina.Dispose()
  }
  Paso "páginas renderizadas en paginas\"
}
Paso "listo: $($pdf.PageCount) páginas"
$pdf = $null
exit 0
