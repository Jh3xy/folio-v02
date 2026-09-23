

/* FOLIO — main js module */

import "../style/font.css";
import "../style/variables.css";
import "../style/utils.css";
import "../style/style.css";

import { toast } from "./modules/utils.js";
import { loadEditor, } from "./modules/transcribe.js";
import "./modules/upload.js";

console.log("[VITE]: Status - Running");

const app = document.getElementById("app");
const nav = document.getElementById("nav");
const toggle = document.getElementById("nav-toggle");

const MOBILE = window.matchMedia("(max-width: 48rem)");



/* ---------- nav width ---------- */

function setNavOpen(open) {
  app.classList.toggle("is-nav-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute(
    "aria-label",
    open ? "Collapse navigation" : "Expand navigation",
  );
}

toggle.addEventListener("click", () => {
  setNavOpen(!app.classList.contains("is-nav-open"));
});

// Below the mobile breakpoint the rail becomes a bottom bar, so the open
// state is meaningless — drop it rather than leave a stale class behind.
MOBILE.addEventListener("change", (e) => {
  if (e.matches) setNavOpen(false);
});

/* ---------- Routing ---------- */

const ROUTES = [
  { name: "home", pattern: [] },
  { name: "recordings", pattern: ["recordings"] },
  { name: "editor", pattern: ["editor", ":id"] },
  { name: "editor", pattern: ["editor"] },
  { name: "settings", pattern: ["settings"] },
];

function parseRoute(pathname) {
  const segments = pathname.split("/").filter(Boolean); // '/editor/42' -> ['editor', '42']

  for (const route of ROUTES) {
    if (route.pattern.length !== segments.length) continue;

    const params = {};
    const isMatch = route.pattern.every((part, i) => {
      if (part.startsWith(":")) {
        params[part.slice(1)] = segments[i];
        return true;
      }
      return part === segments[i];
    });

    if (isMatch) return { name: route.name, params };
  }

  return { name: "notfound", params: {} }; // unknown path -> not found
}


/**
 * The single render path. In-app clicks, popstate, and the initial page
 * load all end up calling this with the same shape of object — no branching
 * between "user clicked" vs "user hit refresh".
 * @param {*} route
 * @returns
 */

function renderRoute(route) {
  const target = document.getElementById(route.name);
  if (!target) return;

  document.querySelectorAll("#main .page").forEach((page) => {
    const isTarget = page === target;
    page.classList.toggle("is-visible", isTarget);
    page.hidden = !isTarget;
  });

  // route.name doubles as the nav's data-section value — editor keeps its
  // own identity/nav highlight rather than borrowing Recordings'.
  document.querySelectorAll(".nav__item").forEach((item) => {
    const isTarget = item.dataset.section === route.name;
    item.classList.toggle("is-active", isTarget);
    if (isTarget) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });

  document.getElementById("main").scrollTop = 0;

  if (route.name === "editor") loadEditor(route.params.id ?? null);
}

// The only place that touches history. Everything else calls this or
// renderRoute() directly (popstate, initial load — see bottom of file).
function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, "", path);
  else history.pushState({}, "", path);
  renderRoute(parseRoute(path));
}

window.addEventListener("popstate", () => {
  renderRoute(parseRoute(location.pathname)); // no pushState — URL already moved
});


/* ---------- toggles ---------- */

document.querySelectorAll(".switch").forEach((sw) => {
  sw.addEventListener("click", () => {
    sw.setAttribute(
      "aria-checked",
      sw.getAttribute("aria-checked") === "true" ? "false" : "true",
    );
  });
});



// Swap these for real handlers one at a time as the features get built.
const actions = {
  new: () => toast("New recording — upload flow goes here"),
  upload: () => toast("Upload audio — file picker goes here"),
  record: () => toast("Start recording — capture goes here"),
  export: () => toast("Export — format options go here"),
  save: () => toast("Saved"),
  play: () => toast("Playback — audio engine goes here"),
  more: () => toast("More actions"),
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const run = actions[el.dataset.action];
  if (run) run();
});

// Any internal nav link — nav items, Open, View all, History — carries
// data-route. Modifier/middle clicks are left alone so ctrl/cmd+click,
// shift+click and middle-click still open a new tab the normal way.
document.addEventListener("click", (e) => {
  const link = e.target.closest("a[data-route]");
  if (!link) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
    return;

  e.preventDefault();
  navigate(link.getAttribute("href"));
  if (MOBILE.matches) setNavOpen(false);
});

// Open Modal Dock

const modalTriggers = document.querySelectorAll("[data-modal-target]");
let activeModalTrigger = null;

function openModal(modal, trigger) {
  activeModalTrigger = trigger;
  modal.hidden = false;
  modal.querySelector(".dock__close")?.focus();
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

  modal
    .querySelectorAll(".dock__close, [data-modal-close]")
    .forEach((closeTrigger) => {
      closeTrigger.addEventListener("click", () => {
        closeModal(modal);
      });
    });
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  const modal = document.querySelector(".dock:not([hidden])");
  if (modal) closeModal(modal);
});

/* ---------- Initial route ---------- */
renderRoute(parseRoute(location.pathname));
