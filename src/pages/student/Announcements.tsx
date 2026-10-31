import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { Megaphone, Search, Bell, Calendar, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/services';

export default function Announcements() {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  // Fetch announcements for students
  const { announcements: allAnnouncements, loading } = useAnnouncements('student', 50);

  // Client-side filtering
  const announcements = allAnnouncements.filter(a =>
    (a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!priorityFilter || a.priority === priorityFilter)
  );

  const unreadCount = announcements.filter(a => !a.isRead).length;

  const priorityColors = {
    high: 'status-rejected',
    medium: 'status-pending',
    low: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <PageHeader
        title="Announcements"
        description="Stay updated with the latest news and updates"
      >
        {unreadCount > 0 && (
          <Badge variant="default">{unreadCount} unread</Badge>
        )}
      </PageHeader>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Search and Filters */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search announcements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={priorityFilter === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPriorityFilter(null)}
              >
                All
              </Button>
              <Button
                variant={priorityFilter === 'high' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPriorityFilter('high')}
              >
                High Priority
              </Button>
              <Button
                variant={priorityFilter === 'medium' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPriorityFilter('medium')}
              >
                Medium
              </Button>
            </div>
          </div>

          {/* Announcements List */}
          {announcements.length > 0 ? (
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <Card
                  key={announcement.id}
                  className={cn(
                    'card-interactive',
                    !announcement.isRead && 'border-primary/30 bg-primary/5'
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {!announcement.isRead && (
                          <div className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
                        )}
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{announcement.title}</CardTitle>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {announcement.authorName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(announcement.publishedAt, 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge className={priorityColors[announcement.priority]}>
                        {announcement.priority}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{announcement.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Megaphone}
              title="No announcements found"
              description={searchQuery || priorityFilter ? 'Try adjusting your search or filters' : 'There are no announcements at the moment'}
            />
          )}
        </>
      )}
    </div>
  );
}
