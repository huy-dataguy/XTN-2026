import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../shared/api";
import type {
  KpiOverview,
  KpiPhase,
  Order,
  Page,
  Weekly,
  User,
} from "../shared/types";
import {
  Badge,
  Dialog,
  ErrorNotice,
  Field,
  Icon,
  MutationStatus,
  PageControls,
  ReasonDialog,
  StatCard,
  addDays,
  money,
  monday,
  useWrite,
  weekRange,
} from "../shared/ui";

function KpiPanel({ from, to }: { from: string; to: string }) {
  const write = useWrite();
  const query = useQuery({
    queryKey: ["kpi", from, to],
    queryFn: () => api<KpiOverview>(`/kpi?from=${from}&to=${to}`),
  });
  const [editing, setEditing] = useState<KpiPhase | "new" | null>(null);
  const [form, setForm] = useState({
    start: from,
    end: to,
    amount: "",
    reason: "",
  });

  const openCreate = () => {
    setForm({ start: from, end: to, amount: "", reason: "" });
    setEditing("new");
  };
  const openEdit = (phase: KpiPhase) => {
    setForm({
      start: phase.startPeriod,
      end: phase.endPeriod,
      amount: String(phase.weeklyTarget),
      reason: "",
    });
    setEditing(phase);
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const body = {
      startPeriod: monday(new Date(form.start)),
      endPeriod: monday(new Date(form.end)),
      weeklyTarget: Number(form.amount),
      reason: form.reason,
    };
    write.mutate(
      editing === "new"
        ? { path: "/kpi/phases", body }
        : {
            path: `/kpi/phases/${editing.id}`,
            method: "PATCH",
            body: { ...body, version: editing.revision },
          },
      { onSuccess: () => setEditing(null) },
    );
  };

  return (
    <section className="panel kpi-panel">
      <div className="section-head">
        <h2>Cấu hình KPI doanh thu</h2>
        <small>{weekRange(from, to)}</small>
      </div>
      {query.isPending && <p className="loading">Đang tải KPI…</p>}
      {query.error && (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data &&
        (query.data.phases.length ? (
          <div className="kpi-list">
            {query.data.phases.map((phase) => (
              <div className="kpi-row" key={phase.id}>
                <div>
                  <strong>{money(phase.weeklyTarget)} / tuần</strong>
                  <small>
                    {weekRange(phase.startPeriod, phase.endPeriod)} ·{" "}
                    {phase.reason} · phiên bản {phase.revision}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => openEdit(phase)}
                >
                  Sửa
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Chưa cấu hình KPI cho giai đoạn này.</p>
        ))}
      {!!query.data?.weeks.length && (
        <p className="fine-print">
          Tuần đã chốt:{" "}
          {query.data.weeks
            .map((week) => `${week.periodId} ${money(week.weeklyTarget)}`)
            .join(" · ")}
        </p>
      )}
      <div className="actions">
        <button type="button" className="btn primary" onClick={openCreate}>
          <Icon name="plus" size={16} /> Thêm KPI giai đoạn
        </button>
      </div>
      <MutationStatus pending={write.isPending} error={write.error} />
      {editing && (
        <Dialog
          open
          onClose={() => setEditing(null)}
          title={
            editing === "new"
              ? "Cấu hình KPI doanh thu"
              : "Cập nhật KPI doanh thu"
          }
          footer={
            <>
              <button
                type="button"
                className="btn"
                onClick={() => setEditing(null)}
              >
                Hủy
              </button>
              <button
                type="submit"
                form="kpi-form"
                className="btn primary"
                disabled={write.isPending || !form.reason || !form.amount}
              >
                Lưu
              </button>
            </>
          }
        >
          <form id="kpi-form" onSubmit={save}>
            <div className="form-grid">
              <Field label="Từ tuần">
                <input
                  type="date"
                  required
                  value={form.start}
                  onChange={(event) =>
                    setForm({ ...form, start: event.target.value })
                  }
                />
              </Field>
              <Field label="Đến tuần">
                <input
                  type="date"
                  required
                  value={form.end}
                  onChange={(event) =>
                    setForm({ ...form, end: event.target.value })
                  }
                />
              </Field>
              <Field label="KPI mỗi tuần (đ)">
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={form.amount}
                  onChange={(event) =>
                    setForm({ ...form, amount: event.target.value })
                  }
                />
              </Field>
              <Field label="Lý do">
                <input
                  required
                  value={form.reason}
                  onChange={(event) =>
                    setForm({ ...form, reason: event.target.value })
                  }
                />
              </Field>
            </div>
            <p className="fine-print">
              KPI áp dụng chung cho mọi thành viên trong khoảng tuần đã chọn.
              Tuần đã chốt giữ nguyên KPI cũ; thay đổi chỉ áp dụng cho tuần chưa
              chốt. Có thể đặt KPI riêng cho từng thành viên ở trang Thành viên.
            </p>
          </form>
        </Dialog>
      )}
    </section>
  );
}

export default function Dashboard({ user }: { user: User }) {
  const [params, setParams] = useSearchParams();
  const from = params.get("from") || monday();
  const to = params.get("to") || from;
  const offset = Number(params.get("offset") || 0);
  const isAdmin = user.role === "ADMIN";
  const [range, setRange] = useState(from !== to);
  const [showAll, setShowAll] = useState(false);
  const [periodAction, setPeriodAction] = useState<"close" | "reopen" | null>(
    null,
  );

  const query = useQuery({
    queryKey: ["weekly", from, to, offset],
    queryFn: () =>
      api<Weekly>(
        `/analytics/weekly?from=${from}&to=${to}&limit=20&offset=${offset}`,
      ),
  });

  const pendingOrders = useQuery({
    queryKey: ["orders", "pending-count"],
    queryFn: () => api<Page<Order>>("/orders?limit=200"),
    enabled: isAdmin,
  });

  const migration = useQuery({
    queryKey: ["migration-status"],
    queryFn: () =>
      api<{ products: number; orders: number; reports: number }>(
        "/migration/status",
      ),
    enabled: isAdmin,
  });

  const write = useWrite();

  const changeRange = (nextFrom: string, nextTo = nextFrom) => {
    setParams((prev) => {
      prev.set("from", nextFrom);
      prev.set("to", nextTo);
      prev.delete("offset");
      return prev;
    });
  };

  const shiftWeek = (direction: number) => {
    changeRange(
      addDays(from, direction * 7),
      addDays(to, direction * 7),
    );
  };

  const toggleRange = () => {
    if (range) {
      setRange(false);
      changeRange(from);
    } else {
      setRange(true);
      changeRange(from, addDays(from, 7));
    }
  };

  const data = query.data;
  const totals = data?.totals;
  const memberTotals = [...(data?.memberTotals || [])].sort(
    (a, b) => b.revenue - a.revenue,
  );
  const maxRevenue = Math.max(1, ...memberTotals.map((m) => m.revenue));
  const visibleMembers = showAll ? memberTotals : memberTotals.slice(0, 5);
  const pendingReports =
    data?.rows.reduce((sum, row) => sum + row.pendingReports, 0) || 0;
  const pendingOrderCount =
    pendingOrders.data?.items.filter((order) => order.status === "PENDING")
      .length || 0;
  const selfRow = data?.rows.find(
    (row) => row.memberId === user.id && row.periodId === from,
  );
  const selfTotal = data?.memberTotals.find(
    (row) => row.memberId === user.id,
  );
  const workload = [
    {
      show: pendingOrderCount > 0,
      to: "/orders",
      icon: "orders" as const,
      title: `${pendingOrderCount} đơn chờ duyệt`,
      hint: "Duyệt hoặc từ chối yêu cầu cấp hàng",
    },
    {
      show: pendingReports > 0,
      to: "/reports",
      icon: "reports" as const,
      title: `${pendingReports} báo cáo chờ duyệt`,
      hint: "Kiểm tra và duyệt báo cáo phát sinh",
    },
    {
      show: (totals?.incompleteRows || 0) > 0,
      to: "/reports",
      icon: "check" as const,
      title: `${totals?.incompleteRows} lượt chưa chốt tuần`,
      hint: "Nhắc thành viên hoàn tất báo cáo tuần",
    },
    {
      show: (totals?.missingTargets || 0) > 0,
      to: "/members",
      icon: "team" as const,
      title: `${totals?.missingTargets} lượt thiếu mục tiêu`,
      hint: "Gán mục tiêu doanh thu cho thành viên",
    },
  ].filter((item) => item.show);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{isAdmin ? "Tổng quan" : "Tuần của bạn"}</h1>
          <p>
            {weekRange(from, to)} ·{" "}
            {data?.provisional ? "Số liệu tạm thời" : "Các kỳ đã khóa"}
          </p>
        </div>
        <div className="week-picker">
          <button
            type="button"
            className="icon-btn"
            onClick={() => shiftWeek(-1)}
            aria-label="Tuần trước"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <input
            type="date"
            aria-label="Từ tuần"
            value={from}
            onChange={(event) =>
              changeRange(event.target.value, range ? to : event.target.value)
            }
          />
          {range && (
            <>
              <span className="range-dash">–</span>
              <input
                type="date"
                aria-label="Đến tuần"
                min={from}
                value={to}
                onChange={(event) => changeRange(from, event.target.value)}
              />
            </>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={() => shiftWeek(1)}
            aria-label="Tuần sau"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          <button type="button" className="btn sm ghost range-toggle" onClick={toggleRange}>
            {range ? "1 tuần" : "Nhiều tuần"}
          </button>
          {from !== monday() && (
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                setRange(false);
                changeRange(monday());
              }}
            >
              Tuần này
            </button>
          )}
        </div>
      </header>

      {migration.data &&
        Object.values(migration.data).some((value) => value > 0) && (
          <div className="notice">
            Còn dữ liệu cũ chưa chuyển đổi: {migration.data.products} sản phẩm,{" "}
            {migration.data.orders} đơn, {migration.data.reports} báo cáo.
          </div>
        )}
      {migration.error && <ErrorNotice error={migration.error} />}
      {query.isPending && (
        <div className="skeleton-grid" aria-label="Đang tải">
          <span />
          <span />
          <span />
          <span />
        </div>
      )}
      {query.error && (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      )}

      {data && totals && (
        <>
          <div className="stat-grid">
            <StatCard
              label="Doanh thu đã duyệt"
              value={money(totals.revenue)}
              icon="finance"
            />
            <StatCard
              label="Đã bán"
              value={`${totals.sold} sản phẩm`}
              icon="inventory"
              tone="blue"
            />
            <StatCard
              label="Lãi đóng góp"
              value={money(totals.contribution)}
              hint="Doanh thu trừ giá vốn hàng bán, hàng hư và hàng tặng. Chưa trừ hoa hồng và chi phí vận hành."
              icon="wallet-in"
            />
            <StatCard
              label="Hoàn thành KPI"
              value={
                totals.achievement == null
                  ? "Chưa đủ dữ liệu"
                  : `${totals.achievement.toFixed(1)}%`
              }
              icon="tasks"
              tone="amber"
            />
          </div>

          {isAdmin ? (
            <>
              <section className="panel action-panel">
                <div className="section-head">
                  <h2>Cần xử lý</h2>
                  <small>
                    {totals.incompleteRows} lượt chưa chốt ·{" "}
                    {totals.missingTargets} thiếu mục tiêu
                  </small>
                </div>
                {workload.length ? (
                  <div className="action-list">
                    {workload.map((item) => (
                      <Link key={item.title} to={item.to} className="action-row">
                        <span className="action-icon">
                          <Icon name={item.icon} />
                        </span>
                        <span className="action-copy">
                          <strong>{item.title}</strong>
                          <small>{item.hint}</small>
                        </span>
                        <Icon name="right" size={18} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="all-clear">
                    <Icon name="check" />
                    Không có việc nào đang chờ.
                  </div>
                )}
              </section>

              <section className="panel">
                <div className="section-head">
                  <h2>Hiệu quả theo thành viên</h2>
                  <small>{data.pagination.total} thành viên</small>
                </div>
                <div className="member-list">
                  {visibleMembers.map((row, index) => (
                    <div className="member-row" key={row.memberId}>
                      <span className="rank">{index + 1}</span>
                      <div className="member-copy">
                        <strong>{row.memberName}</strong>
                        <small>
                          {row.complete ? "Đã chốt" : "Chưa chốt"} ·{" "}
                          {row.closing.sellable} tốt
                        </small>
                      </div>
                      <span className="member-bar" aria-hidden="true">
                        <i
                          style={{
                            width: `${Math.max(
                              3,
                              Math.round((row.revenue / maxRevenue) * 100),
                            )}%`,
                          }}
                        />
                      </span>
                      <div className="member-money">
                        <strong>{money(row.revenue)}</strong>
                        <small>Lãi {money(row.contribution)}</small>
                      </div>
                      <Badge
                        tone={
                          row.achievement == null
                            ? "gray"
                            : row.achievement >= 100
                              ? "green"
                              : "amber"
                        }
                      >
                        {row.achievement == null
                          ? "Chưa đủ"
                          : `${row.achievement.toFixed(0)}%`}
                      </Badge>
                    </div>
                  ))}
                  {!memberTotals.length && (
                    <p className="muted">Chưa có thành viên trong kỳ.</p>
                  )}
                </div>
                {memberTotals.length > 5 && (
                  <button
                    type="button"
                    className="btn sm ghost show-all"
                    onClick={() => setShowAll(!showAll)}
                  >
                    {showAll ? "Thu gọn" : `Xem tất cả ${memberTotals.length}`}
                  </button>
                )}
                {showAll && (
                  <PageControls
                    offset={offset}
                    hasMore={data.pagination.hasMore}
                    onChange={(value) => {
                      setParams((prev) => {
                        prev.set("offset", String(value));
                        return prev;
                      });
                    }}
                    pageSize={20}
                  />
                )}
              </section>

              <details className="panel disclosure">
                <summary>
                  <span>Chi tiết từng tuần</span>
                  <small>{data.pagination.total} dòng</small>
                  <Icon name="down" size={18} />
                </summary>
                <div className="table-wrap" tabIndex={0} role="region" aria-label="Chi tiết từng tuần">
                  <table>
                    <thead>
                      <tr>
                        <th>Thành viên / tuần</th>
                        <th>Doanh thu</th>
                        <th>Lãi đóng góp</th>
                        <th>Tồn cuối</th>
                        <th>KPI</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <tr key={`${row.memberId}:${row.periodId}`}>
                          <td>
                            <strong>{row.memberName}</strong>
                            <small>
                              Tuần {row.periodId}
                              {row.group ? ` · ${row.group}` : ""}
                            </small>
                          </td>
                          <td>
                            {money(row.revenue)}
                            <small>
                              {row.sold} bán · {row.received} nhận
                            </small>
                          </td>
                          <td>{money(row.contribution)}</td>
                          <td>
                            {row.closing.sellable} tốt
                            <small>{row.closing.physical} vật lý</small>
                          </td>
                          <td>
                            {row.achievement == null
                              ? "—"
                              : `${row.achievement.toFixed(1)}%`}
                          </td>
                          <td>
                            <Badge tone={row.complete ? "green" : "amber"}>
                              {row.complete ? "Đã chốt" : "Chưa chốt"}
                            </Badge>
                            <small>
                              {row.pendingReports} chờ duyệt ·{" "}
                              {row.periodStatus === "CLOSED"
                                ? "Đã khóa"
                                : "Đang mở"}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.rows.length && <p>Chưa có dữ liệu trong kỳ.</p>}
                </div>
              </details>

              <section className="panel period-panel">
                <div>
                  <h2>Quản lý kỳ</h2>
                  <p className="muted">
                    Khóa tuần {from} khi mọi thành viên đã chốt và hết hạn gia hạn.
                  </p>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={write.isPending}
                    onClick={() => setPeriodAction("close")}
                  >
                    Khóa kỳ
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={write.isPending}
                    onClick={() => setPeriodAction("reopen")}
                  >
                    Mở lại kỳ
                  </button>
                </div>
                <MutationStatus pending={write.isPending} error={write.error} />
                <ReasonDialog
                  key={periodAction || "closed"}
                  open={periodAction !== null}
                  title={periodAction === "close" ? "Khóa kỳ" : "Mở lại kỳ"}
                  label="Lý do"
                  confirmLabel={periodAction === "close" ? "Khóa kỳ" : "Mở lại"}
                  pending={write.isPending}
                  onClose={() => setPeriodAction(null)}
                  onSubmit={(reason) => {
                    if (!periodAction) return;
                    write.mutate(
                      {
                        path: `/periods/${periodAction}`,
                        body: { periodId: from, reason },
                      },
                      { onSuccess: () => setPeriodAction(null) },
                    );
                  }}
                />
              </section>

              <KpiPanel from={from} to={to} />
            </>
          ) : (
            <>
              <section className="panel week-status">
                <div>
                  <span className="eyebrow">TRẠNG THÁI TUẦN</span>
                  <h2>
                    {selfRow?.complete
                      ? "Đã chốt kết quả tuần"
                      : "Chưa chốt kết quả tuần"}
                  </h2>
                  <p className="muted">
                    {selfRow?.complete
                      ? "Kết quả đã được ghi nhận. Nếu có sai sót, gửi báo cáo điều chỉnh."
                      : "Khai báo đủ bán, hư, tặng rồi chốt tuần để khóa kết quả."}
                  </p>
                  <div className="week-metrics">
                    <span>
                      <strong>{selfTotal?.closing.sellable ?? 0}</strong> tốt
                    </span>
                    <span>
                      <strong>{selfTotal?.closing.damaged ?? 0}</strong> hư
                    </span>
                    <span>
                      <strong>{selfTotal?.closing.physical ?? 0}</strong> vật lý
                    </span>
                  </div>
                  <div className="week-metrics">
                    <span>
                      <strong>{money(selfRow?.targetRevenue ?? null)}</strong>{" "}
                      KPI tuần
                      {selfRow?.targetSource === "MEMBER" ? " (riêng)" : ""}
                    </span>
                    <span>
                      <strong>
                        {selfRow?.achievement == null
                          ? "—"
                          : `${selfRow.achievement.toFixed(1)}%`}
                      </strong>{" "}
                      đạt KPI
                    </span>
                  </div>
                </div>
                <div className="week-actions">
                  <Link to="/reports" className="btn">
                    Báo cáo phát sinh
                  </Link>
                  {!selfRow?.complete && (
                    <button
                      type="button"
                      className="btn primary"
                      disabled={write.isPending}
                      onClick={() =>
                        write.mutate({
                          path: "/periods/complete",
                          body: { periodId: from },
                        })
                      }
                    >
                      Chốt kết quả tuần
                    </button>
                  )}
                </div>
                <MutationStatus pending={write.isPending} error={write.error} />
              </section>

              <section className="panel">
                <div className="section-head">
                  <h2>Lịch sử tuần</h2>
                  <small>{data.rows.length} tuần</small>
                </div>
                <div className="week-list">
                  {data.rows.map((row) => (
                    <div className="week-row" key={`${row.memberId}:${row.periodId}`}>
                      <div>
                        <strong>Tuần {row.periodId}</strong>
                        <small>{row.sold} sản phẩm đã bán</small>
                      </div>
                      <div>
                        <strong>{money(row.revenue)}</strong>
                        <small>Lãi {money(row.contribution)}</small>
                      </div>
                      <div>
                        <strong>
                          {row.achievement == null
                            ? "—"
                            : `${row.achievement.toFixed(0)}%`}
                        </strong>
                        <small>
                          KPI{" "}
                          {row.targetRevenue == null
                            ? "—"
                            : money(row.targetRevenue)}
                          {row.targetSource === "MEMBER" ? " · riêng" : ""}
                        </small>
                      </div>
                      <Badge tone={row.complete ? "green" : "amber"}>
                        {row.complete ? "Đã chốt" : "Chưa chốt"}
                      </Badge>
                    </div>
                  ))}
                  {!data.rows.length && (
                    <p className="muted">Chưa có tuần nào trong khoảng đã chọn.</p>
                  )}
                </div>
              </section>
            </>
          )}

          {totals.contribution != null && isAdmin && (
            <p className="fine-print">
              Lãi đóng góp = doanh thu − giá vốn hàng bán − hàng hư − hàng tặng.
              Chưa trừ hoa hồng và chi phí vận hành.
            </p>
          )}
        </>
      )}
    </>
  );
}
