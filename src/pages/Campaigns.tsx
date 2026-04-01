import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, MessageSquareText, Send, Smartphone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MessageChannel, canMessagePhone, formatCurrency, openMessageComposer } from '@/lib/messaging';

type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
  total_spent: number;
  loyalty_points: number;
};

type CreditOrder = {
  id: string;
  total: number;
  created_at: string;
  credit_paid: boolean;
  customers: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
};

const campaignTemplates = {
  offers: (customerName: string) =>
    `Hi ${customerName}, fresh savings are live at our store. Drop in today to enjoy special offers on your favorite grocery items. Reply here if you want the latest deal list.`,
  festival: (customerName: string) =>
    `Happy festive season ${customerName}! Celebrate with our festival discounts on grocery essentials and festive specials. Visit us today and save more on your shopping.`,
  payment: (customerName: string, amount: number) =>
    `Hi ${customerName}, this is a gentle reminder that ${formatCurrency(amount)} is pending on your account. Please clear it at your convenience. Reply if you need payment details.`,
};

export default function Campaigns() {
  const { user } = useAuth();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<'offers' | 'festival' | 'payment'>('offers');
  const [channel, setChannel] = useState<MessageChannel>('whatsapp');
  const [message, setMessage] = useState('');

  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['campaign-customers', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').order('name');
      if (error) throw error;
      return (data || []) as CustomerOption[];
    },
    enabled: !!user,
  });

  const { data: creditOrders = [] } = useQuery({
    queryKey: ['campaign-credit-orders', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, total, created_at, credit_paid, customers(id, name, phone)')
        .eq('is_credit', true)
        .eq('credit_paid', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CreditOrder[];
    },
    enabled: !!user,
  });

  const selectedCustomer = customers.find(customer => customer.id === selectedCustomerId);
  const pendingForCustomer = creditOrders
    .filter(order => order.customers?.id === selectedCustomerId)
    .reduce((sum, order) => sum + Number(order.total), 0);

  useEffect(() => {
    if (!selectedCustomer) {
      setMessage('');
      return;
    }

    const customerName = selectedCustomer.name.split(' ')[0] || selectedCustomer.name;
    if (selectedTemplate === 'offers') {
      setMessage(campaignTemplates.offers(customerName));
      return;
    }
    if (selectedTemplate === 'festival') {
      setMessage(campaignTemplates.festival(customerName));
      return;
    }
    setMessage(campaignTemplates.payment(customerName, pendingForCustomer));
  }, [pendingForCustomer, selectedCustomer, selectedTemplate]);

  const launchCampaign = () => {
    if (!selectedCustomer) {
      toast.error('Select a customer first');
      return;
    }

    if (!message.trim()) {
      toast.error('Add a message before sending');
      return;
    }

    if (!openMessageComposer({ channel, phone: selectedCustomer.phone, message })) {
      toast.error('This customer does not have a valid mobile number');
      return;
    }

    toast.success(`${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} composer opened`);
  };

  const readyCustomers = customers.filter(customer => canMessagePhone(customer.phone));
  const pendingCreditCount = creditOrders.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Customers Ready for Messaging</p>
          <p className="mt-1 font-heading text-3xl font-bold">{readyCustomers.length}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15">
            <MessageSquareText className="h-5 w-5 text-accent" />
          </div>
          <p className="text-sm text-muted-foreground">Pending Payment Follow-ups</p>
          <p className="mt-1 font-heading text-3xl font-bold">{pendingCreditCount}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-info/15">
            <Smartphone className="h-5 w-5 text-info" />
          </div>
          <p className="text-sm text-muted-foreground">Preferred Channels</p>
          <p className="mt-1 text-sm font-medium text-foreground">SMS and WhatsApp</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="glass hover-lift relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/25">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/6 via-white/[0.02] to-transparent" />
          <div className="pointer-events-none absolute inset-[1px] rounded-[calc(1rem-1px)] bg-gradient-to-br from-primary/12 via-transparent to-accent/10" />
          <div className="pointer-events-none absolute -left-16 top-8 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/20" />
          <CardHeader className="relative z-10">
            <CardTitle className="font-heading text-2xl">Customer Campaigns</CardTitle>
            <CardDescription>
              Send promotional offers, festival discounts, and payment reminders directly to saved customer mobile numbers.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Customer</p>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className="h-11 border-border/50 bg-secondary/30">
                    <SelectValue placeholder={customersLoading ? 'Loading customers...' : 'Select customer'} />
                  </SelectTrigger>
                  <SelectContent className="glass-strong border-border/20">
                    {readyCustomers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} {customer.phone ? `(${customer.phone})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Template</p>
                <Select value={selectedTemplate} onValueChange={value => setSelectedTemplate(value as 'offers' | 'festival' | 'payment')}>
                  <SelectTrigger className="h-11 border-border/50 bg-secondary/30">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent className="glass-strong border-border/20">
                    <SelectItem value="offers">Offers via SMS / WhatsApp</SelectItem>
                    <SelectItem value="festival">Festival discounts</SelectItem>
                    <SelectItem value="payment">Pending payment reminder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Message</p>
              <Textarea
                value={message}
                onChange={event => setMessage(event.target.value)}
                placeholder="Write your customer message"
                className="min-h-[180px] border-border/50 bg-secondary/30"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Channel</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={channel === 'whatsapp' ? 'default' : 'outline'}
                    className="flex-1 h-11"
                    onClick={() => setChannel('whatsapp')}
                  >
                    WhatsApp
                  </Button>
                  <Button
                    type="button"
                    variant={channel === 'sms' ? 'default' : 'outline'}
                    className="flex-1 h-11"
                    onClick={() => setChannel('sms')}
                  >
                    SMS
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Customer Snapshot</p>
                <div className="glass-subtle rounded-xl border border-white/10 p-4 text-sm shadow-lg shadow-black/10">
                  {selectedCustomer ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span>{selectedCustomer.phone}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Loyalty points</span>
                        <span>{selectedCustomer.loyalty_points}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total spent</span>
                        <span>{formatCurrency(Number(selectedCustomer.total_spent))}</span>
                      </div>
                      {selectedTemplate === 'payment' && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Pending credit</span>
                          <span>{formatCurrency(pendingForCustomer)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Select a customer to preview their details.</p>
                  )}
                </div>
              </div>
            </div>

            <Button onClick={launchCampaign} className="h-12 w-full text-base font-semibold">
              <Send className="mr-2 h-4 w-4" />
              Open {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} Composer
            </Button>
          </CardContent>
        </div>

        <div className="glass hover-lift relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/25">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/6 via-white/[0.02] to-transparent" />
          <div className="pointer-events-none absolute inset-[1px] rounded-[calc(1rem-1px)] bg-gradient-to-br from-accent/12 via-transparent to-primary/10" />
          <div className="pointer-events-none absolute -right-12 top-6 h-36 w-36 rounded-full bg-accent/15 blur-3xl" />
          <div className="pointer-events-none absolute left-0 bottom-0 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/20" />
          <CardHeader className="relative z-10">
            <CardTitle className="font-heading text-2xl">Pending Payment Queue</CardTitle>
            <CardDescription>Quickly reach customers who still have unpaid credit orders.</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3">
            {creditOrders.length === 0 ? (
              <div className="glass-subtle rounded-xl border border-white/10 p-4 text-sm text-muted-foreground shadow-lg shadow-black/10">
                No pending credit payments right now.
              </div>
            ) : (
              creditOrders.map(order => {
                const customer = order.customers;
                if (!customer) return null;

                return (
                  <div key={order.id} className="glass-subtle rounded-2xl border border-white/10 p-4 shadow-lg shadow-black/10">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">{customer.phone || 'No phone number saved'}</p>
                      </div>
                      <Badge className="bg-destructive/15 text-destructive border-destructive/20">
                        {formatCurrency(Number(order.total))} due
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Credit sale on {new Date(order.created_at).toLocaleDateString()}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          const firstName = customer.name.split(' ')[0] || customer.name;
                          const reminder = campaignTemplates.payment(firstName, Number(order.total));
                          if (!openMessageComposer({ channel: 'whatsapp', phone: customer.phone, message: reminder })) {
                            toast.error('This customer does not have a valid mobile number');
                            return;
                          }
                          toast.success('WhatsApp composer opened');
                        }}
                        disabled={!canMessagePhone(customer.phone)}
                      >
                        WhatsApp Reminder
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          const firstName = customer.name.split(' ')[0] || customer.name;
                          const reminder = campaignTemplates.payment(firstName, Number(order.total));
                          if (!openMessageComposer({ channel: 'sms', phone: customer.phone, message: reminder })) {
                            toast.error('This customer does not have a valid mobile number');
                            return;
                          }
                          toast.success('SMS composer opened');
                        }}
                        disabled={!canMessagePhone(customer.phone)}
                      >
                        SMS Reminder
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </div>
      </div>
    </div>
  );
}
