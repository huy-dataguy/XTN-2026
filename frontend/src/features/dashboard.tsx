import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../shared/api";
import type { Weekly, User } from "../shared/types";
import {
  Badge,
  Card,
  ErrorNotice,
  Field,
  monday,
  money,
  useWrite,
  MutationStatus,
  PageControls,
} from "../shared/ui";
export default function Dashboard({ user }: { user: User }) {
  const [params, setParams] = useSearchParams();
  const from = params.get("from") || monday(),
    to = params.get("to") || from;
  const offset = Number(params.get("offset") || 0);
  const query = useQuery({
    queryKey: ["weekly", from, to, offset],
    queryFn: () =>
      api<Weekly>(
        `/analytics/weekly?from=${from}&to=${to}&limit=20&offset=${offset}`,
      ),
  });
  const migration = useQuery({
    queryKey: ["migration-status"],
    queryFn: () =>
      api<{ products: number; orders: number; reports: number }>(
        "/migration/status",
      ),
    enabled: user.role === "ADMIN",
  });
  const write = useWrite();
  const update = (key: string, value: string) =>
    setParams((prev) => {
      prev.set(key, value);
      if (key !== "offset") prev.delete("offset");
      return prev;
    });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">KẾT QUẢ THEO TUẦN</span>
          <h1>Tổng quan hoạt động</h1>
          <p className="muted">
            Tuần bán hàng và ngày nộp báo cáo được theo dõi riêng.
          </p>
        </div>
        <div className="filters">
          <Field label="Từ tuần thứ Hai">
            <input
              type="date"
              value={from}
              onChange={(e) => update("from", e.target.value)}
            />
          </Field>
          <Field label="Đến tuần thứ Hai">
            <input
              type="date"
              value={to}
              onChange={(e) => update("to", e.target.value)}
            />
          </Field>
        </div>
      </div>
      {migration.data &&
        Object.values(migration.data).some((value) => value > 0) && (
          <div className="notice">
            Cần đối soát dữ liệu cũ: {migration.data.products} sản phẩm,{" "}
            {migration.data.orders} đơn và {migration.data.reports} báo cáo chưa
            chuyển đổi. Số liệu bên dưới chỉ thuộc hệ thống mới.
          </div>
        )}
      {migration.error && <ErrorNotice error={migration.error} />}
      {query.isPending && <p role="status">Đang tải kết quả…</p>}
      {query.error && (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data && (
        <>
          <div className="notice">
            {query.data.provisional
              ? "Số liệu tạm thời — còn kỳ chưa khóa hoặc thành viên chưa chốt."
              : "Các kỳ đã khóa."}{" "}
            {query.data.totals.incompleteRows} lượt thành viên/tuần chưa chốt.{" "}
            {query.data.totals.missingTargets} lượt chưa có mục tiêu.
          </div>
          <div className="stat-grid">
            {[
              ["Doanh thu đã duyệt", money(query.data.totals.revenue)],
              ["Đã bán", `${query.data.totals.sold} sản phẩm`],
              ["Lãi đóng góp", money(query.data.totals.contribution)],
              [
                "Hoàn thành KPI",
                query.data.totals.achievement == null
                  ? "Chưa đủ dữ liệu"
                  : `${query.data.totals.achievement.toFixed(2)}%`,
              ],
            ].map(([label, value]) => (
              <Card key={label}>
                <p className="muted">{label}</p>
                <strong className="stat-value">{value}</strong>
              </Card>
            ))}
          </div>
          <p className="muted small">
            Lãi đóng góp = doanh thu − giá vốn hàng bán − giá vốn hàng hư − giá
            vốn hàng tốt tặng. Chưa trừ hoa hồng và chi phí vận hành.
          </p>
          <p className="muted">
            Chi tiết {query.data.memberTotals.length} /{" "}
            {query.data.pagination.total} thành viên; tổng kết phía trên tính
            toàn bộ phạm vi.
          </p>
          <Card>
            <h2>Tổng kết thành viên trong khoảng tuần</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Thành viên</th>
                    <th>Doanh thu</th>
                    <th>Lãi đóng góp</th>
                    <th>KPI nhiều tuần</th>
                    <th>Tồn cuối khoảng</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.memberTotals.map((row) => (
                    <tr key={row.memberId}>
                      <td>
                        {row.memberName}
                        <small>
                          {row.complete ? "Đã chốt đủ" : "Còn tuần chưa chốt"}
                        </small>
                      </td>
                      <td>
                        {money(row.revenue)}
                        <small>{row.sold} đã bán</small>
                      </td>
                      <td>{money(row.contribution)}</td>
                      <td>
                        {row.achievement == null
                          ? "Chưa đủ dữ liệu"
                          : `${row.achievement.toFixed(2)}%`}
                        <small>
                          Mục tiêu{" "}
                          {row.missingTargets
                            ? "chưa đủ"
                            : money(row.targetRevenue)}
                        </small>
                      </td>
                      <td>
                        {row.closing.sellable} tốt / {row.closing.physical} vật
                        lý
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <h2>Chi tiết từng tuần</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Thành viên / tuần</th>
                    <th>Doanh thu</th>
                    <th>Giá vốn / lãi gộp</th>
                    <th>Lãi đóng góp</th>
                    <th>Tồn tốt / vật lý</th>
                    <th>KPI</th>
                    <th>Báo cáo</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.rows.map((row) => (
                    <tr key={`${row.memberId}:${row.periodId}`}>
                      <td>
                        <strong>{row.memberName}</strong>
                        <small>
                          {row.periodId} · {row.group}
                        </small>
                      </td>
                      <td>
                        {money(row.revenue)}
                        <small>
                          {row.sold} đã bán · {row.received} thực nhận
                        </small>
                      </td>
                      <td>
                        {money(row.cogs)}
                        <small>{money(row.grossProfit)}</small>
                      </td>
                      <td>
                        {money(row.contribution)}
                        <small>
                          Hư {row.damaged} · tặng tốt {row.giftGood} · tặng hư{" "}
                          {row.giftDamaged}
                        </small>
                      </td>
                      <td>
                        {row.closing.sellable} / {row.closing.physical}
                        <small>Đầu kỳ: {row.opening.sellable} tốt</small>
                      </td>
                      <td>
                        {row.achievement == null
                          ? "N/A"
                          : `${row.achievement.toFixed(2)}%`}
                        <small>Mục tiêu {money(row.targetRevenue)}</small>
                      </td>
                      <td>
                        <Badge>{row.complete ? "Đã chốt" : "Chưa chốt"}</Badge>
                        <small>
                          {row.hasExtension ? "Được gia hạn · " : ""}
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
              {!query.data.rows.length && <p>Chưa có thành viên trong kỳ.</p>}
            </div>
          </Card>
          <PageControls
            offset={offset}
            hasMore={query.data.pagination.hasMore}
            onChange={(value) => update("offset", String(value))}
            pageSize={20}
          />
        </>
      )}
      {user.role === "ADMIN" ? (
        <Card>
          <h2>Quản lý kỳ</h2>
          <p className="muted">
            Thao tác áp dụng tuần {from}. Khóa kỳ yêu cầu thành viên đã chốt và
            hết thời hạn gia hạn.
          </p>
          <div className="actions">
            <button
              disabled={write.isPending}
              onClick={() => {
                const reason = prompt("Lý do khóa kỳ");
                if (reason)
                  write.mutate({
                    path: "/periods/close",
                    body: { periodId: from, reason },
                  });
              }}
            >
              Khóa kỳ
            </button>
            <button
              disabled={write.isPending}
              onClick={() => {
                const reason = prompt("Lý do mở lại kỳ");
                if (reason)
                  write.mutate({
                    path: "/periods/reopen",
                    body: { periodId: from, reason },
                  });
              }}
            >
              Mở lại kỳ
            </button>
          </div>
          <MutationStatus pending={write.isPending} error={write.error} />
        </Card>
      ) : (
        <Card>
          <h2>Xác nhận đã khai báo đủ tuần {from}</h2>
          <p className="muted">
            Chỉ chốt khi đã khai báo đủ bán, hư và tặng; các báo cáo đã được xử
            lý. Có thể xác nhận tuần không phát sinh.
          </p>
          <button
            className="primary"
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
          <MutationStatus pending={write.isPending} error={write.error} />
        </Card>
      )}
    </>
  );
}
