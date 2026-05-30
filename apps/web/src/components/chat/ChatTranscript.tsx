import type { ReactNode } from "react";
import { ChatActivityBlock } from "@/components/chat/ChatActivityBlock";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { Project, Session } from "@/data/types";
import styles from "./ChatView.module.css";

type ChatTranscriptProps = {
  activeProject: Project;
  activeSession: Session | null;
  bannerIcon: ReactNode;
  createSession: () => void;
  routeIcon: ReactNode;
  scopeIcon: ReactNode;
};

export function ChatTranscript({
  activeProject,
  activeSession,
  bannerIcon,
  createSession,
  routeIcon,
  scopeIcon
}: ChatTranscriptProps) {
  return (
    <div className={styles.transcript} aria-label="Chat transcript">
      <div className={styles.transcriptInner}>
        <div className={styles.mockBanner} role="status">
          {bannerIcon}
          <span>
            Chat sends through the server-side BFF when Hermes is connected. If Hermes is
            unavailable, this session stays local with a clear mock fallback.
          </span>
        </div>
        {activeSession ? (
          activeSession.messages.length > 0 ? (
            activeSession.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          ) : (
            <EmptyState
              title="New chat is empty"
              body="Send a message to use real Hermes when configured, or a local mock fallback when unavailable."
            />
          )
        ) : (
          <EmptyState
            title="No chats in this project"
            body="Projects can exist without sessions. Create a new local mock chat when you want a transcript under this project."
            actionLabel="New chat"
            onAction={createSession}
          />
        )}
        {activeSession ? <ChatActivityBlock events={activeSession.toolEvents} /> : null}
        <div className={styles.referenceRow} aria-label="Active scope references">
          <span className={styles.referenceChip}>
            {scopeIcon}
            Scope: {activeProject.memoryScope.stableProjectKey}
          </span>
          <span className={styles.referenceChip}>
            {routeIcon}
            Route: Browser to BFF to Hermes
          </span>
        </div>
      </div>
    </div>
  );
}
