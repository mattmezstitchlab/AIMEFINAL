import { h } from '../core/dom';

/** Messages brefs, annoncés aux lecteurs d'écran. Un seul à la fois. */
let region: HTMLElement | null = null;
let timer = 0;

export function notify(message: string, tone: 'info' | 'error' = 'info'): void {
  if (!region) {
    region = h('div', { class: 'aime-toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(region);
  }
  region.textContent = message;
  region.dataset.tone = tone;
  region.classList.add('is-visible');
  clearTimeout(timer);
  timer = window.setTimeout(() => region?.classList.remove('is-visible'), tone === 'error' ? 7000 : 3500);
}

/** Une boîte de dialogue simple et accessible (élément <dialog> natif). */
export function dialog(opts: {
  title: string;
  body?: (Node | string)[];
  actions: { label: string; value: string; primary?: boolean }[];
  dismissable?: boolean;
  className?: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    const el = h('dialog', { class: `aime-dialog ${opts.className ?? ''}`, 'aria-labelledby': 'aime-dialog-title' });
    const buttons = opts.actions.map((a) =>
      h('button', { type: 'button', class: a.primary ? 'aime-button is-primary' : 'aime-button', 'data-value': a.value, onclick: () => close(a.value) }, a.label),
    );
    el.append(
      h('h2', { id: 'aime-dialog-title' }, opts.title),
      ...(opts.body ?? []).map((b) => (typeof b === 'string' ? h('p', {}, b) : b)),
      h('div', { class: 'aime-dialog__actions' }, ...buttons),
    );
    const close = (value: string | null) => {
      el.close();
      el.remove();
      resolve(value);
    };
    el.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (opts.dismissable !== false) close(null);
    });
    document.body.append(el);
    el.showModal();
    (buttons.find((b) => b.classList.contains('is-primary')) ?? buttons[0])?.focus();
  });
}
