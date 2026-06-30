// Small shared helpers.

// Fisher–Yates shuffle (returns a new array).
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Human-friendly relative-ish date.
export function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

// Case-insensitive substring match used by search.
export function matches(haystack, query) {
  if (!query) return true;
  return String(haystack || "")
    .toLowerCase()
    .includes(query.toLowerCase());
}

// Normalize a typed answer for forgiving comparison: lowercase, strip accents
// and punctuation, collapse whitespace. Used by Learn mode's written grading.
export function normalizeAnswer(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // punctuation -> space
    .replace(/\s+/g, " ")
    .trim();
}

// Whether a typed answer counts as correct against the expected text.
export function answerMatches(input, expected) {
  const a = normalizeAnswer(input);
  const b = normalizeAnswer(expected);
  return a.length > 0 && a === b;
}
