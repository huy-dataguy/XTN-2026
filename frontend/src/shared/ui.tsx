import {
  useEffect,
  useId,
  useRef,
  useState,
  isValidElement,
  cloneElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const money = (n: number | null | undefined) =>
  n == null
    ? "Chưa đủ dữ liệu"
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(n);

export const date = (s: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(s));

export const shortDate = (s: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(s));

export const monday = (s = new Date()) => {
  const d = new Date(+s + 7 * 3600000);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

export const today = () =>
  new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

export const effective = (value: string) =>
  new Date(`${value}${value.length === 16 ? ":00" : ""}+07:00`).toISOString();

export const nowLocal = () =>
  new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 23);

export const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);

export const weekRange = (from: string, to: string) => {
  const end = to === from ? addDays(from, 6) : to;
  return `${shortDate(`${from}T00:00:00+07:00`)} – ${shortDate(`${end}T00:00:00+07:00`)}`;
};

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

type IconName =
  | "home"
  | "orders"
  | "reports"
  | "inventory"
  | "team"
  | "finance"
  | "tasks"
  | "plus"
  | "minus"
  | "search"
  | "close"
  | "left"
  | "right"
  | "down"
  | "more"
  | "logout"
  | "arrow"
  | "alert"
  | "check"
  | "calendar"
  | "edit"
  | "archive"
  | "info"
  | "wallet-in"
  | "wallet-out";

const iconPaths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  orders: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  reports: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4" />
    </>
  ),
  inventory: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5a3 3 0 0 1 0 6M18 14c2 .8 3 2.5 3 5" />
    </>
  ),
  finance: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 9h18M16 13h2" />
    </>
  ),
  tasks: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  left: <path d="m15 18-6-6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  down: <path d="m6 9 6 6 6-6" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  logout: (
    <>
      <path d="M15 3h4v18h-4" />
      <path d="M10 17l5-5-5-5M15 12H3" />
    </>
  ),
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  alert: (
    <>
      <path d="M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v12h14V8M10 12h4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  "wallet-in": <path d="M12 19V5m-6 6 6-6 6 6" />,
  "wallet-out": <path d="M12 5v14m6-6-6 6-6-6" />,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}

export function Badge({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: "gray" | "green" | "amber" | "red" | "blue";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export const orderStatus: Record<
  string,
  { label: string; tone: "gray" | "green" | "amber" | "red" | "blue" }
> = {
  PENDING: { label: "Chờ duyệt", tone: "amber" },
  APPROVED: { label: "Đã duyệt", tone: "blue" },
  PARTIALLY_RECEIVED: { label: "Nhận một phần", tone: "blue" },
  RECEIVED: { label: "Đã nhận", tone: "green" },
  REJECTED: { label: "Từ chối", tone: "red" },
  CANCELLED: { label: "Đã hủy", tone: "gray" },
};

export const reportStatus: Record<
  string,
  { label: string; tone: "gray" | "green" | "amber" | "red" | "blue" }
> = {
  PENDING: { label: "Chờ duyệt", tone: "amber" },
  APPROVED: { label: "Đã duyệt", tone: "green" },
  REJECTED: { label: "Từ chối", tone: "red" },
  SUPERSEDED: { label: "Đã thay thế", tone: "gray" },
};

export const taskStatus: Record<
  string,
  { label: string; tone: "gray" | "green" | "amber" | "red" | "blue" }
> = {
  TODO: { label: "Cần làm", tone: "gray" },
  IN_PROGRESS: { label: "Đang làm", tone: "blue" },
  REVIEW: { label: "Kiểm tra", tone: "amber" },
  DONE: { label: "Hoàn tất", tone: "green" },
};

export const priorityLabel: Record<
  string,
  { label: string; tone: "gray" | "green" | "amber" | "red" | "blue" }
> = {
  LOW: { label: "Thấp", tone: "gray" },
  MEDIUM: { label: "Vừa", tone: "amber" },
  HIGH: { label: "Cao", tone: "red" },
};

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const fieldId = useId();
  return (
    <div className="field">
      <label htmlFor={fieldId}>
        <span>{label}</span>
        {hint && (
          <span className="field-hint" title={hint} aria-label={hint}>
            <Icon name="info" size={13} />
          </span>
        )}
      </label>
      {isValidElement<{ id?: string }>(children)
        ? cloneElement(children, { id: fieldId })
        : children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "green",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: IconName;
  tone?: "green" | "blue" | "amber" | "gray";
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        {icon ? (
          <span className={`stat-icon ${tone}`}>
            <Icon name={icon} size={17} />
          </span>
        ) : hint ? (
          <span className="hint" title={hint}>
            <Icon name="info" size={14} />
          </span>
        ) : null}
      </div>
      <strong className="stat-value">{value}</strong>
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal${wide ? " wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  danger = false,
  pending = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className={`btn ${danger ? "danger" : "primary"}`}
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="dialog-text">{description}</p>
    </Dialog>
  );
}

export function ReasonDialog({
  open,
  title,
  label = "Lý do",
  confirmLabel = "Xác nhận",
  pending = false,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label?: string;
  confirmLabel?: string;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [value, setValue] = useState("");
  const formId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="submit"
            form={formId}
            className="btn primary"
            disabled={pending || !value.trim()}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <Field label={label}>
          <textarea
            autoFocus
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Nhập lý do để lưu lịch sử"
          />
        </Field>
      </form>
    </Dialog>
  );
}

export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="notice error">
      <Icon name="alert" size={16} />
      <span>{error instanceof Error ? error.message : "Không thể tải dữ liệu"}</span>
      {retry && (
        <button type="button" className="btn sm" onClick={retry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

export function MutationStatus({
  pending,
  error,
}: {
  pending: boolean;
  error: unknown;
}) {
  return (
    <>
      {pending && (
        <p className="saving" role="status">
          Đang lưu…
        </p>
      )}
      {error && <ErrorNotice error={error} />}
    </>
  );
}

export function EmptyState({
  icon = "inventory",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={24} />
      </span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  items,
  onChange,
}: {
  value: T;
  items: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className={value === item.value ? "active" : ""}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function PageControls({
  pageSize = 50,
  offset,
  hasMore,
  onChange,
}: {
  offset: number;
  pageSize?: number;
  hasMore: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="page-controls">
      <button
        type="button"
        className="btn sm"
        disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - pageSize))}
      >
        <Icon name="left" size={15} /> Trước
      </button>
      <span>
        {offset + 1}–{offset + pageSize}
      </span>
      <button
        type="button"
        className="btn sm"
        disabled={!hasMore}
        onClick={() => onChange(offset + pageSize)}
      >
        Sau <Icon name="right" size={15} />
      </button>
    </div>
  );
}

export function useOffset() {
  return useState(0);
}

export function useWrite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      body,
      method = "POST",
    }: {
      path: string;
      body: unknown;
      method?: string;
    }) => api(path, method, body),
    onSuccess: async () => {
      await client.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      });
    },
  });
}
