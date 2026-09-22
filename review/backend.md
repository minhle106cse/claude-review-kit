# Rubric — Dịch vụ backend (HTTP / RPC / queue / job)

> Áp mọi ngôn ngữ và framework. Tên framework chỉ là ví dụ — tìm cơ chế tương
> đương trong repo. Mặc định của framework/thư viện (timeout, ép kiểu, cấu hình
> toàn cục có áp cho mọi transport không…) **khác nhau giữa thư viện và phiên bản**:
> rule nói *phải kiểm gì*; kết luận dựa trên hành vi thư viện → *luật bằng chứng
> riêng* của `base`.
> Nguồn chính: OWASP REST Security, Authorization, Node.js Security cheat sheets;
> protobuf.dev Dos & Don'ts.
> Cách đọc: **lỗi** — hậu quả. *Kiểm:* cách xác nhận trước khi gắn CHẮC.

## 1. Phân quyền — deny by default, kiểm trên từng request

- **Endpoint/handler/consumer mới không có kiểm quyền** → public ngoài ý muốn
  (**BLOCKER**). *Kiểm:* đọc đủ ba tầng — guard toàn cục, cấp controller/router, cấp
  method — và mọi cơ chế "bỏ qua xác thực" (decorator public, danh sách loại trừ).
- **IDOR — có xác thực, thiếu phân quyền trên tài nguyên**: đổi id là đọc/sửa được
  của người khác. Mọi truy vấn theo id phải ràng thêm chủ sở hữu/tenant/quan hệ
  (`{ id, ownerId }`, không chỉ `{ id }`) (**BLOCKER**). Id khó đoán (UUID) không
  thay được kiểm quyền.
- **Danh tính / vai trò lấy từ input** (body, param, query, header tự đặt) thay vì
  từ danh tính đã xác thực.
- **Điều kiện phân quyền đổi** — đọc từng dòng: `&&` ↔ `||`, đảo `!`, bỏ một vai
  trò, thêm nhánh `return true` sớm, so sánh id sai kiểu (luôn `false` hoặc luôn
  `true`). Luật bị **nới** so với trước là chỗ lỗ hổng hay trốn.
- **Kiểm quyền chỉ ở UI** (ẩn nút) mà API không kiểm.
- **Luật phân quyền rải nhiều nơi** thay vì một chỗ → lần sửa sau sót một chỗ.
- **Metadata phân quyền đặt một chỗ, đọc chỗ khác** (khai ở method nhưng guard đọc ở
  class, hoặc ngược lại) → luật không bao giờ áp. *Kiểm:* cách guard đọc metadata.
- **Thao tác nhiều bước không kiểm trạng thái**: gọi bước 3 mà không qua bước 1–2
  (xác minh, thanh toán, duyệt); token của bước này dùng được cho bước khác.
- **Tài nguyên tĩnh / file lưu trữ** (bucket, CDN, URL ký) không theo cùng chính sách
  quyền với API; URL ký thời hạn quá dài.
- **Endpoint quản trị/nội bộ** lộ ra ngoài cùng cổng với API công khai.

## 2. Xác thực & phiên

- **Token**: không cố định thuật toán khi verify; không kiểm `exp`/`nbf`/`iss`/`aud`;
  secret yếu/hardcode; không thu hồi được (không denylist/phiên phía server).
- **Token một-mục-đích** (xác minh email, đặt lại mật khẩu, xác nhận thao tác nguy
  hiểm) ký cùng khoá/audience với access token → dùng được như access token. Phải có
  `aud`/`purpose` riêng và bị chặn ở bộ xác thực chính.
- **Refresh token** không xoay vòng; đăng xuất / đổi mật khẩu không thu hồi phiên cũ.
- **Mã OTP / mã xác minh**: không giới hạn lần thử, không hết hạn, dùng lại được,
  so sánh không hằng thời gian, sinh bằng nguồn ngẫu nhiên không mật mã.
