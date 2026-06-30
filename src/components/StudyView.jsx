import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  IconButton,
  Kbd,
  Progress,
  ScrollArea,
  SegmentedControl,
  Separator,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Cross2Icon,
  ResetIcon,
  ShuffleIcon,
  SymbolIcon,
} from "@radix-ui/react-icons";
import { shuffle } from "../lib/util.js";
import { STATUS_META, computeProgress } from "../lib/progress.js";
import LearnMode from "./LearnMode.jsx";
import QuizMode from "./QuizMode.jsx";
import MatchMode from "./MatchMode.jsx";

const EASE = [0.16, 1, 0.3, 1];

export default function StudyView({ set, onClose, onStatus }) {
  const cards = useMemo(
    () => (Array.isArray(set?.cards) ? set.cards : []),
    [set]
  );

  const [order, setOrder] = useState(cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState("flashcards");
  // Local status overrides so marking known/learning reflects instantly
  // without resetting study position from a prop change.
  const [statusById, setStatusById] = useState({});

  const overlayRef = useRef(null);
  const titleId = useId();

  // Defense-in-depth resync (App also keys this component by set id).
  useEffect(() => {
    setOrder(cards);
    setIndex(0);
    setFlipped(false);
    setStatusById({});
  }, [cards]);

  const total = order.length;
  const card = order[index];

  const statusOf = useCallback(
    (c) => (c ? statusById[c.id] ?? c.status ?? "new" : "new"),
    [statusById]
  );

  // Working cards with current (possibly locally-overridden) statuses.
  const workingCards = useMemo(
    () => order.map((c) => ({ ...c, status: statusById[c.id] ?? c.status ?? "new" })),
    [order, statusById]
  );
  const prog = useMemo(() => computeProgress({ cards: workingCards }), [workingCards]);

  const applyStatus = useCallback(
    (cardId, status) => {
      setStatusById((prev) => ({ ...prev, [cardId]: status }));
      Promise.resolve(onStatus?.(cardId, status)).catch(() => {});
    },
    [onStatus]
  );

  const goTo = useCallback(
    (next) => {
      if (total === 0) return;
      setFlipped(false);
      setIndex(((next % total) + total) % total);
    },
    [total]
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  const doShuffle = useCallback(() => {
    setOrder(shuffle(cards));
    setIndex(0);
    setFlipped(false);
  }, [cards]);

  const restart = useCallback(() => {
    setOrder(cards);
    setIndex(0);
    setFlipped(false);
  }, [cards]);

  const flip = useCallback(() => setFlipped((f) => !f), []);

  const markAndAdvance = useCallback(
    (status) => {
      if (!card) return;
      applyStatus(card.id, status);
      next();
    },
    [card, applyStatus, next]
  );

  // Move focus into the overlay on mount; restore it on unmount.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    overlayRef.current?.focus();
    return () => {
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, []);

  // Keyboard: flashcard nav/flip/status + shuffle, plus Esc and a focus trap.
  // Quiz/Match own their key handling; flashcard keys are gated to that mode.
  useEffect(() => {
    function onKeyDown(e) {
      // Escape always closes, even when typing in Learn mode's answer field.
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const t = e.target;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Tab") {
        const nodes = overlayRef.current?.querySelectorAll(
          'button, [href], [tabindex]:not([tabindex="-1"])'
        );
        const list = nodes
          ? Array.from(nodes).filter((el) => !el.disabled && el.offsetParent !== null)
          : [];
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }

      if (mode !== "flashcards") return;

      const onControl =
        t &&
        (t.tagName === "BUTTON" ||
          t.tagName === "A" ||
          t.getAttribute?.("role") === "button");

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prev();
          break;
        case " ":
        case "Enter":
          if (!onControl) {
            e.preventDefault();
            flip();
          }
          break;
        case "1":
          e.preventDefault();
          markAndAdvance("learning");
          break;
        case "2":
          e.preventDefault();
          markAndAdvance("known");
          break;
        case "s":
        case "S":
          e.preventDefault();
          doShuffle();
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, next, prev, flip, doShuffle, markAndAdvance, onClose]);

  const progress = total > 0 ? ((index + 1) / total) * 100 : 0;

  const faceStyle = {
    background: "var(--color-panel-solid)",
    border: "1px solid var(--gray-a5)",
    boxShadow: "0 18px 50px -20px rgba(0,0,0,0.55)",
  };
  const faceLabelStyle = {
    position: "absolute",
    top: 18,
    left: 0,
    right: 0,
    textAlign: "center",
    letterSpacing: "0.14em",
  };

  const currentStatus = statusOf(card);
  const meta = STATUS_META[currentStatus] || STATUS_META.new;

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
        zIndex: 200,
        background: "var(--color-background)",
        display: "flex",
        flexDirection: "column",
        outline: "none",
      }}
    >
      {/* Top bar */}
      <Flex
        align="center"
        justify="between"
        gap="3"
        px="4"
        py="3"
        style={{ borderBottom: "1px solid var(--gray-a4)" }}
      >
        <Flex align="center" gap="2" style={{ minWidth: 0, flex: 1 }}>
          <Heading
            id={titleId}
            size="4"
            weight="medium"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {set?.title || "Untitled set"}
          </Heading>
          <Badge color="indigo" variant="soft" radius="full">
            {total} {total === 1 ? "card" : "cards"}
          </Badge>
          {prog.known > 0 && (
            <Badge color="grass" variant="soft" radius="full">
              {prog.known} known
            </Badge>
          )}
        </Flex>

        <SegmentedControl.Root
          value={mode}
          onValueChange={setMode}
          size="2"
          aria-label="Study mode"
        >
          <SegmentedControl.Item value="flashcards">
            Flashcards
          </SegmentedControl.Item>
          <SegmentedControl.Item value="learn">Learn</SegmentedControl.Item>
          <SegmentedControl.Item value="quiz">Quiz</SegmentedControl.Item>
          <SegmentedControl.Item value="match">Match</SegmentedControl.Item>
          <SegmentedControl.Item value="list">List</SegmentedControl.Item>
        </SegmentedControl.Root>

        <Flex align="center" gap="2" justify="end" style={{ flex: 1 }}>
          {mode === "flashcards" && (
            <>
              <Tooltip content="Shuffle (S)">
                <IconButton
                  size="2"
                  variant="soft"
                  color="gray"
                  aria-label="Shuffle cards"
                  onClick={doShuffle}
                >
                  <ShuffleIcon />
                </IconButton>
              </Tooltip>
              <Tooltip content="Restart">
                <IconButton
                  size="2"
                  variant="soft"
                  color="gray"
                  aria-label="Restart from the first card"
                  onClick={restart}
                >
                  <ResetIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip content="Close (Esc)">
            <IconButton
              size="2"
              variant="soft"
              color="gray"
              aria-label="Close study view"
              onClick={onClose}
            >
              <Cross2Icon />
            </IconButton>
          </Tooltip>
        </Flex>
      </Flex>

      {/* Body */}
      {total === 0 ? (
        <Flex flexGrow="1" align="center" justify="center" p="6">
          <Text size="3" color="gray">
            This set has no cards.
          </Text>
        </Flex>
      ) : mode === "learn" ? null : mode === "quiz" ? (
        <Box flexGrow="1" style={{ minHeight: 0, overflow: "auto" }}>
          <QuizMode cards={workingCards} onStatus={applyStatus} />
        </Box>
      ) : mode === "match" ? (
        <Box flexGrow="1" style={{ minHeight: 0, overflow: "auto" }}>
          <MatchMode cards={workingCards} />
        </Box>
      ) : mode === "list" ? (
        <ScrollArea type="auto" scrollbars="vertical" style={{ height: "100%" }}>
          <Box px="4" py="5" style={{ maxWidth: 860, margin: "0 auto" }}>
            <Grid columns="1fr 1.4fr" gapX="5" gapY="0" align="center">
              {workingCards.map((c, i) => {
                const m = STATUS_META[c.status] || STATUS_META.new;
                return (
                  <Box
                    key={c.term + "" + c.definition + "" + i}
                    style={{ display: "contents" }}
                  >
                    <Box py="3">
                      <Flex align="center" gap="2">
                        <Box
                          role="img"
                          aria-label={`${m.label} status`}
                          title={m.label}
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            flexShrink: 0,
                            background: `var(--${m.color}-9)`,
                          }}
                        />
                        <Text size="3" weight="medium">
                          {c.term}
                        </Text>
                      </Flex>
                    </Box>
                    <Box py="3">
                      <Text size="3" color="gray">
                        {c.definition}
                      </Text>
                    </Box>
                    {i < workingCards.length - 1 && (
                      <Box style={{ gridColumn: "1 / -1" }}>
                        <Separator size="4" />
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Grid>
          </Box>
        </ScrollArea>
      ) : (
        // Flashcards
        <Flex
          flexGrow="1"
          direction="column"
          align="center"
          justify="center"
          gap="4"
          px="4"
          py="5"
          style={{ minHeight: 0 }}
        >
          {/* Progress + current status */}
          <Box style={{ width: "min(640px, 92vw)" }}>
            <Flex align="center" justify="between" mb="2">
              <Text size="1" color="gray">
                {index + 1} / {total}
              </Text>
              <Badge color={meta.color} variant="soft" radius="full">
                {meta.label}
              </Badge>
            </Flex>
            <Progress value={progress} size="2" color="indigo" />
          </Box>

          {/* Flashcard */}
          <div
            className="flashcard-scene"
            style={{
              position: "relative",
              width: "min(640px, 92vw)",
              height: "min(360px, 48vh)",
              cursor: "pointer",
            }}
            onClick={flip}
          >
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.18, ease: EASE }}
              style={{ position: "absolute", inset: 0 }}
            >
              <motion.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  transformStyle: "preserve-3d",
                }}
              >
                <div
                  className="flashcard-face"
                  style={faceStyle}
                  aria-hidden={flipped}
                >
                  <Text size="1" color="gray" style={faceLabelStyle}>
                    TERM
                  </Text>
                  <Text size="6" weight="medium">
                    {card.term}
                  </Text>
                </div>
                <div
                  className="flashcard-face flashcard-face--back"
                  style={faceStyle}
                  aria-hidden={!flipped}
                >
                  <Text size="1" color="indigo" style={faceLabelStyle}>
                    DEFINITION
                  </Text>
                  <Text size="5">{card.definition}</Text>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Status controls */}
          <Flex align="center" gap="3">
            <Button
              size="2"
              variant="soft"
              color="amber"
              onClick={() => markAndAdvance("learning")}
            >
              Still learning
            </Button>
            <Button
              size="2"
              variant="soft"
              color="grass"
              onClick={() => markAndAdvance("known")}
            >
              Known
            </Button>
          </Flex>

          {/* Navigation */}
          <Flex align="center" gap="3">
            <Button
              size="2"
              variant="soft"
              color="gray"
              onClick={prev}
              aria-label="Previous card"
            >
              <ChevronLeftIcon /> Prev
            </Button>
            <Tooltip content="Flip (Space)">
              <Button size="2" variant="soft" onClick={flip} aria-label="Flip card">
                <SymbolIcon /> Flip
              </Button>
            </Tooltip>
            <Button
              size="2"
              variant="soft"
              color="gray"
              onClick={next}
              aria-label="Next card"
            >
              Next <ChevronRightIcon />
            </Button>
          </Flex>

          {/* Hint */}
          <Text size="1" color="gray" align="center">
            <Kbd>Space</Kbd> flip · <Kbd>←</Kbd> <Kbd>→</Kbd> navigate ·{" "}
            <Kbd>1</Kbd> learning · <Kbd>2</Kbd> known · <Kbd>S</Kbd> shuffle ·{" "}
            <Kbd>Esc</Kbd> close
          </Text>
        </Flex>
      )}

      {/* Learn stays mounted across mode switches so its session isn't lost;
          hidden (and keyboard-inert via `active`) when another mode is shown. */}
      {total > 0 && (
        <Box
          style={{
            display: mode === "learn" ? "flex" : "none",
            flex: 1,
            minHeight: 0,
            overflow: "auto",
          }}
        >
          <LearnMode
            cards={workingCards}
            onStatus={applyStatus}
            active={mode === "learn"}
          />
        </Box>
      )}
    </motion.div>
  );
}
