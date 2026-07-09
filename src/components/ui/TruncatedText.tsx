import { Tooltip } from './Tooltip';
import { cn } from '@/lib/utils';

type TruncatedTextProps = {
  children: string;
  className?: string;
  as?: 'span' | 'p' | 'h2';
  id?: string;
};

/** Texto truncado com tooltip temático do nome completo. */
export function TruncatedText({ children, className, as: Tag = 'span', id }: TruncatedTextProps) {
  return (
    <Tooltip label={children} wrapperClassName="min-w-0 max-w-full">
      <Tag id={id} className={cn('block truncate', className)}>
        {children}
      </Tag>
    </Tooltip>
  );
}
