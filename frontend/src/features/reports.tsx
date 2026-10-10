import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../shared/api";
import type { Report, Page, Inventory, User, Activity } from "../shared/types";
import {
  Badge,
  Card,
  ErrorNotice,
  Field,
  monday,
  date,
  useWrite,
  MutationStatus,
  PageControls,
  useOffset,
  nowLocal,
  effective,
} from "../shared/ui";
export default function Reports({ user }: { user: User }) {
  const [offset, setOffset] = useOffset(),
    [editing, setEditing] = useState<Report | null>(null);
  const query = useQuery({
      queryKey: ["reports", offset],
      queryFn: () => api<Page<Report>>(`/reports?offset=${offset}`),
    }),
    write = useWrite();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">KHAI BÁO PHÁT SINH</span>
          <h1>Báo cáo bán hàng</h1>
          <p className="muted">
            Mỗi lần gửi ghi phần bán, hư, tặng mới. Ngày phát sinh quyết định
            tuần thống kê.
          </p>
        </div>
      </div>
      {(user.role === "DISTRIBUTOR" || editing) && (
        <ReportForm
          key={editing?.id || "new"}
          editing={editing}
          onDone={() => setEditing(null)}
        />
      )}
      <MutationStatus pending={write.isPending} error={write.error} />
      {query.error && <ErrorNotice error={query.error} />}
      {query.data?.items.map((report) => (
        <Card key={report.id}>
          <div className="split">
            <div>
              <h2>
                {report.memberName} · Tuần {report.periodId}
              </h2>
              <p className="muted">
                Nộp {date(report.submittedAt)}
                {report.replacesId ? " · Bản điều chỉnh" : ""}
              </p>
            </div>
            <Badge>{report.status}</Badge>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ngày phát sinh</th>
                <th>Bán</th>
                <th>Hư mới</th>
                <th>Tặng tốt</th>
                <th>Tặng hư</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((line, i) => (
                <tr key={i}>
                  <td>{date(line.effectiveAt)}</td>
                  <td>{line.sold}</td>
                  <td>{line.damaged}</td>
                  <td>{line.giftGood}</td>
                  <td>{line.giftDamaged}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{report.notes}</p>
          <div className="actions">
            {report.status === "PENDING" && (
              <>
                <button onClick={() => setEditing(report)}>
                  Sửa phần khai báo
                </button>
                {user.role === "ADMIN" && (
                  <>
                    <button
                      disabled={write.isPending}
                      onClick={() =>
                        write.mutate({
                          path: `/reports/${report.id}/status`,
                          method: "PUT",
                          body: { status: "APPROVED", version: report.version },
                        })
                      }
                    >
                      Duyệt báo cáo
                    </button>
                    <button
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
              </>
            )}
            {user.role === "ADMIN" && report.status === "APPROVED" && (
              <button onClick={() => setEditing(report)}>
                Điều chỉnh có lưu lịch sử
              </button>
            )}
          </div>
        </Card>
      ))}
      {query.data?.items.length === 0 && <Card>Chưa có báo cáo.</Card>}
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
type InputLine = Omit<Activity, "effectiveAt"> & { when: string };
const blank = (): InputLine => ({
  lotId: "",
  when: nowLocal(),
  sold: 0,
  damaged: 0,
  giftGood: 0,
  giftDamaged: 0,
});
function ReportForm({
  editing,
  onDone,
}: {
  editing: Report | null;
  onDone: () => void;
}) {
  const inventory = useQuery({
      queryKey: ["inventory", editing?.memberId],
      queryFn: () =>
        api<Inventory>(
          `/inventory${editing ? `?memberId=${editing.memberId}` : ""}`,
        ),
    }),
    write = useWrite();
  const [week, setWeek] = useState(editing?.periodId || monday()),
    [notes, setNotes] = useState(editing?.notes || ""),
    [reason, setReason] = useState("");
  const [lines, setLines] = useState<InputLine[]>(
    editing?.lines.map((l) => ({
      lotId: l.lotId,
      sold: l.sold,
      damaged: l.damaged,
      giftGood: l.giftGood,
      giftDamaged: l.giftDamaged,
      when: new Date(+new Date(l.effectiveAt) + 7 * 3600000)
        .toISOString()
        .slice(0, 23),
    })) || [blank()],
  );
  const update = (index: number, changes: Partial<InputLine>) =>
    setLines(lines.map((l, i) => (i === index ? { ...l, ...changes } : l)));
  const correction = editing?.status === "APPROVED";
  const submit = (e: FormEvent) => {
    e.preventDefault();
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
      {
        onSuccess: () => {
          setLines([blank()]);
          setNotes("");
          onDone();
        },
      },
    );
  };
  return (
    <Card>
      <h2>
        {correction
          ? "Điều chỉnh bản đã duyệt"
          : editing
            ? "Sửa báo cáo chờ duyệt"
            : "Gửi phần phát sinh mới"}
      </h2>
      <form onSubmit={submit}>
        <Field label="Tuần kết quả (thứ Hai)">
          <input
            type="date"
            required
            disabled={!!editing}
            value={week}
            onChange={(e) => setWeek(e.target.value)}
          />
        </Field>
        <p className="muted">
          Hàng hư chuyển sang tồn hư. Tặng hư chỉ xuất khỏi tồn hư, không trừ
          hàng tốt lần nữa.
        </p>
        {inventory.error && <ErrorNotice error={inventory.error} />}{" "}
        {lines.map((line, index) => (
          <div key={index} className="inset form-grid">
            <Field label="Đợt thực nhận">
              <select
                required
                value={line.lotId}
                onChange={(e) => update(index, { lotId: e.target.value })}
              >
                <option value="">Chọn đợt nhận</option>
                {inventory.data?.lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.productName} · {date(lot.effectiveAt)} · còn{" "}
                    {lot.sellable} tốt/{lot.damaged} hư
                  </option>
                ))}
                {editing &&
                  !inventory.data?.lots.some((l) => l.id === line.lotId) && (
                    <option value={line.lotId}>Đợt nhận của báo cáo gốc</option>
                  )}
              </select>
            </Field>
            <Field label="Ngày giờ phát sinh (Việt Nam)">
              <input
                type="datetime-local"
                step="any"
                required
                value={line.when}
                max={nowLocal()}
                onChange={(e) => update(index, { when: e.target.value })}
              />
            </Field>
            {(["sold", "damaged", "giftGood", "giftDamaged"] as const).map(
              (key, i) => (
                <Field
                  key={key}
                  label={
                    ["Bán thêm", "Hư mới", "Tặng hàng tốt", "Tặng hàng hư"][i]
                  }
                >
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={line[key]}
                    onChange={(e) =>
                      update(index, { [key]: Number(e.target.value) })
                    }
                  />
                </Field>
              ),
            )}
            {lines.length > 1 && (
              <button
                type="button"
                onClick={() => setLines(lines.filter((_, i) => i !== index))}
              >
                Bỏ dòng
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setLines([...lines, blank()])}>
          Thêm đợt / ngày phát sinh
        </button>
        <Field label="Ghi chú">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {correction && (
          <Field label="Lý do điều chỉnh">
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        )}
        <div className="actions">
          <button className="primary" disabled={write.isPending}>
            Lưu báo cáo
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
