import { PanelLeftClose, PanelRightClose, PanelSplit } from "@/components/ui/AppIcons";

type PanelToggleIconProps = {
  side: "left" | "right" | "split";
};

const PANEL_TOGGLE_GLYPH_STYLE = {
  height: "calc(var(--icon-md) * 1.3)",
  width: "calc(var(--icon-md) * 1.3)"
};

export function PanelToggleIcon({ side }: PanelToggleIconProps) {
  if (side === "left") {
    return <PanelLeftClose focusable="false" style={PANEL_TOGGLE_GLYPH_STYLE} />;
  }
  if (side === "right") {
    return <PanelRightClose focusable="false" style={PANEL_TOGGLE_GLYPH_STYLE} />;
  }
  return <PanelSplit focusable="false" style={PANEL_TOGGLE_GLYPH_STYLE} />;
}
