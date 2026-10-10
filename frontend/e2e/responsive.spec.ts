import { test, expect } from "@playwright/test";

test("admin and member pages reflow from small phones to desktop", async ({
  browser,
}) => {
  test.setTimeout(120000);
  for (const username of ["admin", "alice"]) {
    const context = await browser.newContext({
      viewport: { width: 320, height: 640 },
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.locator(".login-form")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await page.getByLabel("Tên đăng nhập").fill(username);
    await page
      .getByLabel("Mật khẩu", { exact: true })
      .fill("browser-fixture-password");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Tổng quan hoạt động" }),
    ).toBeVisible();
    const paths =
      username === "admin"
        ? [
            "/",
            "/orders",
            "/reports",
            "/inventory",
            "/members",
            "/finance",
            "/tasks",
          ]
        : ["/", "/orders", "/reports", "/inventory"];
    for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: width >= 768 ? 900 : 812 });
      for (const path of paths) {
        await page.goto(path);
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.getByRole("status")).toHaveCount(0);
        await expect(page.getByRole("alert")).toHaveCount(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${username} ${path} width ${width}: page overflow`,
        ).toBe(true);
        if (width <= 700) {
          const controls = await page
            .locator("input, select, textarea, button, nav a")
            .evaluateAll((elements) =>
              elements
                .filter((el) => el.getBoundingClientRect().height > 0)
                .map((el) => el.getBoundingClientRect().height),
            );
          expect(
            controls.every((height) => height >= 44),
            `${path}: touch target size`,
          ).toBe(true);
        }
        const tables = page.getByRole("region", {
          name: "Bảng dữ liệu, cuộn ngang để xem đầy đủ",
        });
        for (let i = 0; i < (await tables.count()); i++) {
          const table = tables.nth(i);
          await expect(table).toHaveAttribute("tabindex", "0");
          await table.focus();
          await expect(table).toBeFocused();
        }
      }
      if (username === "admin" && [320, 768, 1440].includes(width)) {
        await page.goto("/");
        await expect(page.getByRole("status")).toHaveCount(0);
        await page.screenshot({
          path: `test-results/responsive-${width}.png`,
          fullPage: true,
        });
      }
    }
    expect(errors).toEqual([]);
    await context.close();
  }
});
