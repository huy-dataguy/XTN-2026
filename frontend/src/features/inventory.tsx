import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../shared/api";
import type { Inventory, Product, User, Warehouse } from "../shared/types";
import {
  Badge,
  Dialog,
  EmptyState,
  ErrorNotice,
  Field,
  MutationStatus,
  Segmented,
  StatCard,
  date,
  money,
  useWrite,
} from "../shared/ui";

export default function InventoryPage({ user }: { user: User }) {
  const query = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api<Inventory>("/inventory"),
  });
  const isAdmin = user.role === "ADMIN";
  const [tab, setTab] = useState<"products" | "lots">("products");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<Warehouse | null>(null);
  const data = query.data;
  const term = search.trim().toLowerCase();
  const products = useMemo(
    () =>
      (data?.warehouse || []).filter(
        (item) => !term || item.name.toLowerCase().includes(term),
      ),
    [data, term],
  );
  const lots = useMemo(
    () =>
      (data?.lots || []).filter(
        (item) => !term || item.productName.toLowerCase().includes(term),
      ),
    [data, term],
  );
  const totals = (data?.warehouse || []).reduce(
    (sum, item) => ({
      sellable: sum.sellable + (item.sellable || 0),
      damaged: sum.damaged + item.damagedOnHand,
      reserved: sum.reserved + item.reserved,
      physical: sum.physical + (item.physical || 0),
    }),
    { sellable: 0, damaged: 0, reserved: 0, physical: 0 },
  );

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{isAdmin ? "Kho & sản phẩm" : "Hàng đang giữ"}</h1>
          <p>
            {isAdmin
              ? "Theo dõi hàng tốt, hàng hư và lượng đang giữ."
              : "Số lượng đang giữ theo từng đợt nhận."}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="btn primary"
            onClick={() => setCreating(true)}
          >
            Thêm sản phẩm
          </button>
        )}
      </header>

      {query.error && <ErrorNotice error={query.error} />}

      <div className="stat-grid">
        <StatCard
          label="Hàng tốt"
          value={query.data ? String(totals.sellable) : "—"}
          icon="inventory"
        />
        <StatCard
          label="Hàng hư"
          value={query.data ? String(totals.damaged) : "—"}
          icon="alert"
          tone="amber"
        />
        <StatCard
          label="Đang giữ"
          value={query.data ? String(totals.reserved) : "—"}
          icon="orders"
          tone="blue"
        />
        <StatCard
          label="Tồn vật lý"
          value={query.data ? String(totals.physical) : "—"}
          icon="finance"
          tone="gray"
        />
      </div>

      <section className="panel">
        <div className="toolbar">
          <Segmented
            value={tab}
            onChange={setTab}
            items={[
              { value: "products", label: "Sản phẩm" },
              { value: "lots", label: "Lô nhập" },
            ]}
          />
          <div className="search-box compact">
            <input
              placeholder="Tìm sản phẩm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Tìm sản phẩm"
            />
          </div>
        </div>

        {tab === "products" && (
          <div className="stock-list">
            {products.map((item) => (
              <div className="stock-row" key={item.id}>
                <div className="stock-name">
                  <strong>{item.name}</strong>
                  <small>
                    {item.needsMigration
                      ? "Cần đối soát"
                      : item.active
                        ? "Đang cấp"
                        : "Ngừng cấp"}
                  </small>
                </div>
                <div className="stock-metrics">
                  <span>
                    <b>{item.sellable ?? "—"}</b>
                    <small>Tốt</small>
                  </span>
                  <span>
                    <b>{item.damagedOnHand}</b>
                    <small>Hư</small>
                  </span>
                  <span>
                    <b>{item.available ?? "—"}</b>
                    <small>Khả dụng</small>
                  </span>
                  <span>
                    <b>{money(item.price)}</b>
                    <small>{isAdmin ? money(item.unitCost) : "Giá bán"}</small>
                  </span>
                </div>
                {isAdmin && !item.needsMigration && (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => setManaging(item)}
                  >
                    Quản lý
                  </button>
                )}
              </div>
            ))}
            {!products.length && !query.isPending && (
              <p className="muted">Chưa có sản phẩm phù hợp.</p>
            )}
          </div>
        )}

        {tab === "lots" && (
          <div className="stock-list">
            {lots.map((lot) => (
              <div className="stock-row" key={lot.id}>
                <div className="stock-name">
                  <strong>{lot.productName}</strong>
                  <small>Nhận {date(lot.effectiveAt)}</small>
                </div>
                <div className="stock-metrics">
                  <span>
                    <b>{lot.sellable}</b>
                    <small>Tốt</small>
                  </span>
                  <span>
                    <b>{lot.damaged}</b>
                    <small>Hư</small>
                  </span>
                  <span>
                    <b>{lot.physical}</b>
                    <small>Vật lý</small>
                  </span>
                  <span>
                    <b>{money(lot.price)}</b>
                    <small>{isAdmin ? money(lot.unitCost) : "Giá bán"}</small>
                  </span>
                </div>
              </div>
            ))}
            {!lots.length && !query.isPending && (
              <p className="muted">Chưa có lô hàng phù hợp.</p>
            )}
          </div>
        )}
      </section>

      {query.isPending && <p className="loading">Đang tải kho…</p>}
      {!query.isPending && !data?.warehouse.length && !data?.lots.length && (
        <EmptyState
          icon="inventory"
          title="Chưa có hàng trong kho"
          description={
            isAdmin
              ? "Thêm sản phẩm và tồn đầu để bắt đầu cấp hàng."
              : "Hàng sẽ xuất hiện sau khi yêu cầu cấp hàng được nhận."
          }
          action={
            isAdmin ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => setCreating(true)}
              >
                Thêm sản phẩm
              </button>
            ) : undefined
          }
        />
      )}

      {creating && <ProductDialog onClose={() => setCreating(false)} />}
      {managing && (
        <ManageDialog
          product={managing}
          onClose={() => setManaging(null)}
        />
      )}
    </>
  );
}

