

/**
 * upload.js handles the entire upload dock and flow
 */

import { formatFileSize, toast } from "./utils.js";

const MIN_FILE_SIZE = 2 * 1024 * 1024;   // 2 MB — matches the dropzone copy; confirm against AssemblyAI's real limits later
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_FILES_PER_BATCH = 10;          // placeholder — exact value not decided per the doc

let fileIdCounter = 0;
const stagedFiles = new Map(); // id -> { id, name, size, status, progress, reason, timer }

function getFileSizeError(size) {
  if (size < MIN_FILE_SIZE) return "File too small";
  if (size > MAX_FILE_SIZE) return "File too large";
  return null;
}


export function renderFileRow(entry) {
  const { id, name, size, status, progress, reason } = entry;

  if (status === "uploading") {
    return `
      <li class="file-row" data-file-row data-id="${id}">
        <span class="file-row__icon" aria-hidden="true"><svg class="icon"><use href="#i-file" /></svg></span>
        <span class="file-row__text">
          <span class="file-row__name">${name}</span>
          <span class="file-row__meta mono">${formatFileSize(size)}</span>
        </span>
        <span class="file-row__trailing">
          <div class="file-row__progress">
            <div class="file-row__bar"><span style="--progress:${progress}%"></span></div>
            <span class="file-row__pct mono">${progress}%</span>
          </div>
          <button type="button" class="icon-btn icon-btn--sm" data-action="cancel-upload" data-id="${id}" aria-label="Cancel upload of ${name}">
            <svg class="icon" aria-hidden="true"><use href="#i-close" /></svg>
          </button>
        </span>
      </li>`;
  }

  if (status === "uploaded") {
    return `
      <li class="file-row is-uploaded" data-file-row data-id="${id}">
        <span class="file-row__icon file-row__icon--accent" aria-hidden="true"><svg class="icon"><use href="#i-file" /></svg></span>
        <span class="file-row__text">
          <span class="file-row__name">${name}</span>
          <span class="file-row__meta mono">${formatFileSize(size)}</span>
        </span>
        <span class="file-row__trailing">
          <span class="file-row__badge" aria-hidden="true"><svg class="icon"><use href="#i-check" /></svg></span>
          <button type="button" class="icon-btn icon-btn--sm" data-action="cancel-upload" data-id="${id}" aria-label="Remove ${name}">
            <svg class="icon" aria-hidden="true"><use href="#i-close" /></svg>
          </button>
        </span>
      </li>`;
  }

  // failed
  return `
    <li class="file-row is-failed" data-file-row data-id="${id}">
      <span class="file-row__icon file-row__icon--error" aria-hidden="true"><svg class="icon"><use href="#i-alert" /></svg></span>
      <span class="file-row__text">
        <span class="file-row__name">${name}</span>
        <span class="file-row__meta mono">${reason ?? "Upload failed"}</span>
      </span>
      <span class="file-row__trailing">
        <button type="button" class="btn btn--sm btn--ghost" data-action="retry-upload" data-id="${id}">Retry</button>
        <button type="button" class="icon-btn icon-btn--sm" data-action="cancel-upload" data-id="${id}" aria-label="Remove ${name}">
          <svg class="icon" aria-hidden="true"><use href="#i-close" /></svg>
        </button>
      </span>
    </li>`;
}


export function renderFileList() {
  const listEl = document.querySelector("[data-file-list]");
  const dropzone = document.querySelector("[data-dropzone]");
  if (!listEl) return;

  listEl.innerHTML = [...stagedFiles.values()].map(renderFileRow).join("");
  listEl.hidden = stagedFiles.size === 0;
  if (dropzone) dropzone.hidden = stagedFiles.size > 0;
  document
    .querySelector("[data-add-more]")
    ?.toggleAttribute("hidden", stagedFiles.size === 0);
}

export function addFiles(fileList) {
  for (const file of Array.from(fileList)) {
    if (stagedFiles.size >= MAX_FILES_PER_BATCH) break;

    const id = String(++fileIdCounter);
    const entry = {
      id,
      name: file.name,
      size: file.size,
      status: "uploading",
      progress: 0,
    };
    stagedFiles.set(id, entry);

    if (!file.type.startsWith("audio/")) {
      entry.status = "failed";
      entry.reason = "Not an audio file";
    } else if (getFileSizeError(file.size)) {
      entry.status = "failed";
      entry.reason = getFileSizeError(file.size);
    } else {
      startUpload(entry);
    }
  }

  renderFileList();
  updateAddMoreState();
  updateTranscribeState();
}

