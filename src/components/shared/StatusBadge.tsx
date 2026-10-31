import { cn } from '@/lib/services';
import { 
  Clock, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Lock,
  AlertCircle 
} from 'lucide-react';

type StatusType = 
  | 'draft' 
  | 'submitted' 
  | 'approved' 
  | 'rejected' 
  | 'locked' 
  | 'pending'
  | 'not_uploaded'
  | 'uploaded'
  | 'reviewed'
  | 'in_progress'
  | 'completed'
  | 'upcoming'
  | 'overdue'
  | 'accepted';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<StatusType, { 
  label: string; 
  className: string; 
  icon: React.ElementType 
}> = {
  draft: {
    label: 'Draft',
    className: 'status-draft',
    icon: Clock,
  },
  submitted: {
    label: 'Submitted',
    className: 'status-submitted',
    icon: Send,
  },
  approved: {
    label: 'Approved',
    className: 'status-approved',
    icon: CheckCircle2,
  },
  accepted: {
    label: 'Accepted',
    className: 'status-approved',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    className: 'status-rejected',
    icon: XCircle,
  },
  locked: {
    label: 'Locked',
    className: 'status-locked',
    icon: Lock,
  },
  pending: {
    label: 'Pending',
    className: 'status-pending',
    icon: Clock,
  },
  not_uploaded: {
    label: 'Not Uploaded',
    className: 'bg-muted text-muted-foreground',
    icon: AlertCircle,
  },
  uploaded: {
    label: 'Uploaded',
    className: 'status-submitted',
    icon: Send,
  },
  reviewed: {
    label: 'Reviewed',
    className: 'status-submitted',
    icon: CheckCircle2,
  },
  in_progress: {
    label: 'In Progress',
    className: 'status-pending',
    icon: Clock,
  },
  completed: {
    label: 'Completed',
    className: 'status-approved',
    icon: CheckCircle2,
  },
  upcoming: {
    label: 'Upcoming',
    className: 'bg-muted text-muted-foreground',
    icon: Clock,
  },
  overdue: {
    label: 'Overdue',
    className: 'status-rejected',
    icon: AlertCircle,
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function StatusBadge({ 
  status, 
  className, 
  showIcon = true, 
  size = 'sm' 
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full whitespace-nowrap',
        config.className,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={cn(
        size === 'sm' && 'h-3 w-3',
        size === 'md' && 'h-3.5 w-3.5',
        size === 'lg' && 'h-4 w-4'
      )} />}
      {config.label}
    </span>
  );
}
