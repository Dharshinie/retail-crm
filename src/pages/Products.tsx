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
import { Plus, Search, AlertTriangle, Pencil } from 'lucide-react';

type ProductRow = {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string | null;
  low_stock_threshold: number | null;
};

const emptyForm = { name: '', price: '', stock: '', category: '', threshold: '10' };

export default function Products() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) throw error;
      return (data || []) as ProductRow[];
    },
    enabled: !!user,
  });

  const handleDialogChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setEditingProductId(null);
      setForm(emptyForm);
    }
  };

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
      handleDialogChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProduct = useMutation({
    mutationFn: async () => {
      if (!editingProductId) return;

      const { error } = await supabase
        .from('products')
        .update({
          name: form.name.trim(),
          price: parseFloat(form.price),
          stock: parseInt(form.stock) || 0,
          category: form.category.trim() || null,
          low_stock_threshold: parseInt(form.threshold) || 10,
        })
        .eq('id', editingProductId)
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product updated');
      handleDialogChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAddDialog = () => {
    setEditingProductId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEditDialog = (product: ProductRow) => {
    setEditingProductId(product.id);
    setForm({
      name: product.name,
      price: String(product.price ?? ''),
      stock: String(product.stock ?? 0),
      category: product.category || '',
      threshold: String(product.low_stock_threshold ?? 10),
    });
    setOpen(true);
  };

  const filtered = products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()));
  const isEditing = editingProductId !== null;
  const isSaving = addProduct.isPending || updateProduct.isPending;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="black h-11 border-border/50 bg-secondary/30 pl-9 backdrop-blur-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Dialog open={open} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="h-11" onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-border/20">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl">{isEditing ? 'Edit Product' : 'Add Product'}</DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (isEditing) {
                  updateProduct.mutate();
                  return;
                }

                addProduct.mutate();
              }}
              className="space-y-3"
            >
              <Input
                placeholder="Product name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="h-11 border-border/50 bg-secondary/30"
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Price (Rs)"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                className="h-11 border-border/50 bg-secondary/30"
              />
              <Input
                type="number"
                placeholder="Stock quantity"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="h-11 border-border/50 bg-secondary/30"
              />
              <Input
                placeholder="Category (optional)"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="h-11 border-border/50 bg-secondary/30"
              />
              <Input
                type="number"
                placeholder="Low stock threshold"
                value={form.threshold}
                onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                className="h-11 border-border/50 bg-secondary/30"
              />
              <Button type="submit" className="h-11 w-full" disabled={isSaving}>
                {isEditing ? 'Update Product' : 'Add Product'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow className="border-border/10 hover:bg-transparent">
              <TableHead className="font-medium text-muted-foreground">Name</TableHead>
              <TableHead className="font-medium text-muted-foreground">Category</TableHead>
              <TableHead className="font-medium text-muted-foreground">Price</TableHead>
              <TableHead className="font-medium text-muted-foreground">Stock</TableHead>
              <TableHead className="text-right font-medium text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((product) => (
                <TableRow key={product.id} className="border-border/10 transition-colors hover:bg-secondary/20">
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{product.category || '-'}</TableCell>
                  <TableCell className="font-semibold">Rs {Number(product.price).toFixed(2)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      {product.stock}
                      {product.stock <= (product.low_stock_threshold ?? 10) && (
                        <Badge className="border-destructive/20 bg-destructive/15 text-xs text-destructive">
                          <AlertTriangle className="mr-1 h-3 w-3" /> Low
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEditDialog(product)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
