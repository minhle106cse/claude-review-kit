# Rubric — Python

> Áp mọi phiên bản Python 3 và mọi framework (web, script, serverless, data). Cổng:
> thứ mà linter/type checker của repo (ruff, flake8-bugbear, mypy, pyright) bắt ở mức
> chặn CI → không báo (mục 0 của `base`); repo không có cổng → một finding hạ tầng,
> rồi soi tay cả những lỗi đó. API bị deprecated/thay đổi giữa phiên bản → đọc
> `requires-python`/runtime trước khi báo.
> Cách đọc: **lỗi** — hậu quả. *Kiểm:* cách xác nhận trước khi gắn CHẮC.

## 1. Injection & thực thi mã

- **SQL dựng bằng f-string / `%` / `.format`** (**BLOCKER**) — tham số của driver;
  tên cột/bảng động phải whitelist.
- **Lệnh shell với dữ liệu ngoài**: `shell=True`, `os.system`, `os.popen` (**BLOCKER**)
  — dùng danh sách tham số, không shell.
- **Giải tuần tự hoá không an toàn** trên dữ liệu không tin được: `pickle`, `marshal`,
  `yaml.load` không safe loader, `eval`/`exec` (**BLOCKER**).
- **Đường dẫn file từ input** không chuẩn hoá và kiểm nằm trong thư mục cho phép
  (path traversal); giải nén archive không lọc thành viên (`../`, symlink, file thiết bị).
- **Template không tự escape** với nội dung người dùng → XSS trong HTML/email.
- **XML parse với entity ngoài bật** (XXE) — dùng parser an toàn.
- **Fetch URL do người dùng đưa** → SSRF (chặn địa chỉ nội bộ, metadata cloud).
- **Ngẫu nhiên cho bảo mật** bằng `random` thay vì `secrets` (**BLOCKER** cho token/mã).

## 2. Gọi ra ngoài & tài nguyên

- **HTTP client không timeout** — một số thư viện phổ biến mặc định **không** có
  timeout → treo vô hạn. *Kiểm:* timeout ở từng lời gọi hoặc session.
- **SDK cloud**: tạo client trong vòng lặp/handler; không phân trang (API `list_*` chỉ
  trả trang đầu); không cấu hình retry/timeout cho lời gọi quan trọng; bắt `Exception`
  chung thay vì loại lỗi của SDK rồi đọc mã lỗi.
- **Không dùng context manager** cho kết nối, cursor, khoá, giao dịch, file tạm → rò
  khi có exception.
- **Retry tự viết** không backoff, không giới hạn, retry lỗi không nên retry.

## 3. Async & đồng thời

- **Gọi hàm blocking trong coroutine** (HTTP đồng bộ, `time.sleep`, I/O file, CPU nặng)
  → chặn cả event loop. Dùng thư viện async hoặc đẩy sang thread/process.
- **Task tạo ra không giữ tham chiếu** → có thể bị thu hồi giữa chừng; lỗi trong task
  không ai chờ → mất im lặng.
- **Thiếu `await`** trên coroutine (không có cổng thì soi).
- **Gom nhiều coroutine** mà một lỗi huỷ/hỏng cả nhóm ở tác vụ "tốt nhất có thể"; không
  giới hạn đồng thời.
- **Thread dùng chung object có thể sửa** không khoá; GIL không bảo vệ thao tác nhiều bước.

## 4. Bẫy ngữ nghĩa

- **Thời gian không múi giờ** (naive): `now()`/`utcnow()` không tz; so sánh naive với
  aware ném lỗi; lưu naive rồi hiểu là UTC chỗ này, giờ địa phương chỗ khác. Dùng
  datetime có tz.
- **Tiền dùng `float`** (**BLOCKER**) — `Decimal` tạo từ chuỗi.
- **So sánh float bằng `==`**; `round()` làm tròn kiểu ngân hàng (`round(2.5) == 2`).
- **Biến lặp bị closure/lambda bắt** → tất cả trỏ giá trị cuối.
- **Sửa list/dict trong lúc lặp** trên chính nó.
- **Thuộc tính mutable cấp class** dùng chung mọi instance; tham số mặc định mutable
  (nếu linter không chặn).
- **`x or default`** khi `0`/`""`/`False` là giá trị hợp lệ.
- **Encoding**: mở file/decode không chỉ định encoding (mặc định theo hệ điều hành).
- **`is` với số/chuỗi** thay `==`.
- **Import vòng / side effect lúc import** (kết nối, đọc env).

## 5. Lỗi & logging

- **Bắt rộng rồi đi tiếp** ở chỗ lẽ ra phải dừng/ném lại → dữ liệu nửa vời. Handler
  queue/serverless nuốt lỗi → hệ thống coi là thành công, message bị xoá.
- **Ném lỗi mới trong `except` không nối nguyên nhân** (`raise … from e`).
- **Log chứa PII/token/cả payload sự kiện**; `print` thay logger; cấu hình logging gốc
  bên trong thư viện/handler.

## 6. Handler serverless / worker

- **Kết nối/client tạo trong handler** → mở lại mỗi lần gọi; khởi tạo ở cấp module để
  tái dùng giữa các lần gọi ấm.
- **State cấp module bị ghi theo từng lần gọi** → rò sang lần gọi sau cùng container.
- **Payload sự kiện dùng thẳng như `dict`** không validate → lỗi thiếu key giữa chừng
  khi nguồn đổi hình dạng.
- **Batch message**: một bản ghi lỗi làm fail cả batch; hoặc nuốt lỗi từng bản ghi → mất.
- **Không kiểm thời gian còn lại** trong vòng lặp dài → bị cắt giữa chừng, làm dở.
- **Không idempotent** — nền tảng có thể gọi lại cùng sự kiện.

## 7. Kiểu & cấu trúc

- **Type hint sai** so với giá trị trả về thật (sai nguy hiểm hơn thiếu); `Optional` không
  được xử lý ở caller.
- **Validate dữ liệu ở biên** (request, config, message) thiếu — dùng thư viện schema.
- **Cấu hình đọc từ env rải rác**, không validate lúc khởi động.
- **Script vận hành** chạy trên production: không chế độ chạy thử, không xác nhận môi
  trường đích, không giới hạn phạm vi ghi.
- **Import nặng cấp module** làm chậm khởi động (quan trọng với serverless/CLI).

## 8. Test

- Test gọi mạng/cloud thật → flaky, tốn tiền; thiếu stub/mock ở ranh giới.
- Logic phụ thuộc thời gian mà không cố định thời gian trong test.
- Fixture phạm vi rộng dùng chung object có thể sửa.
- Chỉ test nhánh thành công.

## Không báo — dễ báo sai

- Thứ linter/type checker của repo chặn ở CI.
- `except Exception` ở ranh giới ngoài cùng có log đầy đủ và phản hồi lỗi đúng.
- Style (PEP 8, thứ tự import) — formatter lo.
- f-string trong câu SQL khi phần chèn là hằng/whitelist đã kiểm (không phải input).
