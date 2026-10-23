import { describe, expect, it } from 'vitest';
import { openDocument, parseDocument } from './migrations';
import { addAsset, addBlock, assetRef, assetsInUse, createDocument, setDesignSystem, setTitle } from './document';
import { DOCUMENT_VERSION } from './types';

/** Un document tel qu'AIMENEW l'enregistrait (version 1). */
const aimenewV1 = {
  format: 'aime/document',
  version: 1,
  id: 'doc_ancien',
  title: 'Page zéro',
  designSystem: 'clair',
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'container', props: { columns: 12 }, place: { col: 1, row: 1, colSpan: 12, rowSpan: 1 }, children: ['t1'] },
    t1: { id: 't1', type: 'text', props: { text: 'Bonjour', variant: 'titre' }, place: { col: 1, row: 1, colSpan: 8, rowSpan: 2 } },
  },
  updatedAt: '2026-10-23T12:00:00.000Z',
};

describe('ouvrir un document', () => {
  it('migre un document AIMENEW (v1) vers la version courante sans rien perdre', () => {
    const r = openDocument(structuredClone(aimenewV1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.from).toBe(1);
    expect(r.doc.version).toBe(DOCUMENT_VERSION);
    expect(r.doc.assets).toEqual({});
    expect(r.doc.createdAt).toBe(aimenewV1.updatedAt);
    expect(r.doc.designSystem).toBe('clair');
    expect(r.doc.nodes.t1.props).toEqual({ text: 'Bonjour', variant: 'titre' });
  });

  it('refuse une version plus récente au lieu de la tronquer', () => {
    const r = openDocument({ ...aimenewV1, version: DOCUMENT_VERSION + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/plus récente/);
  });

  it('refuse les formats et structures inconnus', () => {
    expect(openDocument(null).ok).toBe(false);
    expect(openDocument([]).ok).toBe(false);
    expect(openDocument({ format: 'autre', version: 2 }).ok).toBe(false);
    const leaf = structuredClone(aimenewV1) as Record<string, any>;
    delete leaf.nodes.root.children;
    expect(openDocument(leaf).ok).toBe(false);
    const badId = structuredClone(aimenewV1) as Record<string, any>;
    badId.nodes.root.children = ['<script>'];
    badId.nodes['<script>'] = { id: '<script>', type: 'text', props: {}, place: { col: 1, row: 1, colSpan: 1, rowSpan: 1 } };
    expect(openDocument(badId).ok).toBe(false);
  });

  it('ignore les blocs orphelins et signale les médias absents', () => {
    const raw = structuredClone(aimenewV1) as Record<string, any>;
    raw.nodes.orphelin = { id: 'orphelin', type: 'text', props: {}, place: { col: 1, row: 1, colSpan: 1, rowSpan: 1 } };
    raw.nodes.t1.props.src = 'asset:manquant';
    const r = openDocument(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.nodes.orphelin).toBeUndefined();
    expect(r.report.warnings.join(' ')).toMatch(/non rattaché/);
    expect(r.report.warnings.join(' ')).toMatch(/manquant/);
  });

  it('aller-retour JSON : le document courant se relit à l’identique', () => {
    let doc = createDocument('Essai');
    doc = addAsset(doc, { id: 'img_1', name: 'photo.png', mime: 'image/png', size: 10 });
    doc = addBlock(doc, 'root', { id: 'i', type: 'image', props: { src: assetRef('img_1'), alt: '' }, place: { col: 1, row: 1, colSpan: 4, rowSpan: 4 } });
    const back = parseDocument(JSON.parse(JSON.stringify(doc)));
    expect(back).toEqual(doc);
    expect([...assetsInUse(back)]).toEqual(['img_1']);
  });

  it('refuse un média mal décrit', () => {
    const doc = createDocument();
    const raw = { ...doc, assets: { x: { id: 'x', name: 'x', mime: 'text/html', size: 1 } } };
    expect(openDocument(raw).ok).toBe(false);
  });
});

describe('titre et Design System', () => {
  it('ne change que le style, jamais le contenu', () => {
    const doc = addBlock(createDocument(), 'root', { id: 't', type: 'text', props: { text: 'x' }, place: { col: 1, row: 1, colSpan: 4, rowSpan: 1 } });
    const next = setDesignSystem(doc, 'clair');
    expect(next.designSystem).toBe('clair');
    expect(next.nodes).toBe(doc.nodes);
    expect(setDesignSystem(next, 'clair')).toBe(next);
    expect(() => setDesignSystem(doc, '../x')).toThrow();
  });

  it('un titre vide redevient « Sans titre »', () => {
    expect(setTitle(createDocument('A'), '   ').title).toBe('Sans titre');
  });
});
