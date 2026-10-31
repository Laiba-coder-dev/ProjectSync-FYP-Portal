import { cn } from '@/lib/services';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { format } from 'date-fns';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  date?: Date;
  status: 'completed' | 'in_progress' | 'upcoming' | 'overdue';
}

interface ProgressTimelineProps {
  items: TimelineItem[];
  className?: string;
  orientation?: 'vertical' | 'horizontal';
}

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    lineColor: 'bg-primary',
    iconColor: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  in_progress: {
    icon: Clock,
    lineColor: 'bg-primary',
    iconColor: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  upcoming: {
    icon: Circle,
    lineColor: 'bg-muted',
    iconColor: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  overdue: {
    icon: Clock,
    lineColor: 'bg-destructive',
    iconColor: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
};

export function ProgressTimeline({ 
  items, 
  className,
  orientation = 'vertical' 
}: ProgressTimelineProps) {
  if (orientation === 'horizontal') {
    return (
      <div className={cn('flex items-center justify-between', className)}>
        {items.map((item, index) => {
          const config = statusConfig[item.status];
          const Icon = config.icon;
          const isLast = index === items.length - 1;

          return (
            <div key={item.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full',
                    config.bgColor
                  )}
                >
                  <Icon className={cn('h-5 w-5', config.iconColor)} />
                </div>
                <div className="mt-2 text-center">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.date && (
                    <p className="text-xs text-muted-foreground">
                      {format(item.date, 'MMM d')}
                    </p>
                  )}
                </div>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-2',
                    index < items.findIndex((i) => i.status !== 'completed')
                      ? 'bg-primary'
                      : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {items.map((item, index) => {
        const config = statusConfig[item.status];
        const Icon = config.icon;
        const isLast = index === items.length - 1;

        return (
          <div key={item.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                  config.bgColor
                )}
              >
                <Icon className={cn('h-4 w-4', config.iconColor)} />
              </div>
              {!isLast && (
                <div
                  className={cn('w-0.5 flex-1 min-h-[2rem]', config.lineColor)}
                />
              )}
            </div>
            <div className={cn('pb-6', isLast && 'pb-0')}>
              <p className="font-medium leading-none">{item.title}</p>
              {item.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.description}
                </p>
              )}
              {item.date && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(item.date, 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
