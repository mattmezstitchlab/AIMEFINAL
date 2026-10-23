// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openLocalStore } from './local';
import { exportPackage, importPackage } from './package';
import { acceptImage } from './media';
import { addAsset, addBlock, assetRef, createDocument, updateProps } from '../core/document';
import { devicePolicy } from '../access/contract';

let n = 0;
const freshStore = () => openLocalStore(`test-${++n}`);
const png = () => new Blob([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], { type: 'image/png' });

describe('stockage local (IndexedDB)', () => {
  it('est vide au premier lancement, puis retrouve le document après « rechargement »', async () => {
    const store = await freshStore();
    expect((await store.loadCurrent()).kind).toBe('empty');
    const doc = createDocument('Ma page');
    const saved = await store.save(doc, 0);
    expect(saved).toMatchObject({ ok: true, rev: 1 });
    store.close();

    const again = await openLocalStore(`test-${n}`);
    const loaded = await again.loadCurrent();
    expect(loaded.kind).toBe('ok');
    if (loaded.kind === 'ok') {
      expect(loaded.record.doc).toEqual(doc);
      expect(loaded.record.rev).toBe(1);
    }
  });

  it('n’écrase jamais en silence une version enregistrée par un autre onglet', async () => {
    const store = await freshStore();
    const doc = createDocument();
    await store.save(doc, 0); // rev 1
    const otherTab = updateProps(doc, 'root', { padding: 10 });
    expect(await store.save(otherTab, 1)).toMatchObject({ ok: true, rev: 2 });
    const mine = updateProps(doc, 'root', { padding: 99 });
    const result = await store.save(mine, 1);
    expect(result.ok).toBe(false);
    if (!result.ok && 'conflict' in result) expect(result.conflict.doc.nodes.root.props.padding).toBe(10);
    else throw new Error('conflit attendu');
  });

  it('met de côté un enregistrement abîmé au lieu de l’afficher ou de l’écraser', async () => {
    const store = await freshStore();
    const doc = createDocument();
    await store.save({ ...doc, root: 'absent' } as typeof doc, 0);
    const loaded = await store.loadCurrent();
    expect(loaded.kind).toBe('damaged');
    expect((await store.loadCurrent()).kind).toBe('empty');
  });

  it('garde les médias en fichiers et des versions de secours', async () => {
    const store = await freshStore();
    await store.putAsset('img_a', png());
    expect((await store.getAsset('img_a'))?.size).toBe(7);
    const doc = createDocument('Avant');
    const snap = await store.snapshot(doc, 'Avant import');
    expect((await store.listSnapshots())[0]).toMatchObject({ id: snap.id, label: 'Avant import', title: 'Avant' });
    expect(await store.readSnapshot(snap.id)).toEqual(doc);
  });
});

describe('fichier projet portable', () => {
  it('exporter puis importer redonne le même document, image comprise', async () => {
    let doc = createDocument('Portable');
    doc = addAsset(doc, { id: 'img_a', name: 'a.png', mime: 'image/png', size: 7 });
    doc = addBlock(doc, 'root', { id: 'i', type: 'image', props: { src: assetRef('img_a'), alt: 'a' }, place: { col: 1, row: 1, colSpan: 4, rowSpan: 4 } });
    const text = await exportPackage(doc, async () => png());
    const back = importPackage(text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.doc).toEqual(doc);
    expect(new Uint8Array(await back.blobs.get('img_a')!.arrayBuffer())).toEqual(new Uint8Array(await png().arrayBuffer()));
  });

  it('refuse d’exporter si une image manque, et explique pourquoi', async () => {
    let doc = createDocument();
    doc = addAsset(doc, { id: 'img_a', name: 'a.png', mime: 'image/png', size: 7 });
    doc = addBlock(doc, 'root', { id: 'i', type: 'image', props: { src: assetRef('img_a') }, place: { col: 1, row: 1, colSpan: 4, rowSpan: 4 } });
    await expect(exportPackage(doc, async () => undefined)).rejects.toThrow(/introuvable/);
  });

  it('accepte un document seul et refuse un fichier illisible', () => {
    const doc = createDocument();
    expect(importPackage(JSON.stringify(doc)).ok).toBe(true);
    expect(importPackage('{pas du json').ok).toBe(false);
    expect(importPackage(JSON.stringify({ format: 'aime/package', version: 9 })).ok).toBe(false);
  });
});

describe('médias et accès', () => {
  it('n’accepte que des images raisonnables', () => {
    expect(acceptImage({ name: 'a.png', type: 'image/png', size: 100 }).ok).toBe(true);
    expect(acceptImage({ name: 'a.svg', type: 'image/svg+xml', size: 100 }).ok).toBe(false);
    expect(acceptImage({ name: 'a.png', type: 'image/png', size: 99e6 }).ok).toBe(false);
  });

  it('Phase 1 : l’appareil lit et édite, la publication en ligne est refusée honnêtement', async () => {
    expect((await devicePolicy.can({ kind: 'device' }, 'edit', 'd')).allow).toBe(true);
    expect((await devicePolicy.can({ kind: 'device' }, 'publish', 'd')).allow).toBe(false);
    expect((await devicePolicy.can({ kind: 'user', id: 'u' }, 'read', 'd')).allow).toBe(false);
  });
});
