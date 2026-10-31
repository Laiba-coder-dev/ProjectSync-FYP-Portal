import { ReactNode, useState } from 'react';
import { useLocation, useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTask } from '@/contexts/TaskContext';
import { cn } from '@/lib/services';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  Upload,
  BarChart3,
  Megaphone,
  Award,
  Share,
  User,
  UserCheck,
  ClipboardList,
  FileSearch,
  Settings,
  ShieldCheck,
  Calendar,
  FileSpreadsheet,
  Lock,
  Activity,
  LucideIcon,
  FolderOpen,
  Archive,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LogOut,
  Menu,
  BrainCircuit,
  ExternalLink,
  X,
} from 'lucide-react';
import { UserRole } from '@/types';
import { NotificationDropdown } from './NotificationDropdown';

// ── Navigation Config — formerly src/components/layout/navigationConfig.ts ──

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const studentNavigation: NavigationItem[] = [
  { label: 'Dashboard', href: '/student', icon: LayoutDashboard },
  { label: 'Supervisor Selection', href: '/student/supervisor', icon: UserCheck },
  { label: 'My Group', href: '/student/group', icon: Users },
  { label: 'Project Idea', href: '/student/project', icon: FolderKanban },
  { label: 'Documents', href: '/student/documents', icon: Upload },
  { label: 'AI Analyzer', href: '/student/analyzer', icon: BrainCircuit },
  { label: 'Templates', href: '/student/templates', icon: FileText },
  { label: 'Progress', href: '/student/progress', icon: BarChart3 },
  { label: 'Announcements', href: '/student/announcements', icon: Megaphone },
  { label: 'Evaluation', href: '/student/evaluation', icon: Award },
  { label: 'Profile', href: '/student/profile', icon: User },
];

const supervisorNavigation: NavigationItem[] = [
  { label: 'Dashboard', href: '/supervisor', icon: LayoutDashboard },
  { label: 'Requests', href: '/supervisor/requests', icon: ClipboardList },
  { label: 'My Groups', href: '/supervisor/groups', icon: Users },
  { label: 'Idea Review', href: '/supervisor/ideas', icon: FileSearch },
  { label: 'Document Review', href: '/supervisor/documents', icon: FileText },
  { label: 'AI Analyzer', href: '/supervisor/analyzer', icon: BrainCircuit },
  { label: 'Evaluation', href: '/supervisor/evaluation', icon: Award },
  { label: 'Announcements', href: '/supervisor/announcements', icon: Megaphone },
];

const pmoNavigation: NavigationItem[] = [
  { label: 'Dashboard', href: '/pmo', icon: LayoutDashboard },
  { label: 'User Management', href: '/pmo/users', icon: Users },
  { label: 'Group Overview', href: '/pmo/groups', icon: FolderOpen },
  { label: 'Project Approval', href: '/pmo/approvals', icon: FolderKanban },
  { label: 'Document Repository', href: '/pmo/documents', icon: Archive },
  { label: 'AI Analyzer', href: '/pmo/analyzer', icon: BrainCircuit },
  { label: 'Announcements', href: '/pmo/announcements', icon: Megaphone },
  { label: 'Supervisor Assignment', href: '/pmo/assignments', icon: UserCheck },
  { label: 'External Assignment', href: '/pmo/external-assignment', icon: UserCheck },
  { label: 'Panel Scheduling', href: '/pmo/panels', icon: Calendar },
  { label: 'Evaluation', href: '/pmo/evaluation', icon: Award },
  { label: 'Progress Monitor', href: '/pmo/progress', icon: BarChart3 },
  { label: 'Templates', href: '/pmo/templates', icon: FileText },
  { label: 'Reports', href: '/pmo/reports', icon: FileSpreadsheet },
];

const externalPanelNavigation: NavigationItem[] = [
  { label: 'Dashboard', href: '/external', icon: LayoutDashboard },
  { label: 'Group View', href: '/external/groups', icon: Users },
  { label: 'Document Review', href: '/external/documents', icon: FileText },
  { label: 'Evaluate Groups', href: '/external/evaluate', icon: Award },
];

