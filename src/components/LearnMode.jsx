import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  SegmentedControl,
  Text,
  TextField,
} from "@radix-ui/themes";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  InfoCircledIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { shuffle, answerMatches, normalizeAnswer } from "../lib/util.js";

const EASE = [0.16, 1, 0.3, 1];
const MASTERY = 2; // correct answers (MC then written) to master a card

// A card is "learnable" in a direction only if both sides have text.
function learnableCards(cards, answerSide, promptSide) {
  return (cards || []).filter(
    (c) =>
      c &&
      String(c[answerSide] || "").trim() &&
      String(c[promptSide] || "").trim()
  );
}

function seedBoxes(cards) {
  const boxes = {};
  for (const c of cards) boxes[c.id] = c.status === "known" ? 1 : 0;
  return boxes;
}

export default function LearnMode({ cards, onStatus, active = true }) {
  const [direction, setDirection] = useState("term"); // which side you answer with
  const [announcement, setAnnouncement] = useState(""); // screen-reader live text
  const answerSide = direction;
  const promptSide = direction === "term" ? "definition" : "term";

  const learnable = useMemo(
    () => learnableCards(cards, answerSide, promptSide),
    [cards, answerSide, promptSide]
  );
  const learnableRef = useRef(learnable);
  learnableRef.current = learnable;

  const byId = useMemo(() => {
    const m = {};
    for (const c of learnable) m[c.id] = c;
    return m;
  }, [learnable]);

  const canLearn = learnable.length >= 2;

  // --- session state (built once; rebuilt on restart / direction change) ---
  const [boxes, setBoxes] = useState(() => seedBoxes(learnable));
  const [queue, setQueue] = useState(() => shuffle(learnable.map((c) => c.id)));
  const [done, setDone] = useState(false);

  // Per-question transient state.
  const [phase, setPhase] = useState("question"); // "question" | "feedback"
  const [picked, setPicked] = useState(null); // MC choice
  const [input, setInput] = useState(""); // written answer
  const [result, setResult] = useState(null); // { correct, expected, mastered, prevBox, written }

  const restart = useCallback(() => {
    const ls = learnableRef.current;
    setBoxes(seedBoxes(ls));
    setQueue(shuffle(ls.map((c) => c.id)));
    setDone(false);
    setPhase("question");
    setPicked(null);
    setInput("");
    setResult(null);
    setAnnouncement("");
  }, []);

  // Rebuild when the answer direction changes (but NOT on every cards-content
  // change — onStatus updates the cards prop and must not reset the session).
  const firstMount = useRef(true);
  useEffect(() => {
    if (firstMount.current) {
      firstMount.current = false;
      return;
    }
    restart();
  }, [direction, restart]);

  const total = learnable.length;
  const mastered = learnable.filter((c) => boxes[c.id] >= MASTERY).length;
  const progress = total ? (mastered / total) * 100 : 0;

  const currentId = queue[0];
  const card = currentId != null ? byId[currentId] : null;
  const box = currentId != null ? boxes[currentId] ?? 0 : 0;
  const qtype = box === 0 ? "mc" : "written";

  // Build the current question (prompt + answer + MC options). Stable for a
  // given card/type/direction so MC options don't reshuffle on re-render.
  const question = useMemo(() => {
    if (!card) return null;
    const promptText = String(card[promptSide] || "");
    const answerText = String(card[answerSide] || "");
    let type = qtype;
    let options = null;
    if (qtype === "mc") {
      // Dedupe with the SAME normalization the grader uses, so no option can
      // normalize-equal the answer (which would grade a wrong-looking pick as
      // correct and double-highlight green).
      const seen = new Set([normalizeAnswer(answerText)]);
      const pool = [];
      for (const c of learnableRef.current) {
        if (c.id === card.id) continue;
        const v = String(c[answerSide] || "");
        const key = normalizeAnswer(v);
        if (!v.trim() || seen.has(key)) continue;
        seen.add(key);
        pool.push(v);
      }
      const opts = shuffle([answerText, ...shuffle(pool).slice(0, 3)]);
      if (opts.length < 2) {
        // Not enough distinct choices for a real multiple-choice — ask it in
        // writing instead of presenting a single forced-correct option.
        type = "written";
      } else {
        options = opts;
      }
    }
    return { type, promptText, answerText, options };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, qtype, direction]);

  // Grade the current card. We compute the next box but DON'T apply it here —
  // applying it now would change `qtype` mid-feedback and swap the question UI
  // out from under the user. The box + status are committed in next().
  const grade = useCallback(
    (correct) => {
      if (!card) return;
      const prevBox = boxes[card.id] ?? 0;
      const nb = correct ? Math.min(MASTERY, prevBox + 1) : 0;
      setResult({
        correct,
        expected: question?.answerText ?? "",
        mastered: nb >= MASTERY,
        prevBox,
        nb,
        written: question?.type === "written",
      });
      setAnnouncement(
        correct
          ? nb >= MASTERY
            ? "Correct. Mastered."
            : "Correct."
          : `Incorrect. The answer is ${question?.answerText ?? ""}.`
      );
      setPhase("feedback");
    },
    [card, boxes, question]
  );

  // "I was right" override after a written miss (typo forgiveness).
  const override = useCallback(() => {
    if (!result) return;
    const nb = Math.min(MASTERY, result.prevBox + 1);
    setResult((r) => ({ ...r, correct: true, nb, mastered: nb >= MASTERY }));
    setAnnouncement(nb >= MASTERY ? "Marked correct. Mastered." : "Marked correct.");
  }, [result]);

  const next = useCallback(() => {
    const id = queue[0];
    // Commit the graded box + persisted status now (deferred from grade()).
    if (id != null && result) {
      setBoxes((prev) => ({ ...prev, [id]: result.nb }));
      Promise.resolve(
        onStatus?.(id, result.nb >= MASTERY ? "known" : "learning")
      ).catch(() => {});
    }
    const isMastered = !!result && result.nb >= MASTERY;
    let q = queue.slice(1);
    if (!isMastered) q = [...q, id]; // re-queue until mastered
    setQueue(q);
    setPhase("question");
    setPicked(null);
    setInput("");
    setResult(null);
    setAnnouncement("");
    if (q.length === 0) setDone(true);
  }, [queue, result, onStatus]);

  const chooseMc = useCallback(
    (option) => {
      if (phase !== "question") return;
      setPicked(option);
      grade(answerMatches(option, question?.answerText ?? ""));
    },
    [phase, grade, question]
  );

  const submitWritten = useCallback(() => {
    if (phase !== "question") return;
    grade(answerMatches(input, question?.answerText ?? ""));
  }, [phase, grade, input, question]);

  // Focus the written input when a written question appears (and we're active).
  const inputRef = useRef(null);
  useEffect(() => {
    if (active && !done && phase === "question" && question?.type === "written") {
      inputRef.current?.focus();
    }
  }, [currentId, phase, done, active, question]);

  // Keyboard: 1–4 to pick (MC question), Enter to continue (feedback). Written
  // submit is handled on the input itself. Inert when this mode isn't active.
  useEffect(() => {
    if (!active) return;
    function onKey(e) {
      const t = e.target;
      const typing =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (phase === "feedback" && e.key === "Enter") {
        e.preventDefault();
        next();
        return;
      }
      if (phase === "question" && question?.type === "mc" && !typing && question?.options) {
        const n = Number(e.key);
        if (n >= 1 && n <= question.options.length) {
          e.preventDefault();
          chooseMc(question.options[n - 1]);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, phase, question, next, chooseMc]);

  // ---- empty / tiny-set state -------------------------------------------
  if (!canLearn) {
    return (
      <Flex
        align="center"
        justify="center"
        style={{ minHeight: "100%", width: "100%", padding: 24 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE }}
          style={{ maxWidth: 460, width: "100%" }}
        >
          <Callout.Root color="indigo" variant="surface">
            <Callout.Icon>
              <InfoCircledIcon />
            </Callout.Icon>
            <Callout.Text>
              Add at least 2 cards with both a term and definition to use Learn.
            </Callout.Text>
          </Callout.Root>
        </motion.div>
      </Flex>
    );
  }

  return (
    <Flex
      direction="column"
      align="center"
      style={{ minHeight: "100%", width: "100%", padding: 24 }}
    >
      {/* Persistent live region so feedback is announced to screen readers. */}
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

      <Box style={{ width: "100%", maxWidth: 640 }}>
        {/* Header: direction toggle + progress */}
        <Flex align="center" justify="between" gap="3" mb="3" wrap="wrap">
          <Flex align="center" gap="2">
            <Text size="1" color="gray">
              Answer with
            </Text>
            <SegmentedControl.Root
              size="1"
              value={direction}
              onValueChange={setDirection}
              aria-label="Answer with term or definition"
            >
              <SegmentedControl.Item value="term">Term</SegmentedControl.Item>
              <SegmentedControl.Item value="definition">
                Definition
              </SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>
          <Badge color="grass" variant="soft" size="2">
            {mastered} / {total} mastered
          </Badge>
        </Flex>
        <Progress value={progress} size="2" color="grass" mb="5" />

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              <EndScreen total={total} onRestart={restart} />
            </motion.div>
          ) : (
            card && question && (
              <motion.div
                // Key intentionally excludes `phase` so revealing an answer
                // updates the card in place — only a NEW question (different
                // card or escalated type) triggers the swap animation.
                key={`${currentId}-${qtype}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <Card size="3">
                  <Flex direction="column" gap="4">
                    <Flex align="center" justify="between">
                      <Text size="1" color="gray" weight="medium">
                        {question.type === "mc"
                          ? `Choose the ${answerSide}`
                          : `Type the ${answerSide}`}
                      </Text>
                      <BoxDots box={box} />
                    </Flex>

                    <Box>
                      <Text size="1" color="gray">
                        {promptLabel(promptSide)}
                      </Text>
                      <Heading size="6" mt="1" style={{ lineHeight: 1.3 }}>
                        {question.promptText}
                      </Heading>
                    </Box>

                    {question.type === "mc" ? (
                      <McOptions
                        options={question.options}
                        answer={question.answerText}
                        picked={picked}
                        answered={phase === "feedback"}
                        onChoose={chooseMc}
                      />
                    ) : (
                      <WrittenInput
                        inputRef={inputRef}
                        value={input}
                        onChange={setInput}
                        onSubmit={submitWritten}
                        answered={phase === "feedback"}
                        result={result}
                      />
                    )}

                    {phase === "feedback" && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, ease: EASE }}
                      >
                        <Feedback
                          result={result}
                          onContinue={next}
                          onOverride={override}
                        />
                      </motion.div>
                    )}
                  </Flex>
                </Card>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </Box>
    </Flex>
  );
}

function promptLabel(side) {
  return side === "term" ? "Term" : "Definition";
}

// Mastery progress dots for the current card (0..MASTERY).
function BoxDots({ box }) {
  return (
    <Flex align="center" gap="1" aria-label={`Mastery ${box} of ${MASTERY}`}>
      {Array.from({ length: MASTERY }).map((_, i) => (
        <Box
          key={i}
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: i < box ? "var(--grass-9)" : "var(--gray-a5)",
          }}
        />
      ))}
    </Flex>
  );
}

function McOptions({ options, answer, picked, answered, onChoose }) {
  return (
    <Flex direction="column" gap="2">
      {options.map((option, i) => {
        const isCorrect = answerMatches(option, answer);
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
            aria-label={
              answered
                ? isCorrect
                  ? `${option} — correct answer`
                  : isPicked
                  ? `${option} — your answer, incorrect`
                  : option
                : undefined
            }
            style={{
              justifyContent: "flex-start",
              height: "auto",
              minHeight: 48,
              paddingTop: 10,
              paddingBottom: 10,
              textAlign: "left",
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
            <Text as="span" style={{ whiteSpace: "normal", flex: 1, lineHeight: 1.35 }}>
              {option && option.trim() ? option : "(blank)"}
            </Text>
            {answered && isCorrect && (
              <CheckCircledIcon width="18" height="18" color="var(--grass-9)" />
            )}
            {answered && isPicked && !isCorrect && (
              <CrossCircledIcon width="18" height="18" color="var(--red-9)" />
            )}
          </Button>
        );
      })}
    </Flex>
  );
}

function WrittenInput({ inputRef, value, onChange, onSubmit, answered, result }) {
  const wrong = answered && result && !result.correct;
  const right = answered && result && result.correct;
  return (
    <Flex direction="column" gap="2">
      <TextField.Root
        ref={inputRef}
        size="3"
        placeholder="Type your answer…"
        value={value}
        disabled={answered}
        color={wrong ? "red" : right ? "green" : undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !answered) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      {!answered && (
        <Text size="1" color="gray">
          Press <Kbd>Enter</Kbd> to check.
        </Text>
      )}
      {wrong && (
        <Text size="2" color="gray">
          Answer:{" "}
          <Text as="span" weight="bold" color="green">
            {result.expected || "(blank)"}
          </Text>
        </Text>
      )}
    </Flex>
  );
}

function Feedback({ result, onContinue, onOverride }) {
  const continueRef = useRef(null);
  useEffect(() => {
    continueRef.current?.focus();
  }, []);
  return (
    <Flex align="center" justify="between" gap="3" mt="1">
      <Box style={{ minHeight: 24 }}>
        {result?.correct ? (
          <Flex align="center" gap="1">
            <CheckCircledIcon color="var(--grass-9)" />
            <Text size="2" color="grass" weight="medium">
              {result.mastered ? "Mastered!" : "Correct"}
            </Text>
          </Flex>
        ) : (
          <Flex align="center" gap="2" wrap="wrap">
            <Flex align="center" gap="1">
              <CrossCircledIcon color="var(--red-9)" />
              <Text size="2" color="red" weight="medium">
                Not quite
              </Text>
            </Flex>
            {result?.written && (
              <Button size="1" variant="ghost" color="gray" onClick={onOverride}>
                I was right
              </Button>
            )}
          </Flex>
        )}
      </Box>
      <Button size="3" ref={continueRef} onClick={onContinue}>
        Continue
      </Button>
    </Flex>
  );
}

function EndScreen({ total, onRestart }) {
  return (
    <Flex align="center" justify="center" style={{ width: "100%" }}>
      <Card size="4" style={{ width: "100%", maxWidth: 480 }}>
        <Flex direction="column" align="center" gap="4" py="4">
          <CheckCircledIcon width="44" height="44" color="var(--grass-9)" />
          <Heading size="7" align="center">
            You learned all {total} {total === 1 ? "card" : "cards"}!
          </Heading>
          <Text size="2" color="gray" align="center">
            Every card is mastered. Run it again to keep them sharp.
          </Text>
          <Button size="3" onClick={onRestart} mt="2">
            <ReloadIcon /> Learn again
          </Button>
        </Flex>
      </Card>
    </Flex>
  );
}
