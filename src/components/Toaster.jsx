import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, Flex, Text } from "@radix-ui/themes";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  InfoCircledIcon,
} from "@radix-ui/react-icons";

const ToastContext = createContext(null);

// useToast() -> toast({ title, description?, type?: "success"|"error"|"info" })
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToasterProvider>");
  return ctx;
}

const ICONS = {
  success: <CheckCircledIcon width="18" height="18" color="var(--grass-9)" />,
  error: <CrossCircledIcon width="18" height="18" color="var(--red-9)" />,
  info: <InfoCircledIcon width="18" height="18" color="var(--indigo-9)" />,
};

export function ToasterProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, type = "info", duration = 3800 }) => {
      const id = ++idRef.current;
      setToasts((cur) => [...cur, { id, title, description, type }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: "min(380px, 90vw)",
          pointerEvents: "none",
        }}
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              style={{ pointerEvents: "auto" }}
              onClick={() => dismiss(t.id)}
            >
              <Card size="2" className="lift" style={{ cursor: "pointer" }}>
                <Flex gap="2" align="start">
                  <div style={{ marginTop: 1 }}>{ICONS[t.type] || ICONS.info}</div>
                  <Flex direction="column" gap="0">
                    <Text size="2" weight="bold">
                      {t.title}
                    </Text>
                    {t.description && (
                      <Text size="1" color="gray">
                        {t.description}
                      </Text>
                    )}
                  </Flex>
                </Flex>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