- **OAuth/OIDC**: thiếu/không kiểm `state` (CSRF); `redirect_uri` từ tham số không
  whitelist (open redirect → lộ code); liên kết tài khoản theo email khi provider
  chưa xác minh email (**BLOCKER**); không kiểm `nonce`/`aud` của ID token.
- **Secret/token trong URL** → lộ qua log, lịch sử, `Referer`.
- **Cookie phiên** thiếu `HttpOnly`/`Secure`/`SameSite`; thao tác đổi trạng thái dựa
  trên cookie mà không chống CSRF.
- **CORS** cho phép origin phản chiếu từ request kèm credentials (**BLOCKER**);
  wildcard ở API cần xác thực.
- **Mật khẩu**: hash không phải thuật toán chậm chuyên dụng; log/trả về hash; không
  giới hạn đăng nhập sai (brute force).

## 3. Biên vào — validate & giới hạn

- **Validate ở biên thiếu**: kiểu, độ dài, khoảng, enum, định dạng, số phần tử mảng,
  độ sâu object lồng. Allowlist thay vì blocklist.
- **Mass assignment**: nhận nguyên body rồi tạo/cập nhật entity → client set được
  `role`, `verified`, `ownerId`, `deletedAt`. *Kiểm:* validator có loại field lạ
  không (cấu hình whitelist/strip toàn cục), DTO lồng có được validate đệ quy không.
- **Ép kiểu ngầm của lớp validate/transform**: chuỗi `"false"` có thể thành `true`,
  `""` thành `0`, `null` lọt qua "tuỳ chọn". *Kiểm:* cách thư viện ép kiểu boolean/số
  từ query/form trong đúng version repo dùng.
- **Cấu hình validate/guard toàn cục không áp cho mọi transport**: HTTP có, nhưng
  handler RPC/queue/websocket gắn thêm vào cùng app có thể **không** kế thừa.
  *Kiểm:* cách framework gắn transport phụ và tuỳ chọn kế thừa cấu hình.
- **Không giới hạn kích thước**: body, file (kiểm loại bằng nội dung, không bằng
  đuôi), số item batch, `limit` phân trang.
- **Content-Type** không kiểm / chấp nhận mọi loại; parser XML không tắt entity ngoài
  (XXE).
- **HTTP method** không giới hạn (GET đổi trạng thái → CSRF, cache, prefetch).
- **Rate limit** thiếu ở endpoint đắt hoặc nhạy cảm (đăng nhập, OTP, quên mật khẩu,
  gửi mail/SMS, tìm kiếm, export). *Kiểm:* đơn vị thời gian của cấu hình (giây hay
  mili giây tuỳ thư viện/phiên bản); bộ đếm trong bộ nhớ process → mỗi replica đếm
  riêng; sau proxy phải lấy IP thật, nếu không mọi người dùng chung một bucket.

## 4. Biên ra

- **Trả entity/document nguyên vẹn** → lộ hash mật khẩu, token, id liên kết ngoài,
  ghi chú nội bộ, dữ liệu người khác. Dùng DTO/serializer tường minh.
- **Lỗi lộ chi tiết** (stack, câu truy vấn, host, message thư viện).
- **Phân biệt được "không tồn tại" và "không có quyền"** (mã lỗi, message, thời gian
  phản hồi) → dò được id/email tồn tại.
- **Mã trạng thái sai nghĩa**: 200 kèm lỗi trong body; 500 cho lỗi người dùng; 401
  lẫn 403.
- **Response nhạy cảm không `Cache-Control: no-store`** → proxy/trình duyệt lưu.
- **Danh sách không phân trang** hoặc `limit` không chặn trên.
- **Đổi hình dạng response** (bỏ field, đổi kiểu, `null` ↔ vắng, đổi tên) không
  versioning, không báo client. *Kiểm:* grep mọi consumer (web, mobile, service khác).

## 5. Dữ liệu & giao dịch

