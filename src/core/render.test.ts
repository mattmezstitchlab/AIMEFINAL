import { describe, expect, it } from 'vitest';
import '../blocks';
import example from '../../examples/premiere-page.aime.json';
import { openDocument } from './migrations';
import { renderDocument, safeMediaSrc } from './render';
import { addAsset, addBlock, assetRef, createDocument } from './document';
import { exportHtml } from '../app/export';

describe('exemple de document', () => {
  it('l’exemple du dépôt est un document valide, sans avertissement', () => {
    const r = openDocument(example);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.report.warnings).toEqual([]);
  });
});

describe('rendu', () => {
  it('rend les grilles imbriquées et les blocs dans l’ordre de lecture', () => {
    const r = openDocument(example);
    if (!r.ok) throw new Error(r.reason);
    const surface = renderDocument(r.doc, { mode: 'view' });
    expect(surface.querySelectorAll('.aime-grid')).toHaveLength(2);
    expect([...surface.querySelectorAll('.aime-cell[data-type="text"]')].map((e) => e.textContent)).toEqual([
      'AIME FINAL — exemple',
      'Une grille. Des blocs. Une source de vérité.',
      'Ce fichier montre le contrat de document : des blocs à plat, des grilles qui listent leurs enfants, un Design System à part.',
      '01 — Le document',
      '02 — La grille',
      '03 — Les blocs',
    ]);
    expect(surface.querySelector('[contenteditable]')).toBeNull();
    expect(surface.querySelector('[data-handle]')).toBeNull();
  });

  it('un type de bloc inconnu ne casse pas la page', () => {
    const doc = addBlock(createDocument(), 'root', { id: 'x', type: 'carte-du-futur', props: { a: 1 }, place: { col: 1, row: 1, colSpan: 4, rowSpan: 1 } });
    const surface = renderDocument(doc, { mode: 'edit' });
    expect(surface.textContent).toContain('carte-du-futur');
  });

  it('n’affiche que des sources d’image sûres', () => {
    expect(safeMediaSrc('https://exemple.fr/a.png')).toBe('https://exemple.fr/a.png');
    expect(safeMediaSrc('http://exemple.fr/a.png')).toBeNull();
    expect(safeMediaSrc('javascript:alert(1)')).toBeNull();
    expect(safeMediaSrc('data:text/html,<b>')).toBeNull();
    expect(safeMediaSrc('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(safeMediaSrc('asset:img_1', (id) => (id === 'img_1' ? 'blob:x' : undefined))).toBe('blob:x');
    expect(safeMediaSrc('asset:inconnu', () => undefined)).toBeNull();
  });
});

describe('export HTML', () => {
  it('produit une page autonome : sans script, image intégrée, texte échappé', async () => {
    let doc = createDocument('<Titre & co>');
    doc = addAsset(doc, { id: 'img_1', name: 'a.png', mime: 'image/png', size: 3 });
    doc = addBlock(doc, 'root', { id: 't', type: 'text', props: { text: '<script>alert(1)</script>', variant: 'titre' }, place: { col: 1, row: 1, colSpan: 6, rowSpan: 1 } });
    doc = addBlock(doc, 'root', { id: 'i', type: 'image', props: { src: assetRef('img_1'), alt: 'a "b"' }, place: { col: 7, row: 1, colSpan: 6, rowSpan: 4 } });
    const html = await exportHtml(doc, async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('<title>&lt;Titre &amp; co&gt;</title>');
    expect(html).toContain('src="data:image/png;base64,AQID"');
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain('container-type: inline-size');
  });
});
