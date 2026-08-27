import { useState } from "react";

/**
 * Copy, and say so for two seconds.
 *
 * The confirmation is the reason this is shared: a copy button that changes
 * nothing leaves the reader pressing it again, and every button that has to
 * track its own timeout is another place to forget to clear it.
 */
export const useCopied = (): { copied: boolean; copy: (text: string) => void } => {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    copy: (text: string) => {
      void navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      });
    },
  };
};
