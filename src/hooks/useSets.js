import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";

// Central store for saved sets. Handles loading, optimistic rename/delete,
// and live-refresh so sets pushed by the bookmarklet (while this app is open)
// appear automatically.
export function useSets() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  // Bumped whenever a local optimistic mutation starts. A background refresh
  // that spans a mutation is discarded so it can't revive a just-deleted set
  // or undo a rename before the server has confirmed it.
  const mutationGen = useRef(0);

  const refresh = useCallback(async () => {
    const startGen = mutationGen.current;
    try {
      const data = await api.listSets();
      if (mounted.current && mutationGen.current === startGen) {
        setSets(Array.isArray(data) ? data : []);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    // Live-refresh: on window focus and a gentle poll, so bookmarklet imports
    // from another tab show up without a manual reload.
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const poll = setInterval(refresh, 5000);
    return () => {
      mounted.current = false;
      window.removeEventListener("focus", onFocus);
      clearInterval(poll);
    };
  }, [refresh]);

  const addFromScrape = useCallback(async (url) => {
    const set = await api.scrape(url);
    setSets((prev) => [set, ...prev]);
    return set;
  }, []);

  const addFromImport = useCallback(async (payload) => {
    const set = await api.importText(payload);
    setSets((prev) => [set, ...prev]);
    return set;
  }, []);

  const rename = useCallback(async (id, title) => {
    mutationGen.current++;
    let prev;
    setSets((cur) => {
      prev = cur;
      return cur.map((s) => (s.id === id ? { ...s, title } : s));
    });
    try {
      const updated = await api.renameSet(id, title);
      mutationGen.current++;
      return updated;
    } catch (e) {
      mutationGen.current++;
      setSets(prev); // rollback
      throw e;
    }
  }, []);

  const remove = useCallback(async (id) => {
    mutationGen.current++;
    let prev;
    setSets((cur) => {
      prev = cur;
      return cur.filter((s) => s.id !== id);
    });
    try {
      const result = await api.deleteSet(id);
      mutationGen.current++;
      return result;
    } catch (e) {
      mutationGen.current++;
      setSets(prev); // rollback
      throw e;
    }
  }, []);

  // Replace one set in state with a server-returned copy.
  const replaceSet = useCallback((updated) => {
    if (!updated || !updated.id) return updated;
    setSets((cur) => cur.map((s) => (s.id === updated.id ? updated : s)));
    return updated;
  }, []);

  // Card-level operations. Each persists then syncs the returned set into
  // state (bumping the mutation generation so a background refresh can't
  // clobber the change before the server confirms it).
  const cardOp = useCallback(
    async (fn) => {
      mutationGen.current++;
      const updated = await fn();
      // Bump again so any background poll whose GET overlapped this write is
      // discarded rather than overwriting the just-saved state.
      mutationGen.current++;
      return replaceSet(updated);
    },
    [replaceSet]
  );

  const addCard = useCallback(
    (setId, card) => cardOp(() => api.addCard(setId, card)),
    [cardOp]
  );
  const updateCard = useCallback(
    (setId, cardId, patch) => cardOp(() => api.updateCard(setId, cardId, patch)),
    [cardOp]
  );
  const deleteCard = useCallback(
    (setId, cardId) => cardOp(() => api.deleteCard(setId, cardId)),
    [cardOp]
  );
  const setCardStatus = useCallback(
    (setId, cardId, status) =>
      cardOp(() => api.setCardStatus(setId, cardId, status)),
    [cardOp]
  );
  const resetProgress = useCallback(
    (setId) => cardOp(() => api.resetProgress(setId)),
    [cardOp]
  );

  return {
    sets,
    loading,
    error,
    refresh,
    addFromScrape,
    addFromImport,
    rename,
    remove,
    addCard,
    updateCard,
    deleteCard,
    setCardStatus,
    resetProgress,
  };
}
