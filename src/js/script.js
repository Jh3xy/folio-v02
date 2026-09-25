

/* FOLIO — main js module */

import "../style/font.css";
import "../style/variables.css";
import "../style/utils.css";
import "../style/style.css";

import { toast } from "./modules/utils.js";
import { loadEditor } from "./modules/transcribe.js";
import "./modules/upload.js";
import {
  getSession,
  signIn,
  signUp,
  signOut,
  onAuthChange,
  getAuthErrorMessage,
} from "./modules/auth.js";

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
  closeAccountMenuNow();
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
  closeAccountMenuNow();
  activeModalTrigger = trigger;
  modal.hidden = false;
  modal.querySelector(".dock__close")?.focus();
}

function closeModal(modal) {
  modal.hidden = true;
  activeModalTrigger?.focus();
  activeModalTrigger = null;
}

// New/Upload need a real session before the upload dock opens (uploads need
// auth.uid()). Everything else that opens a dock (Export, etc.) stays ungated.
const GATED_ACTIONS = new Set(["new", "upload"]);

// What to open once login succeeds, when a gated trigger redirected to the
// auth modal instead of its own target.
let pendingModalRequest = null;

function setButtonBusy(button, busy) {
  button.classList.toggle("is-busy", busy);
  button.disabled = busy;
}

// getSession() resolves same-tick almost always (localStorage read) — a
// spinner on every click would just flicker for no reason. It only goes to
// the network when the stored token needs a refresh, so the busy state is
// debounced: it only appears if the check is still pending after 150ms.
async function handleGatedTrigger(trigger, modal) {
  const busyTimer = setTimeout(() => setButtonBusy(trigger, true), 150);
  const session = await getSession();
  clearTimeout(busyTimer);
  setButtonBusy(trigger, false);

  if (session) {
    openModal(modal, trigger);
    return;
  }

  pendingModalRequest = { modalId: modal.id, trigger };
  const authModal = document.getElementById("auth");
  if (authModal) openModal(authModal, trigger);
}

modalTriggers.forEach((trigger) => {
  const modalId = trigger.dataset.modalTarget;
  const modal = document.getElementById(modalId);

  if (!modal) return;

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (GATED_ACTIONS.has(trigger.dataset.action)) {
      handleGatedTrigger(trigger, modal);
      return;
    }
    openModal(modal, trigger);
  });
});

// Wired per-dock, not per-trigger — so #auth's own close button works even
// though no [data-modal-target] points at it.
document.querySelectorAll(".dock").forEach((modal) => {
  modal
    .querySelectorAll(".dock__close, [data-modal-close]")
    .forEach((closeTrigger) => {
      closeTrigger.addEventListener("click", () => closeModal(modal));
    });
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  const modal = document.querySelector(".dock:not([hidden])");
  if (modal) {
    closeModal(modal);
    return;
  }
  closeAccountMenuNow();
});

/* ---------- Account menu ---------- */

const accountTrigger = document.querySelector('[data-action="account"]');
const accountMenu = document.querySelector("[data-account-menu]");
let currentSession = null;
let accountMenuCloseTimer = null;

function positionAccountMenu() {
  if (!accountTrigger || !accountMenu) return;
  const rect = accountTrigger.getBoundingClientRect();
  // Fixed, not absolute — #nav has overflow:hidden for the label-collapse
  // animation, which would clip an absolutely-positioned menu the moment
  // it's wider than the collapsed rail. Fixed escapes that regardless of
  // whether the rail is collapsed or expanded, since it just reads the
  // button's live position.
  accountMenu.style.right = `${window.innerWidth - rect.right}px`;
  accountMenu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
}

function openAccountMenu() {
  if (!accountMenu || !currentSession) return; // nothing to show signed out
  clearTimeout(accountMenuCloseTimer);
  positionAccountMenu();
  accountMenu.classList.add("is-open");
  accountTrigger?.setAttribute("aria-expanded", "true");
}

function closeAccountMenu() {
  // Grace period so moving the pointer from the trigger to the menu itself
  // doesn't close it before it's reached.
  accountMenuCloseTimer = setTimeout(closeAccountMenuNow, 150);
}

function closeAccountMenuNow() {
  clearTimeout(accountMenuCloseTimer);
  accountMenu?.classList.remove("is-open");
  accountTrigger?.setAttribute("aria-expanded", "false");
}

