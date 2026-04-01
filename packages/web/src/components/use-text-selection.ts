import { useState, useEffect } from "react";

export function useTextSelection() {
  const [selectedText, setSelectedText] = useState("");

  useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";

      setSelectedText(text);
    }

    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  return selectedText;
}
