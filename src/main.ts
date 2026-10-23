import './styles/tokens.css';
import './styles/grid.css';
import './styles/blocks.css';
import './styles/app.css';
import './blocks';

import { h } from './core/dom';
import type { AimeDocument } from './core/types';
import { Editor } from './app/editor';
import { mountChrome } from './app/toolbar';
import { dialog, notify } from './app/notify';
import { startDocument } from './app/templates';
import { openLocalStore } from './store/local';
import { memoryStore } from './store/memory';
import type { DocumentStore } from './store/contract';

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  let store: DocumentStore;
  let persistent = true;
  try {
    store = await openLocalStore();
  } catch {
    store = memoryStore();
    persistent = false;
  }

  let doc: AimeDocument | null = null;
  let rev = 0;
  let savedAt: string | null = null;
  const loaded = await store.loadCurrent();
  if (loaded.kind === 'ok') {
    ({ doc, rev, savedAt } = { doc: loaded.record.doc, rev: loaded.record.rev, savedAt: loaded.record.savedAt });
    loaded.warnings.forEach((w) => notify(w));
  } else if (loaded.kind === 'damaged') {
    notify(`La page enregistrée était illisible (${loaded.reason}). Elle a été mise de côté, rien n’a été effacé.`, 'error');
  }

  if (!doc) {
    const choice = await dialog({
      title: 'Créer une page',
      className: 'aime-dialog--welcome',
      dismissable: false,
      body: [
        h('span', { class: 'aime-orb aime-orb--large', 'aria-hidden': 'true' }),
        'Une grille, des blocs. Ajoutez un texte ou une image, déplacez, agrandissez, changez d’apparence.',
        h(
          'p',
          { class: 'aime-dialog__note' },
          persistent
            ? 'Votre travail sera enregistré sur cet appareil, dans ce navigateur uniquement.'
            : 'Ce navigateur refuse le stockage local : votre travail sera perdu au rechargement. Exportez-le avant de partir.',
        ),
      ],
      actions: [
        { label: 'Partir du modèle minimal', value: 'minimal' },
        { label: 'Grille vide', value: 'empty', primary: true },
      ],
    });
    doc = startDocument(choice === 'minimal' ? 'minimal' : 'empty');
  }

  const stage = h('main', { class: 'aime-stage', 'data-tool': 'select', 'data-device': 'desktop', 'aria-label': 'Surface de création' });
  const imageInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif', hidden: true, 'data-testid': 'image-input' });
  const editor = new Editor(stage, doc, store, rev, savedAt, notify);
  imageInput.addEventListener('change', () => {
    const file = imageInput.files?.[0];
    const target = imageInput.dataset.target || undefined;
    imageInput.value = '';
    if (file) void editor.addImage(file, target);
  });

  app.replaceChildren(...mountChrome(editor, imageInput), stage, imageInput);
  await editor.start();
  if (!savedAt) editor.persistence.queue(editor.doc);
  if (!persistent) notify('Stockage local indisponible : exportez votre projet pour le garder.', 'error');

  // Ne rien perdre en quittant : on enregistre dès que la page passe en arrière-plan.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void editor.persistence.flush();
  });
  window.addEventListener('beforeunload', (e) => {
    if (!editor.persistence.hasUnsaved) return;
    void editor.persistence.flush();
    const k = editor.persistence.state.kind;
    if (k === 'error' || k === 'conflict') e.preventDefault();
  });

  document.body.classList.add('is-ready');
  if (import.meta.env.DEV) Object.assign(window, { aime: editor });
}

void boot();
