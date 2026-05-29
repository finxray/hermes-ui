import type { ModelChoice } from "@/data/types";

type ModelSelectorProps = {
  choices: ModelChoice[];
  selectedId: string;
};

export function ModelSelector({ choices, selectedId }: ModelSelectorProps) {
  return (
    <label>
      <span className="sr-only">Model provider</span>
      <select className="model-select" value={selectedId} disabled>
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.label} · {choice.provider}
          </option>
        ))}
      </select>
    </label>
  );
}
