import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Shield, LayoutDashboard, CalendarDays, FileBarChart, Settings, LogOut, Sun, Moon, Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

const navItems = [
  { label: "Дашборд", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Ситуаційний центр", icon: Map, path: "/situation-center" },
  { label: "Календар", icon: CalendarDays, path: "/calendar" },
  { label: "Звіти", icon: FileBarChart, path: "/reports" },
  { label: "Налаштування", icon: Settings, path: "/settings" },
];

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="hidden md:flex flex-col w-60 bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border min-h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <Shield className="h-7 w-7 text-sidebar-primary" />
        <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
          МВС Панель
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {theme === "dark" ? "Світла тема" : "Темна тема"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={async () => { await signOut(); navigate("/"); }}
        >
          <LogOut className="h-5 w-5" />
          Вийти
        </Button>
      </div>
    </aside>
  );
};

export default AppSidebar;
