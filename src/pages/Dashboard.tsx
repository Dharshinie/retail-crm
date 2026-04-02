import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CreditCard,
  DollarSign,
  Package,
  ShoppingBag,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/messaging';

type CustomerRow = {
  id: string;
  name: string;
  total_spent: number;
  loyalty_points: number;
  created_at: string;
};

type OrderRow = {
  total: number;
  created_at: string;
  customer_id: string;
  is_credit: boolean;
  credit_paid: boolean;
};

type LowStockRow = {
  id: string;
  name: string;
  stock: number;
  low_stock_threshold: number | null;
};

type ProductCategoryRow = {
  id: string;
  category: string | null;
};

const chartTooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
  color: 'hsl(var(--foreground))',
};

const categoryColors = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--info))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--secondary-foreground))',
];

const monthFormatter = new Intl.DateTimeFormat('en-IN', { month: 'short' });
const shortDayFormatter = new Intl.DateTimeFormat('en-IN', { weekday: 'short' });

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function diffPercent(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-analytics', user?.id],
    queryFn: async () => {
      const [customersResult, productsResult, productCategoriesResult, ordersResult, lowStockResult] = await Promise.all([
        supabase.from('customers').select('id, name, total_spent, loyalty_points, created_at').order('created_at', { ascending: false }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id, category'),
        supabase.from('orders').select('total, created_at, customer_id, is_credit, credit_paid'),
        supabase.from('products').select('id, name, stock, low_stock_threshold').order('stock', { ascending: true }),
      ]);

      if (customersResult.error) throw customersResult.error;
      if (productsResult.error) throw productsResult.error;
      if (productCategoriesResult.error) throw productCategoriesResult.error;
      if (ordersResult.error) throw ordersResult.error;
      if (lowStockResult.error) throw lowStockResult.error;

      return {
        customers: (customersResult.data || []) as CustomerRow[],
        productCount: productsResult.count || 0,
        productCategories: (productCategoriesResult.data || []) as ProductCategoryRow[],
        orders: (ordersResult.data || []) as OrderRow[],
        lowStockItems: ((lowStockResult.data || []) as LowStockRow[]).filter(
          (product) => product.stock <= (product.low_stock_threshold ?? 10),
        ),
      };
    },
    enabled: !!user,
  });

  const analytics = useMemo(() => {
    const customers = data?.customers || [];
    const productCategories = data?.productCategories || [];
    const orders = data?.orders || [];
    const lowStockItems = data?.lowStockItems || [];
    const now = new Date();
    const today = startOfDay(now);
    const todayKey = today.toISOString().slice(0, 10);
    const past30Start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    const prev30Start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59));
    const currentMonthStart = startOfMonth(now);

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total), 0);
    const todaySales = orders
      .filter((order) => order.created_at.slice(0, 10) === todayKey)
      .reduce((sum, order) => sum + Number(order.total), 0);
    const orderCount = orders.length;
    const avgOrderValue = orderCount ? totalRevenue / orderCount : 0;

    const ordersByCustomer = orders.reduce<Record<string, number>>((acc, order) => {
      acc[order.customer_id] = (acc[order.customer_id] || 0) + 1;
      return acc;
    }, {});

    const repeatCustomers = Object.values(ordersByCustomer).filter((count) => count > 1).length;
    const activeCustomers30 = new Set(
      orders
        .filter((order) => new Date(order.created_at) >= past30Start)
        .map((order) => order.customer_id),
    ).size;

    const customersThisMonth = customers.filter((customer) => new Date(customer.created_at) >= currentMonthStart).length;
    const past30Revenue = orders
      .filter((order) => new Date(order.created_at) >= past30Start)
      .reduce((sum, order) => sum + Number(order.total), 0);
    const previous30Revenue = orders
      .filter((order) => {
        const createdAt = new Date(order.created_at);
        return createdAt >= prev30Start && createdAt < past30Start;
      })
      .reduce((sum, order) => sum + Number(order.total), 0);
    const revenueGrowth = diffPercent(past30Revenue, previous30Revenue);

    const creditSales = orders
      .filter((order) => order.is_credit)
      .reduce((sum, order) => sum + Number(order.total), 0);
    const pendingCredit = orders
      .filter((order) => order.is_credit && !order.credit_paid)
      .reduce((sum, order) => sum + Number(order.total), 0);

    const last7 = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - index));
      const dateKey = date.toISOString().slice(0, 10);
      const dayOrders = orders.filter((order) => order.created_at.slice(0, 10) === dateKey);
      const sales = dayOrders.reduce((sum, order) => sum + Number(order.total), 0);

      return {
        day: shortDayFormatter.format(date),
        sales,
        orders: dayOrders.length,
      };
    });

    const monthlySales = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const month = monthDate.getMonth();
      const year = monthDate.getFullYear();
      const monthOrders = orders.filter((order) => {
        const createdAt = new Date(order.created_at);
        return createdAt.getMonth() === month && createdAt.getFullYear() === year;
      });

      return {
        month: monthFormatter.format(monthDate),
        sales: monthOrders.reduce((sum, order) => sum + Number(order.total), 0),
        orders: monthOrders.length,
      };
    });

    const categoryCounts = productCategories.reduce<Record<string, number>>((acc, product) => {
      const label = product.category?.trim() || 'Uncategorized';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    const categoryDistribution = Object.entries(categoryCounts)
      .map(([name, value], index) => ({
        name,
        value,
        color: categoryColors[index % categoryColors.length],
      }))
      .sort((a, b) => b.value - a.value);
    const topCategory = categoryDistribution[0];
    const uncategorizedCount = categoryCounts.Uncategorized || 0;

    const topCustomers = [...customers]
      .sort((a, b) => Number(b.total_spent) - Number(a.total_spent))
      .slice(0, 5);

    return {
      customerCount: customers.length,
      productCount: data?.productCount || 0,
      orderCount,
      todaySales,
      totalRevenue,
      avgOrderValue,
      repeatCustomers,
      activeCustomers30,
      customersThisMonth,
      revenueGrowth,
      creditSales,
      pendingCredit,
      lowStockItems,
      last7,
      monthlySales,
      categoryDistribution,
      topCategory,
      uncategorizedCount,
      topCustomers,
    };
  }, [data]);

  const statCards = [
    {
      label: "Today's Sales",
      value: formatCurrency(analytics?.todaySales || 0),
      detail: `${analytics?.orderCount || 0} total orders`,
      icon: DollarSign,
      tone: 'text-primary bg-primary/15',
    },
    {
      label: 'Revenue Growth',
      value: `${(analytics?.revenueGrowth || 0).toFixed(1)}%`,
      detail: 'vs previous 30 days',
      icon: TrendingUp,
      tone: 'text-accent bg-accent/15',
    },
    {
      label: 'Average Order',
      value: formatCurrency(analytics?.avgOrderValue || 0),
      detail: 'average basket size',
      icon: ShoppingBag,
      tone: 'text-info bg-info/15',
    },
    {
      label: 'Repeat Customers',
      value: analytics?.repeatCustomers || 0,
      detail: `${analytics?.activeCustomers30 || 0} active in 30 days`,
      icon: Users,
      tone: 'text-primary bg-primary/15',
    },
    {
      label: 'New This Month',
      value: analytics?.customersThisMonth || 0,
      detail: `${analytics?.customerCount || 0} total customers`,
      icon: UserPlus,
      tone: 'text-accent bg-accent/15',
    },
    {
      label: 'Pending Credit',
      value: formatCurrency(analytics?.pendingCredit || 0),
      detail: `${formatCurrency(analytics?.creditSales || 0)} credit sales`,
      icon: CreditCard,
      tone: 'text-warning bg-warning/15',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="animate-pulse font-heading text-xl text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {statCards.map(({ label, value, detail, icon: Icon, tone }, index) => (
          <div
            key={label}
            className="glass hover-lift rounded-2xl p-5"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="font-heading text-2xl font-bold">{value}</div>
            <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="glass rounded-2xl p-6 hover-lift">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold">Sales Analytics</h2>
              <p className="text-sm text-muted-foreground">Daily revenue and order count for the last 7 days.</p>
            </div>
            <div className="rounded-xl bg-primary/10 px-3 py-2 text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Total Revenue</div>
              <div className="font-semibold text-primary">{formatCurrency(analytics.totalRevenue)}</div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.last7}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.45} />
              <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--secondary) / 0.22)' }}
                formatter={(value: number, name: string) => [
                  name === 'sales' ? formatCurrency(value) : value,
                  name === 'sales' ? 'Sales' : 'Orders',
                ]}
                contentStyle={chartTooltipStyle}
              />
              <Bar dataKey="sales" radius={[8, 8, 0, 0]}>
                {analytics.last7.map((entry) => (
                  <Cell
                    key={entry.day}
                    fill={entry.sales > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted))'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl glass-subtle p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Orders</div>
              <div className="mt-2 font-heading text-2xl font-bold">{analytics.orderCount}</div>
            </div>
            <div className="rounded-xl glass-subtle p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Products</div>
              <div className="mt-2 font-heading text-2xl font-bold">{analytics.productCount}</div>
            </div>
            <div className="rounded-xl glass-subtle p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Low Stock</div>
              <div className="mt-2 font-heading text-2xl font-bold">{analytics.lowStockItems.length}</div>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 hover-lift">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold">Monthly Sales Trend</h2>
              <p className="text-sm text-muted-foreground">Revenue trend across the last 6 months.</p>
            </div>
            <div className="rounded-xl bg-accent/10 px-3 py-2 text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">30 Day Growth</div>
              <div className="font-semibold text-accent">{analytics.revenueGrowth.toFixed(1)}%</div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={analytics.monthlySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.45} />
              <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === 'sales' ? formatCurrency(value) : value,
                  name === 'sales' ? 'Sales' : 'Orders',
                ]}
                contentStyle={chartTooltipStyle}
              />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="hsl(var(--accent))"
                strokeWidth={3}
                dot={{ r: 4, fill: 'hsl(var(--accent))' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl glass-subtle p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Credit Sales</div>
              <div className="mt-2 font-heading text-2xl font-bold">{formatCurrency(analytics.creditSales)}</div>
            </div>
            <div className="rounded-xl glass-subtle p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Active Customers</div>
              <div className="mt-2 font-heading text-2xl font-bold">{analytics.activeCustomers30}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="glass rounded-2xl p-6 hover-lift">
          <div className="mb-5">
            <h2 className="font-heading text-lg font-semibold">Category Distribution</h2>
            <p className="text-sm text-muted-foreground">Product mix across your inventory categories.</p>
          </div>

          {analytics.categoryDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add products with categories to see the category distribution chart.</p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.categoryDistribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={65}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {analytics.categoryDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} products`, name]}
                      contentStyle={chartTooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {analytics.categoryDistribution.map((category) => (
                  <div key={category.name} className="rounded-xl border border-border/20 bg-background/35 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <div>
                          <div className="text-sm font-semibold">{category.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {((category.value / analytics.productCount) * 100).toFixed(1)}% of products
                          </div>
                        </div>
                      </div>
                      <div className="font-heading text-2xl font-bold">{category.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl glass-subtle p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Categories</div>
              <div className="mt-2 font-heading text-2xl font-bold">{analytics.categoryDistribution.length}</div>
              <p className="mt-1 text-sm text-muted-foreground">Distinct categories currently used in products.</p>
            </div>
            <div className="rounded-xl glass-subtle p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Top Category</div>
              <div className="mt-2 font-heading text-2xl font-bold">
                {analytics.topCategory?.name || 'None'}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {analytics.topCategory ? `${analytics.topCategory.value} products in the leading category.` : `${analytics.uncategorizedCount} uncategorized products.`}
              </p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 hover-lift">
          <div className="mb-5">
            <h2 className="font-heading text-lg font-semibold">Top Customers</h2>
            <p className="text-sm text-muted-foreground">Customers ranked by total spend and loyalty value.</p>
          </div>

          {analytics.topCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customer data available yet.</p>
          ) : (
            <div className="space-y-3">
              {analytics.topCustomers.map((customer, index) => (
                <div key={customer.id} className="rounded-xl glass-subtle px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-xs text-muted-foreground">{customer.loyalty_points} loyalty points</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-primary">{formatCurrency(Number(customer.total_spent))}</div>
                      <div className="text-xs text-muted-foreground">lifetime spend</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`glass rounded-2xl p-6 ${analytics.lowStockItems.length > 0 ? 'border-warning/20' : ''}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                analytics.lowStockItems.length > 0 ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'
              }`}
            >
              {analytics.lowStockItems.length > 0 ? <AlertTriangle className="h-5 w-5" /> : <Package className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold">
                {analytics.lowStockItems.length > 0 ? 'Inventory Health Needs Attention' : 'Inventory Health Looks Good'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {analytics.lowStockItems.length > 0
                  ? `${analytics.lowStockItems.length} product${analytics.lowStockItems.length > 1 ? 's are' : ' is'} below the low stock watch level.`
                  : 'No products are currently below the low stock watch level.'}
              </p>
            </div>
          </div>

          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/products">Manage Products</Link>
          </Button>
        </div>

        {analytics.lowStockItems.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {analytics.lowStockItems.map((product) => (
              <div key={product.id} className="rounded-xl glass-subtle px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{product.name}</span>
                  <span className="font-semibold text-destructive">{product.stock} left</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Threshold: {product.low_stock_threshold ?? 10}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
