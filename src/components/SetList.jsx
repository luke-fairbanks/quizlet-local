import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  IconButton,
  Progress,
  Spinner,
  Text,
  TextField,
  Tooltip,
  AlertDialog,
} from "@radix-ui/themes";
import {
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  Pencil1Icon,
  PlayIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { useToast } from "./Toaster.jsx";
import { formatDate, matches } from "../lib/util.js";
import { computeProgress } from "../lib/progress.js";

const EASE = [0.16, 1, 0.3, 1];

function SetRow({ set, onStudy, onEdit, onDelete }) {
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);

  const cardCount = set.cards?.length ?? 0;
  const prog = computeProgress(set);

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(set.id);
      toast({ title: "Deleted set", description: set.title, type: "success" });
    } catch (e) {
      toast({ title: "Couldn't delete", description: e?.message, type: "error" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, ease: EASE }}
    >
      <Card size="2" className="lift">
        <Flex align="center" justify="between" gap="4" wrap="wrap">
          <Flex direction="column" gap="2" style={{ minWidth: 0, flex: "1 1 220px" }}>
            <Heading size="3" trim="both">
              {set.title}
            </Heading>
            <Flex align="center" gap="2" wrap="wrap">
              <Badge color="indigo" variant="soft">
                {cardCount} {cardCount === 1 ? "card" : "cards"}
              </Badge>
              <Text size="1" color="gray">
                {formatDate(set.importedAt)}
              </Text>
            </Flex>
            {cardCount > 0 && (
              <Flex align="center" gap="2" style={{ maxWidth: 300 }}>
                <Box style={{ flex: 1 }}>
                  <Tooltip
                    content={`${prog.known} known · ${prog.learning} learning · ${prog.fresh} new`}
                  >
                    <Progress size="1" value={prog.pct} color="grass" />
                  </Tooltip>
                </Box>
                <Text size="1" color="gray" style={{ whiteSpace: "nowrap" }}>
                  {prog.known}/{prog.total} known
                </Text>
              </Flex>
            )}
          </Flex>

          <Flex align="center" gap="2">
            <Button onClick={() => onStudy(set)}>
              <PlayIcon />
              Study
            </Button>

            <Tooltip content="Edit cards & title">
              <IconButton
                variant="soft"
                color="gray"
                aria-label="Edit set"
                onClick={() => onEdit(set)}
              >
                <Pencil1Icon />
              </IconButton>
            </Tooltip>

            <AlertDialog.Root>
              <AlertDialog.Trigger>
                <IconButton
                  variant="soft"
                  color="red"
                  aria-label="Delete set"
                  disabled={deleting}
                >
                  <TrashIcon />
                </IconButton>
              </AlertDialog.Trigger>
              <AlertDialog.Content maxWidth="420px">
                <AlertDialog.Title>Delete this set?</AlertDialog.Title>
                <AlertDialog.Description size="2">
                  &ldquo;{set.title}&rdquo; and its {cardCount}{" "}
                  {cardCount === 1 ? "card" : "cards"} will be removed from this
                  device. This can&rsquo;t be undone.
                </AlertDialog.Description>
                <Flex gap="3" mt="4" justify="end">
                  <AlertDialog.Cancel>
                    <Button variant="soft" color="gray">
                      Cancel
                    </Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action>
                    <Button color="red" onClick={handleDelete}>
                      Delete
                    </Button>
                  </AlertDialog.Action>
                </Flex>
              </AlertDialog.Content>
            </AlertDialog.Root>
          </Flex>
        </Flex>
      </Card>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <Card size="2">
      <Flex align="center" justify="between" gap="4">
        <Flex direction="column" gap="2" style={{ flex: 1 }}>
          <Box
            style={{
              height: 18,
              width: "45%",
              borderRadius: "var(--radius-2)",
              background: "var(--gray-a3)",
            }}
          />
          <Box
            style={{
              height: 12,
              width: "30%",
              borderRadius: "var(--radius-2)",
              background: "var(--gray-a3)",
            }}
          />
        </Flex>
        <Spinner />
      </Flex>
    </Card>
  );
}

export default function SetList({
  sets = [],
  loading = false,
  error = null,
  onStudy,
  onEdit,
  onDelete,
}) {
  const [query, setQuery] = useState("");

  const visible = sets.filter((s) => matches(s.title, query));

  function renderBody() {
    if (error) {
      return (
        <Callout.Root color="red" role="alert">
          <Callout.Icon>
            <ExclamationTriangleIcon />
          </Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      );
    }

    if (loading) {
      return (
        <Flex direction="column" gap="3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </Flex>
      );
    }

    if (sets.length === 0) {
      return (
        <Flex direction="column" align="center" justify="center" gap="2" py="8">
          <Text size="3" weight="medium">
            No sets yet
          </Text>
          <Text size="2" color="gray">
            Import one above to get started.
          </Text>
        </Flex>
      );
    }

    if (visible.length === 0) {
      return (
        <Flex direction="column" align="center" justify="center" py="8">
          <Text size="2" color="gray">
            No sets match &ldquo;{query}&rdquo;.
          </Text>
        </Flex>
      );
    }

    return (
      <Flex direction="column" gap="3">
        <AnimatePresence initial={false}>
          {visible.map((set) => (
            <SetRow
              key={set.id}
              set={set}
              onStudy={onStudy}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </AnimatePresence>
      </Flex>
    );
  }

  return (
    <Card size="3">
      <Flex direction="column" gap="4">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Flex align="center" gap="2">
            <Heading size="5">Saved sets</Heading>
            <Badge color="gray" variant="soft" radius="full">
              {sets.length}
            </Badge>
          </Flex>
          <Box style={{ minWidth: 200, flex: "0 1 260px" }}>
            <TextField.Root
              size="2"
              placeholder="Search sets…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search saved sets"
            >
              <TextField.Slot side="left">
                <MagnifyingGlassIcon />
              </TextField.Slot>
            </TextField.Root>
          </Box>
        </Flex>

        {renderBody()}
      </Flex>
    </Card>
  );
}
