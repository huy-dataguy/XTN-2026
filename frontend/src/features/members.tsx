import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../shared/api";
import type { Group, Page, User } from "../shared/types";
import {
  Badge,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorNotice,
  Field,
  Icon,
  MutationStatus,
  Segmented,
  effective,
  initials,
  monday,
  useWrite,
} from "../shared/ui";

const roleLabel = (role: string) =>
  role === "ADMIN" ? "Chủ cửa hàng" : "Nhân viên";

export default function Members() {
  const query = useQuery({
    queryKey: ["users", "team"],
    queryFn: () => api<Page<User>>("/users?limit=200"),
  });
  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<Page<Group>>("/groups?limit=200"),
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ADMIN" | "DISTRIBUTOR">("ALL");
  const [creating, setCreating] = useState(false);
  const [managingGroups, setManagingGroups] = useState(false);
  const [targeting, setTargeting] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [locking, setLocking] = useState<User | null>(null);
  const write = useWrite();
  const term = search.trim().toLowerCase();
  const users = useMemo(
    () =>
      (query.data?.items || []).filter(
        (user) =>
          (filter === "ALL" || user.role === filter) &&
          (!term ||
            user.name.toLowerCase().includes(term) ||
            user.username.toLowerCase().includes(term) ||
            (user.group || "").toLowerCase().includes(term)),
      ),
    [query.data, term, filter],
  );

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Đội ngũ</h1>
          <p>Quản lý tài khoản, mục tiêu và quyền truy cập.</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setManagingGroups(true)}
          >
            <Icon name="team" size={17} /> Nhóm
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => setCreating(true)}
          >
            <Icon name="plus" size={17} /> Cấp tài khoản
          </button>
        </div>
      </header>

      {query.error && <ErrorNotice error={query.error} />}
      <section className="panel">
        <div className="toolbar">
          <Segmented
            value={filter}
            onChange={setFilter}
            items={[
              { value: "ALL", label: "Tất cả" },
              { value: "DISTRIBUTOR", label: "Nhân viên" },
              { value: "ADMIN", label: "Chủ cửa hàng" },
            ]}
          />
          <div className="search-box compact">
            <input
              placeholder="Tìm tên, tài khoản, nhóm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Tìm thành viên"
            />
          </div>
        </div>

        <div className="team-list">
          {users.map((user) => (
            <div className="team-row" key={user.id}>
              <span className="avatar">{initials(user.name)}</span>
              <div className="member-copy">
                <strong>{user.name}</strong>
                <small>
                  @{user.username}
                  {user.group ? ` · ${user.group}` : ""}
                </small>
              </div>
              <div className="team-tags">
                <Badge tone={user.role === "ADMIN" ? "blue" : "gray"}>
                  {roleLabel(user.role)}
                </Badge>
                <Badge tone={user.active ? "green" : "red"}>
                  {user.active ? "Hoạt động" : "Đã khóa"}
                </Badge>
              </div>
              <div className="team-actions">
                {user.role === "DISTRIBUTOR" && (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => setTargeting(user)}
                  >
                    Mục tiêu / gia hạn
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Đổi mật khẩu ${user.name}`}
                  title="Đổi mật khẩu"
                  onClick={() => setResetting(user)}
                >
                  <Icon name="edit" size={17} />
                </button>
                <button
                  type="button"
                  className={`btn sm ghost${user.active ? " danger-text" : ""}`}
                  onClick={() => setLocking(user)}
                >
                  {user.active ? "Khóa" : "Mở"}
                </button>
              </div>
            </div>
          ))}
          {!users.length && !query.isPending && (
            <p className="muted">Không có thành viên phù hợp.</p>
          )}
        </div>
      </section>

      {query.isPending && <p className="loading">Đang tải đội ngũ…</p>}
      {!query.isPending && !query.data?.items.length && (
        <EmptyState
          icon="team"
          title="Chưa có thành viên"
          description="Cấp tài khoản cho nhân viên để bắt đầu nhận hàng và báo cáo."
          action={
            <button
              type="button"
              className="btn primary"
              onClick={() => setCreating(true)}
            >
              Cấp tài khoản
            </button>
          }
        />
      )}

      {creating && (
        <CreateDialog
          groups={groupsQuery.data?.items || []}
          onClose={() => setCreating(false)}
        />
      )}
      {managingGroups && (
        <GroupsDialog onClose={() => setManagingGroups(false)} />
      )}
      {targeting && (
        <TargetDialog user={targeting} onClose={() => setTargeting(null)} />
      )}
      {resetting && (
        <PasswordDialog user={resetting} onClose={() => setResetting(null)} />
      )}

      <ConfirmDialog
        open={!!locking}
        title={locking?.active ? "Khóa tài khoản?" : "Mở lại tài khoản?"}
        description={
          locking?.active
            ? `${locking?.name} sẽ không thể đăng nhập cho đến khi được mở lại.`
            : `${locking?.name} sẽ có thể đăng nhập trở lại.`
        }
        confirmLabel={locking?.active ? "Khóa tài khoản" : "Mở tài khoản"}
        danger={!!locking?.active}
        pending={write.isPending}
        onClose={() => setLocking(null)}
        onConfirm={() => {
          if (!locking) return;
          write.mutate(
            {
              path: `/users/${locking.id}`,
              method: "PUT",
              body: { active: !locking.active },
            },
            { onSuccess: () => setLocking(null) },
          );
        }}
      />
      <MutationStatus pending={write.isPending} error={write.error} />
    </>
  );
}

function CreateDialog({
  groups,
  onClose,
}: {
  groups: Group[];
  onClose: () => void;
}) {
  const write = useWrite();
  const [form, setForm] = useState({
    username: "",
    name: "",
    password: "",
    role: "DISTRIBUTOR",
    group: groups[0]?.name || "",
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Cấp tài khoản"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="submit"
            form="account-form"
            className="btn primary"
            disabled={write.isPending}
          >
            Tạo tài khoản
          </button>
        </>
      }
    >
      <form
        id="account-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          write.mutate({ path: "/users", body: form }, { onSuccess: onClose });
        }}
      >
        <div className="form-grid">
          <Field label="Tên đăng nhập">
            <input
              required
              autoComplete="off"
              value={form.username}
              onChange={(event) =>
                setForm({ ...form, username: event.target.value })
              }
            />
          </Field>
          <Field label="Tên thành viên">
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Mật khẩu ban đầu" hint="Ít nhất 12 ký tự">
            <input
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
          </Field>
          <Field label="Nhóm">
            <select
              value={form.group}
              onChange={(event) => setForm({ ...form, group: event.target.value })}
            >
              <option value="">Chưa phân nhóm</option>
              {groups.map((group) => (
                <option key={group.id} value={group.name}>
                  {group.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vai trò">
            <select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
            >
              <option value="DISTRIBUTOR">Nhân viên</option>
              <option value="ADMIN">Chủ cửa hàng</option>
            </select>
          </Field>
        </div>
        <MutationStatus pending={write.isPending} error={write.error} />
      </form>
    </Dialog>
  );
}

function GroupsDialog({ onClose }: { onClose: () => void }) {
  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<Page<Group>>("/groups?limit=200"),
  });
  const write = useWrite();
  const [name, setName] = useState("");
  const [color, setColor] = useState("green");
  const groups = groupsQuery.data?.items || [];
  return (
    <Dialog
      open
      onClose={onClose}
      title="Quản lý nhóm"
      footer={
        <button type="button" className="btn" onClick={onClose}>
          Đóng
        </button>
      }
    >
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          write.mutate(
            { path: "/groups", body: { name: name.trim(), color } },
            { onSuccess: () => setName("") },
          );
        }}
      >
        <Field label="Tên nhóm">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ví dụ: Bán hàng"
          />
        </Field>
        <Field label="Màu">
          <select value={color} onChange={(event) => setColor(event.target.value)}>
            {[
              "green",
              "blue",
              "amber",
              "red",
              "purple",
              "gray",
              "orange",
              "teal",
            ].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <button type="submit" className="btn primary" disabled={write.isPending}>
          <Icon name="plus" size={17} /> Tạo nhóm
        </button>
      </form>
      <div className="team-list" style={{ marginTop: 16 }}>
        {groups.map((group) => (
          <div className="team-row" key={group.id}>
            <span
              className="avatar"
              style={{ background: group.color === "green" ? "#dff06d" : undefined }}
            >
              {group.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="member-copy">
              <strong>{group.name}</strong>
              <small>{group.color}</small>
            </div>
            <button
              type="button"
              className="btn sm ghost danger-text"
              disabled={write.isPending}
              onClick={() =>
                write.mutate({
                  path: `/groups/${group.id}`,
                  method: "PUT",
                  body: { active: false },
                })
              }
            >
              Xóa
            </button>
          </div>
        ))}
        {!groups.length && <p className="muted">Chưa có nhóm.</p>}
      </div>
      <MutationStatus pending={write.isPending} error={write.error} />
    </Dialog>
  );
}

function TargetDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const write = useWrite();
  const [week, setWeek] = useState(monday());
  const [target, setTarget] = useState("");
  const [extension, setExtension] = useState("");
  const [reason, setReason] = useState("");
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Mục tiêu riêng · ${user.name}`}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="submit"
            form="target-form"
            className="btn primary"
            disabled={write.isPending || !reason}
          >
            Lưu mục tiêu / gia hạn
          </button>
        </>
      }
    >
      <form
        id="target-form"
        onSubmit={(event) => {
          event.preventDefault();
          write.mutate(
            {
              path: "/periods/member",
              body: {
                memberId: user.id,
                periodId: week,
                reason,
                ...(target !== "" ? { targetRevenue: Number(target) } : {}),
                ...(extension ? { extensionUntil: effective(extension) } : {}),
              },
            },
            { onSuccess: onClose },
          );
        }}
      >
        <div className="form-grid">
          <Field label="Tuần">
            <input
              type="date"
              required
              value={week}
              onChange={(event) => setWeek(event.target.value)}
            />
          </Field>
          <Field label="Mục tiêu doanh thu riêng (đ)">
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Để trống = dùng KPI chung"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </Field>
          <Field label="Gia hạn đến (Việt Nam)">
            <input
              type="datetime-local"
              step="any"
              value={extension}
              onChange={(event) => setExtension(event.target.value)}
            />
          </Field>
          <Field label="Lý do">
            <input
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        </div>
        <p className="fine-print">
          Để trống mục tiêu để dùng KPI chung theo giai đoạn; nhập số để ghi đè
          riêng cho thành viên này. Có thể nhập gia hạn, mục tiêu hoặc cả hai.
          Thao tác được lưu vào lịch sử kỳ.
        </p>
        <MutationStatus pending={write.isPending} error={write.error} />
      </form>
    </Dialog>
  );
}

function PasswordDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const write = useWrite();
  const [password, setPassword] = useState("");
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Đổi mật khẩu · ${user.name}`}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="submit"
            form="password-form"
            className="btn primary"
            disabled={write.isPending}
          >
            Đổi mật khẩu
          </button>
        </>
      }
    >
      <form
        id="password-form"
        onSubmit={(event) => {
          event.preventDefault();
          write.mutate(
            {
              path: `/users/${user.id}/password`,
              method: "PUT",
              body: { password },
            },
            { onSuccess: onClose },
          );
        }}
      >
        <Field label="Mật khẩu mới" hint="Ít nhất 12 ký tự">
          <input
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <p className="fine-print">
          Mật khẩu cũ sẽ bị thu hồi và các phiên đăng nhập hiện tại sẽ hết hiệu
          lực.
        </p>
        <MutationStatus pending={write.isPending} error={write.error} />
      </form>
    </Dialog>
  );
}
