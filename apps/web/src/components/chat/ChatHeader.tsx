import { PanelToggleIcon } from "@/components/ui/PanelToggleIcon";
import styles from "./ChatView.module.css";
import { WindowBackButton } from "@/components/ui/WindowBackButton";

type ChatHeaderProps = {
  isSplitViewOpen?: boolean;
  onBack?: () => void;
  onSplitView?: () => void;
  title: string;
};

export function ChatHeader({ isSplitViewOpen = false, onBack, onSplitView, title }: ChatHeaderProps) {
  const splitButtonLabel = isSplitViewOpen
    ? "Return to single chat view"
    : "Split chat and context panels evenly";
  const splitTooltipLabel = isSplitViewOpen ? "Single view" : "Split screen";

  return (
    <header className={styles.header} data-split-view={isSplitViewOpen ? "true" : "false"}>
      <div className={styles.headerTitle}>
        {onBack ? (
          <WindowBackButton onClick={onBack} />
        ) : onSplitView ? (
          <button
            aria-label={splitButtonLabel}
            aria-pressed={isSplitViewOpen}
            className={styles.headerSplitButton}
            data-active={isSplitViewOpen ? "true" : "false"}
            onClick={onSplitView}
            type="button"
          >
            <PanelToggleIcon side={isSplitViewOpen ? "single" : "split"} />
            <span className={styles.headerSplitTooltip} role="tooltip">
              {splitTooltipLabel}
            </span>
          </button>
        ) : null}
        <h1>{title}</h1>
      </div>
    </header>
  );
}
