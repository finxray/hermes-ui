# Fast streaming plan — Cerebras/Kimi K2.6 consideration

Cerebras claims Kimi K2.6 can stream close to 1,000 output tokens/sec. Even if real local throughput is lower, the UI should be built so fast streams do not freeze React rendering.

## Design implications

Do not append to React state once per token.

Use:

- stream chunk parser,
- mutable buffer/ref for incoming text,
- requestAnimationFrame batching,
- chunk coalescing by time window,
- transcript virtualization for long sessions,
- markdown rendering throttled or incremental,
- separate event queue for tool/status events,
- performance metrics in dev mode.

## Model selector behavior

When a high-throughput provider/model is selected:

- enable `fast_streaming_mode`,
- reduce per-token animations,
- batch UI updates aggressively,
- render markdown in stable chunks,
- avoid expensive syntax highlighting until stream completes,
- keep composer responsive.

## Acceptance test idea

Create a local fake stream that emits 1,000 small token chunks/sec for 10 seconds.

Pass condition:

- page remains responsive,
- no runaway memory growth,
- response text is complete,
- CPU usage is reasonable,
- user can stop the stream.
