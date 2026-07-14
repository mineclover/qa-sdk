// @def.boundary experience-layer-group
// @def.doc experience-layer-group

import { renderGlossaryPage } from './pages/glossary.js';
import { renderPrefixBuilderPage } from './pages/prefix-builder.js';
import { renderDslBuilderPage } from './pages/dsl-builder.js';
import { renderFileMapPage } from './pages/file-map.js';

type TabId = 'glossary' | 'prefix-builder' | 'dsl-builder' | 'file-map';

const tabs = document.querySelectorAll<HTMLButtonElement>('.rui-tab');
const pages = document.querySelectorAll<HTMLElement>('.rui-page');

/* eslint-disable typescript/no-non-null-assertion -- getElementById for elements guaranteed in index.html */
const containers: Record<TabId, HTMLElement> = {
  glossary: document.getElementById('glossary-container')!,
  'prefix-builder': document.getElementById('prefix-builder-container')!,
  'dsl-builder': document.getElementById('dsl-builder-container')!,
  'file-map': document.getElementById('file-map-container')!,
};
/* eslint-enable typescript/no-non-null-assertion */

const rendered = new Set<TabId>();

function switchTab(id: TabId) {
  location.hash = id;

  tabs.forEach((t) => {
    const active = t.dataset.tab === id;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', String(active));
  });

  pages.forEach((p) => p.classList.toggle('rui-hidden', p.id !== `page-${id}`));

  if (!rendered.has(id)) {
    rendered.add(id);
    if (id === 'glossary') renderGlossaryPage(containers.glossary);
    if (id === 'prefix-builder') renderPrefixBuilderPage(containers['prefix-builder']);
    if (id === 'dsl-builder') renderDslBuilderPage(containers['dsl-builder']);
    if (id === 'file-map') renderFileMapPage(containers['file-map']);
  }
}

tabs.forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab as TabId)));

const initialHash = location.hash.replace(/^#/, '');
const initialTab: TabId =
  initialHash === 'glossary' ||
  initialHash === 'prefix-builder' ||
  initialHash === 'dsl-builder' ||
  initialHash === 'file-map'
    ? initialHash
    : 'prefix-builder';

switchTab(initialTab);
