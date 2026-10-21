'use strict';
/** A shared allowlist. Neither local preview nor staging exposes source/config files. */
const fs = require('node:fs/promises');
const path = require('node:path');
const PUBLIC_ROOT = new Set([
  'index.html', '404.html', 'robots.txt', 'sitemap.xml', 'site.webmanifest',
  'Background.mp4', 'studio-hero-inset-preview.png', 'favicon.ico', 'favicon.png',
  'favicon-32x32.png', 'favicon-48x48.png', 'favicon-192x192.png', 'favicon-google.png', 'apple-touch-icon.png'
]);
const ASSET_EXTENSIONS = new Set(['.js','.css','.png','.jpg','.jpeg','.webp','.avif','.svg','.ico','.glb','.mp4','.webm','.woff','.woff2']);
function isPublicRelativePath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath || /[\\\0%]/.test(relativePath)) return false;
  const parts = relativePath.split('/');
  if (parts.some(part => !part || part === '..' || part.startsWith('.') || /^(?:node_modules|docs|test|tests|evidence|tools|internal|private)$/i.test(part))) return false;
  if (PUBLIC_ROOT.has(relativePath)) return true;
  if (relativePath === 'assets/portfolio/manifest.json') return true;
  return parts[0] === 'assets' && ASSET_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase());
}
function isContained(root, full) {
  const relative = path.relative(root, full);
  return relative !== '' && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
}
async function resolvePublicPath(root, pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return null;
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (/[\\\0%]/.test(decoded) || decoded.split('/').some(p => p === '..' || p === '.')) return null;
  const relative = decoded === '/' ? 'index.html' : decoded.slice(1);
  if (!isPublicRelativePath(relative)) return null;
  try {
    const realRoot = await fs.realpath(root);
    const lexicalPath = path.resolve(realRoot, relative);
    if (!isContained(realRoot, lexicalPath)) return null;
    const realPath = await fs.realpath(lexicalPath);
    if (!isContained(realRoot, realPath) || !isPublicRelativePath(path.relative(realRoot, realPath).split(path.sep).join('/'))) return null;
    // Do not serve any symlink, even if its current target happens to be public.
    let cursor = realRoot;
    for (const part of relative.split('/')) {
      cursor = path.join(cursor, part);
      if ((await fs.lstat(cursor)).isSymbolicLink()) return null;
    }
    return (await fs.stat(realPath)).isFile() ? realPath : null;
  } catch { return null; }
}
module.exports = { PUBLIC_ROOT, isPublicRelativePath, resolvePublicPath, isContained };
