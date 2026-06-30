import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertDialog,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  IconButton,
  ScrollArea,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import {
  Cross2Icon,
  PlusIcon,
  ReloadIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { STATUS_META } from "../lib/progress";
import { useToast } from "./Toaster";

const EASE = [0.16, 1, 0.3, 1];

export default function EditSetView({
  set,
  onClose,
  onRename,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onResetProgress,
}) {
  const toast = useToast();
  const overlayRef = useRef(null);
  const titleId = useId();

  // Local authoritative state for inputs (so the cursor never jumps).
  const [title, setTitle] = useState(set.title);
  const [cards, setCards] = useState(set.cards || []);
  // The last title actually saved to the server. The `set` prop is a frozen
  // open-time snapshot, so we compare against this — not set.title — otherwise
  // renaming and then reverting to the original title would be a silent no-op.
  const committedTitle = useRef(set.title);

  // Refs to newly added term fields so we can focus them after add.
  const termRefs = useRef({});
  const pendingFocusId = useRef(null);
  const [resetting, setResetting] = useState(false);
  const [adding, setAdding] = useState(false);

  // --- focus trap / restore + escape handling (per spec skeleton) ---
  useEffect(() => {
    const prev = document.activeElement;
    overlayRef.current?.focus();
    return () => {
      if (prev && prev.focus) prev.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(e) {
      // Ignore keys when focus has left the overlay — e.g. into a nested Radix
      // AlertDialog (which renders in a portal outside overlayRef). That lets
      // the dialog own Esc/Tab instead of this editor closing underneath it.
      if (
        overlayRef.current &&
        document.activeElement &&
        document.activeElement !== document.body &&
        !overlayRef.current.contains(document.activeElement)
      ) {
        return;
      }
      const t = e.target;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        if (e.key === "Escape") e.target.blur();
        return; // don't close while typing
      }
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = overlayRef.current?.querySelectorAll(
          'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const list = nodes
          ? Array.from(nodes).filter(
              (el) => !el.disabled && el.offsetParent !== null
            )
          : [];
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Focus a freshly-added term field once it's rendered.
  useEffect(() => {
    if (pendingFocusId.current) {
      const el = termRefs.current[pendingFocusId.current];
      if (el) {
        el.focus();
        pendingFocusId.current = null;
      }
    }
  }, [cards]);

  // --- title commit ---
  async function commitTitle() {
    const next = title.trim();
    if (!next) {
      setTitle(committedTitle.current); // revert on empty
      return;
    }
    if (next === committedTitle.current) return; // unchanged
    try {
      const updated = await onRename(next);
      const saved = updated?.title ?? next;
      committedTitle.current = saved;
      setTitle(saved);
      toast({ title: "Set renamed", type: "success" });
    } catch (err) {
      setTitle(committedTitle.current);
      toast({
        title: "Couldn't rename set",
        description: err?.message,
        type: "error",
      });
    }
  }

  // --- field commits per card ---
  // The value of the field when editing began (captured on focus). We compare
  // against this, NOT the live local state — local state is updated on every
  // keystroke, so comparing to it would always look "unchanged".
  const editStartValue = useRef(null);

  async function commitField(card, field, value) {
    if (editStartValue.current === null || value === editStartValue.current) {
      return; // nothing actually changed during this edit
    }
    editStartValue.current = null;
    try {
      const updated = await onUpdateCard(card.id, { [field]: value });
      if (updated?.cards) setCards(updated.cards);
    } catch (err) {
      toast({
        title: "Couldn't save change",
        description: err?.message,
        type: "error",
      });
      // keep local value (do not revert)
    }
  }

  function setLocalCard(id, patch) {
    setCards((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  // --- add card ---
  async function handleAdd() {
    if (adding) return;
    setAdding(true);
    try {
      const updated = await onAddCard({ term: "", definition: "" });
      if (updated?.cards) {
        const prevIds = new Set(cards.map((c) => c.id));
        const fresh = updated.cards.find((c) => !prevIds.has(c.id));
        if (fresh) pendingFocusId.current = fresh.id;
        setCards(updated.cards);
      }
    } catch (err) {
      toast({
        title: "Couldn't add card",
        description: err?.message,
        type: "error",
      });
    } finally {
      setAdding(false);
    }
  }

  // --- delete card ---
  async function handleDelete(card) {
    try {
      const updated = await onDeleteCard(card.id);
      if (updated?.cards) setCards(updated.cards);
      else setCards((cur) => cur.filter((c) => c.id !== card.id));
      toast({ title: "Card deleted", type: "success" });
    } catch (err) {
      toast({
        title: "Couldn't delete card",
        description: err?.message,
        type: "error",
      });
    }
  }

  // --- reset progress ---
  async function handleReset() {
    setResetting(true);
    try {
      const updated = await onResetProgress();
      if (updated?.cards) setCards(updated.cards);
      toast({ title: "Progress reset", type: "success" });
    } catch (err) {
      toast({
        title: "Couldn't reset progress",
        description: err?.message,
        type: "error",
      });
    } finally {
      setResetting(false);
    }
  }

  return (
    <motion.div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 210,
        background: "var(--color-background)",
        display: "flex",
        flexDirection: "column",
        outline: "none",
      }}
    >
      {/* Top bar */}
      <Flex
        align="center"
        gap="3"
        px="4"
        py="3"
        style={{ borderBottom: "1px solid var(--gray-a4)", flexShrink: 0 }}
      >
        <Box style={{ flex: 1, minWidth: 0 }}>
          <TextField.Root
            id={titleId}
            size="3"
            value={title}
            placeholder="Set title"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.target.blur();
              }
            }}
            aria-label="Set title"
            style={{ maxWidth: 520 }}
          />
        </Box>

        <Badge variant="soft" color="indigo" radius="full">
          {cards.length} {cards.length === 1 ? "card" : "cards"}
        </Badge>

        <AlertDialog.Root>
          <AlertDialog.Trigger>
            <Button variant="soft" color="amber" disabled={resetting}>
              <ReloadIcon />
              Reset progress
            </Button>
          </AlertDialog.Trigger>
          <AlertDialog.Content maxWidth="420px">
            <AlertDialog.Title>Reset progress?</AlertDialog.Title>
            <AlertDialog.Description size="2">
              This marks every card in this set back to “New”. Your terms and
              definitions are kept.
            </AlertDialog.Description>
            <Flex gap="3" mt="4" justify="end">
              <AlertDialog.Cancel>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action>
                <Button color="amber" onClick={handleReset}>
                  Reset progress
                </Button>
              </AlertDialog.Action>
            </Flex>
          </AlertDialog.Content>
        </AlertDialog.Root>

        <Button onClick={onClose}>Done</Button>
        <IconButton
          variant="ghost"
          color="gray"
          aria-label="Close editor"
          onClick={onClose}
        >
          <Cross2Icon width="18" height="18" />
        </IconButton>
      </Flex>

      {/* Body */}
      <Box style={{ flex: 1, minHeight: 0 }}>
        <ScrollArea type="auto" scrollbars="vertical" style={{ height: "100%" }}>
          <Box px="4" py="5">
            <Box style={{ maxWidth: 720, margin: "0 auto" }}>
              {cards.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: EASE }}
                >
                  <Card size="2">
                    <Flex
                      align="center"
                      justify="center"
                      direction="column"
                      gap="2"
                      py="6"
                    >
                      <Text size="3" color="gray">
                        No cards yet — add one below.
                      </Text>
                    </Flex>
                  </Card>
                </motion.div>
              ) : (
                <Flex direction="column" gap="3">
                  <AnimatePresence initial={false}>
                    {cards.map((card, i) => {
                      const meta = STATUS_META[card.status] || STATUS_META.new;
                      return (
                        <motion.div
                          key={card.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.22, ease: EASE }}
                        >
                          <Card size="2">
                            <Flex gap="3" align="start">
                              <Flex
                                direction="column"
                                align="center"
                                gap="2"
                                style={{ flexShrink: 0, width: 56, paddingTop: 4 }}
                              >
                                <Text size="2" color="gray" weight="medium">
                                  {i + 1}
                                </Text>
                                <Badge color={meta.color} variant="soft">
                                  {meta.label}
                                </Badge>
                              </Flex>

                              <Box style={{ flex: 1, minWidth: 0 }}>
                                <Flex direction="column" gap="2">
                                  <TextField.Root
                                    size="2"
                                    placeholder="Term"
                                    aria-label={`Term for card ${i + 1}`}
                                    value={card.term}
                                    ref={(el) => {
                                      if (el) termRefs.current[card.id] = el;
                                      else delete termRefs.current[card.id];
                                    }}
                                    onFocus={(e) => {
                                      editStartValue.current = e.target.value;
                                    }}
                                    onChange={(e) =>
                                      setLocalCard(card.id, {
                                        term: e.target.value,
                                      })
                                    }
                                    onBlur={(e) =>
                                      commitField(card, "term", e.target.value)
                                    }
                                  />
                                  <TextArea
                                    size="2"
                                    rows={2}
                                    placeholder="Definition"
                                    aria-label={`Definition for card ${i + 1}`}
                                    value={card.definition}
                                    onFocus={(e) => {
                                      editStartValue.current = e.target.value;
                                    }}
                                    onChange={(e) =>
                                      setLocalCard(card.id, {
                                        definition: e.target.value,
                                      })
                                    }
                                    onBlur={(e) =>
                                      commitField(
                                        card,
                                        "definition",
                                        e.target.value
                                      )
                                    }
                                    style={{ resize: "vertical" }}
                                  />
                                </Flex>
                              </Box>

                              <Box style={{ flexShrink: 0, paddingTop: 4 }}>
                                <AlertDialog.Root>
                                  <AlertDialog.Trigger>
                                    <IconButton
                                      variant="soft"
                                      color="red"
                                      aria-label={`Delete card ${i + 1}`}
                                    >
                                      <TrashIcon />
                                    </IconButton>
                                  </AlertDialog.Trigger>
                                  <AlertDialog.Content maxWidth="420px">
                                    <AlertDialog.Title>
                                      Delete card?
                                    </AlertDialog.Title>
                                    <AlertDialog.Description size="2">
                                      This permanently removes this card from the
                                      set. This can’t be undone.
                                    </AlertDialog.Description>
                                    <Flex gap="3" mt="4" justify="end">
                                      <AlertDialog.Cancel>
                                        <Button variant="soft" color="gray">
                                          Cancel
                                        </Button>
                                      </AlertDialog.Cancel>
                                      <AlertDialog.Action>
                                        <Button
                                          color="red"
                                          onClick={() => handleDelete(card)}
                                        >
                                          Delete card
                                        </Button>
                                      </AlertDialog.Action>
                                    </Flex>
                                  </AlertDialog.Content>
                                </AlertDialog.Root>
                              </Box>
                            </Flex>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </Flex>
              )}
            </Box>
          </Box>
        </ScrollArea>
      </Box>

      {/* Footer / sticky add */}
      <Box
        style={{
          borderTop: "1px solid var(--gray-a4)",
          background: "var(--color-panel-solid)",
          flexShrink: 0,
        }}
      >
        <Box px="4" py="3">
          <Box style={{ maxWidth: 720, margin: "0 auto" }}>
            <Button
              size="3"
              variant="soft"
              onClick={handleAdd}
              disabled={adding}
              style={{ width: "100%" }}
            >
              <PlusIcon />
              Add card
            </Button>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}
