import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Users, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async () => {
      const [customers, products, orders, lowStock] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('total, created_at'),
        supabase.from('products').select('*').filter('stock', 'lte', 10),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const todaySales = (orders.data || [])
        .filter(o => o.created_at.startsWith(today))
        .reduce((sum, o) => sum + Number(o.total), 0);
      const totalRevenue = (orders.data || []).reduce((sum, o) => sum + Number(o.total), 0);

      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const key = d.toISOString().split('T')[0];
        const dayTotal = (orders.data || [])
          .filter(o => o.created_at.startsWith(key))
          .reduce((sum, o) => sum + Number(o.total), 0);
        return { day: d.toLocaleDateString('en', { weekday: 'short' }), sales: dayTotal };
      });

      return {
        customerCount: customers.count || 0,
        productCount: products.count || 0,
        orderCount: (orders.data || []).length,
        todaySales,
        totalRevenue,
        lowStockItems: lowStock.data || [],
        last7,
      };
    },
    enabled: !!user,
  });

  const { data: topCustomers } = useQuery({
    queryKey: ['top-customers', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('name, total_spent').order('total_spent', { ascending: false }).limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  const statCards = [
    { label: "Today's Sales", value: `₹${stats?.todaySales?.toFixed(2) || '0.00'}`, icon: DollarSign, accent: 'primary' },
    { label: 'Total Revenue', value: `₹${stats?.totalRevenue?.toFixed(2) || '0.00'}`, icon: TrendingUp, accent: 'primary' },
    { label: 'Customers', value: stats?.customerCount || 0, icon: Users, accent: 'info' },
    { label: 'Products', value: stats?.productCount || 0, icon: Package, accent: 'accent' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, accent }, i) => (
          <div
            key={label}
            className="glass hover-lift rounded-2xl p-5"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-${accent}/15`}>
                <Icon className={`h-4 w-4 text-${accent}`} />
              </div>
            </div>
            <div className="font-heading text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales Chart */}
        <div className="glass rounded-2xl p-6 hover-lift">
          <h2 className="mb-4 font-heading text-lg font-semibold">Sales — Last 7 Days</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats?.last7 || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 20%)" />
              <XAxis dataKey="day" tick={{ fill: 'hsl(220, 10%, 60%)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'hsl(220, 10%, 60%)', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(220, 15%, 12%)',
                  border: '1px solid hsl(220, 15%, 22%)',
                  borderRadius: '12px',
                  backdropFilter: 'blur(20px)',
                  color: 'hsl(0, 0%, 95%)',
                }}
              />
              <Bar dataKey="sales" fill="hsl(152, 60%, 45%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Customers */}
        <div className="glass rounded-2xl p-6 hover-lift">
          <h2 className="mb-4 font-heading text-lg font-semibold">Top Customers</h2>
          {(topCustomers || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No customers yet</p>
          ) : (
            <div className="space-y-3">
              {topCustomers?.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl glass-subtle px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
                      #{i + 1}
                    </div>
                    <span className="text-sm font-medium">{c.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary">₹{Number(c.total_spent).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alerts */}
      {(stats?.lowStockItems || []).length > 0 && (
        <div className="glass rounded-2xl border-warning/20 p-6">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-warning">
            <AlertTriangle className="h-5 w-5" /> Low Stock Alerts
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats?.lowStockItems.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-xl glass-subtle px-4 py-3 text-sm">
                <span>{p.name}</span>
                <span className="font-semibold text-destructive">{p.stock} left</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
