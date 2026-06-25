import { Briefcase, TrendingUp, Home, Newspaper, MessageSquare } from "lucide-react";
import { Link, useLocation } from "wouter";

interface NavItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const navItems: NavItem[] = [
  { path: "/portfolio", icon: Briefcase, label: "Portfolio" },
  { path: "/trends", icon: TrendingUp, label: "Trends" },
  { path: "/", icon: Home, label: "Home" },
  { path: "/news", icon: Newspaper, label: "News" },
  { path: "/chat", icon: MessageSquare, label: "Chat" },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex items-center justify-around h-20 max-w-screen-xl mx-auto px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          return (
            <Link key={item.path} href={item.path}>
              <button
                className="flex flex-col items-center gap-1 p-2 hover-elevate active-elevate-2 rounded-lg transition-colors"
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <div className={isActive ? "icon-glow" : ""}>
                  <Icon 
                    className={`w-6 h-6 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                </div>
                <span 
                  className={`text-xs font-medium ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
