import { PanelLeftClose, PanelRightClose, PanelSingle, PanelSplit } from "@/components/ui/AppIcons";

type PanelToggleIconProps = {
  side: "left" | "right" | "single" | "split";
};

const PANEL_TOGGLE_GLYPH_STYLE = {
  height: "var(--panel-toggle-icon-size, 19.968px)",
  width: "var(--panel-toggle-icon-size, 19.968px)"
};

export function PanelToggleIcon({ side }: PanelToggleIconProps) {
  if (side === "left") {
    return <PanelLeftClose focusable="false" style={PANEL_TOGGLE_GLYPH_STYLE} />;
  }
  if (side === "right") {
    return <PanelRightClose focusable="false" style={PANEL_TOGGLE_GLYPH_STYLE} />;
  }
  if (side === "single") {
    return <PanelSingle focusable="false" style={PANEL_TOGGLE_GLYPH_STYLE} />;
  }
  return <PanelSplit focusable="false" style={PANEL_TOGGLE_GLYPH_STYLE} />;
}
