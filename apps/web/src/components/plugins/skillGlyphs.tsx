import type { ReactNode } from "react";
import type { AppIcon, AppIconProps } from "@/components/ui/AppIcons";
import { BRAND_ICON_PATHS, type BrandIconSlug } from "./brandIconData";

// Brand glyphs: single-path Simple Icons rendered with default (nonzero)
// fill-rule. A separate factory from the stroke glyphs below so logos with
// counters (holes) render correctly.
function makeSimpleIcon(path: string): AppIcon {
  return function SimpleBrandIcon({ "aria-hidden": ariaHidden, height, size = 17, width, ...props }) {
    return (
      <svg
        aria-hidden={ariaHidden ?? true}
        fill="currentColor"
        height={height ?? size}
        viewBox="0 0 24 24"
        width={width ?? size}
        {...props}
      >
        <path d={path} />
      </svg>
    );
  };
}

export const BRAND_ICONS = Object.fromEntries(
  (Object.keys(BRAND_ICON_PATHS) as BrandIconSlug[]).map((slug) => [
    slug,
    makeSimpleIcon(BRAND_ICON_PATHS[slug])
  ])
) as Record<BrandIconSlug, AppIcon>;

export const GoogleDocsColorIcon: AppIcon = ({ "aria-hidden": ariaHidden, height, size = 17, width, ...props }) => (
  <svg aria-hidden={ariaHidden ?? true} height={height ?? size} viewBox="0 0 24 24" width={width ?? size} {...props}>
    <path fill="#4285f4" d="M5 2.8A2.8 2.8 0 0 1 7.8 0H14l5 5v16.2a2.8 2.8 0 0 1-2.8 2.8H7.8A2.8 2.8 0 0 1 5 21.2Z" />
    <path fill="#a8c7fa" d="M14 0v5h5Z" />
    <path fill="#fff" d="M8.2 9.4h7.6v1.2H8.2Zm0 3h7.6v1.2H8.2Zm0 3h5.2v1.2H8.2Z" />
  </svg>
);

export const GoogleSheetsColorIcon: AppIcon = ({ "aria-hidden": ariaHidden, height, size = 17, width, ...props }) => (
  <svg aria-hidden={ariaHidden ?? true} height={height ?? size} viewBox="0 0 24 24" width={width ?? size} {...props}>
    <path fill="#188038" d="M5 2.8A2.8 2.8 0 0 1 7.8 0H14l5 5v16.2a2.8 2.8 0 0 1-2.8 2.8H7.8A2.8 2.8 0 0 1 5 21.2Z" />
    <path fill="#81c995" d="M14 0v5h5Z" />
    <path fill="#fff" d="M8 9h8v8H8Zm1.2 1.2v2.2h2.2v-2.2Zm3.4 0v2.2h2.2v-2.2Zm-3.4 3.4v2.2h2.2v-2.2Zm3.4 0v2.2h2.2v-2.2Z" />
  </svg>
);

export const GoogleSlidesColorIcon: AppIcon = ({ "aria-hidden": ariaHidden, height, size = 17, width, ...props }) => (
  <svg aria-hidden={ariaHidden ?? true} height={height ?? size} viewBox="0 0 24 24" width={width ?? size} {...props}>
    <path fill="#f9ab00" d="M5 2.8A2.8 2.8 0 0 1 7.8 0H14l5 5v16.2a2.8 2.8 0 0 1-2.8 2.8H7.8A2.8 2.8 0 0 1 5 21.2Z" />
    <path fill="#fde293" d="M14 0v5h5Z" />
    <path fill="#fff" d="M8 9h8v7H8Zm1.2 1.2v4.6h5.6v-4.6Z" />
  </svg>
);

