import type { ReactElement, SVGProps } from "react";

export type AppIconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  strokeWidth?: number | string;
};

export type AppIcon = (props: AppIconProps) => ReactElement;
export type LucideIcon = AppIcon;

type IconPath = {
  d?: string;
  element?: "circle" | "line" | "path" | "polyline" | "rect";
  props?: Record<string, number | string | undefined>;
};

function makeIcon(paths: IconPath[], viewBox = "0 0 24 24"): AppIcon {
  return function AppIconComponent({
    "aria-hidden": ariaHidden,
    children,
    fill,
    height,
    size = 16,
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
        viewBox={viewBox}
        width={width ?? size}
        {...props}
      >
        {paths.map((path, index) => {
          const Element = path.element ?? "path";
          return <Element d={path.d} key={index} {...path.props} />;
        })}
        {children}
      </svg>
    );
  };
}

export const Activity = makeIcon([
  { d: "M4 13h3l2-6 4 10 2-5h5" }
]);

export const AlertTriangle = makeIcon([
  { d: "M10.4 4.6 2.8 18.1c-.5.9.1 1.9 1.1 1.9h16.2c1 0 1.6-1.1 1.1-1.9L13.6 4.6c-.7-1.2-2.5-1.2-3.2 0Z" },
  { element: "line", props: { x1: 12, x2: 12, y1: 9, y2: 13 } },
  { element: "line", props: { x1: 12, x2: 12.01, y1: 17, y2: 17 } }
]);

export const Archive = makeIcon([
  { element: "rect", props: { x: 3, y: 4.25, width: 18, height: 3.5, rx: 1.5 } },
  { d: "M4 8.25v9.5A2.25 2.25 0 0 0 6.25 20h11.5A2.25 2.25 0 0 0 20 17.75v-9.5" },
  { d: "M10 12h4" }
]);

export const ArrowUp = makeIcon([
  { d: "M12 20V5" },
  { d: "m6.5 10.5 5.5-5.5 5.5 5.5" }
]);

export const BarChart3 = makeIcon([
  { d: "M5 20V11" },
  { d: "M12 20V4" },
  { d: "M19 20v-7" }
]);

export const Brain = makeIcon([
  { d: "M9 5.2c-2 0-3.4 1.3-3.4 3 0 .4.1.8.2 1.1-1.2.6-2 1.8-2 3.2 0 1.7 1.2 3.1 2.8 3.5.2 1.8 1.6 3 3.4 3 1.3 0 2.3-.7 2.8-1.8" },
  { d: "M15 5.2c2 0 3.4 1.3 3.4 3 0 .4-.1.8-.2 1.1 1.2.6 2 1.8 2 3.2 0 1.7-1.2 3.1-2.8 3.5-.2 1.8-1.6 3-3.4 3-1.3 0-2.3-.7-2.8-1.8" },
  { d: "M12 6v11" },
  { d: "M8.5 10.2c1.1 0 2 .5 2.6 1.4" },
  { d: "M15.5 10.2c-1.1 0-2 .5-2.6 1.4" }
]);

export const Check = makeIcon([
  { d: "m5 12.5 4.2 4L19 7" }
]);

export const CheckCircle2 = makeIcon([
  { element: "circle", props: { cx: 12, cy: 12, r: 9 } },
  { d: "m8 12.4 2.6 2.5 5.4-5.8" }
]);

export const ChevronDown = makeIcon([
  { d: "m6.5 9 5.5 5.5L17.5 9" }
]);

export const ChevronRight = makeIcon([
  { d: "m9 6.5 5.5 5.5L9 17.5" }
]);

export const CornerDownRight = makeIcon([
  { d: "M15 10.5 19.5 15 15 19.5" },
  { d: "M4.5 4.5v5.2c0 3.4 1.9 5.3 5.3 5.3h9.2" }
]);

export const Circle = makeIcon([
  { element: "circle", props: { cx: 12, cy: 12, r: 8 } }
]);

export const CircleDashed = makeIcon([
  { element: "circle", props: { cx: 12, cy: 12, r: 8, strokeDasharray: "2.5 3.5" } }
]);

export const Clock = makeIcon([
  { element: "circle", props: { cx: 12, cy: 12, r: 8.5 } },
  { d: "M12 7.5V12l3 2" }
]);

export const Clock3 = Clock;

