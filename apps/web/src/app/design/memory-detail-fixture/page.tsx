"use client";

import { MemoryDetailPanel } from "@/components/memory/MemoryDetailPanel";
import {
  fullScopedMemoryDetailFixture,
  wrongScopeMemoryDetailFixture
} from "@/data/memoryDetailFixture";
import styles from "./page.module.css";

export default function MemoryDetailFixturePage() {
  return (
    <main className={styles.page} aria-label="Memory detail fixture page">
      <section className={styles.header} aria-labelledby="memory-detail-fixture-title">
        <p>Design fixture</p>
        <h1 id="memory-detail-fixture-title">Memory detail fixture</h1>
        <span>
          Deterministic route for read-only memory detail rendering. No Hermes, Brain
          Memory, localStorage, or external service calls are made here.
        </span>
      </section>

      <section className={styles.fixture} aria-label="Gateway-backed memory detail fixture">
        <MemoryDetailPanel
          inspection={fullScopedMemoryDetailFixture}
          isInspecting={false}
          mockDetail={null}
          onClose={() => undefined}
        />
      </section>

      <section className={styles.fixture} aria-label="Wrong-scope memory detail fixture">
        <MemoryDetailPanel
          inspection={wrongScopeMemoryDetailFixture}
          isInspecting={false}
          mockDetail={null}
          onClose={() => undefined}
        />
      </section>
    </main>
  );
}
