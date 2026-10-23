import type { AimeDocument } from '../core/types';
import { addBlock, createDocument } from '../core/document';

/** Les deux points de départ de la Phase 1 : une grille vide, ou un modèle minimal à remplacer. */
export type StartChoice = 'empty' | 'minimal';

export function startDocument(choice: StartChoice): AimeDocument {
  if (choice === 'empty') return createDocument('Nouvelle page');
  let doc = createDocument('Ma première page');
  doc = addBlock(doc, 'root', {
    id: 'm_kicker',
    type: 'text',
    props: { text: 'Bienvenue', variant: 'legende', align: 'start' },
    place: { col: 1, row: 1, colSpan: 6, rowSpan: 1 },
  });
  doc = addBlock(doc, 'root', {
    id: 'm_title',
    type: 'text',
    props: { text: 'Le titre de votre page', variant: 'titre', align: 'start' },
    place: { col: 1, row: 2, colSpan: 8, rowSpan: 2 },
  });
  doc = addBlock(doc, 'root', {
    id: 'm_body',
    type: 'text',
    props: {
      text: 'Touchez un texte pour l’écrire. Choisissez un bloc puis attrapez la pastille pour le déplacer, ou le coin pour l’agrandir.',
      variant: 'texte',
      align: 'start',
    },
    place: { col: 1, row: 4, colSpan: 7, rowSpan: 2 },
  });
  return doc;
}
