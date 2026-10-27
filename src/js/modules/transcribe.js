

let editorRequestId = 0; // guards a slow fetch from overwriting a newer one

export function getLastOpenedId() {
  return null; // TODO: read and return from localStorage once something writes to it
}

/**
 * Stub — swap this for a real Supabase fetch once DB wiring lands..
 * Resolves to the transcript row, or null for "not found"..
 * @param {*} id 
 * @returns 
 */
export function loadTranscript(id) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(null), 600);
  });
}


export async function loadEditor(id) {
  const editorEl = document.getElementById("editor");
  const resolvedId = id ?? getLastOpenedId();

  editorEl.classList.remove("is-loading", "is-empty", "is-not-found");

  if (!resolvedId) {
    editorEl.classList.add("is-empty");
    return;
  }

  const requestId = ++editorRequestId;
  editorEl.classList.add("is-loading");

  const data = await loadTranscript(resolvedId);
  if (requestId !== editorRequestId) return; // a newer navigation beat this one back

  editorEl.classList.remove("is-loading");

  if (!data) {
    editorEl.classList.add("is-not-found");
    return;
  }

  // TODO: render(data) once there's real content to render
}



