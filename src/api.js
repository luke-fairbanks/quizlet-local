// Thin wrapper around the local Node API. All calls hit /api/* which Vite
// proxies to http://localhost:4321 in dev, and which the Node server serves
// directly in production.

async function request(url, opts) {
  const res = await fetch(url, opts);
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty / non-JSON body */
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (HTTP ${res.status})`);
  }
  return data;
}

const json = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  // Returns the full list of saved sets (newest first).
  listSets: () => request("/api/sets"),

  // Scrape a Quizlet set server-side by URL. Often blocked by Cloudflare —
  // callers should surface the error and steer users to the bookmarklet.
  scrape: (url) => request("/api/scrape", json({ url })),

  // Import pasted text (Quizlet Export format by default).
  importText: ({ title, text, termDelim, cardDelim }) =>
    request("/api/import", json({ title, text, termDelim, cardDelim })),

  // Rename a set.
  renameSet: (id, title) =>
    request(`/api/sets/${id}`, { ...json({ title }), method: "PATCH" }),

  // Delete a set.
  deleteSet: (id) => request(`/api/sets/${id}`, { method: "DELETE" }),

  // --- card-level operations (all return the updated set) ---
  addCard: (setId, card) => request(`/api/sets/${setId}/cards`, json(card)),
  updateCard: (setId, cardId, patch) =>
    request(`/api/sets/${setId}/cards/${cardId}`, { ...json(patch), method: "PATCH" }),
  deleteCard: (setId, cardId) =>
    request(`/api/sets/${setId}/cards/${cardId}`, { method: "DELETE" }),
  setCardStatus: (setId, cardId, status) =>
    request(`/api/sets/${setId}/cards/${cardId}`, {
      ...json({ status }),
      method: "PATCH",
    }),
  resetProgress: (setId) =>
    request(`/api/sets/${setId}/progress/reset`, { method: "POST" }),
};