export const PdfColorIcon: AppIcon = ({ "aria-hidden": ariaHidden, height, size = 17, width, ...props }) => (
  <svg aria-hidden={ariaHidden ?? true} height={height ?? size} viewBox="0 0 24 24" width={width ?? size} {...props}>
    <path fill="#ff5f57" d="M5 2.8A2.8 2.8 0 0 1 7.8 0H14l5 5v16.2a2.8 2.8 0 0 1-2.8 2.8H7.8A2.8 2.8 0 0 1 5 21.2Z" />
    <path fill="#ffc7c2" d="M14 0v5h5Z" />
    <path fill="#fff" d="M7 11.1h2.1c1.2 0 2 .7 2 1.8s-.8 1.9-2 1.9h-.7V17H7Zm1.4 1.2v1.3H9c.5 0 .8-.2.8-.7s-.3-.6-.8-.6Zm3.4-1.2h2c1.8 0 2.9 1.1 2.9 3s-1.1 2.9-2.9 2.9h-2Zm1.4 1.2v3.5h.5c1 0 1.5-.6 1.5-1.7s-.5-1.8-1.5-1.8Z" />
  </svg>
);

export const ChromeColorIcon: AppIcon = ({ "aria-hidden": ariaHidden, height, size = 17, width, ...props }) => (
  <svg aria-hidden={ariaHidden ?? true} height={height ?? size} viewBox="0 0 24 24" width={width ?? size} {...props}>
    <circle cx="12" cy="12" r="11" fill="#fbbc04" />
    <path fill="#ea4335" d="M12 1a11 11 0 0 1 9.5 5.5H12a5.5 5.5 0 0 0-4.8 2.8L4.4 4.5A10.96 10.96 0 0 1 12 1Z" />
    <path fill="#34a853" d="M21.5 6.5A11 11 0 0 1 12 23l4.8-8.3A5.5 5.5 0 0 0 12 6.5Z" />
    <path fill="#4285f4" d="M4.4 4.5 9.2 13a5.5 5.5 0 0 0 7.6 1.7L12 23A11 11 0 0 1 4.4 4.5Z" />
    <circle cx="12" cy="12" r="4" fill="#e8f0fe" />
    <circle cx="12" cy="12" r="2.7" fill="#4285f4" />
  </svg>
);

export const ComputerUseColorIcon: AppIcon = ({ "aria-hidden": ariaHidden, height, size = 17, width, ...props }) => (
  <svg aria-hidden={ariaHidden ?? true} height={height ?? size} viewBox="0 0 24 24" width={width ?? size} {...props}>
    <defs>
      <linearGradient id="computer-use-gradient" x1="4" x2="20" y1="4" y2="20" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7dd3fc" />
        <stop offset=".48" stopColor="#a78bfa" />
        <stop offset="1" stopColor="#fb7185" />
      </linearGradient>
    </defs>
    <rect x="3" y="3" width="18" height="18" rx="5" fill="url(#computer-use-gradient)" />
    <path fill="#fff" fillOpacity=".92" d="m7 6.8 10.3 4.5-4.2 1.3 2.7 3.7-1.8 1.3-2.7-3.8-2.6 3.5Z" />
  </svg>
);

