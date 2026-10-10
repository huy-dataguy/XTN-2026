# ACID và tính đúng của thống kê tuần

Ngày 2026-10-09; branch feature/redesign-ecommerce; baseline ứng dụng ecbac8b.
Đây là đánh giá và đề xuất contract tính toán, chưa phải implementation production.

## 1. Business → consumer → use case → workload

Yêu cầu đã xác nhận: nhiều lần đặt/nhập bổ sung và nhiều báo cáo mỗi tuần;
ngày nhận có thể từ T2 đến T5 hoặc trễ hơn; được gia hạn nộp báo cáo do quên;
cần doanh thu/lợi nhuận và kết quả từng thành viên cho một hoặc nhiều tuần;
hàng hư có thể đem tặng, phải biết tồn thật sau cấp hàng và tặng.

Consumer: thành viên xem kết quả của mình; vận hành kiểm kê kho/đợt giao;
tài chính xem doanh số, chi phí, khoản nộp; quản trị duyệt báo cáo/gia hạn.
Workload: OLTP cấp/nhận/sửa/duyệt phải transactional; thống kê là operational
analytics theo member × period × SKU/lô. Chưa biết throughput/volume/SLO.
Nguồn hiện tại: Product, Order, Report, User, Statement. Order.createdAt có
thể sửa; Report thiếu submittedAt/approvedAt; giá vốn, quà tặng, mục tiêu KPI,
receipt lines và kỳ đóng/gia hạn chưa được mô hình hóa.

Không cần data warehouse/lakehouse riêng để giải quyết workload hiện biết.
Nguồn sự thật đích là giao dịch đã commit + revision/audit; bảng tổng hợp phục
vụ trang chỉ là read model, có thể rebuild và đối chiếu với nguồn.

## 2. ACID: đánh giá theo giao dịch nghiệp vụ

Không chấm một tỷ lệ ACID tùy ý. MongoDB có atomic single-document writes;
điều đó không làm chuỗi sửa nhiều Product rồi lưu Order thành atomic.

| Thuộc tính | Kết luận với code hiện tại | Chứng cứ / giới hạn |
| --- | --- | --- |
| Atomicity | Không đạt ở create/delete order nhiều dòng | orders.js:39-67 lưu kho trước order; P02 trả 404 nhưng tồn 10→8. delete:135-145 cộng kho trước xóa, không session/transaction. |
| Consistency | Không enforce các invariant nghiệp vụ chính | P01/P07 chấp nhận quantity âm; P05 tổng report không khớp details; REJECTED không release hàng; report/receipt thiếu ràng buộc. |
| Isolation | Không có bảo đảm cho concurrent business commands hoặc snapshot thống kê | Read-modify-save Product; status update chỉ theo ID, không expected-state/version; GET riêng products/orders/reports có thể đọc các thời điểm khác nhau. Race chưa chạy với DB thật. |
| Durability | Chưa thể xác nhận | Repo không khai báo read/write concern, topology, journal, backup/restore/failover policy. Không được suy ra durability bằng 0 hoặc mặc định dữ liệu sẽ mất. Audit lịch sử là vấn đề truy vết riêng, không đồng nghĩa DB thiếu durability. |

### Boundary cần atomic sau redesign

- Tạo/sửa request: idempotency record + order/version + reservation delta + audit.
- Dispatch/receive nhiều dòng: state guard + giảm vị trí nguồn + tăng transit/đích
  + receipt/movement + audit, commit một lần. Receipt partial phải có line IDs.
- Duyệt report: report/version + validation balance theo timeline + movements
  bán/hư/tặng + doanh thu/giá vốn + invalidation read model + audit.
- Reject/cancel: guard trạng thái + release reservation đúng một lần + audit.
- Correction: reversal + replacement liên kết bản cũ; không delete lịch sử đã post.
- Close/reopen kỳ: version kỳ + kiểm tra completeness + snapshot revision + audit.

Cần conditional updates/optimistic version và unique identity song song với
transaction; chỉ thêm transaction không chống retry nhân đôi giao dịch.
Không gọi dịch vụ ngoài DB trong transaction hoặc retry callback; nếu cần side
 effects, dùng outbox sau commit. Operation transaction phải dùng cùng session.
Snapshot đọc, write concern và retry/unknown commit handling cần được chỉ rõ
và thử trên DB thật; không tuyên bố serializable chỉ vì dùng transaction.

