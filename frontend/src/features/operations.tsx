import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../shared/api";
import type { Page, Task, Statement, Tag } from "../shared/types";
import {
  Card,
  ErrorNotice,
  Field,
  money,
  date,
  nowLocal,
  effective,
  useWrite,
  MutationStatus,
  PageControls,
  useOffset,
} from "../shared/ui";
export function Finance() {
  const [offset, setOffset] = useOffset();
  const [tagId, setTagId] = useState("");
  const [tagName, setTagName] = useState("");
  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => api<Page<Tag>>("/tags?limit=200"),
  });
  const query = useQuery({
      queryKey: ["statements", offset, tagId],
      queryFn: () =>
        api<Page<Statement>>(`/statements?offset=${offset}&tagId=${tagId}`),
    }),
    write = useWrite();
  const summary = useQuery({
    queryKey: ["cash-summary", tagId],
    queryFn: () =>
      api<{ cashIn: number; cashOut: number; netCashFlow: number }>(
        `/cash/summary?tagId=${tagId}`,
      ),
  });
  const [form, setForm] = useState({
    when: nowLocal(),
    type: "IN",
    amount: 0,
    partnerName: "",
    reference: "",
    description: "",
    tags: [] as string[],
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DÒNG TIỀN</span>
          <h1>Giao dịch thu / chi</h1>
          <p className="muted">
            Dòng tiền khác doanh thu và lợi nhuận. Không dùng thu − chi làm số
            dư ngân hàng.
          </p>
        </div>
      </div>
      <Card>
        <h2>Nhãn giao dịch</h2>
        <p className="muted">
          Một giao dịch có thể có nhiều nhãn. Không cộng tổng các nhãn với nhau.
        </p>
        <Field label="Lọc theo nhãn">
          <select
            value={tagId}
            onChange={(e) => {
              setTagId(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Tất cả</option>
            {tags.data?.items.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </Field>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            write.mutate(
              { path: "/tags", body: { name: tagName } },
              { onSuccess: () => setTagName("") },
            );
          }}
        >
          <Field label="Tên nhãn mới">
            <input
              required
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
            />
          </Field>
          <button disabled={write.isPending}>Tạo nhãn</button>
        </form>
        {tags.error && <ErrorNotice error={tags.error} />}
      </Card>
      {summary.data && (
        <div className="stat-grid">
          {[
            ["Tiền vào", money(summary.data.cashIn)],
            ["Tiền ra", money(summary.data.cashOut)],
            ["Dòng tiền thuần", money(summary.data.netCashFlow)],
          ].map(([label, value]) => (
            <Card key={label}>
              <p>{label}</p>
              <strong className="stat-value">{value}</strong>
            </Card>
          ))}
        </div>
      )}
      {summary.error && <ErrorNotice error={summary.error} />}
      <Card>
        <h2>Ghi giao dịch</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const { when, ...values } = form;
            write.mutate(
              {
                path: "/statements",
                body: { ...values, transactionDate: effective(when) },
              },
              {
                onSuccess: () =>
                  setForm({
                    ...form,
                    amount: 0,
                    partnerName: "",
                    reference: "",
                    description: "",
                  }),
              },
            );
          }}
        >
          <div className="form-grid">
            <Field label="Ngày giờ giao dịch">
              <input
                type="datetime-local"
                step="any"
                required
                value={form.when}
                onChange={(e) => setForm({ ...form, when: e.target.value })}
              />
            </Field>
            <Field label="Loại">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="IN">Thu</option>
                <option value="OUT">Chi</option>
              </select>
            </Field>
            <Field label="Số tiền (đ)">
              <input
                type="number"
                min="1"
                step="1"
                required
                value={form.amount}
                onChange={(e) =>
                  setForm({ ...form, amount: Number(e.target.value) })
                }
              />
            </Field>
            {(["partnerName", "reference", "description"] as const).map(
              (key, i) => (
                <Field
                  key={key}
                  label={["Đối tác", "Mã giao dịch duy nhất", "Nội dung"][i]}
                >
                  <input
                    required={key !== "description"}
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </Field>
              ),
            )}
          </div>
          <Field label="Nhãn giao dịch">
            <select
              multiple
              value={form.tags}
              onChange={(e) =>
                setForm({
                  ...form,
                  tags: Array.from(e.target.selectedOptions, (o) => o.value),
                })
              }
            >
              {tags.data?.items.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </Field>
          <button className="primary" disabled={write.isPending}>
            Ghi giao dịch
          </button>
        </form>
      </Card>
      {query.error && <ErrorNotice error={query.error} />}
      <Card>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Bảng dữ liệu, cuộn ngang để xem đầy đủ"
        >
          <table>
            <thead>
              <tr>
                <th>Ngày / mã</th>
                <th>Đối tác</th>
                <th>Số tiền</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {date(item.transactionDate)}
                    <small>{item.reference}</small>
                  </td>
                  <td>
                    {item.partnerName}
                    <small>{item.description}</small>
                    <small>
                      {item.tags
                        ?.map(
                          (id) =>
                            tags.data?.items.find((t) => t.id === id)?.name ||
                            "Nhãn lưu trữ",
                        )
                        .join(", ")}
                    </small>
                  </td>
                  <td>
                    {item.type === "IN" ? "+" : "−"}
                    {money(item.amount)}
                  </td>
                  <td>
                    <button
                      disabled={write.isPending}
                      onClick={() => {
                        const reason = prompt("Lý do hủy hiệu lực giao dịch");
                        if (reason)
                          write.mutate({
                            path: `/statements/${item.id}/void`,
                            body: { reason },
                          });
                      }}
                    >
                      Hủy hiệu lực
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
export function Tasks() {
  const [offset, setOffset] = useOffset();
  const query = useQuery({
      queryKey: ["tasks", offset],
      queryFn: () => api<Page<Task>>(`/tasks?offset=${offset}`),
    }),
    write = useWrite();
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM"),
    [dueDate, setDueDate] = useState("");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">VẬN HÀNH NỘI BỘ</span>
          <h1>Công việc</h1>
        </div>
      </div>
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            write.mutate(
              {
                path: "/tasks",
                body: {
                  title,
                  description,
                  priority,
                  dueDate: dueDate
                    ? new Date(`${dueDate}T23:59:59+07:00`).toISOString()
                    : null,
                },
              },
              {
                onSuccess: () => {
                  setTitle("");
                  setDescription("");
                },
              },
            );
          }}
        >
          <Field label="Tên công việc">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Nội dung">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="Ưu tiên">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="LOW">Thấp</option>
              <option value="MEDIUM">Vừa</option>
              <option value="HIGH">Cao</option>
            </select>
          </Field>
          <Field label="Hạn hoàn thành">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>
          <button className="primary" disabled={write.isPending}>
            Tạo công việc
          </button>
        </form>
      </Card>
      {query.error && <ErrorNotice error={query.error} />}
      <div className="kanban">
        {(["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const).map(
          (status, index) => (
            <section key={status}>
              <h2>{["Cần làm", "Đang làm", "Kiểm tra", "Hoàn tất"][index]}</h2>
              {query.data?.items
                .filter((task) => task.status === status)
                .map((task) => (
                  <Card key={task.id}>
                    <h3>{task.title}</h3>
                    <p>{task.description}</p>
                    <small>
                      {task.priority}
                      {task.dueDate ? ` · ${date(task.dueDate)}` : ""}
                    </small>
                    <Field label="Trạng thái">
                      <select
                        disabled={write.isPending}
                        value={task.status}
                        onChange={(e) =>
                          write.mutate({
                            path: `/tasks/${task.id}`,
                            method: "PUT",
                            body: { status: e.target.value },
                          })
                        }
                      >
                        {["TODO", "IN_PROGRESS", "REVIEW", "DONE"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </Field>
                    <button
                      disabled={write.isPending}
                      onClick={() =>
                        write.mutate({
                          path: `/tasks/${task.id}`,
                          method: "PUT",
                          body: { status: task.status, active: false },
                        })
                      }
                    >
                      Lưu trữ
                    </button>
                  </Card>
                ))}
            </section>
          ),
        )}
      </div>
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