if (accountTrigger && accountMenu) {
  accountTrigger.addEventListener("mouseenter", openAccountMenu);
  accountMenu.addEventListener("mouseenter", openAccountMenu);
  accountTrigger.addEventListener("mouseleave", closeAccountMenu);
  accountMenu.addEventListener("mouseleave", closeAccountMenu);
  accountTrigger.addEventListener("focusin", openAccountMenu);
  accountTrigger.addEventListener("focusout", (e) => {
    if (!accountMenu.contains(e.relatedTarget)) closeAccountMenu();
  });
  accountMenu.addEventListener("focusout", (e) => {
    if (e.relatedTarget !== accountTrigger && !accountMenu.contains(e.relatedTarget)) {
      closeAccountMenu();
    }
  });
}

window.addEventListener("resize", () => {
  if (accountMenu?.classList.contains("is-open")) positionAccountMenu();
});

function updateAccountUI(session) {
  currentSession = session;

  const avatarEl = document.querySelector("[data-account-avatar]");
  const nameEl = document.querySelector("[data-account-name]");
  const subEl = document.querySelector("[data-account-sub]");
  const menuEmailEl = document.querySelector("[data-account-menu-email]");
  if (!avatarEl || !nameEl || !subEl) return;

  const email = session?.user?.email ?? null;

  avatarEl.textContent = email ? email.charAt(0).toUpperCase() : "?";
  nameEl.textContent = email ?? "Sign in";
  subEl.textContent = email ? "Account" : "Guest";
  if (menuEmailEl) menuEmailEl.textContent = email ?? "";

  if (!email) closeAccountMenuNow();
}

getSession().then(updateAccountUI);
onAuthChange(updateAccountUI);

actions.account = () => {
  if (currentSession) {
    accountMenu?.classList.contains("is-open") ? closeAccountMenuNow() : openAccountMenu();
  } else {
    const authModal = document.getElementById("auth");
    if (authModal) openModal(authModal, accountTrigger);
  }
};

actions.logout = async () => {
  closeAccountMenuNow();
  const { error } = await signOut();
  toast(error ? "Couldn't log out — try again" : "Logged out");
};

/* ---------- Auth modal form ---------- */

const authModal = document.getElementById("auth");
const authForm = document.querySelector("[data-auth-form]");
const authTitleEl = document.querySelector("[data-auth-title]");
const authSubmitBtn = document.querySelector("[data-auth-submit]");
const authSubmitLabel = document.querySelector("[data-auth-submit-label]");
const authToggleBtn = document.querySelector("[data-auth-toggle]");
const authPasswordInput = document.getElementById("auth-password");

let authMode = "login"; // "login" | "signup"

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === "signup";
  if (authTitleEl) authTitleEl.textContent = isSignup ? "Sign up" : "Log in";
  if (authSubmitLabel) authSubmitLabel.textContent = isSignup ? "Sign up" : "Log in";
  if (authPasswordInput) {
    authPasswordInput.autocomplete = isSignup ? "new-password" : "current-password";
  }
  if (authToggleBtn) {
    authToggleBtn.innerHTML = isSignup
      ? "<strong data-auth-toggle >Log in</strong>"
      : "<strong data-auth-toggle >Sign up</strong>";
  }
}

function setAuthFormBusy(busy) {
  if (!authSubmitBtn || !authSubmitLabel) return;
  authSubmitBtn.disabled = busy;
  authSubmitBtn.classList.toggle("is-busy", busy);
  authSubmitLabel.textContent = busy
    ? authMode === "signup" ? "Signing up…" : "Signing in…"
    : authMode === "signup" ? "Sign up" : "Log in";
}

authToggleBtn?.addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "signup" : "login");
});

authForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = authForm.email.value.trim();
  const password = authForm.password.value;

  setAuthFormBusy(true);
  const { error } =
    authMode === "signup" ? await signUp(email, password) : await signIn(email, password);
  setAuthFormBusy(false);

  if (error) {
    toast(getAuthErrorMessage(error));
    return;
  }

  authForm.reset();
  setAuthMode("login");
  if (authModal) closeModal(authModal);

  if (pendingModalRequest) {
    const targetModal = document.getElementById(pendingModalRequest.modalId);
    if (targetModal) openModal(targetModal, pendingModalRequest.trigger);
    pendingModalRequest = null;
  }
});

/* ---------- Initial route ---------- */
renderRoute(parseRoute(location.pathname));
