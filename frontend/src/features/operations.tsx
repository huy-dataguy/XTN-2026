import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../shared/api";
import type { Page, Statement, Tag, Task } from "../shared/types";
import {
  Badge,
  Dialog,
  ErrorNotice,
  Field,
  Icon,
  MutationStatus,
  PageControls,
  ReasonDialog,
  Segmented,
  StatCard,
  date,
  effective,
  money,
  nowLocal,
  priorityLabel,
  taskStatus,
  useOffset,
  useWrite,
} from "../shared/ui";

export function Finance() {
  const [offset, setOffset] = useOffset();
  const [tagId, setTagId] = useState("");
  const [creating, setCreating] = useState(false);
  const [managingTags, setManagingTags] = useState(false);
  const [voiding, setVoiding] = useState<Statement | null>(null);
  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => api<Page<Tag>>("/tags?limit=200"),
  });
  const query = useQuery({
    queryKey: ["statements", offset, tagId],
    queryFn: () =>
      api<Page<Statement>>(`/statements?offset=${offset}&tagId=${tagId}`),
  });
  const summary = useQuery({
    queryKey: ["cash-summary", tagId],
    queryFn: () =>
      api<{ cashIn: number; cashOut: number; netCashFlow: number }>(
        `/cash/summary?tagId=${tagId}`,
      ),
  });
  const write = useWrite();
  const tagName = (id: string) =>
    tags.data?.items.find((tag) => tag.id === id)?.name || "Nhãn lưu trữ";

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Thu / chi</h1>
          <p>Theo dõi dòng tiền độc lập với doanh thu và lợi nhuận.</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setManagingTags(true)}
          >
            Nhãn
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => setCreating(true)}
          >
            <Icon name="plus" size={17} /> Ghi giao dịch
          </button>
        </div>
      </header>

      <div className="stat-grid three">
        <StatCard
          label="Tiền vào"
          value={summary.data ? money(summary.data.cashIn) : "—"}
          icon="wallet-in"
        />
        <StatCard
          label="Tiền ra"
          value={summary.data ? money(summary.data.cashOut) : "—"}
          icon="wallet-out"
          tone="amber"
        />
        <StatCard
          label="Dòng tiền thuần"
          value={summary.data ? money(summary.data.netCashFlow) : "—"}
          icon="finance"
          tone="blue"
        />
      </div>
      {summary.error && <ErrorNotice error={summary.error} />}

      <section className="panel">
        <div className="chip-row" role="tablist" aria-label="Lọc theo nhãn">
          <button
            type="button"
            className={`chip${tagId === "" ? " active" : ""}`}
            onClick={() => {
              setTagId("");
              setOffset(0);
            }}
          >
            Tất cả
          </button>
          {tags.data?.items.map((tag) => (
            <button
              type="button"
              key={tag.id}
              className={`chip${tagId === tag.id ? " active" : ""}`}
              onClick={() => {
                setTagId(tag.id);
                setOffset(0);
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>

        {query.error && <ErrorNotice error={query.error} />}
        <div className="statement-list">
          {query.data?.items.map((item) => (
            <div className="statement-row" key={item.id}>
              <span className={`tx-icon ${item.type.toLowerCase()}`}>
                <Icon
                  name={item.type === "IN" ? "wallet-in" : "wallet-out"}
                  size={18}
                />
              </span>
              <div className="member-copy">
                <strong>{item.partnerName}</strong>
                <small>
                  {date(item.transactionDate)} · {item.reference}
                </small>
                {item.description && <small>{item.description}</small>}
                {!!item.tags?.length && (
                  <span className="tag-list">
                    {item.tags.map((id) => (
                      <span key={id}>{tagName(id)}</span>
                    ))}
                  </span>
                )}
              </div>
              <strong className={`amount ${item.type.toLowerCase()}`}>
                {item.type === "IN" ? "+" : "−"}
                {money(item.amount)}
              </strong>
              <button
                type="button"
                className="icon-btn"
                title="Hủy hiệu lực"
                aria-label={`Hủy giao dịch ${item.reference}`}
                onClick={() => setVoiding(item)}
              >
                <Icon name="archive" size={17} />
              </button>
            </div>
          ))}
          {!query.data?.items.length && !query.isPending && (
            <p className="muted">Chưa có giao dịch trong bộ lọc này.</p>
          )}
        </div>
        {!!query.data?.items.length && (
          <PageControls
            offset={offset}
            hasMore={query.data.hasMore}
            onChange={setOffset}
          />
        )}
      </section>

      {query.isPending && <p className="loading">Đang tải giao dịch…</p>}
      {tags.isPending && <p className="loading">Đang tải nhãn…</p>}
      {creating && (
        <TransactionDialog
          tags={tags.data?.items || []}
          onClose={() => setCreating(false)}
        />
      )}
      {managingTags && (
        <TagsDialog
          tags={tags.data?.items || []}
          onClose={() => setManagingTags(false)}
        />
      )}
      <ReasonDialog
        key={voiding?.id || "closed"}
        open={!!voiding}
        title="Hủy hiệu lực giao dịch"
        label="Lý do hủy"
        confirmLabel="Hủy hiệu lực"
        pending={write.isPending}
        onClose={() => setVoiding(null)}
        onSubmit={(reason) => {
          if (!voiding) return;
          write.mutate(
            {
              path: `/statements/${voiding.id}/void`,
              body: { reason },
            },
            { onSuccess: () => setVoiding(null) },
          );
        }}
      />
      <MutationStatus pending={write.isPending} error={write.error} />
    </>
  );
}

function TransactionDialog({
  tags,
  onClose,
}: {
  tags: Tag[];
  onClose: () => void;
}) {
  const write = useWrite();
  const [form, setForm] = useState({
    when: nowLocal(),
    type: "IN",
    amount: 0,
    partnerName: "",
    reference: "",
    description: "",
    tags: [] as string[],
  });
  const toggleTag = (id: string) =>
    setForm({
      ...form,
      tags: form.tags.includes(id)
        ? form.tags.filter((tag) => tag !== id)
        : [...form.tags, id],
    });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Ghi giao dịch"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="submit"
            form="transaction-form"
            className="btn primary"
            disabled={write.isPending}
          >
            Ghi giao dịch
          </button>
        </>
      }
    >
      <form
        id="transaction-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          const { when, ...values } = form;
          write.mutate(
            {
              path: "/statements",
              body: { ...values, transactionDate: effective(when) },
            },
            { onSuccess: onClose },
          );
        }}
      >
        <Segmented
          value={form.type}
          onChange={(type) => setForm({ ...form, type })}
          items={[
            { value: "IN", label: "Tiền vào" },
            { value: "OUT", label: "Tiền ra" },
          ]}
        />
        <div className="form-grid">
          <Field label="Số tiền (đ)">
            <input
              type="number"
              min="1"
              step="1"
              required
              value={form.amount}
              onChange={(event) =>
                setForm({ ...form, amount: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Ngày giờ giao dịch">
            <input
              type="datetime-local"
              step="any"
              required
              value={form.when}
              onChange={(event) => setForm({ ...form, when: event.target.value })}
            />
          </Field>
          <Field label="Đối tác">
            <input
              required
              value={form.partnerName}
              onChange={(event) =>
                setForm({ ...form, partnerName: event.target.value })
              }
            />
          </Field>
          <Field label="Mã giao dịch duy nhất">
            <input
              required
              value={form.reference}
              onChange={(event) =>
                setForm({ ...form, reference: event.target.value })
              }
            />
          </Field>
        </div>
        <Field label="Nội dung">
          <input
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </Field>
        <Field label="Nhãn">
          <div className="tag-picker">
            {tags.map((tag) => (
              <button
                type="button"
                key={tag.id}
                className={`chip${form.tags.includes(tag.id) ? " active" : ""}`}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </button>
            ))}
            {!tags.length && <span className="muted">Chưa có nhãn.</span>}
          </div>
        </Field>
        <p className="fine-print">
          Thu − chi không phải số dư ngân hàng. Không cộng tổng các nhãn với nhau.
        </p>
        <MutationStatus pending={write.isPending} error={write.error} />
      </form>
    </Dialog>
  );
}

function TagsDialog({ tags, onClose }: { tags: Tag[]; onClose: () => void }) {
  const write = useWrite();
  const [name, setName] = useState("");
  return (
    <Dialog open onClose={onClose} title="Nhãn giao dịch">
      <div className="tag-picker">
        {tags.map((tag) => (
          <span className="chip static" key={tag.id}>
            {tag.name}
          </span>
        ))}
        {!tags.length && <span className="muted">Chưa có nhãn.</span>}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          write.mutate(
            { path: "/tags", body: { name } },
            { onSuccess: () => setName("") },
          );
        }}
      >
        <Field label="Tên nhãn mới">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <button className="btn primary" disabled={write.isPending}>
          Tạo nhãn
        </button>
        <MutationStatus pending={write.isPending} error={write.error} />
      </form>
    </Dialog>
  );
}