## 3. Bốn mốc thời gian không được trộn

| Trường | Ý nghĩa |
| --- | --- |
| orderedAt / intendedPeriodId | Lúc đặt và tuần dự kiến, dùng lập kế hoạch |
| receivedAt / effectiveAt | Thực nhận hoặc thực bán/hư/tặng; xác định inventory timeline và performance period |
| submittedAt / approvedAt | Nộp/duyệt, dùng theo dõi quy trình; không tự đổi tuần phát sinh |
| deadlineAt / extensionUntil / closedAt | Hạn báo cáo, gia hạn theo member-period, thời điểm khóa chính thức |

Đề xuất performance period: T2 00:00 đến T2 tiếp theo 00:00 tại
Asia/Ho_Chi_Minh, interval [start,end). Cần xác nhận đây là lịch kinh doanh,
không lấy cửa sổ đặt hàng T7→T6 hiện tại làm tuần bán mặc định.
Ví dụ W1: 05/10/2026 00:00 +07 đến 12/10/2026 00:00 +07.
Bắt đầu đó là 04/10 17:00 UTC; dùng period ID 2026-10-05, không lấy
`toISOString().split('T')[0]` trên Monday local để đặt key (ra Chủ nhật UTC).

- Đặt CN 04/10, nhận T4 07/10: không có hàng thành viên trước 07/10; nhận thuộc W1.
- Đặt bổ sung T5, nhận T6: thêm receipt cùng W1; không overwrite receipt trước.
- Bán CN 11/10, nộp T3 13/10: doanh số thuộc W1, submittedAt thuộc W2.
- Gia hạn tới T5 không kéo dài performance period. Nếu cho phép bán sang tuần
  sau, sự kiện T2 vẫn thuộc W2 hoặc một campaign riêng được cấu hình rõ.
- Một báo cáo phủ nhiều tuần phải phân bổ từng dòng/sự kiện vào period tương
  ứng. Không có ngày bán/phân bổ thì không thể tái dựng KPI tuần chính xác.

### Lifecycle kỳ và gia hạn

OPEN → REVIEW → CLOSED; mỗi member-period có deadline/extension/reason/actor.
Gia hạn đã được cấp phải hiển thị ON_TIME_EXTENDED, không phạt như trễ chưa phép.
Thiếu report là MISSING/INCOMPLETE, không đồng nghĩa doanh thu 0 hoặc KPI 0.
Đang REVIEW phải hiển thị PROVISIONAL và số thành viên chưa hoàn tất; không
đóng toàn kỳ nếu còn người được gia hạn chưa chốt, trừ explicit policy partial close.
Sau CLOSED chỉ correction/reopen được cấp quyền, xuất revision mới, giữ
snapshot cũ. Báo cáo API có asOfRecordedAt, dataRevision, calculationVersion.

## 4. Grain và nhiều đợt cập nhật

- OrderLine: một dòng yêu cầu cấp hàng; amendment có version. Chưa giao chỉ
  update reservation delta; đã giao phải thêm request/return, không rewrite receipt.
- ReceiptLine: một lần thực nhận × member × SKU × lot; nhiều lần/đơn được phép.
- DeclarationLine: một lần khai báo × member × period × SKU/lot × activity.
  Báo cáo tăng dần là delta kể từ lần trước, không phải tổng lũy kế được cộng lại.
- ReportSubmission: grouping những lines chưa post; có thể nhiều submission
  cùng kỳ. Revision replaces line cũ qua reversal; retry cùng key không post lại.
- Movement: hai chân source/destination hoặc một external boundary; condition
  SELLABLE/DAMAGED, reference tới chứng từ và valuation lot.
- KPI target: member × period × metric × targetVersion. Group membership có
  hiệu lực theo thời gian, không dùng group hiện tại để sửa thành tích nhóm cũ.

Nếu UI cho nhập tổng lũy kế, server phải chuyển thành delta từ revision
baseline dưới lock/version. Không trộn cumulative và delta không có mode.
Ledger có recordedAt và effectiveAt, cho phép nộp trễ. Khi post backdated,
validate toàn bộ timeline bị ảnh hưởng: không chỉ số dư hiện tại. Correction
W1 phải rebuild/cập nhật W1 và các closing/opening balances W2 trở đi, không
chỉ sửa một dashboard. Có thể từ chối correction nếu tạo âm ở bất kỳ mốc nào.

