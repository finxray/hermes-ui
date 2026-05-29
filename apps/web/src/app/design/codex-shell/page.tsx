import {
  AlertTriangle,
  Brain,
  ChevronDown,
  Circle,
  Database,
  FileText,
  Folder,
  Loader2,
  Mic,
  PanelLeftClose,
  PanelRightClose,
  Plus,
  Search,
  SendHorizontal,
  SlidersHorizontal,
  TerminalSquare
} from "lucide-react";
import type { ReactNode } from "react";
import styles from "./page.module.css";

const projects = [
  { name: "Brain Memory", count: 3, active: true },
  { name: "Hermes Agent", count: 2 },
  { name: "Packaging", count: 1 }
];

const sessions = [
  { title: "Hermes UI roadmap", active: true },
  { title: "Gateway memory contract" },
  { title: "Evidence cards and audit trail" }
];

const statusItems = [
  "Hermes: connected",
  "Brain Memory: read-only mock",
  "LocalStorage: active"
];

const messages = [
  {
    role: "user",
    author: "Alexey",
    time: "13:04",
    body: "For Slice 10D, make the product surface feel like a real Codex-style local AI workspace, but keep it static until the visual contract is proven."
  },
  {
    role: "assistant",
    author: "Hermes UI mock",
    time: "13:05",
    body: "This prototype separates the shell contract from production state. The left rail is one transparent layer, the center workspace is the dominant rounded surface, and the right rail shares the same window background."
  },
  {
    role: "tool",
    author: "Tool activity",
    time: "13:06",
    body: "Inspecting layout surfaces and control states",
    status: "running"
  },
  {
    role: "assistant",
    author: "Hermes UI mock",
    time: "13:08",
    body: "Memory inspection stays read-only here. The real app can adopt this structure later without changing Hermes streaming or Brain Memory Gateway behavior."
  }
];

