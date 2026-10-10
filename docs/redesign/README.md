# Redesign review index

- [Chạy local và full check](local-development.md): Mongo volume riêng, API/UI và hạ tầng test tách biệt.
- [Kiểm chứng dữ liệu lớn](scale-verification.md): 1.000 thành viên, giao dịch HTTP đồng thời và Chromium thật.
- [Đánh giá sau refactor](refactor-assessment.md): ACID, công thức và giới hạn thực tế.
- [Implementation/runbook](refactor-runbook.md): changes, startup, verification and migration gate.
- [Implementation contract](implementation-contract.md) and [data contract](data-contract.md).
- [Architecture baseline](architecture-review.md): original 18 findings at ecbac8b.
- [Weekly accounting baseline](acid-weekly-accounting-review.md): original formula defects and confirmed multi-order/report workflows.
- [Redesign direction](redesign-direction.md): initial proposal; implemented scope and remaining policies are tracked in the runbook.

Current tests: backend/test (domain + real replica-set HTTP integration), frontend/e2e
(real browser against fixture API). Historical baseline probes are archived under
historical-probes and cannot be used as current acceptance tests.

Latest full check: [evidence/full-check/verification.json](evidence/full-check/verification.json).
Local running app: [evidence/full-check/local-runtime.json](evidence/full-check/local-runtime.json).

Earlier evidence: final-verification.json, backend-tests.txt, frontend-checks.txt,
failover.json, browser-results.json and screenshots under evidence/ after verification.