## 5. Công thức tồn kho theo vị trí, trạng thái và SKU

SellableClose = SellableOpen + receipts + returnsIn + transfersIn
                - sales - giftsGood - newlyDamaged - returnsOut - transfersOut
DamagedClose = DamagedOpen + newlyDamaged - giftsDamaged - destroyed - damagedTransfersOut
PhysicalClose = SellableClose + DamagedClose (+ trạng thái khác nếu có)
AvailableToAllocate = WarehouseSellableOnHand - ActiveReservations

Đặt hàng chỉ tăng reservation, không làm mất physical onHand. Dispatch giảm
physical kho và tăng in-transit; receive giảm in-transit tăng onHand thành viên.
Transfer trong hệ thống không làm đổi tổng physical toàn mạng.
Tồn sellable, physical, reserved và available phải là bốn chỉ số riêng.

Hàng hư 5 rồi tặng chính 5 đó:
1. DAMAGE chuyển 5 sellable sang damaged: sellable -5, damaged +5, physical không đổi.
2. GIFT_DAMAGED xuất 5 khỏi damaged: damaged -5, physical -5; không trừ sellable lần nữa.
Nếu ghi một operation DAMAGE_AND_GIFT thì thực hiện hai movement liên kết,
chi phí write-off vẫn chỉ ghi một lần. Hàng tốt tặng là GIFT_GOOD: sellable
và physical giảm một lần, revenue/sold/KPI bán không tăng.
Quantity gift không được vượt balance đúng condition/lot. Có thể damage ở
kho trung tâm hoặc thành viên; không mặc định mọi hao hụt là lỗi thành viên.

## 6. Doanh thu, lợi nhuận và tiền nộp

Đây là quy ước quản trị đề xuất, cần chốt giá vốn/discount/commission/tax.
RevenueNet = tổng gross sales - sales discounts - accepted sales refunds.
COGS = giá vốn thực phân bổ cho số đã bán - giá vốn hoàn nhập khi hàng trả
lại đủ điều kiện ghi nhận; không dùng toàn bộ giá trị cấp hàng làm COGS.
GrossProfit = RevenueNet - COGS.
Contribution = GrossProfit - DamageWriteOff - GoodGiftCost - MemberCommission - DirectSellingCosts.
OperatingProfit = Contribution - chi phí vận hành phân bổ theo policy.

Giá vốn theo lô hoặc moving weighted average phải chọn và version trước code;
FIFO không được tự áp dụng khi chủ dự án chưa chốt. Snapshot cost/price tại
sự kiện liên quan; giá product thay đổi không rewrite lịch sử. Không có cost
thì trả profit=null, missingCostLines>0; không dùng 0 để bịa lợi nhuận.
DAMAGE ghi write-off giá trị carrying cost (giả định recoverable value=0);
GIFT_DAMAGED sau write-off không thêm cùng chi phí lần nữa. Nếu chi phí đã
ghi vào W1, tặng ở W2 không đưa write-off vào W2 lần hai.

CashCollected/BankIn = dòng tiền thực; khác revenue. Supplier payment thuộc
cash out, không tự làm COGS cả kỳ. NetCashFlow=IN-OUT; BankBalance cần opening
balance và phạm vi account. StatementPage gọi tổng IN-OUT là realBalance chưa
đủ để chứng minh số dư ngân hàng, càng không phải lợi nhuận.
Receivable được tính theo policy phải nộp (doanh số sau commission/returns,
hoặc mua đứt); không suy ra nghĩa vụ từ order.totalAmount khi chưa chốt mô hình.

## 7. KPI thành viên và nhiều tuần

Per member-period trả: net revenue, net sold units, received units, opening/
closing sellable & physical, damage/gift, gross/contribution (hoặc unknown),
target metric/target/version, achievement, report completeness/timeliness.
RevenueAchievement = RevenueNet / RevenueTarget × 100 nếu target >0.
Target=0 hoặc thiếu: N/A, không chia 0 hay tự đặt 100%. Negative net revenue
có thể hợp lệ khi returns nhiều; đừng clamp thành 0 trong metric gốc.