export const Copy: AppIcon = ({
  "aria-hidden": ariaHidden,
  height,
  size = 16,
  strokeWidth = 1.65,
  width,
  ...props
}) => (
  <svg
    aria-hidden={ariaHidden ?? true}
    fill="none"
    height={height ?? size}
    viewBox="0 0 20 20"
    width={width ?? size}
    {...props}
  >
    <rect x="6.2" y="2.7" width="10.6" height="10.6" rx="2.6" stroke="currentColor" strokeWidth={strokeWidth} />
    <rect
      x="2.7"
      y="6.2"
      width="10.6"
      height="10.6"
      rx="2.6"
      fill="var(--copy-icon-cutout, var(--bg-workspace-solid, #0b0b0c))"
    />
    <rect x="2.7" y="6.2" width="10.6" height="10.6" rx="2.6" stroke="currentColor" strokeWidth={strokeWidth} />
  </svg>
);

export const Cpu = makeIcon([
  { element: "rect", props: { x: 7, y: 7, width: 10, height: 10, rx: 2 } },
  { d: "M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" }
]);

export const Database = makeIcon([
  { d: "M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3Z" },
  { d: "M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" },
  { d: "M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" }
]);

export const ExternalLink = makeIcon([
  { d: "M10 6H6.8C5.7 6 5 6.7 5 7.8v9.4c0 1.1.7 1.8 1.8 1.8h9.4c1.1 0 1.8-.7 1.8-1.8V14" },
  { d: "M13 5h6v6" },
  { d: "m11.5 12.5 7-7" }
]);

export const FileText = makeIcon([
  { d: "M7 3.8h6.4L18 8.4v10c0 1.1-.7 1.8-1.8 1.8H7c-1.1 0-1.8-.7-1.8-1.8V5.6c0-1.1.7-1.8 1.8-1.8Z" },
  { d: "M13.2 4v4.6h4.6" },
  { d: "M8.5 12h7M8.5 15.5h5" }
]);

export const Folder = makeIcon([
  { d: "M3.5 7.4c0-1.2.8-2 2-2h3.3c.5 0 .9.2 1.3.6l1 1c.3.3.7.4 1.2.4h6.2c1.2 0 2 .8 2 2v1" },
  { d: "M3.5 10.2c.1-1.1.9-1.8 2.1-1.8h12.8c1.4 0 2.2.9 2 2.3l-.7 5.9c-.2 1.3-1 2-2.4 2H5.7c-1.4 0-2.2-.8-2.2-2.2v-6.2Z" }
]);

export const Funnel = makeIcon([
  {
    d: "M4.2 4h15.6c1.2 0 1.8 1.5 1 2.35L14.5 13v5.4l-5 3V13L3.2 6.35C2.4 5.5 3 4 4.2 4Z",
    props: { strokeWidth: 2.35 }
  }
]);

export const FolderGit2 = makeIcon([
  { d: "M3.5 7.4c0-1.2.8-2 2-2h3.3c.5 0 .9.2 1.3.6l1 1c.3.3.7.4 1.2.4h6.2c1.2 0 2 .8 2 2v1" },
  { d: "M3.5 10.2c.1-1.1.9-1.8 2.1-1.8h12.8c1.4 0 2.2.9 2 2.3l-.7 5.9c-.2 1.3-1 2-2.4 2H5.7c-1.4 0-2.2-.8-2.2-2.2v-6.2Z" },
  { d: "M9 12.2v2.7c0 .8.5 1.3 1.3 1.3H12" },
  { element: "circle", props: { cx: 8.8, cy: 11.8, r: 1 } },
  { element: "circle", props: { cx: 14.2, cy: 16.2, r: 1 } }
]);

export const FolderPlus = makeIcon([
  { d: "M3.5 7.4c0-1.2.8-2 2-2h3.3c.5 0 .9.2 1.3.6l1 1c.3.3.7.4 1.2.4h6.2c1.2 0 2 .8 2 2v1" },
  { d: "M3.5 10.2c.1-1.1.9-1.8 2.1-1.8h12.8c1.4 0 2.2.9 2 2.3l-.7 5.9c-.2 1.3-1 2-2.4 2H5.7c-1.4 0-2.2-.8-2.2-2.2v-6.2Z" },
  { d: "M12 11.4v4.4M9.8 13.6h4.4" }
]);

export const GripVertical = makeIcon([
  { element: "circle", props: { cx: 9, cy: 7, r: 1 } },
  { element: "circle", props: { cx: 15, cy: 7, r: 1 } },
  { element: "circle", props: { cx: 9, cy: 12, r: 1 } },
  { element: "circle", props: { cx: 15, cy: 12, r: 1 } },
  { element: "circle", props: { cx: 9, cy: 17, r: 1 } },
  { element: "circle", props: { cx: 15, cy: 17, r: 1 } }
]);

