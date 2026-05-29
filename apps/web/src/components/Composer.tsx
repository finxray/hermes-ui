import { SendHorizontal } from "lucide-react";

export function Composer() {
  return (
    <div className="composer-wrap">
      <form className="composer" aria-label="Mock message composer">
        <div className="composer-box">
          <textarea
            aria-label="Message"
            disabled
            placeholder="Mock composer. Real sending arrives in a later Hermes integration slice."
          />
          <button className="send-button" type="button" disabled aria-label="Send message">
            <SendHorizontal size={17} />
          </button>
        </div>
        <div className="composer-note">
          Future streaming should batch deltas with an external buffer or animation-frame flush,
          not update React state once per token.
        </div>
      </form>
    </div>
  );
}