export function cancelUpload(id) {
  const entry = stagedFiles.get(id);
  if (!entry) return;
  clearInterval(entry.timer);
  stagedFiles.delete(id);
  renderFileList();
  updateAddMoreState();
  updateTranscribeState();
}

export function retryUpload(id) {
  const entry = stagedFiles.get(id);
  if (!entry) return;
  const sizeError = getFileSizeError(entry.size);
  if (sizeError) {
    entry.status = "failed";
    entry.reason = sizeError;
    renderFileList();
    updateTranscribeState();
    return;
  }
  startUpload(entry);
  renderFileList();
}

export function updateAddMoreState() {
  document
    .querySelector("[data-add-more]")
    ?.toggleAttribute("disabled", stagedFiles.size >= MAX_FILES_PER_BATCH);
}

function updateTranscribeState() {
  const anyUploaded = [...stagedFiles.values()].some(
    (f) => f.status === "uploaded",
  );
  document
    .querySelector("[data-transcribe]")
    ?.toggleAttribute("disabled", !anyUploaded);
}



const fileInput = document.getElementById("audio-upload");
const dropzoneLabel = document.querySelector("[data-dropzone]");

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = ""; // allows picking the same file again later
});

document
  .querySelector("[data-add-more]")
  ?.addEventListener("click", () => fileInput.click());

["dragover", "dragleave", "drop"].forEach((evt) => {
  dropzoneLabel.addEventListener(evt, (e) => e.preventDefault());
});
dropzoneLabel.addEventListener("dragover", () =>
  dropzoneLabel.classList.add("is-dragover"),
);
dropzoneLabel.addEventListener("dragleave", () =>
  dropzoneLabel.classList.remove("is-dragover"),
);
dropzoneLabel.addEventListener("drop", (e) => {
  dropzoneLabel.classList.remove("is-dragover");
  addFiles(e.dataTransfer.files);
});

// Cancel/Retry need the row's id, which the generic actions listener
// doesn't pass — kept as its own delegated listener rather than retrofitting
// the actions object.
document.addEventListener("click", (e) => {
  const cancelBtn = e.target.closest('[data-action="cancel-upload"]');
  if (cancelBtn) return cancelUpload(cancelBtn.dataset.id);

  const retryBtn = e.target.closest('[data-action="retry-upload"]');
  if (retryBtn) return retryUpload(retryBtn.dataset.id);
});

document.querySelector("[data-transcribe]")?.addEventListener("click", () => {
  toast("Transcribe — DB + Edge Function wiring comes next");
});


/**
 * Stub — swap for the real Supabase Storage upload once that's wired.
 * Testing hook: a filename containing "fail" always resolves to the failed
 * state, so the failed/retry row is reachable without a real network error.
 * Remove that condition when this becomes a real upload call.
 * @param {*} entry 
 */

const UPLOAD_TICK_MS = 200;

export function startUpload(entry) {
  const sizeError = getFileSizeError(entry.size);
  if (sizeError) {
    entry.status = "failed";
    entry.reason = sizeError;
    renderFileList();
    updateTranscribeState();
    return;
  }

  entry.progress = 0;
  entry.status = "uploading";

  const shouldFail = entry.name.toLowerCase().includes("fail");
  const duration = 1500 + Math.random() * 2000;
  const startedAt = Date.now();

  entry.timer = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    entry.progress = Math.min(100, Math.round((elapsed / duration) * 100));

    const row = document.querySelector(`[data-file-row][data-id="${entry.id}"]`);
    if (row) {
      row.querySelector(".file-row__bar span")?.style.setProperty("--progress", `${entry.progress}%`);
      const pct = row.querySelector(".file-row__pct");
      if (pct) pct.textContent = `${entry.progress}%`;
    }

    if (entry.progress >= 100) {
      clearInterval(entry.timer);
      entry.status = shouldFail ? "failed" : "uploaded";
      if (shouldFail) entry.reason = "Upload failed";
      renderFileList();
      updateTranscribeState();
      updateAddMoreState();
    }
  }, UPLOAD_TICK_MS);
}