export const KeyRound = makeIcon([
  { element: "circle", props: { cx: 8, cy: 14, r: 3.5 } },
  { d: "M11 11 20 2" },
  { d: "m16.5 5.5 2 2" },
  { d: "m14.5 7.5 2 2" }
]);

export const Loader2 = makeIcon([
  { d: "M12 3a9 9 0 1 1-8.2 5.3" }
]);

export const LoaderCircle = Loader2;

export const MessageSquare = makeIcon([
  { d: "M5.7 5h12.6c1.1 0 1.7.7 1.7 1.7v8.6c0 1.1-.7 1.7-1.7 1.7H9l-4.7 3v-3.7c-.7-.3-1-1-1-1.8V6.7C3.3 5.7 4 5 5.7 5Z" }
]);

export const MessageSquarePlus = makeIcon([
  { d: "M5.7 5h12.6c1.1 0 1.7.7 1.7 1.7v8.6c0 1.1-.7 1.7-1.7 1.7H9l-4.7 3v-3.7c-.7-.3-1-1-1-1.8V6.7C3.3 5.7 4 5 5.7 5Z" },
  { d: "M12 8.6v5.2M9.4 11.2h5.2" }
]);

export const NewChat = makeIcon(
  [
    {
      d: "M2.669 11.333V8.667c0-.922 0-1.655.048-2.244.048-.597.15-1.106.387-1.571l.155-.276a4 4 0 0 1 1.593-1.472l.177-.083c.418-.179.872-.263 1.395-.305.589-.048 1.32-.048 2.243-.048h.5a.665.665 0 0 1 0 1.33h-.5c-.944 0-1.613 0-2.135.043-.386.032-.66.085-.876.162l-.2.086a2.67 2.67 0 0 0-1.064.982l-.102.184c-.126.247-.206.562-.248 1.076-.043.523-.043 1.192-.043 2.136v2.666c0 .944 0 1.613.043 2.136.042.514.122.829.248 1.076l.102.184c.257.418.624.758 1.064.982l.2.086c.217.077.49.13.876.161.522.043 1.19.044 2.135.044h2.667c.944 0 1.612-.001 2.135-.044.514-.042.829-.121 1.076-.247l.184-.104c.418-.256.759-.623.983-1.062l.086-.2c.077-.217.13-.49.16-.876.043-.523.044-1.192.044-2.136v-.5a.665.665 0 0 1 1.33 0v.5c0 .922.001 1.655-.047 2.244-.043.522-.127.977-.306 1.395l-.083.176a4 4 0 0 1-1.471 1.593l-.276.154c-.466.238-.975.34-1.572.39-.59.047-1.321.047-2.243.047H8.667c-.923 0-1.654 0-2.243-.048-.523-.043-.977-.126-1.395-.305l-.177-.084a4 4 0 0 1-1.593-1.471l-.155-.276c-.237-.465-.339-.974-.387-1.57-.049-.59-.048-1.322-.048-2.245m10.796-8.22a2.43 2.43 0 0 1 3.255.167l.167.185c.727.892.727 2.18 0 3.071l-.168.185-5.046 5.048a4 4 0 0 1-1.945 1.072l-.317.058-1.817.26a.665.665 0 0 1-.752-.753l.26-1.816.058-.319a4 4 0 0 1 1.072-1.944L13.28 3.28zm2.314 1.108a1.103 1.103 0 0 0-1.476-.076l-.084.076-5.046 5.048a2.67 2.67 0 0 0-.716 1.296l-.04.212-.134.939.94-.134.211-.039a2.67 2.67 0 0 0 1.298-.716L15.78 5.78l.076-.084c.33-.404.33-.988 0-1.392z",
      props: { fill: "currentColor", stroke: "none" }
    }
  ],
  "0 0 20 20"
);

export const MoreHorizontal = makeIcon([
  { element: "circle", props: { cx: 6.6, cy: 12, r: 1 } },
  { element: "circle", props: { cx: 12, cy: 12, r: 1 } },
  { element: "circle", props: { cx: 17.4, cy: 12, r: 1 } }
]);

export const Mic = makeIcon([
  { d: "M12 14c1.8 0 3-1.2 3-3V6.5c0-1.8-1.2-3-3-3s-3 1.2-3 3V11c0 1.8 1.2 3 3 3Z" },
  { d: "M6 10.5c0 3.4 2.4 5.7 6 5.7s6-2.3 6-5.7" },
  { d: "M12 16.2V20" },
  { d: "M9 20h6" }
]);

export const PanelLeftClose = makeIcon([
  { element: "rect", props: { x: 4.8, y: 6, width: 14.4, height: 12, rx: 3.6 } },
  { d: "M8.94 9.15v5.7" }
]);

