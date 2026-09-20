
/* FOLIO — main js module */

import '../style/font.css';
import '../style/variables.css';
import '../style/utils.css';
import '../style/style.css';

console.log("[VITE]: Status - Running");

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const toggle = document.getElementById('nav-toggle');
const toastEl = document.getElementById('toast');

const MOBILE = window.matchMedia('(max-width: 48rem)');

/* ---------- nav width ---------- */

function setNavOpen(open) {
  app.classList.toggle('is-nav-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Collapse navigation' : 'Expand navigation');
}

toggle.addEventListener('click', () => {
  setNavOpen(!app.classList.contains('is-nav-open'));
});

// Below the mobile breakpoint the rail becomes a bottom bar, so the open
// state is meaningless — drop it rather than leave a stale class behind.
MOBILE.addEventListener('change', (e) => {
  if (e.matches) setNavOpen(false);
});

/* ---------- Section to Nav swapping & mapping---------- */

/**
 * ?INFO: Sections without a nav item of their own borrow one
 * Editor is reached from a transcript, so it lights up the Transcript nav btn
 * might change and adjust that if i seperate editor for transcripts/ recordings
 */
const SECTION_NAV = {
  home: 'home',
  transcripts: 'transcripts',
  editor: 'editor',
  settings: 'settings',
};

function showSection(id) {
  const navId = SECTION_NAV[id] ?? id;
  const target = document.getElementById(id);
  if (!target) return;

  document.querySelectorAll('#main .page').forEach((page) => {
    const isTarget = page === target;
    page.classList.toggle('is-visible', isTarget);
    page.hidden = !isTarget;
  });

  document.querySelectorAll(".nav__item").forEach((item) => {
    const isTarget = item.dataset.section === navId;
    item.classList.toggle("is-active", isTarget);
    if (isTarget) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });

  document.getElementById('main').scrollTop = 0;
}

nav.addEventListener('click', (e) => {
  const item = e.target.closest('.nav__item');
  if (!item) return;
  // e.preventDefault(); - used buttons which dont navigate, instead of anchor tags.
  showSection(item.dataset.section);
  if (MOBILE.matches) setNavOpen(false);
});

/* ---------- toggles ---------- */

document.querySelectorAll('.switch').forEach((sw) => {
  sw.addEventListener('click', () => {
    sw.setAttribute('aria-checked', sw.getAttribute('aria-checked') === 'true' ? 'false' : 'true');
  });
});

/* ---------- placeholder actions ---------- */

let toastTimer;

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 22200);
}

// Swap these for real handlers one at a time as the features get built.
const actions = {
  new: () => toast('New recording — upload flow goes here'),
  upload: () => toast('Upload audio — file picker goes here'),
  record: () => toast('Start recording — capture goes here'),
  open: () => showSection('editor'),
  export: () => toast('Export — format options go here'),
  save: () => toast('Saved'),
  play: () => toast('Playback — audio engine goes here'),
  more: () => toast('More actions'),
  history: () => toast('Queue history'),
  'view-all': () => showSection('transcripts'),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const run = actions[el.dataset.action];
  if (run) run();
});


// Open Modal Dock

const modalTriggers = document.querySelectorAll("[data-modal-target]");
let activeModalTrigger = null;

function openModal(modal, trigger) {
  activeModalTrigger = trigger;
  modal.hidden = false;
  modal.querySelector('.dock__close')?.focus();
}

function closeModal(modal) {
  modal.hidden = true;
  activeModalTrigger?.focus();
  activeModalTrigger = null;
}

modalTriggers.forEach((trigger) => {
  const modalId = trigger.dataset.modalTarget;
  const modal = document.getElementById(modalId);

  if (!modal) return;

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    openModal(modal, trigger);
  });

  modal.querySelectorAll('.dock__close, [data-modal-close]').forEach((closeTrigger) => {
    closeTrigger.addEventListener('click', () => {
      closeModal(modal);
    });
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  const modal = document.querySelector('.dock:not([hidden])');
  if (modal) closeModal(modal);
});
