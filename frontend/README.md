# Frontend XTN

React 19 + TypeScript, TanStack Query, Vite. Node 24.

```bash
npm ci
npm run dev
npm run typecheck
npm run lint
npm run build
```

Vite chuyển `/api` tới backend cổng 5000. `VITE_API_BASE_URL` mặc định `/api/v1`; chỉ cấu hình khi frontend và backend khác host. Không đặt secret trong biến VITE.

Các trang trong `src/features`; request và kiểu dữ liệu dùng chung trong `src/shared`. Tất cả tổng doanh thu/giá vốn/KPI đến từ backend. Browser E2E chạy bản build bằng preview ở 5174 và API test 5001, tách dev 5173/5000. Browser E2E cần backend và fixture Mongo riêng; xem [runbook](../docs/redesign/refactor-runbook.md).
