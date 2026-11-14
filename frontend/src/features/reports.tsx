import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../shared/api";
import type { Activity, Inventory, Page, Report, User } from "../shared/types";
import {
  Badge,
  Dialog,
  EmptyState,
  ErrorNotice,
  Field,
  Icon,
  MutationStatus,
  PageControls,
  date,
  effective,
  monday,
  nowLocal,
  reportStatus,
  useOffset,
  useWrite,
} from "../shared/ui";

export default function Reports({ user }: { user: User }) {
  const [offset, setOffset] = useOffset();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Report | null>(null);
  const query = useQuery({
    queryKey: ["reports", offset],
    queryFn: () => api<Page<Report>>(`/reports?offset=${offset}`),
  });
  const write = useWrite();
  const isAdmin = user.role === "ADMIN";

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Báo cáo bán hàng</h1>
          <p>Khai báo phần bán, hư và tặng phát sinh theo tuần.</p>
        </div>
        {user.role === "DISTRIBUTOR" && !!query.data?.items.length && (
          <button
            type="button"
            className="btn primary"
            onClick={() => setCreating(true)}
          >
            <Icon name="plus" size={17} /> Gửi báo cáo
          </button>
        )}
      </header>

      {query.error && <ErrorNotice error={query.error} />}
      {query.isPending && <p className="loading">Đang tải báo cáo…</p>}
      {query.data && !query.data.items.length && (
        <EmptyState
          icon="reports"
          title="Chưa có báo cáo"
          description={
            user.role === "DISTRIBUTOR"
              ? "Gửi báo cáo sau khi đã nhận hàng và phát sinh bán, hư hoặc tặng."
              : "Báo cáo của thành viên sẽ xuất hiện tại đây để duyệt."
          }
          action={
            user.role === "DISTRIBUTOR" ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => setCreating(true)}
              >
                Gửi báo cáo
              </button>
            ) : undefined
          }
        />
      )}

      <div className="card-list">
        {query.data?.items.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            isAdmin={isAdmin}
            onEdit={() => setEditing(report)}
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
        <ReportDialog
          key={editing?.id || "new"}
          editing={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      <MutationStatus pending={write.isPending} error={write.error} />
    </>
  );
}

