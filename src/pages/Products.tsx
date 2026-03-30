import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Search, AlertTriangle } from 'lucide-react';

export default function Products() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', stock: '', category: '', threshold: '10' });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('products').insert({
        name: form.name.trim(),
        price: parseFloat(form.price),
        stock: parseInt(form.stock) || 0,
        category: form.category.trim() || null,
        low_stock_threshold: parseInt(form.threshold) || 10,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product added');
      setForm({ name: '', price: '', stock: '', category: '', threshold: '10' });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products..." className="black pl-9 h-11 border-border/50 bg-secondary/30 backdrop-blur-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-11"><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-border/20">
            <DialogHeader><DialogTitle className="font-heading text-xl">Add Product</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); addProduct.mutate(); }} className="space-y-3">
              <Input placeholder="Product name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="h-11 bg-secondary/30 border-border/50" />
              <Input type="number" step="0.01" placeholder="Price (₹)" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required className="h-11 bg-secondary/30 border-border/50" />
              <Input type="number" placeholder="Stock quantity" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="h-11 bg-secondary/30 border-border/50" />
              <Input placeholder="Category (optional)" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="h-11 bg-secondary/30 border-border/50" />
              <Input type="number" placeholder="Low stock threshold" value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })} className="h-11 bg-secondary/30 border-border/50" />
              <Button type="submit" className="w-full h-11" disabled={addProduct.isPending}>Add Product</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/10 hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium">Name</TableHead>
              <TableHead className="text-muted-foreground font-medium">Category</TableHead>
              <TableHead className="text-muted-foreground font-medium">Price</TableHead>
              <TableHead className="text-muted-foreground font-medium">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No products found</TableCell></TableRow>
            ) : filtered.map(p => (
              <TableRow key={p.id} className="border-border/10 hover:bg-secondary/20 transition-colors">
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">{p.category || '—'}</TableCell>
                <TableCell className="font-semibold">₹{Number(p.price).toFixed(2)}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    {p.stock}
                    {p.stock <= p.low_stock_threshold && (
                      <Badge className="bg-destructive/15 text-destructive border-destructive/20 text-xs">
                        <AlertTriangle className="mr-1 h-3 w-3" /> Low
                      </Badge>
                    )}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
