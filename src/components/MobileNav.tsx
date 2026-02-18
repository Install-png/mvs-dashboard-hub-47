import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, CalendarDays, FileBarChart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { label: "Дашборд", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Календар", icon: CalendarDays, path: "/calendar" },
  { label: "Звіти", icon: FileBarChart, path: "/reports" },
  { label: "Ще", icon: Settings, path: "/settings" },
];

const MobileNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 flex">
      {items.map((item) => {
        const active = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
};

export default MobileNav;
