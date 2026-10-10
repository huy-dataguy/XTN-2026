import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../shared/api";
import type { Inventory, User, Product, Page } from "../shared/types";
import {
  Card,
  ErrorNotice,
  Field,
  money,
  date,
  useWrite,
  MutationStatus,
} from "../shared/ui";
export default function InventoryPage({ user }: { user: User }) {
  const query = useQuery({
      queryKey: ["inventory"],
      queryFn: () => api<Inventory>("/inventory"),
    }),
    write = useWrite();
  const [form, setForm] = useState({
    name: "",
    price: 0,
    unitCost: "",
    openingStock: 0,
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">HÀNG & GIÁ TRỊ</span>
          <h1>
            {user.role === "ADMIN"
              ? "Kho trung tâm & sản phẩm"
              : "Hàng đang giữ"}
          </h1>
          <p className="muted">
            Tách hàng tốt, hàng hư, hàng đã giữ và tồn vật lý.
          </p>
        </div>
      </div>
      {user.role === "ADMIN" && (
        <Card>
          <h2>Thêm sản phẩm và tồn đầu</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              write.mutate(
                {
                  path: "/products",
                  body: {
                    ...form,
                    unitCost:
                      form.unitCost === "" ? null : Number(form.unitCost),
                  },
                },
                {
                  onSuccess: () =>
                    setForm({
                      name: "",
                      price: 0,
                      unitCost: "",
                      openingStock: 0,
                    }),
                },
              );
            }}
          >
            <div className="form-grid">
              <Field label="Tên sản phẩm">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Giá bán (đ)">
                <input
                  type="number"
                  required
                  min="0"
                  step="1"
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Giá vốn mỗi sản phẩm (đ, có thể để trống)">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.unitCost}
                  onChange={(e) =>
                    setForm({ ...form, unitCost: e.target.value })
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
                  onChange={(e) =>
                    setForm({ ...form, openingStock: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            <button className="primary" disabled={write.isPending}>
              Tạo sản phẩm
            </button>
            <MutationStatus pending={write.isPending} error={write.error} />
          </form>
        </Card>
      )}
      {query.error && <ErrorNotice error={query.error} />}
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sản phẩm / đợt nhận</th>
                <th>Hàng tốt</th>
                <th>Hàng hư</th>
                <th>Vật lý</th>
                <th>Giữ / khả dụng</th>
                <th>Giá bán / vốn</th>
                {user.role === "ADMIN" && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {query.data?.warehouse.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <small>
                      {p.needsMigration
                        ? "Cần đối soát dữ liệu cũ"
                        : p.active
                          ? "Đang cấp"
                          : "Ngừng cấp"}
                    </small>
                  </td>
                  <td>{p.sellable ?? "—"}</td>
                  <td>{p.damagedOnHand}</td>
                  <td>{p.physical ?? "—"}</td>
                  <td>
                    {p.reserved} / {p.available ?? "—"}
                  </td>
                  <td>
                    {money(p.price)}
                    <small>{money(p.unitCost)}</small>
                  </td>
                  <td>{!p.needsMigration && <ProductActions product={p} />}</td>
                </tr>
              ))}
              {query.data?.lots.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.productName}</strong>
                    <small>Nhận {date(l.effectiveAt)}</small>
                  </td>
                  <td>{l.sellable}</td>
                  <td>{l.damaged}</td>
                  <td>{l.physical}</td>
                  <td>—</td>
                  <td>
                    {money(l.price)}
                    <small>{money(l.unitCost)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {query.data &&
          !query.data.lots.length &&
          !query.data.warehouse.length && <p>Chưa có hàng được ghi nhận.</p>}
      </Card>
    </>
  );
}
function ProductActions({ product }: { product: Product }) {
  const write = useWrite(),
    [expanded, setExpanded] = useState(false),
    [price, setPrice] = useState(product.price),
    [cost, setCost] = useState(product.unitCost?.toString() || ""),
    [delta, setDelta] = useState(0),
    [reason, setReason] = useState(""),
    [damaged, setDamaged] = useState(0),
    [giftGood, setGiftGood] = useState(0),
    [giftDamaged, setGiftDamaged] = useState(0);
  return (
    <>
      <button onClick={() => setExpanded(!expanded)}>Quản lý</button>
      {expanded && (
        <div className="inset">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              write.mutate({
                path: `/products/${product.id}`,
                method: "PUT",
                body: { price, unitCost: cost === "" ? null : Number(cost) },
              });
            }}
          >
            <Field label="Giá bán cho yêu cầu mới">
              <input
                type="number"
                min="0"
                step="1"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </Field>
            <Field label="Giá vốn cho yêu cầu mới">
              <input
                type="number"
                min="0"
                step="1"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </Field>
            <button disabled={write.isPending}>Lưu giá</button>
          </form>
          <button
            disabled={write.isPending}
            onClick={() =>
              write.mutate({
                path: `/products/${product.id}`,
                method: "PUT",
                body: { active: !product.active },
              })
            }
          >
            {product.active ? "Ngừng cấp" : "Mở lại"}
          </button>
          <Field label="Lý do nhập/điều chỉnh/hư/tặng">
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label="Nhập thêm / điều chỉnh tồn tốt (+/−)">
            <input
              type="number"
              step="1"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
            />
          </Field>
          <button
            disabled={write.isPending || !reason || !delta}
            onClick={() =>
              write.mutate({
                path: `/products/${product.id}/adjust`,
                body: { delta, reason },
              })
            }
          >
            Ghi biến động tồn
          </button>
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
                onChange={(e) =>
                  (setter as (value: number) => void)(Number(e.target.value))
                }
              />
            </Field>
          ))}
          <button
            disabled={
              write.isPending ||
              !reason ||
              damaged + giftGood + giftDamaged === 0
            }
            onClick={() =>
              write.mutate({
                path: `/products/${product.id}/activity`,
                body: { damaged, giftGood, giftDamaged, reason },
              })
            }
          >
            Ghi hư / tặng
          </button>
          <MutationStatus pending={write.isPending} error={write.error} />
        </div>
      )}
    </>
  );
}
export function useProducts() {
  return useQuery({
    queryKey: ["products", "all"],
    queryFn: () => api<Page<Product>>("/products?limit=200"),
  });
}
