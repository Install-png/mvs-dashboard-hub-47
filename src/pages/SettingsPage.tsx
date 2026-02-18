import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { Sun, Moon, Keyboard } from "lucide-react";

const SettingsPage = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>Налаштування</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            Тема оформлення
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">Поточна: {theme === "dark" ? "Темна" : "Світла"}</p>
          <Button variant="outline" size="sm" onClick={toggleTheme}>
            Переключити на {theme === "dark" ? "світлу" : "темну"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Гарячі клавіші
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Швидкий PDF-експорт поточної сторінки</span>
              <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Ctrl + Shift + P</kbd>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