export const PanelRightClose = makeIcon([
  { element: "rect", props: { x: 4.8, y: 6, width: 14.4, height: 12, rx: 3.6 } },
  { d: "M15.06 9.15v5.7" }
]);

export const PanelSingle = makeIcon([
  { d: "M11 17H7v-4" },
  { d: "M13 7h4v4" }
]);

export const PanelSplit = makeIcon([
  { element: "rect", props: { x: 4.8, y: 6, width: 14.4, height: 12, rx: 3.6 } },
  { d: "M12 9.15v5.7" }
]);

export const Pencil = makeIcon([
  { d: "M4.5 16.7 4 20l3.3-.5L18.9 7.9c.8-.8.8-2 0-2.8s-2-.8-2.8 0L4.5 16.7Z" },
  { d: "m14.8 6.4 2.8 2.8" }
]);

export const Pin = makeIcon(
  [
    {
      d: "m11.294.984 3.722 3.722a1.75 1.75 0 0 1-.504 2.826l-1.327.613a3.089 3.089 0 0 0-1.707 2.084l-.584 2.454c-.317 1.332-1.972 1.8-2.94.832L5.75 11.311 1.78 15.28a.749.749 0 1 1-1.06-1.06l3.969-3.97-2.204-2.204c-.968-.968-.5-2.623.832-2.94l2.454-.584a3.08 3.08 0 0 0 2.084-1.707l.613-1.327a1.75 1.75 0 0 1 2.826-.504ZM6.283 9.723l2.732 2.731a.25.25 0 0 0 .42-.119l.584-2.454a4.586 4.586 0 0 1 2.537-3.098l1.328-.613a.25.25 0 0 0 .072-.404l-3.722-3.722a.25.25 0 0 0-.404.072l-.613 1.328a4.584 4.584 0 0 1-3.098 2.537l-2.454.584a.25.25 0 0 0-.119.42l2.731 2.732Z",
      props: { fill: "currentColor", stroke: "none" }
    }
  ],
  "0 0 16 16"
);

export const PinOff = makeIcon(
  [
    {
      d: "m1.655.595 13.75 13.75q.22.219.22.53 0 .311-.22.53-.219.22-.53.22-.311 0-.53-.22L.595 1.655q-.22-.219-.22-.53 0-.311.22-.53.219-.22.53-.22.311 0 .53.22ZM.72 14.22l4.5-4.5q.219-.22.53-.22.311 0 .53.22.22.219.22.53 0 .311-.22.53l-4.5 4.5q-.219.22-.53.22-.311 0-.53-.22-.22-.219-.22-.53 0-.311.22-.53Z",
      props: { fill: "currentColor", stroke: "none" }
    },
    {
      d: "m5.424 6.146-1.759.419q-.143.034-.183.175-.04.141.064.245l5.469 5.469q.104.104.245.064.141-.04.175-.183l.359-1.509q.072-.302.337-.465.264-.163.567-.091.302.072.465.337.162.264.09.567l-.359 1.509q-.238.999-1.226 1.278-.988.28-1.714-.446L2.485 8.046q-.726-.726-.446-1.714.279-.988 1.278-1.226l1.759-.419q.303-.072.567.091.265.163.337.465.072.302-.091.567-.163.264-.465.336ZM7.47 3.47q.155-.156.247-.355l.751-1.627Q8.851.659 9.75.498q.899-.16 1.544.486l3.722 3.722q.646.645.486 1.544-.161.899-.99 1.282l-1.627.751q-.199.092-.355.247-.219.22-.53.22-.311 0-.53-.22-.22-.219-.22-.53 0-.311.22-.53.344-.345.787-.549l1.627-.751q.118-.055.141-.183.023-.128-.069-.221l-3.722-3.722q-.092-.092-.221-.069-.128.023-.183.141l-.751 1.627q-.204.443-.549.787-.219.22-.53.22-.311 0-.53-.22-.22-.219-.22-.53 0-.311.22-.53Z",
      props: { fill: "currentColor", stroke: "none" }
    }
  ],
  "0 0 16 16"
);

export const Plug = makeIcon([
  { d: "M8 3v5M16 3v5" },
  { d: "M6.5 8h11v3.2c0 2.5-1.8 4.3-4.3 4.3h-2.4c-2.5 0-4.3-1.8-4.3-4.3V8Z" },
  { d: "M12 15.5V21" }
]);

export const Plus = makeIcon([
  { d: "M12 5v14M5 12h14" }
]);

export const RefreshCw = makeIcon([
  {
    d: "M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.69 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8ZM6 12c0-1.01.25-1.97.69-2.8L5.23 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6Z",
    props: { fill: "currentColor", stroke: "none", transform: "rotate(90 12 12)" }
  }
]);

