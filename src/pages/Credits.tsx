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
    onError: (e: any) => toast.error(e.message),
  });

  const totalPending = creditOrders
    .filter(o => !o.credit_paid)
    .reduce((sum, o) => sum + (Number(o.total) - getOrderPaid(o.id)), 0);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary Card */}
      <div className="glass rounded-2xl p-6 glow-primary">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15">
            <CreditCard className="h-7 w-7 text-accent" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Pending Credits</p>
            <p className="font-heading text-3xl font-bold text-gradient">₹{totalPending.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Credit Orders Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border/10">
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
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : creditOrders.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No credit orders</TableCell></TableRow>
            ) : creditOrders.map(o => {
              const paid = getOrderPaid(o.id);
              const remaining = Number(o.total) - paid;
              return (
                <TableRow key={o.id} className="border-border/10 hover:bg-secondary/20 transition-colors">
                  <TableCell className="font-medium">{(o.customers as any)?.name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>₹{Number(o.total).toFixed(2)}</TableCell>
                  <TableCell className="text-primary">₹{paid.toFixed(2)}</TableCell>
                  <TableCell className="font-semibold">₹{remaining.toFixed(2)}</TableCell>
                  <TableCell>
                    {o.credit_paid ? (
                      <Badge className="bg-primary/15 text-primary border-primary/20"><CheckCircle className="mr-1 h-3 w-3" /> Paid</Badge>
                    ) : (
                      <Badge className="bg-destructive/15 text-destructive border-destructive/20">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!o.credit_paid && (
                      <Button size="sm" variant="outline" className="border-border/30 bg-secondary/20 hover:bg-secondary/40" onClick={() => { setPayingOrder(o.id); setPayAmount(remaining.toFixed(2)); }}>
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
          <DialogHeader><DialogTitle className="font-heading text-xl">Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); makePayment.mutate(); }} className="space-y-4">
            <Input type="number" step="0.01" placeholder="Amount (₹)" value={payAmount} onChange={e => setPayAmount(e.target.value)} required className="h-11 bg-secondary/30 border-border/50" />
            <Button type="submit" className="w-full h-11" disabled={makePayment.isPending}>Record Payment</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
