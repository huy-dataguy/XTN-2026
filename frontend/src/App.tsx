import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, session } from "./shared/api";
import type { User } from "./shared/types";
import { Dialog, ErrorNotice, Icon, initials } from "./shared/ui";
import Login from "./features/auth";

const Dashboard = lazy(() => import("./features/dashboard"));
const Orders = lazy(() => import("./features/orders"));
const Reports = lazy(() => import("./features/reports"));
const Inventory = lazy(() => import("./features/inventory"));
const Members = lazy(() => import("./features/members"));
const Finance = lazy(() =>
  import("./features/operations").then((m) => ({ default: m.Finance })),
);
const Tasks = lazy(() =>
  import("./features/operations").then((m) => ({ default: m.Tasks })),
);

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    return this.state.error ? (
      <div className="notice error">
        Không thể hiển thị trang.{" "}
        <button type="button" onClick={() => location.reload()}>
          Tải lại
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

type LinkItem = { path: string; label: string; icon: Parameters<typeof Icon>[0]["name"] };

const staffLinks: LinkItem[] = [
  { path: "/", label: "Overview", icon: "home" },
  { path: "/orders", label: "Orders", icon: "orders" },
  { path: "/reports", label: "Reports", icon: "reports" },
  { path: "/inventory", label: "Inventory", icon: "inventory" },
];

const adminLinks: LinkItem[] = [
  ...staffLinks,
  { path: "/members", label: "Team", icon: "team" },
  { path: "/finance", label: "Finance", icon: "finance" },
  { path: "/tasks", label: "Tasks", icon: "tasks" },
];

function Application() {
  const client = useQueryClient();
  const routerLocation = useLocation();
  const [menu, setMenu] = useState(false);
  const query = useQuery({
    queryKey: ["session"],
    queryFn: () => api<User>("/auth/me"),
    enabled: !!session.get(),
    retry: false,
    staleTime: 300000,
  });

  useEffect(() => {
    const expire = () => {
      session.clear();
      client.clear();
      void client.invalidateQueries({ queryKey: ["session"] });
    };
    window.addEventListener("xtn:session-expired", expire);
    return () => window.removeEventListener("xtn:session-expired", expire);
  }, [client]);

  const logout = async () => {
    try {
      await api("/auth/logout", "POST", {});
    } finally {
      session.clear();
      client.clear();
      window.location.assign("/login");
    }
  };

  if (!session.get())
    return (
      <Login
        onLogin={() => {
          void client.invalidateQueries({ queryKey: ["session"] });
          window.location.assign("/");
        }}
      />
    );

  if (query.isPending)
    return (
      <div className="boot" role="status">
        Đang xác thực phiên…
      </div>
    );

  if (query.error)
    return (
      <div className="boot">
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
        <button
          type="button"
          className="btn"
          onClick={() => {
            session.clear();
            window.location.reload();
          }}
        >
          Đăng nhập lại
        </button>
      </div>
    );

  const user = query.data;
  if (!user) return null;

  const isAdmin = user.role === "ADMIN";
  const links = isAdmin ? adminLinks : staffLinks;
  const tabs = links.slice(0, 4);
  const extras = links.slice(4);
  const current =
    links.find((link) =>
      link.path === "/" ? routerLocation.pathname === "/" : routerLocation.pathname.startsWith(link.path),
    )?.label || "XTN";
  const moreActive = extras.some((link) => routerLocation.pathname.startsWith(link.path));
  const roleLabel = isAdmin ? "Chủ cửa hàng" : "Nhân viên";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Spring volunteer<span></span>
        </div>
        <div className="nav-group">
          <span className="nav-label">Selling</span>
          {links.slice(0, 4).map((link) => (
            <NavLink key={link.path} to={link.path} end={link.path === "/"}>
              <span className="nav-icon">
                <Icon name={link.icon} size={18} />
              </span>
              {link.label}
            </NavLink>
          ))}
        </div>
        {isAdmin && (
          <div className="nav-group">
            <span className="nav-label">Management</span>
            {extras.map((link) => (
              <NavLink key={link.path} to={link.path}>
                <span className="nav-icon">
                  <Icon name={link.icon} size={18} />
                </span>
                {link.label}
              </NavLink>
            ))}
          </div>
        )}
        <div className="profile">
          <span className="avatar">{initials(user.name)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>
              {roleLabel}
              {user.group ? ` · ${user.group}` : ""}
            </small>
          </div>
          <button
            type="button"
            className="icon-btn ghost"
            onClick={() => void logout()}
            aria-label="Đăng xuất"
            title="Đăng xuất"
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="mobile-bar">
          <div className="mobile-brand">
            <span className="brand">
              Spring volunteer<span></span>
            </span>
            <small>{current}</small>
          </div>
          <button
            type="button"
            className="avatar-btn"
            onClick={() => setMenu(true)}
            aria-label="Mở tài khoản"
          >
            {initials(user.name)}
          </button>
        </header>

        <main className="workspace">
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="boot" role="status">
                  Đang tải trang…
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Dashboard user={user} />} />
                <Route path="/orders" element={<Orders user={user} />} />
                <Route path="/reports" element={<Reports user={user} />} />
                <Route path="/inventory" element={<Inventory user={user} />} />
                {isAdmin && (
                  <>
                    <Route path="/members" element={<Members />} />
                    <Route path="/finance" element={<Finance />} />
                    <Route path="/tasks" element={<Tasks />} />
                  </>
                )}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>

        <nav className="tabbar" aria-label="Điều hướng chính">
          {tabs.map((link) => (
            <NavLink key={link.path} to={link.path} end={link.path === "/"}>
              <Icon name={link.icon} size={21} />
              <span>{link.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            className={moreActive || menu ? "active" : ""}
            onClick={() => setMenu(true)}
            aria-label="Mở thêm mục"
          >
            <Icon name="more" size={21} />
            <span>More</span>
          </button>
        </nav>
      </div>

      <Dialog open={menu} onClose={() => setMenu(false)} title={roleLabel}>
        <div className="account-card">
          <span className="avatar">{initials(user.name)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>@{user.username}</small>
            {user.group && <small>{user.group}</small>}
          </div>
        </div>
        {extras.length > 0 && (
          <div className="menu-list">
            {extras.map((link) => (
              <NavLink key={link.path} to={link.path} onClick={() => setMenu(false)}>
                <Icon name={link.icon} size={19} />
                {link.label}
                <Icon name="right" size={17} />
              </NavLink>
            ))}
          </div>
        )}
        <button type="button" className="btn logout-btn" onClick={() => void logout()}>
          <Icon name="logout" size={18} /> Đăng xuất
        </button>
      </Dialog>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Application />
    </BrowserRouter>
  );
}
