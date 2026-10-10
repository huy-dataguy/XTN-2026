import {
  useState,
  useId,
  isValidElement,
  cloneElement,
  type ReactNode,
} from "react";
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
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const fieldId = useId();
  return (
    <div className="field">
      <label htmlFor={fieldId}>
        <span>{label}</span>
      </label>
      {isValidElement<{ id?: string }>(children)
        ? cloneElement(children, { id: fieldId })
        : children}
    </div>
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
      {error instanceof Error ? error.message : "Không thể tải dữ liệu"}{" "}
      {retry && (
        <button type="button" onClick={retry}>
          Thử lại
        </button>
      )}
    </div>
  );
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
export function MutationStatus({
  pending,
  error,
}: {
  pending: boolean;
  error: unknown;
}) {
  return (
    <>
      {pending && <p role="status">Đang lưu…</p>}
      {error && <ErrorNotice error={error} />}
    </>
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
        disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - pageSize))}
      >
        Trước
      </button>
      <span>
        {offset + 1}–{offset + pageSize}
      </span>
      <button disabled={!hasMore} onClick={() => onChange(offset + pageSize)}>
        Sau
      </button>
    </div>
  );
}
export function useOffset() {
  return useState(0);
}
