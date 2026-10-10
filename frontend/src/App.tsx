import {
  Component,
  lazy,
  Suspense,
  useEffect,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, session } from "./shared/api";
import type { User } from "./shared/types";
import { ErrorNotice } from "./shared/ui";
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
        <button onClick={() => location.reload()}>Tải lại</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Application() {
  const client = useQueryClient();
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
      location.assign("/login");
    }
  };
  if (!session.get())
    return (
      <Login
        onLogin={() => {
          void client.invalidateQueries({ queryKey: ["session"] });
          location.assign("/");
        }}
      />
    );
  if (query.isPending)
    return (
      <p className="boot" role="status">
        Đang xác thực phiên…
      </p>
    );
  if (query.error)
    return (
      <div className="boot">
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
        <button
          onClick={() => {
            session.clear();
            location.reload();
          }}
        >
          Đăng nhập lại
        </button>
      </div>
    );
  const user = query.data;
  if (!user) return null;
  const links = [
    ["/", "Tổng quan"],
    ["/orders", "Cấp hàng"],
    ["/reports", "Báo cáo"],
    ["/inventory", user.role === "ADMIN" ? "Kho & sản phẩm" : "Hàng đang giữ"],
    ...(user.role === "ADMIN"
      ? [
          ["/members", "Thành viên"],
          ["/finance", "Thu / chi"],
          ["/tasks", "Công việc"],
        ]
      : []),
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          XTN <span>2026</span>
        </div>
        <p className="eyebrow">CÙNG NHAU TẠO KẾT QUẢ</p>
        <nav>
          {links.map(([path, label]) => (
            <NavLink key={path} to={path} end={path === "/"}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="profile">
          <strong>{user.name}</strong>
          <small>
            {user.role === "ADMIN" ? "Quản trị" : user.group || "Thành viên"}
          </small>
          <button onClick={() => void logout()}>Đăng xuất</button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Không gian {user.role === "ADMIN" ? "điều hành" : "thành viên"}
          </span>
          <span>VND · Giờ Việt Nam</span>
        </header>
        <div className="workspace">
          <ErrorBoundary>
            <Suspense fallback={<p role="status">Đang tải trang…</p>}>
              <Routes>
                <Route path="/" element={<Dashboard user={user} />} />
                <Route path="/orders" element={<Orders user={user} />} />
                <Route path="/reports" element={<Reports user={user} />} />
                <Route path="/inventory" element={<Inventory user={user} />} />
                {user.role === "ADMIN" && (
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
        </div>
      </main>
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
