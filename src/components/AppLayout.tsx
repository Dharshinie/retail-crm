import { ReactNode, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Package, Receipt, CreditCard, LogOut, Menu, ShoppingCart, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/billing', icon: Receipt, label: 'Billing' },
  { to: '/credits', icon: CreditCard, label: 'Credits' },
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const backgroundImageUrl = 'https://i.pinimg.com/1200x/43/3b/bb/433bbb73aa539cbe46c2779320e2eb6f.jpg';

  return (
    <div className="relative flex h-screen overflow-hidden">
      {/* Full-screen background */}
      <img src={backgroundImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" width={1920} height={1080} />
      <div className="absolute inset-0 bg-gradient-to-br from-background/92 via-background/88 to-background/92" />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col glass-sidebar transition-transform duration-300 lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0 animate-slide-in-right" : "-translate-x-full"
      )}>
        <div className="flex h-20 items-center gap-3 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 glow-primary">
            <ShoppingCart className="h-5 w-5 text-primary" />
          </div>
          <span className="font-heading text-xl font-bold text-gradient">ShopPulse CRM</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                location.pathname === to
                  ? "glass-subtle text-primary glow-primary"
                  : "text-sidebar-foreground hover:glass-subtle hover:text-foreground"
              )}
            >
              <Icon className={cn(
                "h-4.5 w-4.5 transition-colors",
                location.pathname === to ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border/10 p-4">
          <p className="mb-3 truncate px-1 text-xs text-muted-foreground/60">{user?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-4 glass border-b border-border/10 px-4 lg:px-6">
          <button className="lg:hidden rounded-lg p-2 hover:bg-secondary/50 transition-colors" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="font-heading text-xl font-semibold">
            {navItems.find(n => n.to === location.pathname)?.label || 'GroceryCRM'}
          </h1>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
