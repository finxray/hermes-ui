import { PanelLeftClose, PanelRightClose } from "@/components/ui/AppIcons";

type PanelToggleIconProps = {
  side: "left" | "right" | "single" | "split";
};

const PANEL_TOGGLE_GLYPH_STYLE = {
  height: "calc(var(--icon-md) * 1.248)",
  width: "calc(var(--icon-md) * 1.248)"
};

export function PanelToggleIcon({ side }: PanelToggleIconProps) {
  if (side === "left") {
    return <PanelLeftClose focusable="false" style={PANEL_TOGGLE_GLYPH_STYLE} />;
  }
  if (side === "right") {
    return <PanelRightClose focusable="false" style={PANEL_TOGGLE_GLYPH_STYLE} />;
  }
  if (side === "single") {
    return <SinglePanelIcon focusable="false" style={PANEL_TOGGLE_GLYPH_STYLE} />;
  }
  return <SplitPanelsIcon focusable="false" style={PANEL_TOGGLE_GLYPH_STYLE} />;
}

function SinglePanelIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="4.2" y="5.7" width="15.6" height="12.6" rx="4" stroke="currentColor" strokeWidth="2" />
      <rect x="8.2" y="8" width="7.6" height="8" rx="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SplitPanelsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="4.2" y="5.7" width="15.6" height="12.6" rx="4" stroke="currentColor" strokeWidth="2" />
      <rect x="7.1" y="8" width="3.8" height="8" rx="1.3" fill="currentColor" stroke="none" />
      <rect x="13.1" y="8" width="3.8" height="8" rx="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