const columns = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;

export function Tasks() {
  const [offset, setOffset] = useOffset();
  const [creating, setCreating] = useState(false);
  const [mobileStatus, setMobileStatus] =
    useState<(typeof columns)[number]>("TODO");
  const query = useQuery({
    queryKey: ["tasks", offset],
    queryFn: () => api<Page<Task>>(`/tasks?offset=${offset}`),
  });
  const write = useWrite();
  const items = useMemo(() => query.data?.items || [], [query.data]);
  const visible = items.filter((task) => task.status === mobileStatus);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Công việc</h1>
          <p>Theo dõi việc vận hành nội bộ theo trạng thái.</p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => setCreating(true)}
        >
          <Icon name="plus" size={17} /> Tạo công việc
        </button>
      </header>

      {query.error && <ErrorNotice error={query.error} />}
      <div className="mobile-only">
        <Segmented
          value={mobileStatus}
          onChange={setMobileStatus}
          items={columns.map((status) => ({
            value: status,
            label: taskStatus[status].label,
          }))}
        />
      </div>

      <div className="kanban kanban-desktop">
        {columns.map((status) => (
          <section key={status} className="kanban-column">
            <header>
              <h2>{taskStatus[status].label}</h2>
              <span>
                {items.filter((task) => task.status === status).length}
              </span>
            </header>
            {items
              .filter((task) => task.status === status)
              .map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            {!items.some((task) => task.status === status) && (
              <p className="kanban-empty">Chưa có việc.</p>
            )}
          </section>
        ))}
      </div>

      <div className="task-list kanban-mobile">
        {visible.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {!visible.length && !query.isPending && (
          <p className="muted">Chưa có công việc trong trạng thái này.</p>
        )}
      </div>

      {query.isPending && <p className="loading">Đang tải công việc…</p>}
      {!!query.data?.items.length && (
        <PageControls
          offset={offset}
          hasMore={query.data.hasMore}
          onChange={setOffset}
        />
      )}
      {creating && <TaskDialog onClose={() => setCreating(false)} />}
      <MutationStatus pending={write.isPending} error={write.error} />
    </>
  );
}

