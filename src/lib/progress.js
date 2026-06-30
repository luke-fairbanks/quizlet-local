// Learning-status model shared across the study + edit UIs.

export const STATUSES = ["new", "learning", "known"];

// Radix color + label per status (used for badges, dots, buttons).
export const STATUS_META = {
  new: { label: "New", color: "gray" },
  learning: { label: "Learning", color: "amber" },
  known: { label: "Known", color: "grass" },
};

// Summarize a set's learning progress.
export function computeProgress(set) {
  const cards = Array.isArray(set?.cards) ? set.cards : [];
  const total = cards.length;
  let known = 0;
  let learning = 0;
  for (const c of cards) {
    if (c.status === "known") known++;
    else if (c.status === "learning") learning++;
  }
  return {
    total,
    known,
    learning,
    fresh: total - known - learning,
    pct: total ? Math.round((known / total) * 100) : 0,
  };
}