- **N+1**: gọi DB/service trong vòng lặp.
- **Ghi liên quan không nằm trong một giao dịch** → trạng thái nửa vời khi lỗi giữa chừng.
- **Giao dịch + gọi ra ngoài**: ghi DB trong giao dịch rồi gọi service/queue (hoặc
  ngược lại) → một bên commit, bên kia không. Hỏi: bước sau fail thì trạng thái cuối
  là gì? Cần outbox, bù trừ, hoặc thứ tự an toàn.
- **Đọc-rồi-ghi không nguyên tử** (kiểm quota/số dư/trùng rồi mới ghi) → race; cần
  điều kiện trong câu ghi, ràng buộc unique, hoặc khoá lạc quan.
- **Tạo/thanh toán/gửi không idempotent** → retry của client/queue/gateway sinh
  trùng. Cần idempotency key hoặc ràng buộc unique.
- **Xoá mềm không nhất quán**: query mới quên lọc bản ghi đã xoá; xoá cứng ở nơi hệ
  thống dựa vào xoá mềm.

## 6. Gọi ra ngoài & độ bền

- **Không timeout** cho HTTP/RPC/DB/SDK — nhiều client mặc định chờ vô hạn.
- **Retry** không backoff/jitter; retry lỗi không nên retry; retry lồng nhiều tầng →
  khuếch đại tải đúng lúc dịch vụ phụ thuộc đang yếu.
- **Dịch vụ không quan trọng chặn đường chính** (analytics, geo, gợi ý) — không
  fallback, không bất đồng bộ hoá.
- **Fan-out không giới hạn** trên danh sách do người dùng điều khiển.
- **SSRF**: server fetch URL từ người dùng (avatar URL, webhook, preview) không chặn
  địa chỉ nội bộ/metadata cloud (**BLOCKER**).
- **Secret/endpoint hardcode** thay vì cấu hình/secret manager.
- **Chặn luồng xử lý** bằng việc CPU nặng đồng bộ trong request (runtime đơn luồng).

## 7. Job, message, vận hành

- **Consumer không chịu được message trùng** — hầu hết hàng đợi là at-least-once;
  xử lý phải idempotent.
- **Không phân biệt lỗi tạm và vĩnh viễn**: dữ liệu hỏng vẫn ném để retry (xoay vòng
  tới DLQ); lỗi tạm bị nuốt (mất message).
- **Ack/xoá message trước khi xử lý xong** → mất khi crash.
- **Thời gian khoá message (visibility/lease) < thời gian xử lý** → xử lý song song hai lần.
- **Một item lỗi làm fail cả batch** → cả batch retry; cần báo lỗi từng item.
- **Job định kỳ chạy trong service scale ngang** → chạy N lần; cần khoá phân tán
  hoặc worker riêng.
- **Job dài không chia lô / không checkpoint** → restart làm lại từ đầu, giữ khoá lâu.
- **Tác vụ đắt đồng bộ trong request** (xử lý ảnh, export, gửi hàng loạt) → timeout ở
  load balancer, người dùng bấm lại, chạy hai lần.
- **Log**: thiếu id tương quan; log PII/token/body nhạy cảm; mức log sai; log không
  có cấu trúc; dữ liệu người dùng vào log không làm sạch (log injection).
- **Sự kiện bảo mật không được ghi** (đăng nhập sai, đổi quyền, token không hợp lệ).
- **Không tắt êm** (`SIGTERM`) → request/message đang xử lý bị cắt khi deploy.
- **Lỗi không bắt ở cấp process** được "nuốt rồi chạy tiếp" thay vì log và tắt êm.

## 8. Framework có pipeline khai báo (DI, decorator, middleware)

Áp cho framework kiểu NestJS, Spring, ASP.NET, FastAPI, Express/Fastify có plugin:
- **Handler/provider mới không được đăng ký** trong module/container → lỗi lúc chạy,
  không lỗi build.
- **Thứ tự pipeline**: xác thực phải chạy trước phân quyền; filter/interceptor mới
  bắt quá rộng làm đổi mã lỗi của cả app.
