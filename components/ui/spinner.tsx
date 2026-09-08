import { cn } from '@/lib/utils';
import { Loader2Icon } from 'lucide-react';

function Spinner({
  className,
  'aria-label': label = 'Loading',
  ...props
}: React.ComponentProps<'svg'>) {
  return (
    <output className="inline-flex" aria-label={label}>
      <Loader2Icon
        data-slot="spinner"
        className={cn('size-4 animate-spin', className)}
        {...props}
        aria-hidden="true"
      />
    </output>
  );
}

export { Spinner };
