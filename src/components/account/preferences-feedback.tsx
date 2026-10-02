export type Feedback = { tone: "ok" | "error"; text: string } | null;

/**
 * The one-line result of a save: "Saved." in success colour with
 * `role="status"`, or the problem in danger colour with `role="alert"`.
 */
export function PreferencesFeedback({ msg }: { msg: Feedback }) {
  if (!msg) return null;
  return msg.tone === "error" ? (
    <p role="alert" className="text-[14px] leading-[1.45] text-danger">
      {msg.text}
    </p>
  ) : (
    <p role="status" className="text-[14px] leading-[1.45] text-success">
      {msg.text}
    </p>
  );
}

// Action error strings that are codes rather than sentences.
const ERROR_WORDS: Record<string, string> = {
  DB_INSERT_FAILED: "That didn't save — try again.",
};

/** Turn an action's error into a sentence (most already are). */
export function errorSentence(error: string): string {
  return ERROR_WORDS[error] ?? error;
}
