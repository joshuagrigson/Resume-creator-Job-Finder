/**
 * Editorial still-lifes from public/art (generated in Canva, see docs/BRAND.md).
 *
 * Serves the smallest format the browser understands at the width the layout needs:
 *   /art/<name>-<width>.<avif|webp|jpg>
 */
import { cx } from './utils';

export type ArtFormat = 'avif' | 'webp' | 'jpg';

export interface ArtImageProps {
  name: 'desk' | 'compass' | 'pen' | 'envelopes';
  /** Widths that exist on disk, smallest first. */
  widths: number[];
  /** CSS `sizes` so the browser picks the right width. */
  sizes: string;
  alt: string;
  /** Formats that exist on disk, best first; the last one is the <img> fallback. */
  formats?: ArtFormat[];
  /** Above-the-fold art loads eagerly with high priority; everything else is lazy. */
  priority?: boolean;
  className?: string;
}

const DEFAULT_FORMATS: Record<ArtImageProps['name'], ArtFormat[]> = {
  desk: ['avif', 'webp', 'jpg'],
  compass: ['webp'],
  pen: ['webp'],
  envelopes: ['webp'],
};

const MIME: Record<ArtFormat, string> = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg' };

export function ArtImage({ name, widths, sizes, alt, formats, priority = false, className }: ArtImageProps) {
  const list = formats ?? DEFAULT_FORMATS[name];
  const srcset = (format: ArtFormat) => widths.map((w) => `/art/${name}-${w}.${format} ${w}w`).join(', ');
  const fallback = list[list.length - 1]!;
  const largest = widths[widths.length - 1]!;
  return (
    <picture className={cx('ui-art', className)}>
      {list.slice(0, -1).map((format) => (
        <source key={format} type={MIME[format]} srcSet={srcset(format)} sizes={sizes} />
      ))}
      <img
        src={`/art/${name}-${largest}.${fallback}`}
        srcSet={srcset(fallback)}
        sizes={sizes}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...(priority ? { fetchPriority: 'high' as const } : {})}
      />
    </picture>
  );
}
