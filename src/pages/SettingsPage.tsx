import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/hooks/useTheme";
import {
  useUIPreferences,
  ACCENT_OPTIONS,
  AccentColor,
  FontScale,
  Density,
  FontFamily,
  Radius,
} from "@/hooks/useUIPreferences";
import {
  Sun, Moon, Keyboard, Palette, Type, LayoutGrid, Sparkles, Eye, RotateCcw, Code2, Info, Check,
} from "lucide-react";
import { toast } from "sonner";

const SettingsPage = () => {
  const { theme, toggleTheme } = useTheme();
  const prefs = useUIPreferences();

  const fontScales: { v: FontScale; label: string }[] = [
    { v: "sm", label: "Малий" },
    { v: "md", label: "Середній" },
    { v: "lg", label: "Великий" },
    { v: "xl", label: "Дуже великий" },
  ];
  const densities: { v: Density; label: string; desc: string }[] = [
    { v: "compact", label: "Компактна", desc: "Більше інформації на екрані" },
    { v: "comfortable", label: "Комфортна", desc: "Збалансовано (за замовч.)" },
    { v: "spacious", label: "Простора", desc: "Більше простору між елементами" },
  ];
  const fonts: { v: FontFamily; label: string }[] = [
    { v: "montserrat", label: "Montserrat" },
    { v: "inter", label: "Inter" },
    { v: "roboto", label: "Roboto" },
    { v: "system", label: "Системний" },
  ];
  const radii: { v: Radius; label: string }[] = [
    { v: "none", label: "Прямі" },
    { v: "sm", label: "Малий" },
    { v: "md", label: "Середній" },
    { v: "lg", label: "Великий" },
    { v: "xl", label: "Округлений" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Налаштування інтерфейсу
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Підлаштуйте систему під себе — кольори, шрифти, щільність та анімації застосовуються миттєво.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { prefs.reset(); toast.success("Налаштування скинуто"); }}>
          <RotateCcw className="h-4 w-4 mr-2" /> Скинути
        </Button>
      </div>

      <Tabs defaultValue="appearance" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="appearance"><Palette className="h-4 w-4 mr-2" />Вигляд</TabsTrigger>
          <TabsTrigger value="typography"><Type className="h-4 w-4 mr-2" />Типографіка</TabsTrigger>
          <TabsTrigger value="layout"><LayoutGrid className="h-4 w-4 mr-2" />Макет</TabsTrigger>
          <TabsTrigger value="about"><Info className="h-4 w-4 mr-2" />Про систему</TabsTrigger>
        </TabsList>

        {/* Appearance */}
        <TabsContent value="appearance" className="space-y-4 mt-4">
          <Card className="hover-lift shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                Тема оформлення
              </CardTitle>
              <CardDescription>Світла або темна — обирайте за умовами роботи.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                onClick={() => theme === "dark" && toggleTheme()}
              >
                <Sun className="h-4 w-4 mr-2" />Світла
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                onClick={() => theme === "light" && toggleTheme()}
              >
                <Moon className="h-4 w-4 mr-2" />Темна
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />Акцентний колір</CardTitle>
              <CardDescription>Основний колір кнопок, посилань та маркерів.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {ACCENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => prefs.setPref("accent", opt.value as AccentColor)}
                    className={`relative h-16 rounded-lg border-2 transition-all hover:scale-105 ${
                      prefs.accent === opt.value ? "border-foreground ring-2 ring-offset-2 ring-foreground" : "border-transparent"
                    }`}
                    style={{ background: `hsl(${opt.hsl})` }}
                    title={opt.label}
                  >
                    {prefs.accent === opt.value && (
                      <Check className="absolute inset-0 m-auto h-6 w-6 text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Поточний: <span className="font-medium text-foreground">
                  {ACCENT_OPTIONS.find(o => o.value === prefs.accent)?.label}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Анімації та ефекти</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Анімації переходів</Label>
                  <p className="text-xs text-muted-foreground">Плавні переходи між станами елементів</p>
                </div>
                <Switch checked={prefs.animations} onCheckedChange={(v) => prefs.setPref("animations", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Зменшений рух</Label>
                  <p className="text-xs text-muted-foreground">Для людей з вестибулярною чутливістю</p>
                </div>
                <Switch checked={prefs.reducedMotion} onCheckedChange={(v) => prefs.setPref("reducedMotion", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-2"><Eye className="h-4 w-4" />Високий контраст</Label>
                  <p className="text-xs text-muted-foreground">Покращена читабельність</p>
                </div>
                <Switch checked={prefs.highContrast} onCheckedChange={(v) => prefs.setPref("highContrast", v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Typography */}
        <TabsContent value="typography" className="space-y-4 mt-4">
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle>Розмір шрифту</CardTitle>
              <CardDescription>Базовий розмір тексту по всій системі.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {fontScales.map((s) => (
                  <Button
                    key={s.v}
                    variant={prefs.fontScale === s.v ? "default" : "outline"}
                    onClick={() => prefs.setPref("fontScale", s.v)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader>
              <CardTitle>Гарнітура</CardTitle>
              <CardDescription>Шрифт основного інтерфейсу.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {fonts.map((f) => (
                  <Button
                    key={f.v}
                    variant={prefs.fontFamily === f.v ? "default" : "outline"}
                    onClick={() => prefs.setPref("fontFamily", f.v)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
              <div className="mt-4 p-4 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Зразок:</p>
                <p className="text-2xl font-bold">МВС України — Ситуаційний центр</p>
                <p className="text-sm">Швидке реагування на надзвичайні події 24/7</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Layout */}
        <TabsContent value="layout" className="space-y-4 mt-4">
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle>Щільність інтерфейсу</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-3">
              {densities.map((d) => (
                <button
                  key={d.v}
                  onClick={() => prefs.setPref("density", d.v)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    prefs.density === d.v ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold">{d.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{d.desc}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader>
              <CardTitle>Заокруглення кутів</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-5 gap-2">
              {radii.map((r) => (
                <Button
                  key={r.v}
                  variant={prefs.radius === r.v ? "default" : "outline"}
                  onClick={() => prefs.setPref("radius", r.v)}
                >
                  {r.label}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Keyboard className="h-5 w-5" />Гарячі клавіші</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Швидкий PDF-експорт сторінки</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Ctrl + Shift + P</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Перемикання теми</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Ctrl + J</kbd>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* About / Tech stack */}
        <TabsContent value="about" className="space-y-4 mt-4">
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Code2 className="h-5 w-5" />Про технології системи</CardTitle>
              <CardDescription>Чому саме ці технології, а не Python або C++</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <section>
                <h3 className="font-semibold text-base mb-2">📌 Чому HTML/JavaScript, а не Python чи C++?</h3>
                <p className="text-muted-foreground">
                  Ця система — <b>веб-додаток</b>. Він працює прямо у браузері (Chrome, Edge, Firefox) на будь-якому
                  пристрої — комп'ютері, планшеті, телефоні, без встановлення.
                </p>
                <ul className="mt-2 space-y-1 list-disc list-inside text-muted-foreground">
                  <li><b>HTML/CSS</b> — єдина мова, яку розуміють усі браузери для відображення інтерфейсу.</li>
                  <li><b>TypeScript/JavaScript</b> — єдина мова, яку браузер виконує для інтерактивності.</li>
                  <li><b>Python</b> чудовий для аналітики/AI на сервері, але <i>не виконується у браузері</i>. Для UI він не підходить.</li>
                  <li><b>C++</b> — для системного ПЗ (драйвери, ігрові рушії). Створювати на ньому веб-інтерфейс — як забивати цвях мікроскопом: довго, дорого, без переваг.</li>
                  <li>Перевага веб: миттєві оновлення для всіх користувачів одразу, без ручної інсталяції.</li>
                </ul>
              </section>

              <section className="pt-2 border-t">
                <h3 className="font-semibold text-base mb-2">🛠 Стек технологій</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { n: "React 18", d: "Бібліотека для побудови інтерфейсу з компонентів" },
                    { n: "TypeScript", d: "JavaScript із типізацією — менше помилок у коді" },
                    { n: "Vite 5", d: "Швидкий збірник та dev-сервер" },
                    { n: "Tailwind CSS", d: "Утилітарні CSS-класи для стилізації" },
                    { n: "shadcn/ui", d: "Готові доступні UI-компоненти" },
                    { n: "Lucide Icons", d: "Іконки в інтерфейсі" },
                    { n: "d3-geo", d: "Карта України (геопроєкції)" },
                    { n: "Zustand", d: "Стейт-менеджмент (інциденти, фільтри)" },
                    { n: "Lovable Cloud (Supabase)", d: "База даних, авторизація, реальний час" },
                    { n: "jsPDF", d: "Генерація PDF-звітів з кирилицею" },
                    { n: "Framer Motion", d: "Анімації переходів" },
                    { n: "Sonner / Radix UI", d: "Сповіщення та діалоги" },
                  ].map((t) => (
                    <div key={t.n} className="p-3 rounded-lg border bg-muted/20">
                      <div className="font-semibold">{t.n}</div>
                      <div className="text-xs text-muted-foreground">{t.d}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="pt-2 border-t">
                <h3 className="font-semibold text-base mb-2">💻 Як локально розгорнути код</h3>
                <p className="text-muted-foreground mb-2">
                  Якщо GitHub недоступний — можна вивантажити проєкт з Lovable напряму:
                </p>
                <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                  <li>У Lovable: <b>Share → Download Project</b> (отримаєте ZIP-архів усього коду).</li>
                  <li>Встановіть <b>Node.js 20+</b> з офіційного сайту nodejs.org.</li>
                  <li>Розпакуйте архів і у терміналі виконайте:
                    <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto"><code>{`npm install
npm run dev`}</code></pre>
                  </li>
                  <li>Відкрийте у браузері адресу <code className="px-1 bg-muted rounded">http://localhost:5173</code></li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2">
                  Backend (база даних) залишається в хмарі — нічого додатково підіймати не треба.
                </p>
              </section>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
