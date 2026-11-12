import Image from 'next/image';
import { cn } from '@/utils/validators';

// Intrinsic size of /public/almaarefa-logo.png (keeps aspect ratio, prevents layout shift)
const LOGO_WIDTH = 1024;
const LOGO_HEIGHT = 210;

interface BrandLogoProps {
  /** Tailwind height class, e.g. "h-9". Width scales automatically. */
  className?: string;
  /** Load eagerly (use for above-the-fold placements). */
  priority?: boolean;
}

export function BrandLogo({ className = 'h-9', priority = false }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center rounded-xl px-2 py-1 bg-[#ffffff]/95 shadow-xs ring-1 ring-black/5">
      <Image
        src="/almaarefa-logo.png"
        alt="Almaarefa University"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority={priority}
        className={cn('w-auto select-none', className)}
      />
    </span>
  );
}
