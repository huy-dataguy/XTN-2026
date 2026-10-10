import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../shared/api";
import type { User, Page } from "../shared/types";
import {
  Card,
  ErrorNotice,
  Field,
  monday,
  useWrite,
  MutationStatus,
  PageControls,
  useOffset,
  effective,
} from "../shared/ui";
export default function Members() {
  const [offset, setOffset] = useOffset();
  const query = useQuery({
      queryKey: ["users", offset],
      queryFn: () => api<Page<User>>(`/users?offset=${offset}`),
    }),
    write = useWrite();
  const [form, setForm] = useState({
    username: "",
    name: "",
    password: "",
    role: "DISTRIBUTOR",
    group: "",
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THÀNH VIÊN & MỤC TIÊU</span>
          <h1>Đội ngũ</h1>
        </div>
      </div>
      <Card>
        <h2>Cấp tài khoản</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            write.mutate(
              { path: "/users", body: form },
              {
                onSuccess: () =>
                  setForm({
                    username: "",
                    name: "",
                    password: "",
                    role: "DISTRIBUTOR",
                    group: "",
                  }),
              },
            );
          }}
        >
          <div className="form-grid">
            {(["username", "name", "password", "group"] as const).map(
              (key, i) => (
                <Field
                  key={key}
                  label={
                    [
                      "Tên đăng nhập",
                      "Tên thành viên",
                      "Mật khẩu ban đầu (ít nhất 12 ký tự)",
                      "Nhóm",
                    ][i]
                  }
                >
                  <input
                    type={key === "password" ? "password" : "text"}
                    minLength={key === "password" ? 12 : undefined}
                    required={key !== "group"}
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </Field>
              ),
            )}
            <Field label="Vai trò">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="DISTRIBUTOR">Thành viên</option>
                <option value="ADMIN">Quản trị</option>
              </select>
            </Field>
          </div>
          <button className="primary" disabled={write.isPending}>
            Cấp tài khoản
          </button>
          <MutationStatus pending={write.isPending} error={write.error} />
        </form>
      </Card>
      {query.error && <ErrorNotice error={query.error} />}
      <Card>
        <table>
          <thead>
            <tr>
              <th>Thành viên</th>
              <th>Nhóm / quyền</th>
              <th>Tài khoản</th>
              <th>Mục tiêu & gia hạn</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.items.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.name}</strong>
                  <small>{user.username}</small>
                </td>
                <td>
                  {user.group || "—"}
                  <small>{user.role}</small>
                </td>
                <td>
                  <button
                    disabled={write.isPending}
                    onClick={() =>
                      write.mutate({
                        path: `/users/${user.id}`,
                        method: "PUT",
                        body: { active: !user.active },
                      })
                    }
                  >
                    {user.active ? "Khóa tài khoản" : "Mở tài khoản"}
                  </button>
                  <button
                    onClick={() => {
                      const password = prompt("Mật khẩu mới, ít nhất 12 ký tự");
                      if (password)
                        write.mutate({
                          path: `/users/${user.id}/password`,
                          method: "PUT",
                          body: { password },
                        });
                    }}
                  >
                    Đổi mật khẩu
                  </button>
                </td>
                <td>
                  {user.role === "DISTRIBUTOR" && <MemberPeriod user={user} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {query.data && (
        <PageControls
          offset={offset}
          hasMore={query.data.hasMore}
          onChange={setOffset}
        />
      )}
      <MutationStatus pending={write.isPending} error={write.error} />
    </>
  );
}
function MemberPeriod({ user }: { user: User }) {
  const [expanded, setExpanded] = useState(false),
    [week, setWeek] = useState(monday()),
    [target, setTarget] = useState(""),
    [extension, setExtension] = useState(""),
    [reason, setReason] = useState("");
  const write = useWrite();
  return (
    <>
      <button onClick={() => setExpanded(!expanded)}>Mục tiêu / gia hạn</button>
      {expanded && (
        <form
          className="inset"
          onSubmit={(e) => {
            e.preventDefault();
            write.mutate({
              path: "/periods/member",
              body: {
                memberId: user.id,
                periodId: week,
                reason,
                ...(target !== "" ? { targetRevenue: Number(target) } : {}),
                ...(extension ? { extensionUntil: effective(extension) } : {}),
              },
            });
          }}
        >
          <Field label="Tuần thứ Hai">
            <input
              type="date"
              required
              value={week}
              onChange={(e) => setWeek(e.target.value)}
            />
          </Field>
          <Field label="Mục tiêu doanh thu (đ)">
            <input
              type="number"
              min="0"
              step="1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </Field>
          <Field label="Gia hạn đến (Việt Nam)">
            <input
              type="datetime-local"
              step="any"
              value={extension}
              onChange={(e) => setExtension(e.target.value)}
            />
          </Field>
          <Field label="Lý do">
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <button disabled={write.isPending}>Lưu mục tiêu / gia hạn</button>
          <MutationStatus pending={write.isPending} error={write.error} />
        </form>
      )}
    </>
  );
}
