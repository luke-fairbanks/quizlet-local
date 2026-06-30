import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Grid,
  Heading,
  ScrollArea,
  Text,
} from "@radix-ui/themes";
import {
  CheckCircledIcon,
  InfoCircledIcon,
  ReloadIcon,
  TimerIcon,
} from "@radix-ui/react-icons";

const MAX_TILES = 6;
const WRONG_FLASH_MS = 500;
const EASE = [0.16, 1, 0.3, 1];

// Fisher-Yates shuffle (returns a new array).
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Build the 2 * n tiles (a term + a definition per chosen card), shuffled.
function buildRound(cards) {
  const pool = cards.filter((c) => c && c.id != null);
  const chosen = shuffle(pool).slice(0, MAX_TILES);
  const tiles = [];
  for (const card of chosen) {
    tiles.push({
      key: `${card.id}-term`,
      cardId: card.id,
      side: "term",
      text: card.term ?? "",
    });
    tiles.push({
      key: `${card.id}-def`,
      cardId: card.id,
      side: "definition",
      text: card.definition ?? "",
    });
  }
  return { tiles: shuffle(tiles), pairCount: chosen.length };
}

export default function MatchMode({ cards }) {
  const list = Array.isArray(cards) ? cards : [];

  const [round, setRound] = useState(() => buildRound(list));
  const [matchedIds, setMatchedIds] = useState(() => new Set());
  const [selectedKey, setSelectedKey] = useState(null);
  const [wrongKeys, setWrongKeys] = useState(null); // [keyA, keyB] flashing red
  const [announcement, setAnnouncement] = useState(""); // screen-reader live text

  // Timer state: starts on first interaction, stops on completion.
  const [startedAt, setStartedAt] = useState(null);
  const [finalSeconds, setFinalSeconds] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const wrongTimer = useRef(null);
  const intervalRef = useRef(null);

  const complete =
    round.pairCount > 0 && matchedIds.size === round.pairCount;

  // Start a fresh round whenever the underlying cards change identity/length.
  // Keyed by a lightweight signature so we don't reshuffle on every render.
  const signature = useMemo(
    () => list.map((c) => c?.id).join("|") + ":" + list.length,
    [list]
  );
  const prevSignature = useRef(signature);
  useEffect(() => {
    if (prevSignature.current !== signature) {
      prevSignature.current = signature;
      resetRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const resetRound = useCallback(() => {
    if (wrongTimer.current) {
      clearTimeout(wrongTimer.current);
      wrongTimer.current = null;
    }
    setRound(buildRound(list));
    setMatchedIds(new Set());
    setSelectedKey(null);
    setWrongKeys(null);
    setStartedAt(null);
    setFinalSeconds(null);
    setElapsed(0);
    setAnnouncement("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  // Drive the counting-up timer.
  useEffect(() => {
    if (startedAt == null || complete) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startedAt, complete]);

  // Freeze the final time the moment the round completes.
  useEffect(() => {
    if (complete && finalSeconds == null) {
      const secs =
        startedAt != null ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      setFinalSeconds(secs);
      setElapsed(secs);
      setAnnouncement(`All pairs matched in ${formatTime(secs)}.`);
    }
  }, [complete, finalSeconds, startedAt]);

  // Cleanup any pending timers on unmount.
  useEffect(() => {
    return () => {
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const displaySeconds = finalSeconds != null ? finalSeconds : elapsed;

  const handleTileClick = useCallback(
    (tile) => {
      if (matchedIds.has(tile.cardId)) return; // already matched
      if (wrongKeys) return; // ignore during the wrong-pair flash
      if (complete) return;

      // Begin the timer on the first interaction.
      if (startedAt == null) setStartedAt(Date.now());

      // Clicking the already-selected tile deselects it.
      if (selectedKey === tile.key) {
        setSelectedKey(null);
        return;
      }

      // First selection of the pair.
      if (selectedKey == null) {
        setSelectedKey(tile.key);
        return;
      }

      // Second selection: resolve against the first.
      const first = round.tiles.find((t) => t.key === selectedKey);
      if (!first) {
        setSelectedKey(tile.key);
        return;
      }

      if (first.cardId === tile.cardId && first.side !== tile.side) {
        // Match!
        setMatchedIds((cur) => {
          const next = new Set(cur);
          next.add(tile.cardId);
          return next;
        });
        setSelectedKey(null);
        setAnnouncement("Matched.");
      } else {
        // Wrong pair — flash both red, then deselect.
        setAnnouncement("Not a match, try again.");
        setWrongKeys([first.key, tile.key]);
        wrongTimer.current = setTimeout(() => {
          setWrongKeys(null);
          setSelectedKey(null);
          wrongTimer.current = null;
        }, WRONG_FLASH_MS);
      }
    },
    [matchedIds, wrongKeys, complete, startedAt, selectedKey, round.tiles]
  );

  // ---- Empty / tiny-set state -------------------------------------------
  if (list.length < 2) {
    return (
      <Flex
        align="center"
        justify="center"
        style={{ height: "100%", width: "100%", padding: "var(--space-5)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE }}
          style={{ maxWidth: 420, width: "100%" }}
        >
          <Callout.Root color="indigo">
            <Callout.Icon>
              <InfoCircledIcon />
            </Callout.Icon>
            <Callout.Text>Add at least 2 cards to play Match.</Callout.Text>
          </Callout.Root>
        </motion.div>
      </Flex>
    );
  }

  return (
    <Flex
      direction="column"
      style={{ height: "100%", width: "100%", minHeight: 0 }}
    >
      {/* Header: timer, progress, play again */}
      <Flex
        align="center"
        justify="between"
        gap="3"
        px="4"
        py="3"
        style={{
          flexShrink: 0,
          borderBottom: "1px solid var(--gray-a4)",
        }}
      >
        <Flex align="center" gap="2">
          <TimerIcon
            width="18"
            height="18"
            color="var(--indigo-9)"
            aria-hidden
          />
          <Text size="4" weight="bold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatTime(displaySeconds)}
          </Text>
        </Flex>

        <Flex align="center" gap="3">
          {list.length > round.pairCount && (
            <Text size="1" color="gray">
              {round.pairCount} of {list.length} cards
            </Text>
          )}
          <Badge color="grass" size="2" variant="soft">
            {matchedIds.size} / {round.pairCount} matched
          </Badge>
          <Button
            variant="soft"
            color="indigo"
            onClick={resetRound}
            aria-label="Play again with a new set of cards"
          >
            <ReloadIcon />
            Play again
          </Button>
        </Flex>
      </Flex>

      {/* Screen-reader announcements for selection/match/completion. */}
      <Box
        role="status"
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        {announcement}
      </Box>

      {/* Body */}
      <Box style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <ScrollArea type="hover" scrollbars="vertical" style={{ height: "100%" }}>
          <Box px="4" py="4" style={{ maxWidth: 960, margin: "0 auto" }}>
            <AnimatePresence mode="wait" initial={false}>
              {complete ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: EASE }}
                >
                  <Flex
                    align="center"
                    justify="center"
                    style={{ minHeight: "40vh" }}
                  >
                    <Card size="4" style={{ maxWidth: 460, width: "100%" }}>
                      <Flex direction="column" align="center" gap="4" py="3">
                        <CheckCircledIcon
                          width="44"
                          height="44"
                          color="var(--grass-9)"
                        />
                        <Heading size="6" align="center">
                          Nice work!
                        </Heading>
                        <Text size="4" align="center">
                          Matched all {round.pairCount}{" "}
                          {round.pairCount === 1 ? "pair" : "pairs"} in{" "}
                          <Text weight="bold">{formatTime(displaySeconds)}</Text>
                        </Text>
                        <Button
                          size="3"
                          color="indigo"
                          onClick={resetRound}
                          mt="2"
                        >
                          <ReloadIcon />
                          Play again
                        </Button>
                      </Flex>
                    </Card>
                  </Flex>
                </motion.div>
              ) : (
                <Grid
                  key="grid"
                  columns={{ initial: "2", sm: "3", md: "4" }}
                  gap="3"
                  width="auto"
                >
                  <AnimatePresence initial={false}>
                    {round.tiles
                      .filter((tile) => !matchedIds.has(tile.cardId))
                      .map((tile) => {
                        const isSelected = selectedKey === tile.key;
                        const isWrong = !!wrongKeys && wrongKeys.includes(tile.key);
                        const isDef = tile.side === "definition";
                        return (
                          <motion.div
                            key={tile.key}
                            layout
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={
                              isWrong
                                ? { opacity: 1, scale: 1, x: [0, -6, 6, -4, 4, 0] }
                                : { opacity: 1, scale: 1, x: 0 }
                            }
                            exit={{ opacity: 0, scale: 0.6 }}
                            transition={{ duration: 0.22, ease: EASE }}
                            style={{ minWidth: 0 }}
                          >
                            <button
                              type="button"
                              onClick={() => handleTileClick(tile)}
                              aria-pressed={isSelected}
                              aria-label={`${isDef ? "Definition" : "Term"}: ${tile.text}`}
                              style={{
                                all: "unset",
                                boxSizing: "border-box",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                                width: "100%",
                                minHeight: 110,
                                padding: "var(--space-3)",
                                cursor: "pointer",
                                borderRadius: "var(--radius-4)",
                                background: isWrong
                                  ? "var(--red-a4)"
                                  : isSelected
                                  ? "var(--indigo-a4)"
                                  : "var(--color-panel-solid)",
                                border: isWrong
                                  ? "2px solid var(--red-9)"
                                  : isSelected
                                  ? "2px solid var(--indigo-9)"
                                  : "1px solid var(--gray-a5)",
                                boxShadow: isSelected
                                  ? "0 0 0 3px var(--indigo-a4)"
                                  : "none",
                                transition:
                                  "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
                              }}
                            >
                              <Text
                                as="span"
                                size={isDef ? "2" : "3"}
                                weight={isDef ? "regular" : "medium"}
                                color={isDef ? "gray" : undefined}
                                style={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 4,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  overflowWrap: "anywhere",
                                  lineHeight: 1.35,
                                }}
                              >
                                {tile.text}
                              </Text>
                            </button>
                          </motion.div>
                        );
                      })}
                  </AnimatePresence>
                </Grid>
              )}
            </AnimatePresence>
          </Box>
        </ScrollArea>
      </Box>
    </Flex>
  );
}
