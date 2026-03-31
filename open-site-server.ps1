$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://127.0.0.1:4173/')
$listener.Start()
$root = $PSScriptRoot
$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.svg' = 'image/svg+xml'
  '.ico' = 'image/x-icon'
  '.webmanifest' = 'application/manifest+json'
  '.glb' = 'model/gltf-binary'
}
while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $requestPath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
    if ([string]::IsNullOrWhiteSpace($requestPath) -or $requestPath -eq '/') {
      $requestPath = '/index.html'
    }
    $relativePath = $requestPath.TrimStart('/' ) -replace '/', '\'
    $filePath = Join-Path $root $relativePath
    if (Test-Path $filePath -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
      if ($mime.ContainsKey($extension)) {
        $context.Response.ContentType = $mime[$extension]
      }
      $context.Response.StatusCode = 200
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } elseif (-not [System.IO.Path]::GetExtension($requestPath)) {
      $fallbackPath = Join-Path $root 'index.html'
      $bytes = [System.IO.File]::ReadAllBytes($fallbackPath)
      $context.Response.ContentType = $mime['.html']
      $context.Response.StatusCode = 200
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      $context.Response.StatusCode = 404
      $context.Response.ContentType = 'text/plain; charset=utf-8'
      $context.Response.ContentLength64 = $body.Length
      $context.Response.OutputStream.Write($body, 0, $body.Length)
    }
    $context.Response.OutputStream.Close()
  } catch {
  }
}