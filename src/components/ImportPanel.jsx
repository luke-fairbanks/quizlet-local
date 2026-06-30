import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Select,
  Spinner,
  Tabs,
  Text,
  TextArea,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import { Link2Icon, BookmarkIcon, ClipboardIcon } from "@radix-ui/react-icons";
import { useToast } from "./Toaster.jsx";
import { BOOKMARKLET } from "../bookmarklet.js";

const ENTRANCE = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
};

// Map the friendly between-cards delimiter to what the server expects.
function mapCardDelim(value) {
  if (value === "newline") return "";
  if (value === "blank") return "\n\n";
  return value;
}

export default function ImportPanel({ onScrape, onImport }) {
  const toast = useToast();

  // A bookmarklet must use a `javascript:` href to be draggable, but React
  // warns when that's passed via the href prop. Setting it through a ref
  // callback (which fires each time the lazily-mounted anchor attaches)
  // sidesteps the warning while keeping the link draggable.
  const setBookmarkletHref = useCallback((node) => {
    if (node) node.setAttribute("href", BOOKMARKLET);
  }, []);

  // By URL
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);

  // Paste Import
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [termDelim, setTermDelim] = useState("tab");
  const [cardDelim, setCardDelim] = useState("newline");
  const [importing, setImporting] = useState(false);

  async function handleScrape() {
    const trimmed = url.trim();
    if (!trimmed || scraping) return;
    setScraping(true);
    try {
      const set = await onScrape(trimmed);
      toast({
        title: 'Saved "' + set.title + '"',
        description: set.cards.length + " cards",
        type: "success",
      });
      setUrl("");
    } catch (e) {
      toast({
        title: "Couldn't scrape",
        description: e.message,
        type: "error",
      });
    } finally {
      setScraping(false);
    }
  }

  async function handleImport() {
    if (importing) return;
    if (!text.trim()) {
      toast({
        title: "Nothing to import",
        description: "Paste your exported cards first.",
        type: "error",
      });
      return;
    }
    setImporting(true);
    try {
      const set = await onImport({
        title: title.trim(),
        text,
        termDelim,
        cardDelim: mapCardDelim(cardDelim),
      });
      toast({
        title: 'Saved "' + set.title + '"',
        description: set.cards.length + " cards",
        type: "success",
      });
      setText("");
    } catch (e) {
      toast({
        title: "Couldn't import",
        description: e.message,
        type: "error",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <motion.div {...ENTRANCE}>
      <Card size="3">
        <Tabs.Root defaultValue="url">
          <Tabs.List>
            <Tabs.Trigger value="url">
              <Flex align="center" gap="2">
                <Link2Icon /> By URL
              </Flex>
            </Tabs.Trigger>
            <Tabs.Trigger value="bookmarklet">
              <Flex align="center" gap="2">
                <BookmarkIcon /> Bookmarklet
              </Flex>
            </Tabs.Trigger>
            <Tabs.Trigger value="paste">
              <Flex align="center" gap="2">
                <ClipboardIcon /> Paste Import
              </Flex>
            </Tabs.Trigger>
          </Tabs.List>

          <Box pt="4">
            {/* By URL */}
            <Tabs.Content value="url">
              <Flex direction="column" gap="3">
                <Heading size="3">Import from a Quizlet URL</Heading>
                <Flex gap="3" align="center" wrap="wrap">
                  <Box style={{ flex: "1 1 280px" }}>
                    <TextField.Root
                      size="2"
                      placeholder="https://quizlet.com/123456789/my-set/"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleScrape();
                      }}
                      disabled={scraping}
                    >
                      <TextField.Slot side="left">
                        <Link2Icon />
                      </TextField.Slot>
                    </TextField.Root>
                  </Box>
                  <Button
                    size="2"
                    variant="solid"
                    onClick={handleScrape}
                    disabled={scraping || !url.trim()}
                  >
                    {scraping ? (
                      <>
                        <Spinner size="1" /> Scraping…
                      </>
                    ) : (
                      "Scrape & Save"
                    )}
                  </Button>
                </Flex>
                <Text size="1" color="gray">
                  Quizlet often blocks direct scraping. If this fails, use the
                  Bookmarklet tab instead.
                </Text>
              </Flex>
            </Tabs.Content>

            {/* Bookmarklet */}
            <Tabs.Content value="bookmarklet">
              <Flex direction="column" gap="4">
                <Heading size="3">Save sets with one click</Heading>
                <Box asChild>
                  <ol
                    style={{
                      margin: 0,
                      paddingLeft: 20,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <li>
                      <Text size="2">
                        Show your bookmarks bar (<Text as="span" weight="medium">⌘⇧B</Text>).
                      </Text>
                    </li>
                    <li>
                      <Text size="2">Drag this button up to it:</Text>
                    </li>
                    <li>
                      <Text size="2">
                        Open any Quizlet set and click the bookmark.
                      </Text>
                    </li>
                  </ol>
                </Box>

                <Flex>
                  <Tooltip content="Drag me to your bookmarks bar">
                    <Button asChild size="2">
                      <a
                        ref={setBookmarkletHref}
                        className="bookmarklet-pill"
                        draggable
                        onClick={(e) => e.preventDefault()}
                      >
                        ＋ Save to QuizletLocal
                      </a>
                    </Button>
                  </Tooltip>
                </Flex>

                <Text size="1" color="gray">
                  Keep this app running while you use the bookmark — it sends the
                  cards to your local copy.
                </Text>
              </Flex>
            </Tabs.Content>

            {/* Paste Import */}
            <Tabs.Content value="paste">
              <Flex direction="column" gap="3">
                <Heading size="3">Paste exported cards</Heading>

                <TextField.Root
                  size="2"
                  placeholder="Set title (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={importing}
                />

                <TextArea
                  size="2"
                  rows={8}
                  resize="vertical"
                  placeholder={
                    "On Quizlet: ··· → Export → copy, then paste here.\n\nterm  definition\nterm  definition"
                  }
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={importing}
                />

                <Flex gap="4" wrap="wrap">
                  <Flex direction="column" gap="1" style={{ flex: "1 1 200px" }}>
                    <Text size="1" color="gray">
                      Between term &amp; definition
                    </Text>
                    <Select.Root
                      value={termDelim}
                      onValueChange={setTermDelim}
                      disabled={importing}
                    >
                      <Select.Trigger />
                      <Select.Content position="popper">
                        <Select.Item value="tab">Tab</Select.Item>
                        <Select.Item value=",">Comma</Select.Item>
                        <Select.Item value=";">Semicolon</Select.Item>
                        <Select.Item value=" - ">Dash ( - )</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Flex>

                  <Flex direction="column" gap="1" style={{ flex: "1 1 200px" }}>
                    <Text size="1" color="gray">
                      Between cards
                    </Text>
                    <Select.Root
                      value={cardDelim}
                      onValueChange={setCardDelim}
                      disabled={importing}
                    >
                      <Select.Trigger />
                      <Select.Content position="popper">
                        <Select.Item value="newline">New line</Select.Item>
                        <Select.Item value="blank">Blank line</Select.Item>
                        <Select.Item value=";">Semicolon</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Flex>
                </Flex>

                <Flex justify="end">
                  <Button
                    size="2"
                    variant="solid"
                    onClick={handleImport}
                    disabled={importing || !text.trim()}
                  >
                    {importing ? (
                      <>
                        <Spinner size="1" /> Importing…
                      </>
                    ) : (
                      "Import & Save"
                    )}
                  </Button>
                </Flex>
              </Flex>
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Card>
    </motion.div>
  );
}