function TaskCard({ task }: { task: Task }) {
  const write = useWrite();
  const priority = priorityLabel[task.priority] || {
    label: task.priority,
    tone: "gray" as const,
  };
  return (
    <article className="task-card">
      <div className="task-top">
        <Badge tone={priority.tone}>{priority.label}</Badge>
        {task.dueDate && <small>{date(task.dueDate)}</small>}
      </div>
      <h3>{task.title}</h3>
      {task.description && <p>{task.description}</p>}
      <div className="task-actions">
        <select
          aria-label="Trạng thái công việc"
          value={task.status}
          disabled={write.isPending}
          onChange={(event) =>
            write.mutate({
              path: `/tasks/${task.id}`,
              method: "PUT",
              body: { status: event.target.value },
            })
          }
        >
          {columns.map((status) => (
            <option key={status} value={status}>
              {taskStatus[status].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="icon-btn"
          aria-label="Lưu trữ công việc"
          title="Lưu trữ"
          disabled={write.isPending}
          onClick={() =>
            write.mutate({
              path: `/tasks/${task.id}`,
              method: "PUT",
              body: { status: task.status, active: false },
            })
          }
        >
          <Icon name="archive" size={16} />
        </button>
      </div>
      <MutationStatus pending={write.isPending} error={write.error} />
    </article>
  );
}

function TaskDialog({ onClose }: { onClose: () => void }) {
  const write = useWrite();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  return (
    <Dialog
      open
      onClose={onClose}
      title="Tạo công việc"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="submit"
            form="task-form"
            className="btn primary"
            disabled={write.isPending}
          >
            Tạo công việc
          </button>
        </>
      }
    >
      <form
        id="task-form"
        onSubmit={(event) => {
          event.preventDefault();
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
            { onSuccess: onClose },
          );
        }}
      >
        <Field label="Tên công việc">
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label="Nội dung">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <div className="form-grid">
          <Field label="Ưu tiên">
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
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
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>
        </div>
        <MutationStatus pending={write.isPending} error={write.error} />
      </form>
    </Dialog>
  );
}