- **Phạm vi vòng đời**: lưu dữ liệu theo request vào field của đối tượng singleton →
  rò giữa request (**BLOCKER**); đối tượng theo-request được inject vào singleton →
  giữ request cũ.
- **Exception của transport này ném trong transport khác** (lỗi HTTP ném trong
  handler RPC) → phía gọi nhận lỗi chung chung, mất phân loại.
- **Cấu hình không validate lúc khởi động** → thiếu biến môi trường lộ ra ở request
  đầu tiên dùng tới nó.
- **File bootstrap đổi** (header bảo mật, CORS, giới hạn body, trust proxy, tắt êm)
  → soát cả nhóm, vì mỗi thứ ảnh hưởng mọi endpoint.

## 9. Hợp đồng giữa service — RPC / proto / event

- **Đổi hình dạng dữ liệu mà không đổi định nghĩa hợp đồng** (đổi hàm serialize, bỏ
  field) — compiler không báo nếu phía gọi ép kiểu. *Kiểm:* grep mọi client của
  RPC/event đó, liệt kê field chúng đọc.
- **Protobuf — tương thích ngược** (protobuf.dev):
  - không tái dùng số field; xoá field phải `reserved` cả số lẫn tên (**BLOCKER** nếu
    tái dùng số);
  - không đổi kiểu field; không đổi `repeated` ↔ đơn; không đổi giá trị mặc định;
  - enum có giá trị 0 là `*_UNSPECIFIED`; xoá giá trị enum phải `reserved`;
  - không thêm field `required`;
  - `bool` cho thứ có thể cần trạng thái thứ ba → dùng enum;
  - tách message của API khỏi message lưu trữ;
  - đổi tên field an toàn cho wire nhưng vỡ code sinh ra / JSON mapping.
- **Không phân biệt "không gửi" với giá trị zero** (proto3 scalar, JSON bỏ field)
  khi nghiệp vụ cần phân biệt → dùng field `optional`/wrapper. *Kiểm:* cấu hình
  decode của thư viện (có điền giá trị mặc định cho field vắng không, int64 ra kiểu
  gì) — đổi cấu hình này đổi hành vi mọi handler.
- **Client RPC không có deadline** → một service treo kéo cả chuỗi treo.
- **Mã lỗi RPC**: server không trả mã chuẩn (NOT_FOUND, INVALID_ARGUMENT…) → client
  không phân biệt được; client không map mã về lỗi phù hợp → mọi lỗi thành 500.
- **API batch không giới hạn số phần tử**; message vượt giới hạn kích thước mặc định
  khi dữ liệu lớn dần.
- **Đổi schema event/message** khi consumer cũ còn chạy → deploy lệch phiên bản làm
  consumer cũ lỗi. Thêm field được; bỏ/đổi field phải qua nhiều lần deploy.
- **Hợp đồng nằm ở module/submodule dùng chung** mà diff chỉ thấy con trỏ → ghi Vùng
  mù, review phía repo con.

## 10. Serverless (khi có)

- Thời gian khoá message của hàng đợi nguồn phải dài hơn nhiều lần timeout của hàm
  (AWS khuyến nghị ≥ 6× cho SQS → Lambda).
- Client/kết nối tạo trong handler thay vì ngoài → mở lại mỗi lần gọi.
- State cấp module bị ghi theo từng lần gọi → rò sang lần gọi sau cùng container.
- Hàm gọi DB không giới hạn concurrency → cạn kết nối DB.

## Không báo — dễ báo sai

- "Thiếu kiểm quyền" khi chưa đọc guard toàn cục và guard cấp class/router.
- "Thiếu validate" khi DTO/schema đã validate và pipeline toàn cục áp cho transport đó.
- N+1 trên danh sách có kích thước chặn trên nhỏ và cố định.
- Thiếu retry/circuit breaker cho lời gọi nội bộ không quan trọng, chịu lỗi được.
- Đề xuất đổi kiến trúc (thêm queue, tách service) trong PR sửa lỗi nhỏ.