const examCellNavigation: NavigationItem[] = [
  { label: 'Dashboard', href: '/exam-cell', icon: LayoutDashboard },
  { label: 'Compile Results', href: '/exam-cell/compile', icon: FileSpreadsheet },
];

const adminNavigation: NavigationItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Role Management', href: '/admin/roles', icon: ShieldCheck },
  { label: 'Academic Config', href: '/admin/config', icon: Calendar },
  { label: 'Audit Logs', href: '/admin/logs', icon: Activity },
];

function getNavigationItems(role: UserRole): NavigationItem[] {
  switch (role) {
    case 'student': return studentNavigation;
    case 'supervisor': return supervisorNavigation;
    case 'pmo': return pmoNavigation;
    case 'external_panel': return externalPanelNavigation;
    case 'exam_cell': return examCellNavigation;
    case 'admin': return adminNavigation;
    default: return [];
  }
}

// ── End Navigation Config ─────────────────────────────────────

interface AppLayoutProps {
  children: ReactNode;
}

const NavItem = ({
  item,
  collapsed = false,
  active,
  setMobileOpen,
}: {
  item: NavigationItem;
  collapsed?: boolean;
  active: boolean;
  setMobileOpen: (open: boolean) => void;
}) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.href}
      onClick={() => setMobileOpen(false)}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
        collapsed && 'justify-center px-2'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
};

const SidebarContent = ({
  collapsed = false,
  navItems,
  isActive,
  setMobileOpen,
  setSidebarCollapsed,
}: {
  collapsed?: boolean;
  navItems: NavigationItem[];
  isActive: (path: string) => boolean;
  setMobileOpen: (open: boolean) => void;
  setSidebarCollapsed?: (collapsed: boolean) => void;
}) => (
  <div className="flex h-full flex-col bg-sidebar">
    {/* Logo */}
    <div className={cn('flex h-16 items-center border-b border-sidebar-border px-4', collapsed && 'justify-center px-2')}>
      <Link to="/" className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <GraduationCap className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && <span className="font-semibold text-sidebar-foreground">ProjectSync</span>}
      </Link>
    </div>

    {/* Navigation */}
    <ScrollArea className="flex-1 px-3 py-4">
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavItem key={item.href} item={item} collapsed={collapsed} active={isActive(item.href)} setMobileOpen={setMobileOpen} />
        ))}
      </nav>
    </ScrollArea>

    {/* Collapse Toggle (Desktop only) */}
    {setSidebarCollapsed && (
      <div className="hidden border-t border-sidebar-border p-2 lg:block">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => setSidebarCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    )}
  </div>
);

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const task = useTask();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const navItems = getNavigationItems(user.role);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden border-r transition-all duration-300 lg:block',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent collapsed={sidebarCollapsed} navItems={navItems} isActive={isActive} setMobileOpen={setMobileOpen} setSidebarCollapsed={setSidebarCollapsed} />
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
          {/* Mobile Menu Trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent navItems={navItems} isActive={isActive} setMobileOpen={setMobileOpen} />
            </SheetContent>
          </Sheet>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <NotificationDropdown />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden flex-col items-start text-left md:flex">
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ') || 'User'}</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/${user?.role || 'student'}/profile`)}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background lg:hidden">
        <div className="flex h-16 items-center justify-around px-2">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-2 text-xs',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom padding for mobile nav */}
      <div className="h-16 lg:hidden" />

      {/* Floating Task Indicator */}
      {task.status === 'processing' && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-50 w-80 animate-in slide-in-from-bottom-5">
          <div className="bg-card text-card-foreground shadow-lg border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <BrainCircuit className="h-4 w-4 animate-pulse text-primary" />
                <span className="text-sm">AI Analyzer Running</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(`/${user.role}/analyzer`)}>
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={task.cancelTask}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Progress value={task.progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground truncate">{task.currentStep}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