RangeAchievement = Σ actual_i / Σ target_i ×100 với cùng metric/currency và
scope tuần có target hợp lệ. Không lấy trung bình % các tuần. Nếu tuần thiếu
target/data, full range trả INCOMPLETE; có thể thêm partial achievement ghi rõ
excludedWeeks, không giả vờ đó là kết quả đầy đủ.
Ví dụ tuần actual/target 100/100 và 100/1000: range=200/1100=18.18%, không
phải (100%+10%)/2=55%. Per-week leaderboard, historical group và metric version
phải ổn định, ties có cách xử lý công khai.

SellThrough nếu dùng: netSold / unitsAvailableForSale theo cùng scope; mẫu số
cần chốt có bao gồm carryover, transfers/returns và hàng hư/tặng hay không.
Không dùng received trong tuần làm mẫu số nếu có tồn đầu kỳ (có thể >100%).
Không gộp KPI bán với giao hàng đúng hạn hay nộp báo cáo đúng hạn thành điểm
chung nếu chưa có trọng số/policy được phê duyệt.

## 8. Đối chiếu các trang hiện tại

| Trang | Sai lệch / giới hạn hiện tại | Contract kết quả đúng |
| --- | --- | --- |
| ReportPage:81-137 | APPROVED tính như đã nhận; createdAt T7→T6; lấy một report gần nhất làm tồn đầu; item.find chỉ lấy dòng trùng đầu; Math.max che số âm | Receipt + ledger theo effectiveAt; opening từ toàn lịch sử; tổng mọi dòng; lỗi invariant phải báo |
| ReportPage:158-194 | Tự clamp sold/damaged rồi lấy p.price hiện tại; không gift | Backend validate, không im lặng giảm input; price/cost snapshot; conditions và gift riêng |
| DistributorDashboard:16-50 | Monday local đổi sang UTC date; sold cộng cả pending/rejected; ordered total mọi status là chi phí nhập | Canonical period; approved metrics đồng bộ; request value khác actual COGS/cash |
| AdminDashboard:23-55 | Cộng approved report totals; chart key month/day thiếu năm; group/name hiện tại làm key | Aggregate accepted unique lines theo memberId/periodId/historical group; không collision |
| ReportManager:53-118 | Filter theo weekStartDate, missing reporter là không có report nào trong cả range | Calendar spine member×week; required/complete/missing từng tuần; deadline/gia hạn riêng |
| ReceivedOrderManager:79-149 | Kho hiện tại + approved range - received range; filter ngày đặt, không ngày nhận | Ledger balance tại asOf; reservations mọi kỳ; receipt line/date; count-progress khác quantity-progress |
| OrderManager:104-132 | order.totalAmount đã duyệt cộng vào biến revenue; active dù order rejected | Giá trị cấp hàng riêng; actual selling performance từ sales; định nghĩa active rõ |
| ProductManager:42-69 | Admin sửa stock trực tiếp thiếu movement/audit | Stock adjustment document có reason, actor, expected balance/version |
| StatementPage:209-223,389-401 | IN-OUT chưa gồm opening; breakdown tag dùng mọi statement và giao dịch nhiều tags xuất hiện nhiều lần | Account/period scope rõ; tag breakdown non-additive hoặc allocation weights; không gọi profit |
| HistoryPage | Hiển thị totals raw, không revision/deadline/approval timestamps | Tách lịch sử submission và performance period; link revisions, trạng thái provisional/final |

Filter danh sách không được đổi số dư kho thật. Dashboard, member page và
report export cùng scope/asOf/revision phải cho số giống nhau.

## 9. Fixture độc lập để chốt cách tính

Giả định 1 SKU, giá bán 10.000đ, giá vốn lô cố định 6.000đ (chỉ fixture).
Kho trung tâm mở 100. Member A không có tồn đầu W1.
Đặt CN04/10 20, thực nhận T4 07/10; nhập bổ sung 10 nhận T6 09/10.
Hai khai báo bán W1 là delta 8 + 4; hư 3, tặng chính 3 hàng hư; tặng 2 hàng tốt.
Nộp sau hạn vào 13/10 được gia hạn, effective period vẫn W1.

