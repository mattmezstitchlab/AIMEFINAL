import { defineBlock } from '../core/registry';
import { h } from '../core/dom';

export type ImageProps = {
  /** `asset:<id>` (fichier stocké sur l'appareil), une adresse https, ou une image intégrée (documents anciens). */
  src: string;
  alt: string;
  fit: 'cover' | 'contain';
};

export const imageBlock = defineBlock<ImageProps>({
  type: 'image',
  label: 'Image',
  icon: '▲',
  description: 'Une image depuis votre appareil ou une adresse web sécurisée (https).',
  capabilities: ['média'],
  defaultSize: { colSpan: 6, rowSpan: 5 },
  defaults: () => ({ src: '', alt: '', fit: 'cover' }),

  render(props, ctx) {
    const src = ctx.media(props.src);
    const figure = h('figure', { class: 'b-image', style: { '--fit': props.fit === 'contain' ? 'contain' : 'cover' } });
    if (src) {
      figure.append(h('img', { src, alt: props.alt, decoding: 'async', draggable: 'false' }));
    } else if (ctx.mode === 'edit') {
      figure.append(h('div', { class: 'b-image__empty' }, props.src ? 'Image introuvable sur cet appareil — remplacez-la depuis la barre du bloc' : 'Image — choisissez un fichier dans la barre du bloc'));
    } else {
      figure.classList.add('is-empty');
    }
    return figure;
  },

  actions: (props) => [
    { kind: 'file', label: props.src ? 'Remplacer…' : 'Choisir une image…', key: 'src', accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif' },
    { kind: 'input', label: 'Description', key: 'alt', value: props.alt, placeholder: 'Ce que montre l’image' },
    { kind: 'button', label: 'Remplir', title: 'L’image remplit le cadre', active: props.fit !== 'contain', patch: { fit: 'cover' } },
    { kind: 'button', label: 'Contenir', title: 'L’image entière reste visible', active: props.fit === 'contain', patch: { fit: 'contain' } },
  ],
});
