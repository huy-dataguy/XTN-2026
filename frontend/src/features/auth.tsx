import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, session } from "../shared/api";
import type { User } from "../shared/types";
import { Field, MutationStatus } from "../shared/ui";
export default function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      api<{ token: string; user: User }>("/auth/login", "POST", {
        username,
        password,
      }),
    onSuccess: (data) => {
      session.set(data.token);
      onLogin();
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };
  return (
    <div className="login">
      <div className="login-story">
        <div className="brand">
          XTN <span>2026</span>
        </div>
        <h1>
          Mỗi kết quả đều
          <br />
          có một hành trình.
        </h1>
        <p>
          Theo dõi hàng đã nhận, kết quả bán và báo cáo của bạn trong một nơi.
        </p>
      </div>
      <form className="panel login-form" onSubmit={submit}>
        <BadgeTitle />
        <h2>Chào bạn trở lại</h2>
        <p className="muted">Đăng nhập bằng tài khoản được cấp.</p>
        <Field label="Tên đăng nhập">
          <input
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="Mật khẩu">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <button className="primary" disabled={mutation.isPending}>
          Đăng nhập
        </button>
        <MutationStatus pending={mutation.isPending} error={mutation.error} />
      </form>
    </div>
  );
}
function BadgeTitle() {
  return <span className="eyebrow">CỔNG THÀNH VIÊN</span>;
}
