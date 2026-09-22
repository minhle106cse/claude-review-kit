# Rubric — Container / CI / pipeline / script vận hành

> Áp mọi nền tảng CI (GitHub Actions, GitLab CI, Jenkins, CircleCI…) và mọi công cụ
> build container. Ví dụ cú pháp lấy từ GitHub Actions — tìm cơ chế tương đương ở nền
> tảng thật của repo. Pipeline chạy **với quyền cao nhất hệ thống** (secret deploy, quyền
> ghi production) — lỗi ở đây đắt hơn lỗi trong app.
> Nguồn: GitHub "Security hardening for GitHub Actions", Docker "Building best
> practices", OpenSSF Scorecard.
> Cách đọc: **lỗi** — hậu quả. *Kiểm:* cách xác nhận trước khi gắn CHẮC.

## 1. Pipeline — bảo mật

- **Script injection**: dữ liệu do người ngoài kiểm soát (tiêu đề/nội dung PR hoặc
  issue, tên nhánh, commit message, input của trigger thủ công) chèn thẳng vào script
  (`run: echo "${{ github.event.pull_request.title }}"`) → chạy lệnh tuỳ ý trên runner
  (**BLOCKER**). Truyền qua biến môi trường trung gian rồi dùng có nháy.
- **Trigger chạy với secret trên code không tin được**: checkout rồi build/test code của
  PR trong ngữ cảnh có secret (`pull_request_target`, `workflow_run`, pipeline cho
  fork có biến bảo vệ) (**BLOCKER**). Artifact từ pipeline không tin được cũng là dữ
  liệu không tin được.
- **Action/image/template bên thứ ba ghim bằng tag hoặc nhánh** → tag bị ghi đè là
  chuỗi cung ứng bị chiếm (đã xảy ra thật với một action phổ biến năm 2025). Chỉ SHA
  đầy đủ là bất biến. Action chính chủ nền tảng: rủi ro thấp hơn — SHOULD.
- **Quyền token của pipeline** không khai báo hoặc rộng hơn cần; mặc định nên chỉ đọc,
  cấp thêm theo job.
- **Credential cloud dài hạn** trong secret thay vì liên kết danh tính ngắn hạn (OIDC);
  trust policy của role OIDC không giới hạn repo/nhánh/môi trường → pipeline bất kỳ
  assume được (**BLOCKER**).
- **Secret lộ ra log**: in trực tiếp, bật trace shell trong bước có secret, secret biến
  đổi (base64, cắt, bọc JSON) không còn được che.
- **Artifact/cache chứa secret** (`.env`, cấu hình đã render) được upload.
- **Sửa file pipeline không có người sở hữu duyệt** (CODEOWNERS cho thư mục pipeline);
  môi trường production không yêu cầu người duyệt.
- **Runner tự host** cho repo công khai / dùng lại giữa các job không tin cậy.

## 2. Pipeline — độ tin cậy deploy

- **Deploy không khoá đồng thời** → hai lần deploy chạy chồng, bản cũ đè bản mới.
- **Không có điều kiện nhánh/môi trường** rõ cho job deploy.
- **Deploy không chờ build/test**, hoặc test được phép fail.
- **Artifact deploy định danh bằng nhãn có thể ghi đè** (`latest`, tên nhánh) → không
  biết production đang chạy commit nào, không rollback được. Dùng SHA/digest.
- **Không chờ trạng thái ổn định / health** sau deploy → pipeline xanh khi service đang
  crash-loop.
- **Không có đường rollback**; migration chạy trước khi code tương thích sẵn sàng.
- **Cache dependency không khoá theo lockfile** → cache lệch phiên bản.
- **Bộ lọc đường dẫn/matrix** bỏ sót service khi thư mục dùng chung đổi.
- **Lịch chạy** hiểu theo UTC.
- **Bước quan trọng `continue-on-error`/`allow_failure`** không lý do.

## 3. Dockerfile / image

- **Secret qua build arg / biến môi trường** → nằm lại trong layer/metadata
  (**BLOCKER**); dùng cơ chế mount secret lúc build.
- **Build context thiếu `.dockerignore`** → kéo `.git`, `.env`, credential, dependency
  local vào image.
- **Chạy bằng root** không lý do — thêm `USER` với UID/GID tường minh.
- **Base image không ghim** (tag trôi) — tốt nhất ghim digest; image base không tin cậy
  hoặc quá lớn so với nhu cầu.
- **Không multi-stage** → image chứa toolchain, devDependencies, mã nguồn.
- **Thứ tự layer**: copy mã nguồn trước khi cài dependency → cài lại mỗi lần sửa code.
- **Cài dependency không theo lockfile**; cập nhật index gói và cài gói ở hai `RUN` khác
  nhau (cache index cũ); không dọn cache trong cùng layer.
- **Lệnh có pipe trong `RUN` không `pipefail`** → bước lỗi vẫn build thành công.
- **CMD/ENTRYPOINT dạng shell** → tiến trình chính không nhận `SIGTERM`, không tắt êm,
  bị kill cứng. Dùng dạng exec, hoặc init nhỏ.
- **`ADD` URL/archive không kiểm checksum** thay vì `COPY`.
- **Không có health check** (ở image hoặc ở orchestrator) cho service chạy dài.
- **Module native build ở môi trường khác môi trường chạy** (libc, kiến trúc) → crash
  lúc khởi động.

## 4. Compose / môi trường local

- Cổng DB/cache mở ra mọi interface trên máy dùng chung.
- Mật khẩu mặc định bị dùng lại ở môi trường thật.
- Volume đè thư mục dependency trong image.

## 5. Script shell / Makefile

- **Không dừng khi lỗi** (`set -euo pipefail` hoặc tương đương) → lệnh lỗi giữa chừng
  vẫn đi tiếp và báo thành công.
- **Biến không nháy** → tách từ, glob; biến rỗng làm lệnh xoá nhắm vào thư mục gốc
  (**BLOCKER** với `rm`). Dùng `"${VAR:?}"`.
- **Script thao tác production** không xác nhận môi trường/tài khoản đích, không chạy
  thử, không giới hạn phạm vi.
- **Tải và chạy script từ mạng** (`curl | sh`) không ghim phiên bản/checksum.
- **Parse output dành cho người đọc** bằng `grep`/`awk` thay vì định dạng máy đọc (JSON)
  → vỡ khi định dạng đổi.
- **Phụ thuộc bản cài đặt của công cụ** (GNU vs BSD `sed`/`date`, bash-ism trong
  `#!/bin/sh`) → chạy được máy này, hỏng máy khác/runner khác.
- **Makefile**: mỗi dòng recipe là một shell riêng (`cd` không tác dụng dòng sau);
  target không `.PHONY` trùng tên file.
- **Secret trong tham số dòng lệnh** → lộ qua danh sách tiến trình, history, log.

## Không báo — dễ báo sai

- Ghim tag cho action/image chính chủ nền tảng ở repo nội bộ — chỉ NIT/SHOULD, không BLOCKER.
- Chạy root trong image build tạm/stage không phải stage chạy cuối.
- Thiếu `pipefail` ở lệnh không có pipe.
- Style YAML/Dockerfile mà linter (actionlint, hadolint) của repo đã lo.
