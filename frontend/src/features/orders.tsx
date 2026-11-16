import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../shared/api";
import type { Order, Page, Product, User } from "../shared/types";
import {
  Badge,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorNotice,
  Field,
  Icon,
  MutationStatus,
  PageControls,
  date,
  effective,
  money,
  monday,
  nowLocal,
  orderStatus,
  useOffset,
  useWrite,
} from "../shared/ui";

const fetchProducts = () => api<Page<Product>>("/products?limit=200");

export default function Orders({ user }: { user: User }) {
  const [offset, setOffset] = useOffset();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [receiving, setReceiving] = useState<Order | null>(null);
  const [canceling, setCanceling] = useState<Order | null>(null);
  const query = useQuery({
    queryKey: ["orders", offset],
    queryFn: () => api<Page<Order>>(`/orders?offset=${offset}`),
  });
  const catalog = useQuery({
    queryKey: ["products", "picker"],
    queryFn: fetchProducts,
    enabled: user.role !== "ADMIN",
  });
  const write = useWrite();
  const isAdmin = user.role === "ADMIN";
  const available = useMemo(
    () =>
      (catalog.data?.items || []).filter(
        (product) => product.active && !product.needsMigration,
      ),
    [catalog.data],
  );

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Đơn cấp hàng</h1>
          <p>Theo dõi yêu cầu và xác nhận hàng thực nhận.</p>
        </div>
        {user.role === "DISTRIBUTOR" && (
          <button
            type="button"
            className="btn primary"
            onClick={() => setCreating(true)}
          >
            <Icon name="plus" size={17} /> Tạo yêu cầu
          </button>
        )}
      </header>

      {query.error && <ErrorNotice error={query.error} />}
      {query.isPending && <p className="loading">Đang tải đơn hàng…</p>}

      {!isAdmin && (
        <section className="panel catalog-panel">
          <div className="section-head">
            <div>
              <h2>Danh mục sản phẩm</h2>
              <small>Sản phẩm đang cấp tại kho trung tâm.</small>
            </div>
            {catalog.data && (
              <Badge tone="green">{available.length} sản phẩm</Badge>
            )}
          </div>
          {catalog.error && <ErrorNotice error={catalog.error} />}
          {catalog.isPending && <p className="loading">Đang tải sản phẩm…</p>}
          {!catalog.isPending && !available.length && (
            <p className="muted">Chưa có sản phẩm đang cấp.</p>
          )}
          <div className="catalog-grid">
            {available.map((product) => (
              <article className="catalog-card" key={product.id}>
                {product.image ? (
                  <img
                    className="catalog-image"
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span
                    className="catalog-image placeholder"
                    aria-hidden="true"
                  >
                    <Icon name="inventory" size={22} />
                  </span>
                )}
                <strong>{product.name}</strong>
                <small>{money(product.price)}</small>
                <small className="catalog-stock">
                  Còn {product.stock ?? "—"}
                </small>
              </article>
            ))}
          </div>
        </section>
      )}

      {query.data && !query.data.items.length && (
        <EmptyState
          icon="orders"
          title="Chưa có yêu cầu cấp hàng"
          description={
            user.role === "DISTRIBUTOR"
              ? "Tạo yêu cầu đầu tiên để giữ hàng từ kho trung tâm."
              : "Yêu cầu từ thành viên sẽ xuất hiện tại đây."
          }
          action={
            user.role === "DISTRIBUTOR" ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => setCreating(true)}
              >
                Tạo yêu cầu
              </button>
            ) : undefined
          }
        />
      )}

      <div className="card-list">
        {query.data?.items.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            isAdmin={isAdmin}
            onEdit={() => setEditing(order)}
            onReceive={() => setReceiving(order)}
            onCancel={() => setCanceling(order)}
          />
        ))}
      </div>

      {!!query.data?.items.length && (
        <PageControls
          offset={offset}
          hasMore={query.data.hasMore}
          onChange={setOffset}
        />
      )}

      {(creating || editing) && (
        <OrderDialog
          key={editing?.id || "new"}
          editing={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {receiving && (
        <ReceiptDialog
          order={receiving}
          onClose={() => setReceiving(null)}
        />
      )}

      <ConfirmDialog
        open={!!canceling}
        title="Hủy phần chưa nhận?"
        description="Phần hàng chưa thực nhận sẽ được trả lại kho. Thao tác này không thể hoàn tác."
        confirmLabel="Hủy phần chưa nhận"
        danger
        pending={write.isPending}
        onClose={() => setCanceling(null)}
        onConfirm={() => {
          if (!canceling) return;
          write.mutate(
            {
              path: `/orders/${canceling.id}/status`,
              method: "PUT",
              body: { status: "CANCELLED", version: canceling.version },
            },
            { onSuccess: () => setCanceling(null) },
          );
        }}
      />
      <MutationStatus pending={write.isPending} error={write.error} />
    </>
  );
}

function OrderCard({
  order,
  isAdmin,
  onEdit,
  onReceive,
  onCancel,
}: {
  order: Order;
  isAdmin: boolean;
  onEdit: () => void;
  onReceive: () => void;
  onCancel: () => void;
}) {
  const write = useWrite();
  const status = orderStatus[order.status] || {
    label: order.status,
    tone: "gray" as const,
  };
  const canReceive = ["APPROVED", "PARTIALLY_RECEIVED"].includes(order.status);
  const received = order.items.reduce(
    (sum, item) => sum + item.receivedQuantity,
    0,
  );
  const requested = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <article className="order-card">
      <div className="order-top">
        <div>
          <Badge tone={status.tone}>{status.label}</Badge>
          <span className="period-chip">Tuần {order.intendedPeriodId}</span>
        </div>
        <span className="order-date">{date(order.createdAt)}</span>
      </div>
      <div className="order-main">
        <div>
          <h2>{isAdmin ? order.memberName : "Yêu cầu cấp hàng"}</h2>
          <p>
            {order.items.length} sản phẩm · đã nhận {received}/{requested}
          </p>
        </div>
        <strong className="order-total">{money(order.totalAmount)}</strong>
      </div>

      <details className="order-details">
        <summary>
          Chi tiết sản phẩm <Icon name="down" size={16} />
        </summary>
        <div className="line-list">
          {order.items.map((item) => (
            <div className="line-row" key={item.productId}>
              <span>
                <strong>{item.productName}</strong>
                <small>{money(item.price)} / sản phẩm</small>
              </span>
              <span>
                {item.receivedQuantity}/{item.quantity}
                <small>đã nhận</small>
              </span>
            </div>
          ))}
        </div>
      </details>

      <div className="order-actions">
        {isAdmin && order.status === "PENDING" && (
          <>
            <button
              type="button"
              className="btn sm primary"
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
              type="button"
              className="btn sm"
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
        {order.status === "PENDING" && (
          <button type="button" className="btn sm ghost" onClick={onEdit}>
            Sửa yêu cầu
          </button>
        )}
        {canReceive && (
          <button type="button" className="btn sm primary" onClick={onReceive}>
            Xác nhận nhận hàng
          </button>
        )}
        {["PENDING", "APPROVED", "PARTIALLY_RECEIVED"].includes(
          order.status,
        ) && (
          <button type="button" className="btn sm ghost danger-text" onClick={onCancel}>
            Hủy phần chưa nhận
          </button>
        )}
        <MutationStatus pending={write.isPending} error={write.error} />
      </div>
    </article>
  );
}

function OrderDialog({
  editing,
  onClose,
}: {
  editing: Order | null;
  onClose: () => void;
}) {
  const products = useQuery({
    queryKey: ["products", "picker"],
    queryFn: fetchProducts,
  });
  const [search, setSearch] = useState("");
  const [week, setWeek] = useState(editing?.intendedPeriodId || monday());
  const [cart, setCart] = useState<Record<string, number>>(
    Object.fromEntries(editing?.items.map((item) => [item.productId, item.quantity]) || []),
  );
  const write = useWrite();
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (products.data?.items || []).filter(
      (product) =>
        product.active &&
        !product.needsMigration &&
        (!term || product.name.toLowerCase().includes(term)),
    );
  }, [products.data, search]);
  const count = Object.values(cart).filter((value) => value > 0).length;
  const byId = new Map((products.data?.items || []).map((item) => [item.id, item]));
  const total = Object.entries(cart).reduce(
    (sum, [id, quantity]) => sum + (byId.get(id)?.price || 0) * quantity,
    0,
  );

  const setQuantity = (id: string, value: number) =>
    setCart((prev) => ({ ...prev, [id]: Math.max(0, value) }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const items = Object.entries(cart)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    write.mutate(
      {
        path: editing ? `/orders/${editing.id}` : "/orders",
        method: editing ? "PUT" : "POST",
        body: editing
          ? { items, version: editing.version }
          : { items, intendedPeriodId: week },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? "Sửa yêu cầu cấp hàng" : "Tạo yêu cầu cấp hàng"}
      wide
      footer={
        <div className="dialog-submit">
          <span>
            <strong>{count}</strong> sản phẩm
            <small>{money(total)}</small>
          </span>
          <button
            type="submit"
            form="order-form"
            className="btn primary"
            disabled={write.isPending || count === 0}
          >
            {editing ? "Lưu yêu cầu" : "Gửi yêu cầu"}
          </button>
        </div>
      }
    >
      <form id="order-form" onSubmit={submit}>
        <Field label="Tuần dự kiến">
          <input
            type="date"
            required
            disabled={!!editing}
            value={week}
            onChange={(event) => setWeek(event.target.value)}
          />
        </Field>
        <div className="search-box">
          <Icon name="search" size={18} />
          <input
            placeholder="Tìm sản phẩm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Tìm sản phẩm"
          />
        </div>
        {products.error && <ErrorNotice error={products.error} />}
        {products.isPending && <p className="loading">Đang tải sản phẩm…</p>}
        <div className="picker-list">
          {visible.map((product) => {
            const quantity = cart[product.id] || 0;
            return (
              <div
                className={`picker-row${quantity ? " selected" : ""}`}
                key={product.id}
              >
                <div className="picker-main">
                  {product.image ? (
                    <img
                      className="picker-thumb"
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span
                      className="picker-thumb placeholder"
                      aria-hidden="true"
                    >
                      <Icon name="inventory" size={16} />
                    </span>
                  )}
                  <div className="picker-copy">
                    <strong>{product.name}</strong>
                    <small>
                      {money(product.price)} · còn {product.stock ?? "—"}
                    </small>
                  </div>
                </div>
                <div className="stepper">
                  <button
                    type="button"
                    aria-label={`Giảm ${product.name}`}
                    onClick={() => setQuantity(product.id, quantity - 1)}
                    disabled={quantity === 0}
                  >
                    <Icon name="minus" size={16} />
                  </button>
                  <input
                    aria-label={`Số lượng ${product.name}`}
                    type="number"
                    min="0"
                    max={product.stock ?? undefined}
                    step="1"
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(product.id, Number(event.target.value))
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Tăng ${product.name}`}
                    onClick={() => setQuantity(product.id, quantity + 1)}
                    disabled={
                      product.stock != null && quantity >= product.stock
                    }
                  >
                    <Icon name="plus" size={16} />
                  </button>
                </div>
              </div>
            );
          })}
          {!products.isPending && !visible.length && (
            <p className="muted">Không tìm thấy sản phẩm phù hợp.</p>
          )}
        </div>
        <MutationStatus pending={write.isPending} error={write.error} />
      </form>
    </Dialog>
  );
}

function ReceiptDialog({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const remaining = order.items.filter(
    (item) => item.quantity > item.receivedQuantity,
  );
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(
      remaining.map((item) => [
        item.productId,
        item.quantity - item.receivedQuantity,
      ]),
    ),
  );
  const [when, setWhen] = useState(nowLocal());
  const write = useWrite();
  const receiving = Object.values(counts).reduce(
    (sum, value) => sum + value,
    0,
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title="Xác nhận hàng thực nhận"
      footer={
        <div className="dialog-submit">
          <span>
            <strong>{receiving}</strong> sản phẩm
          </span>
          <button
            type="submit"
            form="receipt-form"
            className="btn primary"
            disabled={write.isPending || receiving === 0}
          >
            Ghi nhận
          </button>
        </div>
      }
    >
      <form
        id="receipt-form"
        onSubmit={(event) => {
          event.preventDefault();
          const items = remaining
            .map((item) => ({
              productId: item.productId,
              quantity: counts[item.productId] ?? 0,
            }))
            .filter((item) => item.quantity > 0);
          write.mutate(
            {
              path: `/orders/${order.id}/receipts`,
              body: {
                items,
                effectiveAt: effective(when),
                version: order.version,
              },
            },
            { onSuccess: onClose },
          );
        }}
      >
        <Field label="Thời điểm thực nhận (Việt Nam)">
          <input
            type="datetime-local"
            step="any"
            required
            value={when}
            max={nowLocal()}
            onChange={(event) => setWhen(event.target.value)}
          />
        </Field>
        <div className="picker-list">
          {remaining.map((item) => {
            const max = item.quantity - item.receivedQuantity;
            const value = counts[item.productId] ?? max;
            return (
              <div className="picker-row" key={item.productId}>
                <div className="picker-copy">
                  <strong>{item.productName}</strong>
                  <small>
                    Còn lại {max} · {money(item.price)}
                  </small>
                </div>
                <div className="stepper">
                  <button
                    type="button"
                    aria-label={`Giảm ${item.productName}`}
                    onClick={() =>
                      setCounts({
                        ...counts,
                        [item.productId]: Math.max(0, value - 1),
                      })
                    }
                    disabled={value === 0}
                  >
                    <Icon name="minus" size={16} />
                  </button>
                  <input
                    aria-label={`Thực nhận ${item.productName}`}
                    type="number"
                    min="0"
                    max={max}
                    step="1"
                    value={value}
                    onChange={(event) =>
                      setCounts({
                        ...counts,
                        [item.productId]: Math.min(
                          max,
                          Math.max(0, Number(event.target.value)),
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Tăng ${item.productName}`}
                    onClick={() =>
                      setCounts({
                        ...counts,
                        [item.productId]: Math.min(max, value + 1),
                      })
                    }
                    disabled={value >= max}
                  >
                    <Icon name="plus" size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <MutationStatus pending={write.isPending} error={write.error} />
      </form>
    </Dialog>
  );
}
