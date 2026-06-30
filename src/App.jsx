import { useState } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { Box, Flex, Heading, Text } from "@radix-ui/themes";
import { CardStackIcon } from "@radix-ui/react-icons";
import { ToasterProvider } from "./components/Toaster.jsx";
import { useSets } from "./hooks/useSets.js";
import ImportPanel from "./components/ImportPanel.jsx";
import SetList from "./components/SetList.jsx";
import StudyView from "./components/StudyView.jsx";
import EditSetView from "./components/EditSetView.jsx";

function AppBody() {
  const {
    sets,
    loading,
    error,
    addFromScrape,
    addFromImport,
    rename,
    remove,
    addCard,
    updateCard,
    deleteCard,
    setCardStatus,
    resetProgress,
  } = useSets();
  const [studying, setStudying] = useState(null);
  const [editing, setEditing] = useState(null);

  return (
    <Box className="app-shell">
      <Box
        px="4"
        style={{
          width: "100%",
          maxWidth: "var(--app-max-width)",
          marginInline: "auto",
        }}
      >
        <Flex direction="column" align="center" gap="3" py="7">
          <Flex align="center" gap="3">
            <Box
              aria-hidden
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                display: "grid",
                placeItems: "center",
                color: "white",
                background:
                  "linear-gradient(135deg, var(--indigo-9), var(--violet-9))",
                boxShadow: "0 10px 26px -10px var(--indigo-a8)",
              }}
            >
              <CardStackIcon width="22" height="22" />
            </Box>
            <Heading size="8" weight="bold">
              QuizletLocal
            </Heading>
          </Flex>
          <Text color="gray" align="center">
            Import a set once. Study it ad-free, stored on your machine.
          </Text>
        </Flex>

        <Flex direction="column" gap="5" pb="9">
          <ImportPanel onScrape={addFromScrape} onImport={addFromImport} />
          <SetList
            sets={sets}
            loading={loading}
            error={error}
            onStudy={setStudying}
            onEdit={setEditing}
            onDelete={remove}
          />
        </Flex>
      </Box>

      <AnimatePresence>
        {studying && (
          <StudyView
            key={studying.id}
            set={studying}
            onClose={() => setStudying(null)}
            onStatus={(cardId, status) =>
              setCardStatus(studying.id, cardId, status)
            }
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editing && (
          <EditSetView
            key={editing.id}
            set={editing}
            onClose={() => setEditing(null)}
            onRename={(title) => rename(editing.id, title)}
            onAddCard={(card) => addCard(editing.id, card)}
            onUpdateCard={(cardId, patch) =>
              updateCard(editing.id, cardId, patch)
            }
            onDeleteCard={(cardId) => deleteCard(editing.id, cardId)}
            onResetProgress={() => resetProgress(editing.id)}
          />
        )}
      </AnimatePresence>
    </Box>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToasterProvider>
        <AppBody />
      </ToasterProvider>
    </MotionConfig>
  );
}
