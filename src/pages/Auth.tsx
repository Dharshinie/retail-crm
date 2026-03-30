import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ShoppingCart } from 'lucide-react';

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const backgroundImageUrl = 'https://i.pinimg.com/736x/4b/5e/fe/4b5efe08d4bc344057f51f15d1064df1.jpg';

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="animate-pulse font-heading text-xl text-muted-foreground">Loading...</div>
    </div>
  );
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    const { error } = isLogin ? await signIn(email, password) : await signUp(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else if (!isLogin) {
      toast.success('Account created! Check your email to confirm.');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Background */}
      <img src={backgroundImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover background-size-cover" width={1920} height={1080} />
      <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/85 to-background/90" />

      {/* Auth Card */}
      <div className="glass-strong relative z-10 w-full max-w-md rounded-2xl p-8 animate-enter">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 glow-primary">
            <ShoppingCart className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-gradient">GroceryCRM</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isLogin ? 'Welcome back to your store' : 'Create your store account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 border-border/50 bg-secondary/50 backdrop-blur-sm placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-12 border-border/50 bg-secondary/50 backdrop-blur-sm placeholder:text-muted-foreground/60"
            />
          </div>
          <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={submitting}>
            {submitting ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary font-medium underline-offset-4 hover:underline transition-colors"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
