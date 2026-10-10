import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../shared/api";
import type { Order, Page, Product, User } from "../shared/types";
import {
  Badge,
  Card,
  ErrorNotice,
  Field,
  monday,
  money,
  date,
  useWrite,
  MutationStatus,
  PageControls,
  useOffset,
  nowLocal,
  effective,
} from "../shared/ui";
export default function Orders({ user }: { user: User }) {
  const [offset, setOffset] = useOffset();
  const query = useQuery({
      queryKey: ["orders", offset],
      queryFn: () => api<Page<Order>>(`/orders?offset=${offset}`),
    }),
    write = useWrite();
  const [editing, setEditing] = useState<Order | null>(null);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CẤP HÀNG & THỰC NHẬN</span>
          <h1>Yêu cầu cấp hàng</h1>
          <p className="muted">
            Đặt hàng giữ tồn; xác nhận thực nhận mới chuyển hàng tới thành viên.
          </p>
        </div>
      </div>
      {(user.role === "DISTRIBUTOR" || editing) && (
        <OrderForm
          key={editing?.id || "new"}
          editing={editing}
          onDone={() => setEditing(null)}
        />
      )}
      <MutationStatus pending={write.isPending} error={write.error} />
      {query.error && <ErrorNotice error={query.error} />}
      {query.isPending && <p>Đang tải…</p>}
      {query.data?.items.map((order) => (
        <Card key={order.id}>
          <div className="split">
            <div>
              <h2>{order.memberName}</h2>
              <p className="muted">
                {date(order.createdAt)} · Dự kiến tuần {order.intendedPeriodId}
              </p>
            </div>
            <Badge>{order.status}</Badge>
          </div>
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Bảng dữ liệu, cuộn ngang để xem đầy đủ"
          >
            <table>
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Yêu cầu</th>
                  <th>Đã nhận</th>
                  <th>Giá bán</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.productId}>
                    <td>{item.productName}</td>
                    <td>{item.quantity}</td>
                    <td>{item.receivedQuantity}</td>
                    <td>{money(item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Giá trị cấp hàng: <strong>{money(order.totalAmount)}</strong>
          </p>
          <div className="actions">
            {user.role === "ADMIN" && order.status === "PENDING" && (
              <>
                <button
                  disabled={write.isPending}
                  onClick={() =>
                    write.mutate({
                      path: `/orders/${order.id}/status`,
                      method: "PUT",
                      body: { status: "APPROVED", version: order.version },
                    })
                  }
                >
                  Duyệt
                </button>
                <button
                  disabled={write.isPending}
                  onClick={() =>
                    write.mutate({
                      path: `/orders/${order.id}/status`,
                      method: "PUT",
                      body: { status: "REJECTED", version: order.version },
                    })
                  }
                >
                  Từ chối
                </button>
              </>
            )}
            {["PENDING", "APPROVED"].includes(order.status) && (
              <button onClick={() => setEditing(order)}>Sửa yêu cầu</button>
            )}
            {["PENDING", "APPROVED", "PARTIALLY_RECEIVED"].includes(
              order.status,
            ) && (
              <button
                disabled={write.isPending}
                onClick={() => {
                  if (confirm("Hủy phần hàng chưa nhận?"))
                    write.mutate({
                      path: `/orders/${order.id}/status`,
                      method: "PUT",
                      body: { status: "CANCELLED", version: order.version },
                    });
                }}
              >
                Hủy phần chưa nhận
              </button>
            )}
          </div>
          {["APPROVED", "PARTIALLY_RECEIVED"].includes(order.status) && (
            <ReceiptForm order={order} />
          )}
        </Card>
      ))}
      {query.data?.items.length === 0 && <Card>Chưa có yêu cầu cấp hàng.</Card>}
      {query.data && (
        <PageControls
          offset={offset}
          hasMore={query.data.hasMore}
          onChange={setOffset}
        />
      )}
    </>
  );
}
function OrderForm({
  editing,
  onDone,
}: {
  editing: Order | null;
  onDone: () => void;
}) {
  const [offset, setOffset] = useOffset();
  const products = useQuery({
    queryKey: ["products", "selector", offset],
    queryFn: () => api<Page<Product>>(`/products?offset=${offset}`),
  });
  const [cart, setCart] = useState<Record<string, number>>({}),
    [week, setWeek] = useState(monday());
  const write = useWrite();
  const selected = Object.keys(cart).length
    ? cart
    : Object.fromEntries(
        editing?.items.map((i) => [i.productId, i.quantity]) || [],
      );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const items = Object.entries(selected)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    write.mutate(
      {
        path: editing ? `/orders/${editing.id}` : "/orders",
        method: editing ? "PUT" : "POST",
        body: editing
          ? { items, version: editing.version }
          : { items, intendedPeriodId: week },
      },
      {
        onSuccess: () => {
          setCart({});
          onDone();
        },
      },
    );
  };
  return (
    <Card>
      <h2>{editing ? "Sửa yêu cầu chưa giao" : "Tạo yêu cầu mới / bổ sung"}</h2>
      <form onSubmit={submit}>
        <Field label="Tuần dự kiến (thứ Hai)">
          <input
            type="date"
            required
            value={week}
            onChange={(e) => setWeek(e.target.value)}
          />
        </Field>
        {products.error && <ErrorNotice error={products.error} />}
        <div className="catalog">
          {products.data?.items
            .filter((p) => p.active && !p.needsMigration)
            .map((p) => (
              <Field
                key={p.id}
                label={`${p.name} · khả dụng ${p.stock} · ${money(p.price)}`}
              >
                <input
                  aria-label={`Số lượng ${p.name}`}
                  type="number"
                  min="0"
                  step="1"
                  value={selected[p.id] || 0}
                  onChange={(e) =>
                    setCart({ ...selected, [p.id]: Number(e.target.value) })
                  }
                />
              </Field>
            ))}
        </div>
        {products.data && (
          <PageControls
            offset={offset}
            hasMore={products.data.hasMore}
            onChange={setOffset}
          />
        )}
        <p className="muted">
          Đã chọn {Object.values(selected).filter((v) => v > 0).length} sản
          phẩm.
        </p>
        <div className="actions">
          <button
            className="primary"
            disabled={
              write.isPending || !Object.values(selected).some((v) => v > 0)
            }
          >
            {editing ? "Lưu yêu cầu" : "Gửi yêu cầu"}
          </button>
          {editing && (
            <button type="button" onClick={onDone}>
              Bỏ sửa
            </button>
          )}
        </div>
        <MutationStatus pending={write.isPending} error={write.error} />
      </form>
    </Card>
  );
}
function ReceiptForm({ order }: { order: Order }) {
  const [counts, setCounts] = useState<Record<string, number>>({}),
    [when, setWhen] = useState(nowLocal());
  const write = useWrite();
  return (
    <form
      className="inset"
      onSubmit={(e) => {
        e.preventDefault();
        const items = order.items
          .map((i) => ({
            productId: i.productId,
            quantity: counts[i.productId] ?? i.quantity - i.receivedQuantity,
          }))
          .filter((i) => i.quantity > 0);
        write.mutate(
          {
            path: `/orders/${order.id}/receipts`,
            body: {
              items,
              effectiveAt: effective(when),
              version: order.version,
            },
          },
          { onSuccess: () => setCounts({}) },
        );
      }}
    >
      <h3>Xác nhận thực nhận</h3>
      <div className="form-grid">
        <Field label="Ngày giờ thực nhận (Việt Nam)">
          <input
            type="datetime-local"
            step="any"
            required
            value={when}
            max={nowLocal()}
            onChange={(e) => setWhen(e.target.value)}
          />
        </Field>
        {order.items
          .filter((i) => i.quantity > i.receivedQuantity)
          .map((i) => (
            <Field key={i.productId} label={i.productName}>
              <input
                type="number"
                min="0"
                max={i.quantity - i.receivedQuantity}
                step="1"
                value={counts[i.productId] ?? i.quantity - i.receivedQuantity}
                onChange={(e) =>
                  setCounts({
                    ...counts,
                    [i.productId]: Number(e.target.value),
                  })
                }
              />
            </Field>
          ))}
      </div>
      <button disabled={write.isPending}>Ghi nhận số thực nhận</button>
      <MutationStatus pending={write.isPending} error={write.error} />
    </form>
  );
}
