import type { ReactNode } from "react";
import { AgentActivityBlock } from "@/components/chat/AgentActivityBlock";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { Project, Session } from "@/data/types";
import type { AgentActivityEvent } from "@/types/agentActivity";
import styles from "./ChatView.module.css";

type ChatTranscriptProps = {
  activeProject: Project;
  activeSession: Session | null;
  activityEvents: AgentActivityEvent[];
  bannerIcon: ReactNode;
  createSession: () => void;
  isStartState?: boolean;
  isThinking: boolean;
  routeIcon: ReactNode;
  scopeIcon: ReactNode;
};

export function ChatTranscript({
  activeProject,
  activeSession,
  activityEvents,
  bannerIcon,
  createSession,
  isStartState = false,
  isThinking,
  routeIcon,
  scopeIcon
}: ChatTranscriptProps) {
  return (
    <div
      className={styles.transcript}
      data-start-state={isStartState ? "true" : "false"}
      aria-label="Chat transcript"
    >
      <div className={styles.transcriptInner}>
        <div className={styles.mockBanner} role="status" aria-label="Connection status">
          {bannerIcon}
          <span>Hermes is reached through the BFF when available; offline turns stay local.</span>
        </div>
        {isStartState ? (
          <div className={styles.startHero}>
            <span className={styles.startEyebrow}>{activeProject.name}</span>
            <h2>What should Hermes work on?</h2>
          </div>
        ) : activeSession ? (
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
        {activeSession ? (
          <AgentActivityBlock
            events={activityEvents}
            legacyEvents={activeSession.toolEvents}
            showThinking={isThinking}
          />
        ) : null}
        {!isStartState ? (
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
        ) : null}
      </div>
    </div>
  );
}