// Reset and refresh intentionally share the supplied two-arrow silhouette.
export const RotateCcw = RefreshCw;

export const Search = makeIcon([
  { element: "circle", props: { cx: 10.8, cy: 10.8, r: 6.3 } },
  { d: "m15.4 15.4 4.3 4.3" }
]);

export const SendHorizontal = makeIcon([
  { d: "M3.8 11.2 19.5 4.4c.7-.3 1.3.3 1 1L13.8 21c-.3.8-1.4.7-1.6-.1l-1.8-6.7-6.7-1.8c-.8-.2-.9-1.3.1-1.2Z" },
  { d: "m10.5 14.1 4.1-4.1" }
]);

export const Server = makeIcon([
  { element: "rect", props: { x: 4, y: 4, width: 16, height: 6, rx: 1.5 } },
  { element: "rect", props: { x: 4, y: 14, width: 16, height: 6, rx: 1.5 } },
  { d: "M7 7h.01M7 17h.01" }
]);

export const Settings = makeIcon([
  { d: "M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" },
  { d: "M19.4 13.6c.1-.5.1-1.1 0-1.6l2-1.5-2-3.5-2.4 1c-.4-.3-.9-.6-1.4-.8L15.3 4h-6.6l-.4 3.2c-.5.2-1 .4-1.4.8L4.6 7l-2 3.5 2 1.5c-.1.5-.1 1.1 0 1.6l-2 1.5 2 3.5 2.3-1c.4.3.9.6 1.4.8l.4 3.2h6.6l.4-3.2c.5-.2 1-.4 1.4-.8l2.4 1 2-3.5-2.1-1.5Z" }
]);

export const ShieldCheck = makeIcon([
  { d: "M12 3.2 19 6v5.2c0 4.5-2.8 7.9-7 9.6-4.2-1.7-7-5.1-7-9.6V6l7-2.8Z" },
  { d: "m8.5 12 2.2 2.2 4.8-5" }
]);

export const SlidersHorizontal = makeIcon([
  { d: "M4 7h6M14 7h6" },
  { element: "circle", props: { cx: 12, cy: 7, r: 2 } },
  { d: "M4 17h3M11 17h9" },
  { element: "circle", props: { cx: 9, cy: 17, r: 2 } }
]);

export const Sparkles = makeIcon([
  { d: "M12 3.5 13.6 8 18 9.6 13.6 11.2 12 15.5l-1.6-4.3L6 9.6 10.4 8 12 3.5Z" },
  { d: "M5.5 14.5 6.3 17l2.2.8-2.2.8-.8 2.4-.8-2.4-2.2-.8 2.2-.8.8-2.5Z" },
  { d: "M18 15.5 18.7 18l2.3.7-2.3.8-.7 2-.8-2-2.2-.8 2.2-.7.8-2.5Z" }
]);

export const Square = makeIcon([
  { element: "rect", props: { x: 6.5, y: 6.5, width: 11, height: 11, rx: 0 } }
]);

export const Terminal = makeIcon([
  { d: "m5 7 5 5-5 5" },
  { d: "M12 17h7" }
]);

export const TerminalSquare = makeIcon([
  { element: "rect", props: { x: 3.5, y: 4, width: 17, height: 16, rx: 2.2 } },
  { d: "m7.5 9 3 3-3 3" },
  { d: "M12.5 15h4" }
]);

export const Trash2 = makeIcon([
  { d: "M4 6.5h16" },
  { d: "M9.5 6.5V4.8c0-.8.5-1.3 1.3-1.3h2.4c.8 0 1.3.5 1.3 1.3v1.7" },
  { d: "M6.8 6.5 7.6 19c.1 1 .8 1.6 1.8 1.6h5.2c1 0 1.7-.6 1.8-1.6l.8-12.5" },
  { d: "M10 10v6M14 10v6" }
]);

export const UserPlus = makeIcon([
  { d: "M15.5 19.2c0-2.5-1.9-4.2-4.7-4.2H8.6c-2.8 0-4.7 1.7-4.7 4.2" },
  { d: "M6.7 7.7a3.1 3.1 0 1 0 6.2 0 3.1 3.1 0 0 0-6.2 0Z" },
  { d: "M18 7.5v5" },
  { d: "M15.5 10h5" }
]);

export const X = makeIcon([
  { d: "M6 6l12 12M18 6 6 18" }
]);

export const XCircle = makeIcon([
  { element: "circle", props: { cx: 12, cy: 12, r: 9 } },
  { d: "M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5" }
]);
