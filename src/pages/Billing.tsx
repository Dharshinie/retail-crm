import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, ShoppingCart, Star } from 'lucide-react';

interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function Billing() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [isCredit, setIsCredit] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*').order('name');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').order('name');
      return data || [];
    },
    enabled: !!user,
  });

  const selectedCustomer = customers.find(c => c.id === customerId);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const pointsDiscount = redeemPoints && selectedCustomer ? Math.min(selectedCustomer.loyalty_points, Math.floor(subtotal)) : 0;
  const total = subtotal - pointsDiscount;
  const pointsEarned = Math.floor(total / 100);

  const addToCart = () => {
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;
    if (product.stock < quantity) { toast.error('Not enough stock'); return; }
    const existing = cart.find(c => c.product_id === product.id);
    if (existing) {
      setCart(cart.map(c => c.product_id === product.id ? { ...c, quantity: c.quantity + quantity } : c));
    } else {
      setCart([...cart, { product_id: product.id, name: product.name, price: Number(product.price), quantity }]);
    }
    setSelectedProduct('');
    setQuantity(1);
  };

  const removeFromCart = (productId: string) => setCart(cart.filter(c => c.product_id !== productId));

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!customerId || cart.length === 0) throw new Error('Select customer and add items');
      const { data: order, error: orderError } = await supabase.from('orders').insert({
        user_id: user!.id, customer_id: customerId, total, discount: pointsDiscount,
        points_redeemed: redeemPoints ? pointsDiscount : 0, is_credit: isCredit, credit_paid: !isCredit,
      }).select().single();
      if (orderError) throw orderError;

      const items = cart.map(c => ({
        order_id: order.id, product_id: c.product_id, product_name: c.name,
        quantity: c.quantity, price: c.price, total: c.price * c.quantity,
      }));
      const { error: itemsError } = await supabase.from('order_items').insert(items);
      if (itemsError) throw itemsError;

      for (const item of cart) {
        const product = products.find(p => p.id === item.product_id);
        if (product) await supabase.from('products').update({ stock: product.stock - item.quantity }).eq('id', item.product_id);
      }

      const newPoints = (selectedCustomer?.loyalty_points || 0) - (redeemPoints ? pointsDiscount : 0) + pointsEarned;
      const newTotal = Number(selectedCustomer?.total_spent || 0) + total;
      await supabase.from('customers').update({ loyalty_points: newPoints, total_spent: newTotal }).eq('id', customerId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(`Order placed! Customer earned ${pointsEarned} loyalty points.`);
      setCart([]); setCustomerId(''); setRedeemPoints(false); setIsCredit(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions', cart.map(c => c.product_id)],
    queryFn: async () => {
      if (cart.length === 0) return [];
      const productIds = cart.map(c => c.product_id);
      const { data: relatedItems } = await supabase.from('order_items').select('order_id').in('product_id', productIds);
      if (!relatedItems?.length) return [];
      const orderIds = [...new Set(relatedItems.map(r => r.order_id))];
      const { data: otherItems } = await supabase.from('order_items').select('product_id, product_name').in('order_id', orderIds).not('product_id', 'in', `(${productIds.join(',')})`);
      if (!otherItems?.length) return [];
      const freq: Record<string, { name: string; count: number }> = {};
      for (const item of otherItems) {
        if (!freq[item.product_id]) freq[item.product_id] = { name: item.product_name, count: 0 };
        freq[item.product_id].count++;
      }
      return Object.entries(freq).sort((a, b) => b[1].count - a[1].count).slice(0, 3).map(([id, v]) => ({ id, name: v.name }));
    },
    enabled: cart.length > 0,
  });

  return (
    <div className="grid gap-6 animate-fade-in lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="glass rounded-2xl p-6">
          <h2 className="mb-5 font-heading text-xl font-semibold">New Bill</h2>

          <div className="space-y-4">
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="h-11 border-border/50 bg-secondary/30"><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent className="glass-strong border-border/20">
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap gap-2">
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger className="flex-1 min-w-[200px] h-11 border-border/50 bg-secondary/30"><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent className="glass-strong border-border/20">
                  {products.filter(p => p.stock > 0).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — ₹{Number(p.price).toFixed(2)} (Stock: {p.stock})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="number" min={1} className="w-20 h-11 border-border/50 bg-secondary/30" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} />
              <Button onClick={addToCart} disabled={!selectedProduct} className="h-11"><Plus className="mr-1 h-4 w-4" /> Add</Button>
            </div>

            {cart.length > 0 && (
              <div className="rounded-xl border border-border/20 overflow-hidden">
                {cart.map(item => (
                  <div key={item.product_id} className="flex items-center justify-between border-b border-border/10 px-4 py-3 last:border-0 hover:bg-secondary/10 transition-colors">
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">× {item.quantity}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">₹{(item.price * item.quantity).toFixed(2)}</span>
                      <button onClick={() => removeFromCart(item.product_id)} className="text-destructive/70 hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="rounded-xl glass-subtle p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">💡 Frequently bought together</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map(s => (
                    <Button key={s.id} size="sm" variant="outline" className="border-border/30 bg-secondary/20 hover:bg-secondary/40" onClick={() => {
                      setSelectedProduct(s.id);
                      setQuantity(1);
                    }}>{s.name}</Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div>
        <div className="glass rounded-2xl p-6 sticky top-4">
          <h2 className="mb-5 font-heading text-xl font-semibold">Order Summary</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
            {pointsDiscount > 0 && (
              <div className="flex justify-between text-primary"><span>Points Discount</span><span>-₹{pointsDiscount.toFixed(2)}</span></div>
            )}
            <div className="h-px bg-border/20" />
            <div className="flex justify-between font-heading text-xl font-bold">
              <span>Total</span><span className="text-gradient">₹{total.toFixed(2)}</span>
            </div>
          </div>

          {selectedCustomer && (
            <div className="mt-5 rounded-xl glass-subtle p-4 text-sm">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-accent" />
                <span className="font-medium">{selectedCustomer.loyalty_points} points available</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Will earn {pointsEarned} new points</div>
              <div className="mt-3 flex items-center gap-2">
                <Switch checked={redeemPoints} onCheckedChange={setRedeemPoints} id="redeem" />
                <Label htmlFor="redeem" className="text-sm cursor-pointer">Redeem points</Label>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <Switch checked={isCredit} onCheckedChange={setIsCredit} id="credit" />
            <Label htmlFor="credit" className="text-sm cursor-pointer">Buy now, pay later</Label>
          </div>

          <Button
            className="mt-5 w-full h-12 text-base font-semibold"
            onClick={() => placeOrder.mutate()}
            disabled={!customerId || cart.length === 0 || placeOrder.isPending}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            {placeOrder.isPending ? 'Processing...' : 'Place Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}
