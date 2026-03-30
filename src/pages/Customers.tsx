import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, Star } from 'lucide-react';

export default function Customers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addCustomer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('customers').insert({ name: name.trim(), phone: phone.trim() || null, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer added');
      setName(''); setPhone(''); setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search))
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search customers..." className="pl-9 h-11 border-border/50 bg-secondary/30 backdrop-blur-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-11"><Plus className="mr-2 h-4 w-4" /> Add Customer</Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-border/20">
            <DialogHeader><DialogTitle className="font-heading text-xl">Add Customer</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); addCustomer.mutate(); }} className="space-y-4">
              <Input placeholder="Customer name" value={name} onChange={e => setName(e.target.value)} required className="h-11 bg-secondary/30 border-border/50" />
              <Input placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)} className="h-11 bg-secondary/30 border-border/50" />
              <Button type="submit" className="w-full h-11" disabled={addCustomer.isPending}>Add Customer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/10 hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium">Name</TableHead>
              <TableHead className="text-muted-foreground font-medium">Phone</TableHead>
              <TableHead className="text-muted-foreground font-medium">Loyalty Points</TableHead>
              <TableHead className="text-muted-foreground font-medium">Total Spent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No customers found</TableCell></TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id} className="border-border/10 hover:bg-secondary/20 transition-colors">
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.phone || '—'}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                    <Star className="h-3 w-3" />{c.loyalty_points}
                  </span>
                </TableCell>
                <TableCell className="font-semibold text-primary">₹{Number(c.total_spent).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
