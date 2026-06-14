import { PanelToggleIcon } from "@/components/ui/PanelToggleIcon";
import styles from "./ChatView.module.css";

type ChatHeaderProps = {
  isSplitViewOpen?: boolean;
  onSplitView?: () => void;
  title: string;
};

export function ChatHeader({ isSplitViewOpen = false, onSplitView, title }: ChatHeaderProps) {
  const splitButtonLabel = isSplitViewOpen
    ? "Return to single chat view"
    : "Split chat and context panels evenly";

  return (
    <header className={styles.header}>
      <div className={styles.headerTitle}>
        <h1>{title}</h1>
        {onSplitView ? (
          <button
            aria-label={splitButtonLabel}
            aria-pressed={isSplitViewOpen}
            className={styles.headerSplitButton}
            data-active={isSplitViewOpen ? "true" : "false"}
            onClick={onSplitView}
            title={splitButtonLabel}
            type="button"
          >
            <PanelToggleIcon side="split" />
          </button>
        ) : null}
      </div>
    </header>
  );
}