| Kết quả W1 | Giá trị |
| --- | --- |
| Thực nhận / bán | 30 / 12 |
| Hàng hư / tặng hư / tặng tốt | 3 / 3 / 2 |
| Member sellable / damaged / physical cuối | 13 / 0 / 13 |
| Kho trung tâm physical / available sau hoàn tất receipts | 70 / 70 |
| Physical toàn mạng | 83 = 100 - 12 bán - 3 tặng hư - 2 tặng tốt |
| Revenue / COGS / GrossProfit | 120.000 / 72.000 / 48.000đ |
| DamageWriteOff / GoodGiftCost / Contribution | 18.000 / 12.000 / 18.000đ |
| KPI doanh thu target 200.000 | 60% |

W2 nhận bổ sung 5, bán 10, không hư/tặng: opening=13, closing=8;
revenue=100.000, COGS=60.000, gross/contribution=40.000;
target=300.000 →33.33%. Hai tuần revenue=220.000, target=500.000,
achievement=44%, contribution=58.000. Closing hai tuần là 8,
không phải cộng hai closing 13+8. W1 nhận 30, W2 nhận 5, closing range:
0+35-22-3-2=8 sellable; giftDamaged không trừ sellable lại.

## 10. Verification và implementation gates

Review → calendar/time contracts → movement/valuation contracts → transaction
commands → server aggregates → page integration. Chưa đổi business code.

Verify cô lập: `node scripts/audit-probes.cjs` và
`node scripts/weekly-calculation-probes.cjs`. Script sau trích tính toán từ
source TSX rồi chạy trên fixture; không chạy browser hoặc database. Một phần
assert expected fixture chỉ kiểm chứng công thức đề xuất, không chứng minh
production đã implement. Artifacts `evidence/weekly-calculation-probes.json`.

DB thật bắt buộc trước claim ACID: multi-line rollback; concurrent stock=1;
concurrent report approvals; repeat/unknown commit; sửa request sau partial
receipt; cancel/reject một lần; damage→gift không double expense; backdated
sale trước receipt bị reject; reopen W1 không làm âm W2; close vs late approve
chỉ một state transition hợp lệ. Kiểm tra journal/write concern, primary failover,
backup/restore. Chưa chạy các gate đó do chưa có test DB/topology được cấu hình.

Quality/read model: count và amount đối chiếu source→aggregate→API→page;
replay không nhân metrics; cùng asOf/revision giữa trang; incomplete tuần không
thành 0; timezone boundary T2/CN; hai năm cùng nhãn ngày; đổi giá/nhóm/target;
refund khác tuần; returns/gift không tạo KPI bán; target 0; 2 report cùng kỳ;
gia hạn giữ effective week; adjustment invalidates các kỳ sau; tiền integer
và overflow. Cache có dataRevision và stale/provisional flag; không tự expose
bảng tổng hợp mất đồng bộ như final.

## Decisions

- Nhiều đơn và report/tuần là nghiệp vụ hợp lệ, không unique(member,week) cho
  từng submission; unique cho business event/idempotency/revision.
- Gia hạn nộp tách khỏi khoảng phát sinh; ngày đặt không thay ngày nhận.
- Hư→tặng là lifecycle hai trạng thái, không hai lần trừ sellable/chi phí.
- Phân biệt request value/revenue/COGS/profit/cash và physical/available.
- ACID đánh giá theo transaction boundary, không theo danh tiếng database.

## Open issues

Giá vốn theo lô/cố định/FIFO/bình quân; KPI mục tiêu và commission; doanh số
mua đứt hay ký gửi; bán theo giá cố định hay giảm giá; kỳ tuần chính thức;
policy hàng hư/tặng/returns, thu hồi goods; đóng toàn kỳ hay theo từng thành viên;
quy trình reopen, phân bổ chi phí vận hành, dữ liệu ngày bán có được ghi đủ.

## Non-goals

Chưa rewrite framework, migrate database, sửa số liệu production hoặc tuyên
bố lợi nhuận chuẩn kế toán/tax. Công thức profit là quản trị nội bộ đề xuất.

## Nguồn kỹ thuật

[MongoDB atomicity](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)
xác định giới hạn atomic một document và cần điều kiện expected value để tránh
xung đột. [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
mô tả ACID phụ thuộc read/write concern.
[Write concern](https://www.mongodb.com/docs/manual/reference/write-concern/)
là căn cứ đánh giá acknowledgment/durability;
[Mongoose transactions](https://mongoosejs.com/docs/transactions.html)
hướng dẫn dùng session/transaction, không parallelize thao tác bên trong transaction.
