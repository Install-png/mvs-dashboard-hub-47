import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Shield, LayoutDashboard, CalendarDays, FileBarChart, Settings, LogOut, Sun, Moon, Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/hooks/useI18n";

const navItemsBase = [
  { key: "nav.dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { key: "nav.situation", icon: Map, path: "/situation-center" },
  { key: "nav.calendar", icon: CalendarDays, path: "/calendar" },
  { key: "nav.reports", icon: FileBarChart, path: "/reports" },
  { key: "nav.settings", icon: Settings, path: "/settings" },
];

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();

  return (
    <aside className="hidden md:flex flex-col w-60 bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border min-h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <Shield className="h-7 w-7 text-sidebar-primary" />
        <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
          {t("app.title")}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItemsBase.map((item) => {
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
              {t(item.key)}
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
          {theme === "dark" ? t("nav.theme.light") : t("nav.theme.dark")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={async () => { await signOut(); navigate("/"); }}
        >
          <LogOut className="h-5 w-5" />
          {t("nav.signout")}
        </Button>
      </div>
    </aside>
  );
};

export default AppSidebar;
