/**
 * Shared GoalIQ wordmark logo. Consolidated from two duplicated copies that
 * used to live in `pages/Landing.tsx` and `layout/AppLayout.tsx`.
 *
 * Size tokens cover every existing call site:
 *   xs = 28 (AppLayout header), sm = 36, md = 48, lg = 48 (Landing).
 *
 * NOTE: no inline `display` — that previously overrode responsive
 * `sm:hidden` / `hidden sm:block` classes and caused a double-logo bug.
 */
const LOGO_HEIGHTS = { xs: 28, sm: 36, md: 48, lg: 48 } as const;

export type GoalIQLogoSize = keyof typeof LOGO_HEIGHTS;

export default function GoalIQLogo({
  size = "md",
  className,
}: {
  size?: GoalIQLogoSize;
  className?: string;
}) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}images/goaliq-logo-full.png`}
      alt="GoalIQ"
      className={className}
      style={{ height: LOGO_HEIGHTS[size], width: "auto", objectFit: "contain" }}
    />
  );
}
