import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Lock, UserPlus, LogIn, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

const Index = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();

  useEffect(() => {
    if (session) navigate("/dashboard", { replace: true });
  }, [session, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Помилка входу", description: error.message, variant: "destructive" });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirm) {
      toast({ title: "Помилка", description: "Паролі не співпадають", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        data: { full_name: regName },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Помилка реєстрації", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Успіх!", description: "Перевірте вашу електронну пошту для підтвердження реєстрації." });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-primary text-primary-foreground py-4 px-6 shadow-lg">
        <div className="container mx-auto flex items-center gap-3">
          <Shield className="h-8 w-8" />
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              МВС Портал
            </h1>
            <p className="text-sm opacity-90">Міністерство внутрішніх справ</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-full text-sm font-medium">
              <Shield className="h-4 w-4" />
              Офіційний портал
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-foreground leading-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Система управління
              <span className="text-primary block">МВС України</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Інформаційна система для моніторингу, аналітики та управління оперативними даними
              Міністерства внутрішніх справ.
            </p>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">24/7</div>
                <div className="text-sm text-muted-foreground">Моніторинг</div>
              </div>
              <div className="w-px bg-border" />
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">100%</div>
                <div className="text-sm text-muted-foreground">Захист даних</div>
              </div>
              <div className="w-px bg-border" />
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">500+</div>
                <div className="text-sm text-muted-foreground">Підрозділів</div>
              </div>
            </div>
          </div>

          <Card className="shadow-2xl border-2 border-primary/10">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Авторизація
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="login" className="gap-2">
                    <LogIn className="h-4 w-4" /> Вхід
                  </TabsTrigger>
                  <TabsTrigger value="register" className="gap-2">
                    <UserPlus className="h-4 w-4" /> Реєстрація
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Електронна пошта</label>
                      <Input type="email" placeholder="example@mvs.gov.ua" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Пароль</label>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder="Введіть пароль" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full font-semibold text-base h-11" disabled={loading}>
                      {loading ? "Завантаження..." : "Увійти"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Повне ім'я</label>
                      <Input placeholder="Іванов Іван Іванович" value={regName} onChange={e => setRegName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Електронна пошта</label>
                      <Input type="email" placeholder="example@mvs.gov.ua" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Пароль</label>
                      <Input type="password" placeholder="Мінімум 8 символів" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={8} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Підтвердження паролю</label>
                      <Input type="password" placeholder="Повторіть пароль" value={regConfirm} onChange={e => setRegConfirm(e.target.value)} required minLength={8} />
                    </div>
                    <Button type="submit" className="w-full font-semibold text-base h-11" disabled={loading}>
                      {loading ? "Завантаження..." : "Зареєструватись"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="bg-primary/5 border-t border-border py-4 text-center text-sm text-muted-foreground">
        © 2026 МВС України. Усі права захищені.
      </footer>
    </div>
  );
};

export default Index;