// Stroke glyphs for skills with no brand, matching the AppIcons house style
// (24x24, round caps/joins, 1.75 stroke).
function stroke(children: ReactNode): AppIcon {
  return function StrokeGlyph({
    "aria-hidden": ariaHidden,
    fill,
    height,
    size = 17,
    strokeWidth = 1.75,
    width,
    ...props
  }: AppIconProps) {
    return (
      <svg
        aria-hidden={ariaHidden ?? true}
        fill={fill ?? "none"}
        height={height ?? size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        viewBox="0 0 24 24"
        width={width ?? size}
        {...props}
      >
        {children}
      </svg>
    );
  };
}

export const MusicGlyph = stroke(
  <>
    <path d="M9 17.3V6.2l9-2v9.1" />
    <circle cx="6.8" cy="17.3" r="2.2" />
    <circle cx="15.8" cy="15.3" r="2.2" />
  </>
);

export const ImageGlyph = stroke(
  <>
    <rect x="3.8" y="5" width="16.4" height="14" rx="2.4" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4.5 17.5 4.7-4.5 3 2.8L16 11l4 4" />
  </>
);

export const VideoGlyph = stroke(
  <>
    <rect x="3.8" y="6" width="12.4" height="12" rx="2.4" />
    <path d="m16.2 10 4-2.3v8.6l-4-2.3" />
  </>
);

export const PresentationGlyph = stroke(
  <>
    <path d="M3.5 4.5h17" />
    <rect x="5" y="4.5" width="14" height="9.5" rx="1.6" />
    <path d="M12 14v3.2" />
    <path d="m9.2 20 2.8-2.8 2.8 2.8" />
  </>
);

export const GamepadGlyph = stroke(
  <>
    <path d="M7.8 8.2h8.4a3.8 3.8 0 0 1 3.7 2.9l.8 3.7a2.1 2.1 0 0 1-3.6 1.9L15.8 15H8.2l-1.1 1.6a2.1 2.1 0 0 1-3.6-1.9l.8-3.7A3.8 3.8 0 0 1 7.8 8.2Z" />
    <path d="M6.5 11.4v2.2M5.4 12.5h2.2" />
    <path d="M15.6 11.6h.01M17.2 13.1h.01" />
  </>
);

export const BulbGlyph = stroke(
  <>
    <path d="M8.8 14.2a5 5 0 1 1 6.4 0c-.7.6-1.1 1.3-1.2 2.1H10c-.1-.8-.5-1.5-1.2-2.1Z" />
    <path d="M10 18.5h4M10.6 20.7h2.8" />
  </>
);

export const MailGlyph = stroke(
  <>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" />
    <path d="m4.4 7.5 7.6 5.5 7.6-5.5" />
  </>
);

export const GlobeGlyph = stroke(
  <>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M3.6 12h16.8" />
    <path d="M12 3.6c2.4 2.4 2.4 14.4 0 16.8M12 3.6c-2.4 2.4-2.4 14.4 0 16.8" />
  </>
);

export const PaletteGlyph = stroke(
  <>
    <path d="M12 3.6a8.4 8.4 0 0 0-.4 16.8c1.3 0 1.9-1 1.6-2-.3-1 .3-1.9 1.4-1.9h1.9a3.1 3.1 0 0 0 3.1-3.1c0-5.1-4.1-9.8-7.6-9.8Z" />
    <circle cx="8.4" cy="11.4" r="0.9" />
    <circle cx="12" cy="8.4" r="0.9" />
    <circle cx="15.4" cy="11" r="0.9" />
  </>
);

export const KanbanGlyph = stroke(
  <>
    <rect x="3.8" y="5" width="4.4" height="14" rx="1.4" />
    <rect x="9.8" y="5" width="4.4" height="9.2" rx="1.4" />
    <rect x="15.8" y="5" width="4.4" height="11" rx="1.4" />
  </>
);

export const BugGlyph = stroke(
  <>
    <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    <path d="M8 9.5h8v3.5a4 4 0 0 1-8 0Z" />
    <path d="M8 12H5M16 12h3M8.2 9 6.3 7.4M15.8 9l1.9-1.6M8 14.6l-2.2 1.9M16 14.6l2.2 1.9" />
  </>
);

export const BookGlyph = stroke(
  <>
    <path d="M5 5.6A1.6 1.6 0 0 1 6.6 4H18a1 1 0 0 1 1 1v12.6a1 1 0 0 1-1 1H6.6A1.6 1.6 0 0 0 5 20.2Z" />
    <path d="M5 18.6A1.6 1.6 0 0 1 6.6 17H19" />
  </>
);

export const UsersGlyph = stroke(
  <>
    <circle cx="9" cy="9" r="2.6" />
    <path d="M4.4 18a4.6 4.6 0 0 1 9.2 0" />
    <path d="M15.6 6.6a2.6 2.6 0 0 1 0 5M16.4 13.4a4.4 4.4 0 0 1 3.2 4.4" />
  </>
);

export const WrenchGlyph = stroke(
  <path d="M14.7 6.3a3.6 3.6 0 0 0-4.8 4.4L4 16.6 7.4 20l5.9-5.9a3.6 3.6 0 0 0 4.4-4.8l-2.2 2.2-2.4-.6-.6-2.4 2.2-2.2Z" />
);

export const PixelGlyph = stroke(
  <>
    <rect x="4.5" y="4.5" width="15" height="15" rx="1.6" />
    <path d="M9.5 4.5v15M14.5 4.5v15M4.5 9.5h15M4.5 14.5h15" />
  </>
);

export const TerminalMark: AppIcon = stroke(
  <>
    <path d="m5 8 4 4-4 4" />
    <path d="M11.5 16h7" />
  </>
);
