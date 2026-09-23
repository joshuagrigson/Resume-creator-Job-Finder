/** Launchpad's mark (public/icon.svg without its tile): the L with the rise. Designed in Canva. */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="84 72 344 352" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <rect x="96" y="120" width="40" height="292" />
        <rect x="96" y="372" width="252" height="40" />
        <polygon points="152,350 198,350 404,130 404,84" />
        <polygon points="376,126 416,84 416,412 376,412" />
      </g>
    </svg>
  );
}
