import type { AimeDocument } from '../core/types';
import { renderDocument } from '../core/render';
import { assetsInUse } from '../core/document';
import { toDataUrl } from '../store/package';
import tokensCss from '../styles/tokens.css?inline';
import gridCss from '../styles/grid.css?inline';
import blocksCss from '../styles/blocks.css?inline';

/**
 * Le même document, rendu en une page HTML autonome : aucun script, aucune dépendance,
 * images intégrées. La mise en page s'adapte à l'écran (container queries).
 * Repris d'AIMENEW (app/export.ts) ; ajout des médias stockés et d'une politique de sécurité stricte.
 */
export async function exportHtml(doc: AimeDocument, getAsset: (id: string) => Promise<Blob | undefined>): Promise<{ html: string; missing: number }> {
  const dataUrls = new Map<string, string>();
  let missing = 0;
  for (const id of assetsInUse(doc)) {
    const ref = doc.assets[id];
    const blob = ref ? await getAsset(id) : undefined;
    if (ref && blob) dataUrls.set(id, await toDataUrl(blob, ref.mime));
    else missing++;
  }
  const surface = renderDocument(doc, { mode: 'view', resolveAsset: (id) => dataUrls.get(id) });
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="generator" content="AIME FINAL">
<title>${escapeHtml(doc.title)}</title>
<style>
${tokensCss}
${gridCss}
${blocksCss}
html, body { margin: 0; min-height: 100%; }
</style>
</head>
<body data-ds="${escapeHtml(doc.designSystem)}">
<main>
${surface.outerHTML}
</main>
</body>
</html>
`;
  return { html, missing };
}

export function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'page'
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
