/**
 * LE CONTRAT D'ACCEPTATION DE LA PHASE 1 — les 14 étapes du parcours de création, de bout en bout,
 * dans un vrai navigateur. Si une étape échoue, la Phase 1 n'est pas livrée.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const IMAGE = fileURLToPath(new URL('./fixtures/paysage.png', import.meta.url));

const cell = (page: Page, type: string, nth = 0): Locator => page.locator(`.aime-stage .aime-cell[data-type="${type}"]`).nth(nth);
const placeOf = (loc: Locator) =>
  loc.evaluate((el) => ({ c: Number(el.style.getPropertyValue('--c')), cs: Number(el.style.getPropertyValue('--cs')), r: Number(el.style.getPropertyValue('--r')), rs: Number(el.style.getPropertyValue('--rs')) }));

async function typeInto(page: Page, editable: Locator, text: string): Promise<void> {
  await editable.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(text);
}

async function drag(page: Page, handle: Locator, dx: number, dy: number): Promise<void> {
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  await page.mouse.up();
}

async function seriousA11y(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.length}`);
}

test('Phase 1 — créer, éditer, enregistrer, retrouver, prévisualiser et exporter une page', async ({ page, context }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await test.step('1. L’utilisateur arrive sur AIME FINAL', async () => {
    await page.goto('/');
    await expect(page.getByRole('dialog', { name: 'Créer une page' })).toBeVisible();
    await expect(page.getByText('sur cet appareil, dans ce navigateur uniquement')).toBeVisible();
  });

  await test.step('2. Il crée une page à partir d’une grille vide', async () => {
    await page.getByRole('button', { name: 'Grille vide' }).click();
    await expect(page.getByRole('toolbar', { name: 'Outils de création' })).toBeVisible();
    await expect(page.locator('.aime-stage .aime-cell:not(.aime-cell--root)')).toHaveCount(0);
    await expect(page.getByTestId('save-status')).toHaveText(/Enregistré sur cet appareil/);
  });

  await test.step('3. Il ajoute un titre', async () => {
    await page.getByTestId('add-text').click();
    await expect(cell(page, 'text')).toHaveClass(/is-selected/);
    const bar = page.getByTestId('context-bar');
    await expect(bar).toBeVisible();
    await bar.getByRole('button', { name: 'Titre' }).click();
    await expect(cell(page, 'text').locator('h2.b-text--titre')).toBeVisible();
  });

  await test.step('4. Il modifie directement le texte', async () => {
    await typeInto(page, cell(page, 'text').locator('[contenteditable]'), 'Bonjour AIME');
    await expect(cell(page, 'text')).toHaveText('Bonjour AIME');
  });

  await test.step('5. Il ajoute une image depuis son appareil', async () => {
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('add-image').click();
    await (await chooser).setFiles(IMAGE);
    const img = cell(page, 'image').locator('img');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('src', /^blob:/);
    expect(await img.evaluate((el: HTMLImageElement) => el.decode().then(() => el.naturalWidth))).toBe(480);
    // La description sert aux lecteurs d'écran : on la renseigne depuis la barre du bloc.
    const alt = page.getByTestId('context-bar').getByRole('textbox', { name: 'Description' });
    await alt.fill('Un dégradé irisé');
    await alt.press('Enter');
    await expect(img).toHaveAttribute('alt', 'Un dégradé irisé');
  });

  await test.step('6. Il ajoute un second bloc de texte', async () => {
    await page.getByTestId('add-text').click();
    await expect(page.locator('.aime-stage .aime-cell[data-type="text"]')).toHaveCount(2);
    await typeInto(page, cell(page, 'text', 1).locator('[contenteditable]'), 'Une grille, des blocs, une source de vérité.');
    await expect(cell(page, 'text', 1)).toHaveText('Une grille, des blocs, une source de vérité.');
  });

  await test.step('7. Il déplace et redimensionne les blocs dans la grille', async () => {
    const grid = page.locator('.aime-stage .aime-grid').first();
    const colWidth = ((await grid.boundingBox())!.width + 20) / 12;

    // Image : à droite du titre (glisser la pastille).
    const image = cell(page, 'image');
    await image.click({ position: { x: 20, y: 20 } });
    const before = await placeOf(image);
    await drag(page, image.locator('[data-handle="move"]'), colWidth * 6, -((await image.boundingBox())!.y - (await cell(page, 'text').boundingBox())!.y));
    const moved = await placeOf(image);
    expect(moved.c).toBe(before.c + 6);
    await expect.poll(async () => (await placeOf(image)).c).toBe(before.c + 6);
    expect(moved.r).toBeLessThan(before.r);

    // Titre : plus étroit (glisser le coin).
    const title = cell(page, 'text');
    await title.click({ position: { x: 4, y: 4 } });
    const t0 = await placeOf(title);
    await drag(page, title.locator('[data-handle="resize"]'), -colWidth * 2, 0);
    const t1 = await placeOf(title);
    expect(t1.cs).toBe(t0.cs - 2);

    // Clavier : Maj + flèche agrandit d'une rangée, flèche déplace.
    await title.focus();
    await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(async () => (await placeOf(title)).rs).toBe(t1.rs + 1);

    // L'outil « Déplacer » : on attrape le bloc entier.
    await page.getByRole('button', { name: 'Déplacer', exact: true }).click();
    const second = cell(page, 'text', 1);
    const s0 = await placeOf(second);
    await drag(page, second, 0, 80);
    expect((await placeOf(second)).r).toBeGreaterThan(s0.r);
    await page.getByRole('button', { name: 'Sélectionner', exact: true }).click();
    await page.screenshot({ path: info.outputPath('07-composition.png') });
  });

  await test.step('8. Il change de Design System', async () => {
    const bg = () => page.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor);
    const dark = await bg();
    await page.getByTestId('appearance').click();
    await page.getByRole('button', { name: /Minimal Clair/ }).click();
    await expect(page.locator('body')).toHaveAttribute('data-ds', 'clair');
    expect(await bg()).not.toBe(dark);
    await expect(cell(page, 'text')).toHaveText('Bonjour AIME'); // le contenu ne bouge pas
  });

  await test.step('9. Il annule et rétablit une modification', async () => {
    await page.getByTestId('undo').click();
    await expect(page.locator('body')).toHaveAttribute('data-ds', 'iris');
    await page.getByTestId('redo').click();
    await expect(page.locator('body')).toHaveAttribute('data-ds', 'clair');
    // Au clavier aussi.
    await page.locator('.aime-stage').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.locator('body')).toHaveAttribute('data-ds', 'iris');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(page.locator('body')).toHaveAttribute('data-ds', 'clair');
  });

  const snapshot = async () => ({
    title: await cell(page, 'text').innerText(),
    second: await cell(page, 'text', 1).innerText(),
    image: await placeOf(cell(page, 'image')),
    titlePlace: await placeOf(cell(page, 'text')),
    alt: await cell(page, 'image').locator('img').getAttribute('alt'),
  });
  let saved: Awaited<ReturnType<typeof snapshot>>;

  await test.step('10. Il enregistre son travail', async () => {
    await page.getByTestId('save').click();
    await expect(page.getByRole('status').filter({ hasText: 'Enregistré sur cet appareil.' })).toBeVisible();
    await expect(page.getByTestId('save-status')).toHaveText(/Enregistré sur cet appareil · \d\d:\d\d/);
    saved = await snapshot();
  });

  await test.step('11. Il recharge la page et retrouve sa création', async () => {
    await page.reload();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('body')).toHaveAttribute('data-ds', 'clair');
    await expect(cell(page, 'image').locator('img')).toHaveAttribute('src', /^blob:/);
    expect(await cell(page, 'image').locator('img').evaluate((el: HTMLImageElement) => el.decode().then(() => el.naturalWidth))).toBe(480);
    expect(await snapshot()).toEqual(saved);
  });

  let phoneTitleSize = 0;
  await test.step('12. Il prévisualise le rendu sur ordinateur et téléphone', async () => {
    await page.getByTestId('preview').click();
    await expect(page.locator('.aime-surface.is-view')).toBeVisible();
    await expect(page.locator('[contenteditable], [data-handle]')).toHaveCount(0);
    await expect(page.getByTestId('preview-desktop')).toHaveAttribute('aria-pressed', 'true');
    const imgBox = (await cell(page, 'image').boundingBox())!;
    const titleBox = (await cell(page, 'text').boundingBox())!;
    expect(imgBox.x).toBeGreaterThan(titleBox.x + titleBox.width - 1); // côte à côte sur ordinateur
    await page.screenshot({ path: info.outputPath('12-apercu-ordinateur.png') });

    await page.getByTestId('preview-phone').click();
    const frame = page.locator('.aime-frame');
    expect((await frame.boundingBox())!.width).toBeLessThanOrEqual(390);
    const xs = await page.locator('.aime-stage .aime-cell:not(.aime-cell--root)').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(new Set(xs).size).toBe(1); // une seule colonne, dans l'ordre de lecture
    expect(await frame.evaluate((f) => f.scrollWidth <= f.clientWidth)).toBe(true);
    phoneTitleSize = await cell(page, 'text').locator('h2').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    await page.screenshot({ path: info.outputPath('12-apercu-telephone.png') });
    await page.getByTestId('preview-exit').click();
    await expect(page.getByRole('toolbar', { name: 'Outils de création' })).toBeVisible();
  });

  let exported = '';
  await test.step('13. Il exporte une page HTML autonome', async () => {
    await page.getByTestId('export').click();
    const download = page.waitForEvent('download');
    await page.getByTestId('export-html').click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('nouvelle-page.html');
    exported = info.outputPath('export.html');
    await file.saveAs(exported);
    const html = readFileSync(exported, 'utf8');
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('Bonjour AIME');
    expect(html).toContain('data:image/png;base64,');
    expect(html).not.toContain('blob:');
    await expect(page.getByRole('status').filter({ hasText: 'n’est pas en ligne' })).toBeVisible();
  });

  await test.step('14. Il ouvre la page HTML et retrouve son contenu et sa mise en page adaptée', async () => {
    const viewer = await context.newPage();
    await viewer.goto(pathToFileURL(exported).href);
    await expect(viewer.getByText('Bonjour AIME')).toBeVisible();
    await expect(viewer.getByText('Une grille, des blocs, une source de vérité.')).toBeVisible();
    await expect(viewer.locator('body')).toHaveAttribute('data-ds', 'clair');
    const img = viewer.getByRole('img', { name: 'Un dégradé irisé' });
    expect(await img.evaluate((el: HTMLImageElement) => el.decode().then(() => el.naturalWidth))).toBe(480);
    // Ordinateur : même placement que dans l'éditeur.
    const ib = (await viewer.locator('.aime-cell[data-type="image"]').boundingBox())!;
    const tb = (await viewer.locator('.aime-cell[data-type="text"]').first().boundingBox())!;
    expect(ib.x).toBeGreaterThan(tb.x + tb.width - 1);
    expect(await viewer.locator('.aime-cell[data-type="image"]').evaluate((e) => getComputedStyle(e).gridColumnStart)).toBe(String(saved.image.c));
    await viewer.screenshot({ path: info.outputPath('14-export-ordinateur.png'), fullPage: true });
    // Téléphone : une colonne, sans défilement horizontal.
    await viewer.setViewportSize({ width: 390, height: 844 });
    const xs = await viewer.locator('.aime-cell:not(.aime-cell--root)').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(new Set(xs).size).toBe(1);
    expect(await viewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(img).toBeVisible();
    // Fidélité : l'aperçu téléphone de l'éditeur annonce la même typographie que la page réelle.
    const realSize = await viewer.locator('h2').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(Math.abs(realSize - phoneTitleSize)).toBeLessThanOrEqual(2);
    await viewer.screenshot({ path: info.outputPath('14-export-telephone.png'), fullPage: true });
    expect(await seriousA11y(viewer)).toEqual([]);
    await viewer.close();
  });

  await test.step('Accessibilité de l’éditeur (axe, WCAG AA)', async () => {
    expect(await seriousA11y(page, '.aime-dock-wrap')).toEqual([]);
    expect(await seriousA11y(page, '.aime-header')).toEqual([]);
  });

  expect(errors).toEqual([]);
});

test('Téléphone : la barre reste utilisable et la page ne déborde pas', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Partir du modèle minimal' }).click();
  await expect(page.locator('.aime-stage .aime-cell[data-type="text"]')).toHaveCount(3);
  const dock = page.getByRole('toolbar', { name: 'Outils de création' });
  expect((await dock.boundingBox())!.width).toBeLessThanOrEqual(390);
  // Chaque outil est visible sans faire défiler la barre.
  for (const b of await dock.getByRole('button').all()) {
    const box = (await b.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByTestId('add-text').tap();
  await expect(page.locator('.aime-stage .aime-cell[data-type="text"]')).toHaveCount(4);
  // Bloc choisi, poignées visibles : toujours aucun débordement horizontal.
  await expect(page.locator('.aime-cell.is-selected [data-handle="move"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('telephone.png') });
  await ctx.close();
});

test('Aucun écrasement silencieux : un autre onglet a enregistré entre-temps', async ({ context }) => {
  const a = await context.newPage();
  await a.goto('/');
  await a.getByRole('button', { name: 'Grille vide' }).click();
  await expect(a.getByTestId('save-status')).toHaveText(/Enregistré/);
  const b = await context.newPage();
  await b.goto('/');
  await expect(b.getByTestId('save-status')).toHaveText(/Enregistré/);

  await b.getByTestId('add-text').click();
  await expect(b.getByTestId('save-status')).toHaveText(/Enregistré/);
  await a.getByTestId('add-grid').click();
  await expect(a.getByTestId('conflict')).toBeVisible();
  await expect(a.getByTestId('save-status')).toHaveText(/conflit/);
  // Reprendre l'autre version : on retrouve le texte ajouté dans l'onglet B.
  await a.getByRole('button', { name: 'Reprendre l’autre version' }).click();
  await expect(a.locator('.aime-stage .aime-cell[data-type="text"]')).toHaveCount(1);
  await expect(a.getByTestId('conflict')).toBeHidden();
});

test('Import validé : un fichier abîmé est refusé, un projet exporté se réimporte à l’identique', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Partir du modèle minimal' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('add-image').click();
  await (await chooser).setFiles(IMAGE);
  await expect(page.locator('.aime-stage img')).toBeVisible();

  await page.getByTestId('export').click();
  const dl = page.waitForEvent('download');
  await page.getByTestId('export-json').click();
  const file = info.outputPath('projet.aime.json');
  await (await dl).saveAs(file);
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  expect(pkg.format).toBe('aime/package');
  expect(Object.keys(pkg.assets)).toHaveLength(1);

  // Fichier abîmé : refusé, rien ne change.
  await page.getByTestId('import-input').setInputFiles({ name: 'casse.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"aime/document","version":99}') });
  await expect(page.getByRole('status').filter({ hasText: 'version plus récente' })).toBeVisible();
  await expect(page.locator('.aime-stage .aime-cell[data-type="text"]')).toHaveCount(3);

  // Nouvelle page vide, puis réimport du projet exporté.
  await page.getByTestId('export').click();
  await page.getByTestId('new-page').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Grille vide' }).click();
  await expect(page.locator('.aime-stage .aime-cell:not(.aime-cell--root)')).toHaveCount(0);
  // (tampon plutôt que chemin : le dossier de sortie contient une apostrophe typographique)
  await page.getByTestId('import-input').setInputFiles({ name: 'projet.aime.json', mimeType: 'application/json', buffer: readFileSync(file) });
  await page.getByRole('dialog').getByRole('button', { name: 'Importer' }).click();
  await expect(page.locator('.aime-stage .aime-cell[data-type="text"]')).toHaveCount(3);
  expect(await page.locator('.aime-stage img').evaluate((el: HTMLImageElement) => el.decode().then(() => el.naturalWidth))).toBe(480);

  // Les versions de secours existent.
  await page.getByTestId('export').click();
  await page.getByTestId('versions').click();
  await expect(page.getByRole('dialog', { name: 'Pages et versions' })).toContainText('Avant import');
});

test('Rien n’est perdu si l’on recharge juste après avoir tapé', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Grille vide' }).click();
  await page.getByTestId('add-text').click();
  const editable = page.locator('.aime-stage .aime-cell[data-type="text"] [contenteditable]');
  await editable.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('texte important');
  await page.reload(); // sans attendre l'enregistrement automatique
  await expect(page.locator('.aime-stage .aime-cell[data-type="text"]')).toHaveText('texte important');
});

test('Une image déguisée (SVG ou fichier abîmé) est refusée', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Grille vide' }).click();
  await page.getByTestId('image-input').setInputFiles({ name: 'faux.png', mimeType: 'image/png', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await expect(page.getByRole('status').filter({ hasText: 'n’est pas une image' })).toBeVisible();
  await expect(page.locator('.aime-stage .aime-cell[data-type="image"]')).toHaveCount(0);
});

test('Garder ma version après un conflit garde aussi l’autre en version de secours', async ({ context }) => {
  const a = await context.newPage();
  await a.goto('/');
  await a.getByRole('button', { name: 'Grille vide' }).click();
  await expect(a.getByTestId('save-status')).toHaveText(/Enregistré/);
  const b = await context.newPage();
  await b.goto('/');
  await b.getByTestId('add-text').click();
  await expect(b.getByTestId('save-status')).toHaveText(/Enregistré/);
  await a.getByTestId('add-grid').click();
  await a.getByRole('button', { name: 'Garder ma version' }).click();
  await expect(a.getByTestId('save-status')).toHaveText(/Enregistré/);
  await a.getByTestId('export').click();
  await a.getByTestId('versions').click();
  await expect(a.getByRole('dialog', { name: 'Pages et versions' })).toContainText('Version écartée (conflit)');
});
