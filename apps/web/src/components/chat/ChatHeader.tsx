import styles from "./ChatView.module.css";

export function ChatHeader({ title }: { title: string }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerTitle}>
        <h1>{title}</h1>
      </div>
    </header>
  );
}