function ReportCard({
  report,
  isAdmin,
  onEdit,
}: {
  report: Report;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const write = useWrite();
  const status = reportStatus[report.status] || {
    label: report.status,
    tone: "gray" as const,
  };
  const sums = report.lines.reduce(
    (total, line) => ({
      sold: total.sold + line.sold,
      damaged: total.damaged + line.damaged,
      giftGood: total.giftGood + line.giftGood,
      giftDamaged: total.giftDamaged + line.giftDamaged,
    }),
    { sold: 0, damaged: 0, giftGood: 0, giftDamaged: 0 },
  );
  const correction = report.replacesId || report.status === "SUPERSEDED";

  return (
    <article className="order-card">
      <div className="order-top">
        <div>
          <Badge tone={status.tone}>{status.label}</Badge>
          <span className="period-chip">Tuần {report.periodId}</span>
          {correction && <span className="period-chip">Điều chỉnh</span>}
        </div>
        <span className="order-date">{date(report.submittedAt)}</span>
      </div>
      <div className="order-main">
        <div>
          <h2>{isAdmin ? report.memberName : "Báo cáo phát sinh"}</h2>
          <p>{report.lines.length} đợt phát sinh</p>
        </div>
      </div>
      <div className="metric-chips">
        <span>
          <strong>{sums.sold}</strong> bán
        </span>
        <span>
          <strong>{sums.damaged}</strong> hư
        </span>
        <span>
          <strong>{sums.giftGood}</strong> tặng tốt
        </span>
        <span>
          <strong>{sums.giftDamaged}</strong> tặng hư
        </span>
      </div>
      {report.notes && <p className="report-notes">{report.notes}</p>}
      <details className="order-details">
        <summary>
          Chi tiết đợt phát sinh <Icon name="down" size={16} />
        </summary>
        <div className="line-list">
          {report.lines.map((line, index) => (
            <div className="line-row" key={index}>
              <span>
                <strong>{date(line.effectiveAt)}</strong>
                <small>
                  Bán {line.sold} · Hư {line.damaged}
                </small>
              </span>
              <span>
                Tặng {line.giftGood + line.giftDamaged}
                <small>
                  {line.giftGood} tốt · {line.giftDamaged} hư
                </small>
              </span>
            </div>
          ))}
        </div>
      </details>
      <div className="order-actions">
        {report.status === "PENDING" && (
          <button type="button" className="btn sm ghost" onClick={onEdit}>
            Sửa báo cáo
          </button>
        )}
        {isAdmin && report.status === "PENDING" && (
          <>
            <button
              type="button"
              className="btn sm primary"
              disabled={write.isPending}
              onClick={() =>
                write.mutate({
                  path: `/reports/${report.id}/status`,
                  method: "PUT",
                  body: { status: "APPROVED", version: report.version },
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
                  path: `/reports/${report.id}/status`,
                  method: "PUT",
                  body: { status: "REJECTED", version: report.version },
                })
              }
            >
              Từ chối
            </button>
          </>
        )}
        {isAdmin && report.status === "APPROVED" && (
          <button type="button" className="btn sm ghost" onClick={onEdit}>
            Điều chỉnh
          </button>
        )}
        <MutationStatus pending={write.isPending} error={write.error} />
      </div>
    </article>
  );
}

type InputLine = Omit<Activity, "effectiveAt"> & { when: string };

const blank = (): InputLine => ({
  lotId: "",
  when: nowLocal(),
  sold: 0,
  damaged: 0,
  giftGood: 0,
  giftDamaged: 0,
});

function ReportDialog({
  editing,
  onClose,
}: {
  editing: Report | null;
  onClose: () => void;
}) {
  const correction = editing?.status === "APPROVED";
  const inventory = useQuery({
    queryKey: ["inventory", editing?.memberId],
    queryFn: () =>
      api<Inventory>(
        `/inventory${editing ? `?memberId=${editing.memberId}` : ""}`,
      ),
  });
  const write = useWrite();
  const [week, setWeek] = useState(editing?.periodId || monday());
  const [notes, setNotes] = useState(editing?.notes || "");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<InputLine[]>(
    editing?.lines.map((line) => ({
      lotId: line.lotId,
      sold: line.sold,
      damaged: line.damaged,
      giftGood: line.giftGood,
      giftDamaged: line.giftDamaged,
      when: new Date(+new Date(line.effectiveAt) + 7 * 3600000)
        .toISOString()
        .slice(0, 23),
    })) || [blank()],
  );

  const update = (index: number, changes: Partial<InputLine>) =>
    setLines(lines.map((line, i) => (i === index ? { ...line, ...changes } : line)));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = {
      periodId: week,
      notes,
      lines: lines.map(({ when, ...line }) => ({
        ...line,
        effectiveAt: effective(when),
      })),
      ...(editing ? { version: editing.version } : {}),
      ...(correction ? { reason } : {}),
    };
    write.mutate(
      {
        path: editing
          ? `/reports/${editing.id}${correction ? "/corrections" : ""}`
          : "/reports",
        method: editing && !correction ? "PUT" : "POST",
        body,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        correction
          ? "Điều chỉnh báo cáo đã duyệt"
          : editing
            ? "Sửa báo cáo chờ duyệt"
            : "Gửi báo cáo phát sinh"
      }
      wide
      footer={
        <div className="dialog-submit">
          <span>
            <strong>{lines.length}</strong> đợt
          </span>
          <button
            type="submit"
            form="report-form"
            className="btn primary"
            disabled={write.isPending}
          >
            Lưu báo cáo
          </button>
        </div>
      }
    >
      <form id="report-form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Tuần kết quả">
            <input
              type="date"
              required
              disabled={!!editing}
              value={week}
              onChange={(event) => setWeek(event.target.value)}
            />
          </Field>
          {correction && (
            <Field label="Lý do điều chỉnh">
              <input
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ví dụ: nhập nhầm số lượng bán"
              />
            </Field>
          )}
        </div>

        {inventory.error && <ErrorNotice error={inventory.error} />}
        {inventory.isPending && <p className="loading">Đang tải hàng đang giữ…</p>}

        <div className="report-lines">
          {lines.map((line, index) => (
            <div className="report-line" key={index}>
              <div className="report-line-head">
                <span>Đợt {index + 1}</span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Bỏ đợt"
                    onClick={() => setLines(lines.filter((_, i) => i !== index))}
                  >
                    <Icon name="close" size={16} />
                  </button>
                )}
              </div>
              <Field label="Đợt hàng đã nhận">
                <select
                  required
                  value={line.lotId}
                  onChange={(event) =>
                    update(index, { lotId: event.target.value })
                  }
                >
                  <option value="">Chọn đợt nhận</option>
                  {inventory.data?.lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.productName} · {date(lot.effectiveAt)} · còn{" "}
                      {lot.sellable} tốt/{lot.damaged} hư
                    </option>
                  ))}
                  {editing &&
                    line.lotId &&
                    !inventory.data?.lots.some((lot) => lot.id === line.lotId) && (
                      <option value={line.lotId}>Đợt của báo cáo gốc</option>
                    )}
                </select>
              </Field>
              <Field label="Thời điểm phát sinh (Việt Nam)">
                <input
                  type="datetime-local"
                  step="any"
                  required
                  value={line.when}
                  max={nowLocal()}
                  onChange={(event) =>
                    update(index, { when: event.target.value })
                  }
                />
              </Field>
              <div className="quantity-grid">
                {(["sold", "damaged", "giftGood", "giftDamaged"] as const).map(
                  (key, i) => (
                    <Field
                      key={key}
                      label={["Bán", "Hư mới", "Tặng tốt", "Tặng hư"][i]}
                    >
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={line[key]}
                        onChange={(event) =>
                          update(index, { [key]: Number(event.target.value) })
                        }
                      />
                    </Field>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn ghost add-line"
          onClick={() => setLines([...lines, blank()])}
        >
          <Icon name="plus" size={16} /> Thêm đợt phát sinh
        </button>
        <Field label="Ghi chú">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Không bắt buộc"
          />
        </Field>
        <MutationStatus pending={write.isPending} error={write.error} />
      </form>
    </Dialog>
  );
}