export default function CodexShellPrototypePage() {
  return (
    <main className={styles.shell} aria-label="Codex style shell prototype">
      <header className={styles.topbar}>
        <button className={styles.iconButton} type="button" aria-label="Collapse left rail">
          <PanelLeftClose size={19} />
        </button>
        <nav className={styles.topMenu} aria-label="Prototype workspace sections">
          <button className={`${styles.menuButton} ${styles.menuButtonActive}`} type="button">
            Workspace
          </button>
          <button className={styles.menuButton} type="button">
            Memory
          </button>
          <button className={styles.menuButton} type="button">
            Projects
          </button>
          <button className={styles.menuButton} type="button">
            Tools
          </button>
          <button className={styles.menuButton} type="button">
            Help
          </button>
        </nav>
      </header>

      <aside className={styles.leftRail} aria-label="Prototype project navigation">
        <div className={styles.brandRow}>
          <Brain className={styles.brandIcon} size={21} aria-hidden="true" />
          <strong>Brain Memory Studio</strong>
        </div>

        <div className={styles.primaryActions}>
          <button className={styles.plainAction} type="button">
            <Folder size={19} aria-hidden="true" />
            Project
          </button>
          <button className={styles.plainAction} type="button">
            <Search size={19} aria-hidden="true" />
            Chat
          </button>
        </div>

        <RailSection title="Projects" count="3">
          {projects.map((project) => (
            <button
              className={`${styles.railRow} ${project.active ? styles.railRowActive : ""}`}
              type="button"
              key={project.name}
            >
              <Folder className={styles.rowFolder} size={20} aria-hidden="true" />
              <span>{project.name}</span>
              <span className={styles.rowCount}>{project.count}</span>
            </button>
          ))}
        </RailSection>

        <RailSection title="Sessions">
          {sessions.map((session) => (
            <button
              className={`${styles.railRow} ${session.active ? styles.railRowActive : ""}`}
              type="button"
              key={session.title}
            >
              <span className={styles.sessionIndent}>{session.title}</span>
            </button>
          ))}
        </RailSection>

        <section className={styles.mockBlock} aria-labelledby="prototype-connections-heading">
          <div className={styles.railSectionHeader} id="prototype-connections-heading">
            <span>Mock connections</span>
            <FileText size={16} aria-hidden="true" />
          </div>
          <div className={styles.mockStack}>
            {statusItems.map((item, index) => (
              <span className={styles.mockLine} key={item}>
                <span className={index === 1 ? styles.dotWarn : styles.dotOk} />
                {item}
              </span>
            ))}
            <button className={styles.mockAction} type="button">
              Reset mock data
            </button>
            <button className={styles.mockAction} type="button">
              Refresh Hermes
            </button>
            <button className={`${styles.mockAction} ${styles.settingsAction}`} type="button">
              <Circle size={15} aria-hidden="true" />
              Settings
            </button>
          </div>
        </section>
      </aside>

      <section className={styles.workspace} aria-label="Prototype chat workspace">
        <header className={styles.workspaceHeader}>
          <div>
            <h1>Hermes UI roadmap</h1>
            <p>Brain Memory / Slice planning for Studio shell and future integration path</p>
          </div>
        </header>

        <div className={styles.warning} role="status">
          <AlertTriangle size={28} aria-hidden="true" />
          <span>
            Chat sends through the server-side BFF when Hermes is connected. If Hermes is
            unavailable, this session stays local with a clear mock fallback.
          </span>
        </div>

        <div className={styles.transcript} aria-label="Prototype transcript">
          {messages.map((message) => (
            <article
              className={`${styles.message} ${styles[`message_${message.role}`]}`}
              key={`${message.author}-${message.time}`}
            >
              <div className={styles.messageHead}>
                <strong>{message.author}</strong>
                <span>{message.time}</span>
              </div>
              <p>{message.body}</p>
              {message.role === "tool" ? (
                <div className={styles.toolRow}>
                  <Loader2 className={styles.spin} size={18} aria-hidden="true" />
                  <span>Running design-shell audit</span>
                </div>
              ) : null}
              {message.role === "assistant" ? (
                <div className={styles.subtleRefs}>
                  <span>/v1/chat/completions</span>
                  <span>Gateway-mediated memory</span>
                </div>
              ) : null}
            </article>
          ))}
          <p className={styles.scopeLine}>
            Scope: studio:tenant-local:project:project-brain-memory / Route: Browser to BFF to
            Hermes
          </p>
        </div>

        <form className={styles.composer} aria-label="Prototype composer">
          <textarea placeholder="Message Hermes through the local BFF..." />
          <div className={styles.composerControls}>
            <div className={styles.composerLeft}>
              <button type="button" aria-label="Attach context">
                <Plus size={20} />
              </button>
              <button className={styles.modelButton} type="button">
                Hermes default - Mock <ChevronDown size={17} />
              </button>
              <button type="button" aria-label="Composer options">
                <SlidersHorizontal size={19} />
              </button>
            </div>
            <div className={styles.composerRight}>
              <button type="button" aria-label="Voice input">
                <Mic size={18} />
              </button>
              <button className={styles.sendButton} type="submit" aria-label="Send">
                <SendHorizontal size={18} />
              </button>
            </div>
          </div>
        </form>
      </section>

      <aside className={styles.rightRail} aria-label="Prototype context console">
        <header className={styles.panelHeader}>
          <div className={styles.panelTitleRow}>
            <h2>Context console</h2>
            <button className={styles.iconButton} type="button" aria-label="Collapse right rail">
              <PanelRightClose size={19} />
            </button>
          </div>
          <p>Hermes can stream live; Brain Memory inspection is read-only and Gateway-mediated.</p>
          <div className={styles.tabs} aria-label="Context console tabs">
            <button className={styles.tabActive} type="button">
              Context
            </button>
            <button type="button">Memory</button>
            <button type="button">Tools</button>
            <button type="button">Files</button>
          </div>
        </header>

        <div className={styles.panelScroll}>
          <PanelSection title="Hermes status">
            <div className={styles.flatCard}>
              <div className={styles.cardTitle}>
                <strong>Hermes connected</strong>
                <span>real</span>
              </div>
              <div className={styles.metricGrid}>
                <Metric value="Yes" label="configured" />
                <Metric value="Yes" label="reachable" />
              </div>
              <p>Base URL: http://127.0.0.1:8642</p>
              <div className={styles.capabilityList}>
                {["chat completions", "responses api", "run submission", "run events sse"].map(
                  (item) => (
                    <span key={item}>{item}</span>
                  )
                )}
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Active context">
            <div className={styles.flatCard}>
              <div className={styles.cardTitle}>
                <strong>Brain Memory</strong>
                <span>mock</span>
              </div>
              <p>Gateway-scoped persistent memory and UI console.</p>
              <div className={styles.metricGrid}>
                <Metric value="4" label="session messages" />
                <Metric value="3" label="memory refs" />
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Memory detail">
            <div className={styles.memoryDetail}>
              <Database size={20} aria-hidden="true" />
              <div>
                <strong>Project shell design contract</strong>
                <p>
                  Read-only memory preview. Evidence and supersession remain not implemented in
                  this static route.
                </p>
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Tool row">
            <div className={styles.toolPreview}>
              <TerminalSquare size={20} aria-hidden="true" />
              <span>Running shell prototype smoke</span>
              <Loader2 className={styles.spin} size={18} aria-hidden="true" />
            </div>
          </PanelSection>
        </div>
      </aside>
    </main>
  );
}

function RailSection({
  children,
  count,
  title
}: {
  children: ReactNode;
  count?: string;
  title: string;
}) {
  return (
    <section className={styles.railSection} aria-labelledby={`${title.toLowerCase()}-heading`}>
      <div className={styles.railSectionHeader} id={`${title.toLowerCase()}-heading`}>
        <span>{title}</span>
        {count ? <span>{count}</span> : null}
      </div>
      <div className={styles.railList}>{children}</div>
    </section>
  );
}

function PanelSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={styles.panelSection}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