function ProductDialog({ onClose }: { onClose: () => void }) {
  const write = useWrite();
  const [form, setForm] = useState({
    name: "",
    price: 0,
    unitCost: "",
    openingStock: 0,
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Thêm sản phẩm"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="submit"
            form="product-form"
            className="btn primary"
            disabled={write.isPending}
          >
            Tạo sản phẩm
          </button>
        </>
      }
    >
      <form
        id="product-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          write.mutate(
            {
              path: "/products",
              body: {
                ...form,
                unitCost: form.unitCost === "" ? null : Number(form.unitCost),
              },
            },
            { onSuccess: onClose },
          );
        }}
      >
        <Field label="Tên sản phẩm">
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <div className="form-grid">
          <Field label="Giá bán (đ)">
            <input
              type="number"
              required
              min="0"
              step="1"
              value={form.price}
              onChange={(event) =>
                setForm({ ...form, price: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Giá vốn (đ)">
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Không bắt buộc"
              value={form.unitCost}
              onChange={(event) =>
                setForm({ ...form, unitCost: event.target.value })
              }
            />
          </Field>
          <Field label="Tồn tốt đầu kỳ">
            <input
              type="number"
              required
              min="0"
              step="1"
              value={form.openingStock}
              onChange={(event) =>
                setForm({ ...form, openingStock: Number(event.target.value) })
              }
            />
          </Field>
        </div>
        <MutationStatus pending={write.isPending} error={write.error} />
      </form>
    </Dialog>
  );
}

function ManageDialog({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const write = useWrite();
  const [price, setPrice] = useState(product.price);
  const [cost, setCost] = useState(product.unitCost?.toString() || "");
  const [reason, setReason] = useState("");
  const [delta, setDelta] = useState(0);
  const [damaged, setDamaged] = useState(0);
  const [giftGood, setGiftGood] = useState(0);
  const [giftDamaged, setGiftDamaged] = useState(0);

  return (
    <Dialog open onClose={onClose} title={product.name} wide>
      <section className="dialog-section">
        <div className="section-head">
          <h3>Giá & trạng thái</h3>
          <Badge tone={product.active ? "green" : "gray"}>
            {product.active ? "Đang cấp" : "Ngừng cấp"}
          </Badge>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            write.mutate(
              {
                path: `/products/${product.id}`,
                method: "PUT",
                body: { price, unitCost: cost === "" ? null : Number(cost) },
              },
              { onSuccess: onClose },
            );
          }}
        >
          <div className="form-grid">
            <Field label="Giá bán cho yêu cầu mới">
              <input
                type="number"
                min="0"
                step="1"
                value={price}
                onChange={(event) => setPrice(Number(event.target.value))}
              />
            </Field>
            <Field label="Giá vốn cho yêu cầu mới">
              <input
                type="number"
                min="0"
                step="1"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
              />
            </Field>
          </div>
          <div className="actions">
            <button className="btn primary" disabled={write.isPending}>
              Lưu giá
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={write.isPending}
              onClick={() =>
                write.mutate(
                  {
                    path: `/products/${product.id}`,
                    method: "PUT",
                    body: { active: !product.active },
                  },
                  { onSuccess: onClose },
                )
              }
            >
              {product.active ? "Ngừng cấp" : "Mở lại"}
            </button>
          </div>
        </form>
      </section>

      <section className="dialog-section">
        <h3>Điều chỉnh tồn</h3>
        <div className="form-grid">
          <Field label="Lý do">
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Nhập hoặc điều chỉnh"
            />
          </Field>
          <Field label="Thay đổi tồn tốt (+/−)">
            <input
              type="number"
              step="1"
              value={delta}
              onChange={(event) => setDelta(Number(event.target.value))}
            />
          </Field>
        </div>
        <button
          type="button"
          className="btn"
          disabled={write.isPending || !reason || !delta}
          onClick={() =>
            write.mutate(
              {
                path: `/products/${product.id}/adjust`,
                body: { delta, reason },
              },
              { onSuccess: onClose },
            )
          }
        >
          Ghi biến động tồn
        </button>
      </section>

      <section className="dialog-section">
        <h3>Ghi hư / tặng</h3>
        <div className="quantity-grid">
          {[
            ["Hư mới", damaged, setDamaged],
            ["Tặng tốt", giftGood, setGiftGood],
            ["Tặng hư", giftDamaged, setGiftDamaged],
          ].map(([label, value, setter]) => (
            <Field key={String(label)} label={String(label)}>
              <input
                type="number"
                min="0"
                step="1"
                value={value as number}
                onChange={(event) =>
                  (setter as (value: number) => void)(Number(event.target.value))
                }
              />
            </Field>
          ))}
        </div>
        <button
          type="button"
          className="btn"
          disabled={
            write.isPending || !reason || damaged + giftGood + giftDamaged === 0
          }
          onClick={() =>
            write.mutate(
              {
                path: `/products/${product.id}/activity`,
                body: { damaged, giftGood, giftDamaged, reason },
              },
              { onSuccess: onClose },
            )
          }
        >
          Ghi hư / tặng
        </button>
        <p className="fine-print">Dùng chung ô lý do ở phần điều chỉnh tồn.</p>
      </section>
      <MutationStatus pending={write.isPending} error={write.error} />
    </Dialog>
  );
}
