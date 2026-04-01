import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CreditCard, CheckCircle } from 'lucide-react';
import { canMessagePhone, formatCurrency, openMessageComposer } from '@/lib/messaging';

export default function Credits() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [payingOrder, setPayingOrder] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');

  const { data: creditOrders = [], isLoading } = useQuery({
    queryKey: ['credit-orders', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, customers(name, phone)')
        .eq('is_credit', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['credit-payments', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('credit_payments').select('*').order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const getOrderPaid = (orderId: string) => payments.filter(p => p.order_id === orderId).reduce((sum, p) => sum + Number(p.amount), 0);

  const makePayment = useMutation({
    mutationFn: async () => {
      if (!payingOrder || !payAmount) throw new Error('Invalid');
      const amount = parseFloat(payAmount);
      const order = creditOrders.find(o => o.id === payingOrder);
      if (!order) throw new Error('Order not found');
      const remaining = Number(order.total) - getOrderPaid(payingOrder);
      if (amount > remaining) throw new Error('Amount exceeds remaining balance');

      await supabase.from('credit_payments').insert({ user_id: user!.id, order_id: payingOrder, amount });
      if (amount >= remaining) {
        await supabase.from('orders').update({ credit_paid: true }).eq('id', payingOrder);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credit-orders'] });
      qc.invalidateQueries({ queryKey: ['credit-payments'] });
      toast.success('Payment recorded');
      setPayingOrder(null);
      setPayAmount('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalPending = creditOrders
    .filter(o => !o.credit_paid)
    .reduce((sum, o) => sum + (Number(o.total) - getOrderPaid(o.id)), 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="glass rounded-2xl p-6 glow-primary">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15">
            <CreditCard className="h-7 w-7 text-accent" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Pending Credits</p>
            <p className="font-heading text-3xl font-bold text-gradient">{formatCurrency(totalPending)}</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="border-b border-border/10 px-6 py-4">
          <h2 className="font-heading text-lg font-semibold">Credit Orders</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border/10 hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium">Customer</TableHead>
              <TableHead className="text-muted-foreground font-medium">Date</TableHead>
              <TableHead className="text-muted-foreground font-medium">Total</TableHead>
              <TableHead className="text-muted-foreground font-medium">Paid</TableHead>
              <TableHead className="text-muted-foreground font-medium">Remaining</TableHead>
              <TableHead className="text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="text-muted-foreground font-medium">Reminder</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : creditOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No credit orders
                </TableCell>
              </TableRow>
            ) : creditOrders.map(o => {
              const paid = getOrderPaid(o.id);
              const remaining = Number(o.total) - paid;
              const customer = o.customers as { name?: string; phone?: string | null } | null;

              return (
                <TableRow key={o.id} className="border-border/10 transition-colors hover:bg-secondary/20">
                  <TableCell className="font-medium">{customer?.name || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{formatCurrency(Number(o.total))}</TableCell>
                  <TableCell className="text-primary">{formatCurrency(paid)}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(remaining)}</TableCell>
                  <TableCell>
                    {o.credit_paid ? (
                      <Badge className="border-primary/20 bg-primary/15 text-primary">
                        <CheckCircle className="mr-1 h-3 w-3" /> Paid
                      </Badge>
                    ) : (
                      <Badge className="border-destructive/20 bg-destructive/15 text-destructive">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!o.credit_paid && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border/30 bg-secondary/20 hover:bg-secondary/40"
                          disabled={!canMessagePhone(customer?.phone)}
                          onClick={() => {
                            const firstName = customer?.name?.split(' ')[0] || 'Customer';
                            const message = `Hi ${firstName}, this is a gentle reminder that ${formatCurrency(remaining)} is pending on your account. Please clear it at your convenience.`;
                            if (!openMessageComposer({ channel: 'whatsapp', phone: customer?.phone, message })) {
                              toast.error('Valid mobile number required');
                              return;
                            }
                            toast.success('WhatsApp reminder opened');
                          }}
                        >
                          WhatsApp
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!canMessagePhone(customer?.phone)}
                          onClick={() => {
                            const firstName = customer?.name?.split(' ')[0] || 'Customer';
                            const message = `Hi ${firstName}, ${formatCurrency(remaining)} is pending on your account. Please make the payment when convenient.`;
                            if (!openMessageComposer({ channel: 'sms', phone: customer?.phone, message })) {
                              toast.error('Valid mobile number required');
                              return;
                            }
                            toast.success('SMS reminder opened');
                          }}
                        >
                          SMS
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {!o.credit_paid && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border/30 bg-secondary/20 hover:bg-secondary/40"
                        onClick={() => {
                          setPayingOrder(o.id);
                          setPayAmount(remaining.toFixed(2));
                        }}
                      >
                        Record Payment
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!payingOrder} onOpenChange={() => setPayingOrder(null)}>
        <DialogContent className="glass-strong border-border/20">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Record Payment</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              makePayment.mutate();
            }}
            className="space-y-4"
          >
            <Input
              type="number"
              step="0.01"
              placeholder="Amount (INR)"
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
              required
              className="h-11 border-border/50 bg-secondary/30"
            />
            <Button type="submit" className="h-11 w-full" disabled={makePayment.isPending}>
              Record Payment
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
