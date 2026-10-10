import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, username: string) {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto("/");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("browser-fixture-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tổng quan hoạt động" }),
  ).toBeVisible();
}
test("admin creates stock; member requests, receives, reports; server-derived dashboard agrees", async ({
  browser,
}) => {
  const adminContext = await browser.newContext(),
    memberContext = await browser.newContext();
  const admin = await adminContext.newPage(),
    member = await memberContext.newPage();
  await login(admin, "admin");
  await admin.getByRole("link", { name: "Kho & sản phẩm" }).click();
  await admin
    .getByLabel("Tên sản phẩm", { exact: true })
    .fill("Sản phẩm kiểm chứng");
  await admin.getByLabel("Giá bán (đ)", { exact: true }).fill("10000");
  await admin.getByLabel("Giá vốn mỗi sản phẩm").fill("6000");
  await admin.getByLabel("Tồn tốt đầu kỳ").fill("100");
  await admin
    .getByRole("button", { name: "Tạo sản phẩm", exact: true })
    .click();
  await expect(
    admin.getByRole("cell", { name: "Sản phẩm kiểm chứng" }),
  ).toBeVisible();
  await login(member, "alice");
  await member.getByRole("link", { name: "Cấp hàng" }).click();
  await member
    .getByRole("spinbutton", { name: "Số lượng Sản phẩm kiểm chứng" })
    .fill("10");
  await member.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(member.getByText("PENDING", { exact: true })).toBeVisible();
  await admin.getByRole("link", { name: "Cấp hàng" }).click();
  await admin.getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect(admin.getByText("APPROVED", { exact: true })).toBeVisible();
  await member.reload();
  await member.getByRole("button", { name: "Ghi nhận số thực nhận" }).click();
  await expect(member.getByText("RECEIVED", { exact: true })).toBeVisible();
  await member.getByRole("link", { name: "Hàng đang giữ" }).click();
  await expect(
    member.getByRole("cell", { name: "Sản phẩm kiểm chứng" }),
  ).toBeVisible();
  await member.getByRole("link", { name: "Báo cáo", exact: true }).click();
  await member.getByLabel("Đợt thực nhận").selectOption({ index: 1 });
  await member.getByLabel("Bán thêm").fill("4");
  await member.getByLabel("Hư mới").fill("2");
  await member.getByLabel("Tặng hàng hư").fill("2");
  await member.getByRole("button", { name: "Lưu báo cáo" }).click();
  await expect(member.getByText("PENDING", { exact: true })).toBeVisible();
  await admin.getByRole("link", { name: "Báo cáo", exact: true }).click();
  await admin.getByRole("button", { name: "Duyệt báo cáo" }).click();
  await expect(admin.getByText("APPROVED", { exact: true })).toBeVisible();
  await member.getByRole("link", { name: "Tổng quan" }).click();
  await expect(
    member.getByText("40.000", { exact: false }).first(),
  ).toBeVisible();
  await expect(member.getByText("4 tốt / 4 vật lý")).toBeVisible();
  await member.screenshot({
    path: "test-results/member-dashboard.png",
    fullPage: true,
  });
  await admin.getByRole("link", { name: "Tổng quan" }).click();
  await expect(
    admin.getByText("40.000", { exact: false }).first(),
  ).toBeVisible();
  await expect(admin.getByText("4 tốt / 4 vật lý")).toBeVisible();
  await admin.screenshot({
    path: "test-results/admin-dashboard.png",
    fullPage: true,
  });
  await member.setViewportSize({ width: 390, height: 844 });
  await member.screenshot({
    path: "test-results/mobile-dashboard.png",
    fullPage: true,
  });
  expect(
    await member.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await adminContext.close();
  await memberContext.close();
});
test("admin manages member targets, cash reference and internal work", async ({
  page,
}) => {
  await login(page, "admin");
  await page.getByRole("link", { name: "Thành viên", exact: true }).click();
  await page
    .getByLabel("Tên đăng nhập", { exact: true })
    .fill("fixture-new-member");
  await page
    .getByLabel("Tên thành viên", { exact: true })
    .fill("Thành viên kiểm chứng");
  await page.getByLabel("Mật khẩu ban đầu").fill("new-browser-fixture-pass");
  await page.getByLabel("Nhóm", { exact: true }).fill("Tài Chính");
  await page
    .getByRole("button", { name: "Cấp tài khoản", exact: true })
    .click();
  const row = page
    .getByRole("row")
    .filter({ has: page.getByText("Thành viên kiểm chứng", { exact: true }) });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Mục tiêu / gia hạn" }).click();
  await row.getByLabel("Mục tiêu doanh thu").fill("200000");
  await row.getByLabel("Lý do", { exact: true }).fill("Mục tiêu kiểm chứng");
  await row.getByRole("button", { name: "Lưu mục tiêu / gia hạn" }).click();
  await expect(row.getByText("Đang lưu…")).toHaveCount(0);
  await page.getByRole("link", { name: "Thu / chi" }).click();
  await page.getByLabel("Số tiền (đ)", { exact: true }).fill("150000");
  await page
    .getByLabel("Đối tác", { exact: true })
    .fill("Thành viên kiểm chứng");
  await page.getByLabel("Mã giao dịch duy nhất").fill("browser-bank-reference");
  await page
    .getByRole("button", { name: "Ghi giao dịch", exact: true })
    .click();
  await expect(
    page.getByText("browser-bank-reference", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Công việc", exact: true }).click();
  await page.getByLabel("Tên công việc", { exact: true }).fill("Đối soát tuần");
  await page
    .getByRole("button", { name: "Tạo công việc", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Đối soát tuần", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Trạng thái", { exact: true }).selectOption("DONE");
  await expect(page.getByLabel("Trạng thái", { exact: true })).toHaveValue(
    "DONE",
  );
});

test("approved correction preserves history and recalculates member stock and revenue", async ({
  page,
}) => {
  await login(page, "admin");
  await page.getByRole("link", { name: "Báo cáo", exact: true }).click();
  await page.getByRole("button", { name: "Điều chỉnh có lưu lịch sử" }).click();
  await expect(
    page.getByRole("heading", { name: "Điều chỉnh bản đã duyệt" }),
  ).toBeVisible();
  await page.getByLabel("Bán thêm").fill("3");
  await page.getByLabel("Lý do điều chỉnh").fill("Đối soát thực tế");
  await page.getByRole("button", { name: "Lưu báo cáo" }).click();
  await expect(page.getByText("SUPERSEDED", { exact: true })).toBeVisible();
  await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Tổng quan", exact: true }).click();
  await expect(
    page.getByText("30.000", { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByText("5 tốt / 5 vật lý")).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
  await login(page, "alice");
  await expect(
    page.getByText("30.000", { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByText("5 tốt / 5 vật lý")).toBeVisible();
  await page.goto("/tasks");
  await expect(
    page.getByRole("heading", { name: "Tổng quan hoạt động" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Công việc", exact: true }),
  ).toHaveCount(0);
});
test("finance tags filter without double counting; void and task archive are effective", async ({
  page,
}) => {
  await login(page, "admin");
  await page.getByRole("link", { name: "Thu / chi" }).click();
  await page.getByLabel("Tên nhãn mới").fill("Đối soát");
  await page.getByRole("button", { name: "Tạo nhãn", exact: true }).click();
  await expect(
    page
      .getByLabel("Nhãn giao dịch")
      .getByRole("option", { name: "Đối soát", exact: true }),
  ).toHaveCount(1);
  await page.getByLabel("Nhãn giao dịch").selectOption({ label: "Đối soát" });
  await page.getByLabel("Số tiền (đ)", { exact: true }).fill("25000");
  await page.getByLabel("Đối tác", { exact: true }).fill("Đối soát");
  await page
    .getByLabel("Mã giao dịch duy nhất")
    .fill("tagged-browser-reference");
  await page
    .getByRole("button", { name: "Ghi giao dịch", exact: true })
    .click();
  await expect(
    page.getByText("tagged-browser-reference", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Lọc theo nhãn").selectOption({ label: "Đối soát" });
  await expect(
    page.getByText("browser-bank-reference", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("25.000", { exact: false }).first(),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept("Đối soát hủy"));
  await page.getByRole("button", { name: "Hủy hiệu lực", exact: true }).click();
  await expect(
    page.getByText("tagged-browser-reference", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Công việc", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Đối soát tuần", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lưu trữ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Đối soát tuần", exact: true }),
  ).toHaveCount(0);
});
