import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Kbd,
  Progress,
  Text,
} from "@radix-ui/themes";
import {
  CheckCircledIcon,
  CheckIcon,
  Cross2Icon,
  CrossCircledIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";

const EASE = [0.16, 1, 0.3, 1];

// Fisher–Yates shuffle (returns a new array).
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build the shuffled queue of questions. Each question has the prompt card and
// up to 4 shuffled options (correct definition + up to 3 distractors).
function buildQueue(cards) {
  const order = shuffle(cards);
  return order.map((card) => {
    // Distractor pool: definitions from *other* cards, de-duped against the
    // correct answer and each other.
    const seen = new Set([card.definition]);
    const pool = [];
    for (const other of cards) {
      if (other.id === card.id) continue;
      if (!other.definition || !other.definition.trim()) continue; // skip blanks
      if (seen.has(other.definition)) continue;
      seen.add(other.definition);
      pool.push(other.definition);
    }
    const distractors = shuffle(pool).slice(0, 3);
    const options = shuffle([card.definition, ...distractors]);
    return { card, options, answer: card.definition };
  });
}

export default function QuizMode({ cards, onStatus }) {
  const usable = Array.isArray(cards) ? cards : [];
  const canQuiz = usable.length >= 2;

  const [queue, setQueue] = useState(() => buildQueue(usable));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null); // chosen option string (locked)
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  // Rebuild the queue whenever the underlying set changes identity/size.
  const cardsKey = useMemo(
    () => usable.map((c) => c.id).join("|") + ":" + usable.length,
    [usable]
  );

  const restart = useCallback(() => {
    setQueue(buildQueue(usable));
    setIndex(0);
    setPicked(null);
    setScore(0);
    setDone(false);
  }, [usable]);

  useEffect(() => {
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardsKey]);

  const total = queue.length;
  const current = !done && index < total ? queue[index] : null;
  const answered = picked !== null;

  const choose = useCallback(
    (option) => {
      if (picked !== null || !current) return;
      setPicked(option);
      const correct = option === current.answer;
      if (correct) setScore((s) => s + 1);
      Promise.resolve(
        onStatus?.(current.card.id, correct ? "known" : "learning")
      ).catch(() => {});
    },
    [picked, current, onStatus]
  );

  const advance = useCallback(() => {
    if (picked === null) return;
    if (index + 1 >= total) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
      setPicked(null);
    }
  }, [picked, index, total]);

  // Keyboard: 1–4 select an option, Enter advances. Scoped to this component
  // and cleaned up on every state change so handlers never leak/stack.
  useEffect(() => {
    if (!canQuiz || done) return;
    function onKey(e) {
      const t = e.target;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Enter") {
        if (answered) {
          e.preventDefault();
          advance();
        }
        return;
      }
      if (!answered && current) {
        const n = Number(e.key);
        if (n >= 1 && n <= current.options.length) {
          e.preventDefault();
          choose(current.options[n - 1]);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canQuiz, done, answered, current, advance, choose]);

  // ---- Empty / tiny-set state -------------------------------------------
  if (!canQuiz) {
    return (
      <Flex
        align="center"
        justify="center"
        style={{ minHeight: "100%", width: "100%", padding: "24px" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE }}
          style={{ maxWidth: 440, width: "100%" }}
        >
          <Callout.Root color="indigo" variant="surface">
            <Callout.Icon>
              <CheckCircledIcon />
            </Callout.Icon>
            <Callout.Text>Add at least 2 cards to take a quiz.</Callout.Text>
          </Callout.Root>
        </motion.div>
      </Flex>
    );
  }

  const progressValue = total ? (index / total) * 100 : 0;

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      style={{ minHeight: "100%", width: "100%", padding: "24px" }}
    >
      <Box style={{ width: "100%", maxWidth: 640 }}>
        {/* Header: position progress + running score */}
        <Flex align="center" justify="between" gap="3" mb="3">
          <Text size="2" color="gray">
            {done ? "Complete" : `Question ${index + 1} / ${total}`}
          </Text>
          <Badge color="grass" variant="soft" size="2">
            Score {score} / {total}
          </Badge>
        </Flex>
        <Progress
          value={done ? 100 : progressValue}
          size="2"
          color="indigo"
          mb="5"
        />

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="end"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              <EndScreen score={score} total={total} onRestart={restart} />
            </motion.div>
          ) : (
            current && (
              <motion.div
                key={`q-${index}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                <Question
                  question={current}
                  picked={picked}
                  answered={answered}
                  onChoose={choose}
                  onAdvance={advance}
                />
              </motion.div>
            )
          )}
        </AnimatePresence>
      </Box>
    </Flex>
  );
}

function Question({ question, picked, answered, onChoose, onAdvance }) {
  const { card, options, answer } = question;
  const nextRef = useRef(null);

  // Move focus to Next when an answer is locked, so keyboard users aren't
  // stranded on a now-disabled option.
  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);

  return (
    <Card size="3">
      <Flex direction="column" gap="4">
        <Box>
          <Text size="1" color="gray" weight="medium">
            Which definition matches this term?
          </Text>
          <Heading size="6" mt="1" style={{ lineHeight: 1.25 }}>
            {card.term}
          </Heading>
        </Box>

        <Flex direction="column" gap="2">
          {options.map((option, i) => {
            const isCorrect = option === answer;
            const isPicked = option === picked;

            let color;
            let variant = "surface";
            if (answered) {
              if (isCorrect) {
                color = "green";
                variant = "soft";
              } else if (isPicked) {
                color = "red";
                variant = "soft";
              } else {
                variant = "surface";
              }
            }

            return (
              <Button
                key={`${i}-${option}`}
                size="3"
                variant={variant}
                color={color}
                disabled={answered}
                onClick={() => onChoose(option)}
                style={{
                  justifyContent: "flex-start",
                  height: "auto",
                  minHeight: 48,
                  paddingTop: 10,
                  paddingBottom: 10,
                  textAlign: "left",
                  // Keep the visual treatment when locked even though disabled.
                  opacity: 1,
                  cursor: answered ? "default" : "pointer",
                  boxShadow: answered
                    ? isCorrect
                      ? "inset 0 0 0 2px var(--grass-9)"
                      : isPicked
                      ? "inset 0 0 0 2px var(--red-9)"
                      : "none"
                    : "none",
                  transition:
                    "background-color 0.25s ease, border-color 0.25s ease, color 0.2s ease, box-shadow 0.2s ease",
                }}
              >
                <Kbd size="2">{i + 1}</Kbd>
                <Text
                  as="span"
                  color={option && option.trim() ? undefined : "gray"}
                  style={{
                    whiteSpace: "normal",
                    flex: 1,
                    lineHeight: 1.35,
                  }}
                >
                  {option && option.trim() ? option : "(no definition)"}
                </Text>
                {answered && isCorrect && (
                  <CheckIcon width="18" height="18" />
                )}
                {answered && isPicked && !isCorrect && (
                  <Cross2Icon width="18" height="18" />
                )}
              </Button>
            );
          })}
        </Flex>

        <Flex align="center" justify="between" gap="3" mt="1">
          <Box style={{ minHeight: 24 }} role="status" aria-live="polite">
            {answered && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                {picked === answer ? (
                  <Flex align="center" gap="1">
                    <CheckCircledIcon color="var(--grass-9)" />
                    <Text size="2" color="grass" weight="medium">
                      Correct
                    </Text>
                  </Flex>
                ) : (
                  <Flex align="center" gap="1">
                    <CrossCircledIcon color="var(--red-9)" />
                    <Text size="2" color="red" weight="medium">
                      Not quite
                    </Text>
                  </Flex>
                )}
              </motion.div>
            )}
          </Box>
          {answered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              <Button size="3" onClick={onAdvance} ref={nextRef}>
                Next
              </Button>
            </motion.div>
          )}
        </Flex>
      </Flex>
    </Card>
  );
}

function EndScreen({ score, total, onRestart }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  return (
    <Flex align="center" justify="center" style={{ width: "100%" }}>
      <Card size="4" style={{ width: "100%", maxWidth: 480 }}>
        <Flex direction="column" align="center" gap="4" py="4">
          <CheckCircledIcon
            width="44"
            height="44"
            color="var(--grass-9)"
          />
          <Heading size="7" align="center">
            You scored {score} / {total}
          </Heading>
          <Badge size="3" color="grass" variant="soft">
            {pct}% known
          </Badge>
          <Text size="2" color="gray" align="center">
            {pct === 100
              ? "Perfect run — you nailed every card."
              : "Run it again to lock in the ones you missed."}
          </Text>
          <Button size="3" onClick={onRestart} mt="2">
            <ReloadIcon /> Restart quiz
          </Button>
        </Flex>
      </Card>
    </Flex>
  );
}
