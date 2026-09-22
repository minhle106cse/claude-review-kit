# Rubric — Hạ tầng dạng mã (Terraform / OpenTofu; nguyên tắc dùng được cho IaC khác)

> Áp mọi cloud. Tên dịch vụ AWS/GCP/Azure trong ngoặc chỉ là ví dụ — tìm tài nguyên
> tương đương. **Thuộc tính nào gây thay thế tài nguyên (ForceNew) phụ thuộc provider
> và phiên bản** → kết luận "sẽ replace" phải dựa trên tài liệu thuộc tính đúng
> version hoặc output plan, không dựa trí nhớ; không có → trần NGỜ.
> **Diff Terraform không cho thấy tác động thật — plan mới cho thấy.** PR không kèm
> output plan cho môi trường đích → một finding SHOULD ở đầu review.
> Nguồn: HashiCorp Terraform style guide & recommended practices.
> Cách đọc: **lỗi** — hậu quả. *Kiểm:* cách xác nhận trước khi gắn CHẮC.

## 1. Phá huỷ & thay thế ngoài ý muốn — kiểm TRƯỚC mọi thứ khác

- **Đổi thuộc tính gây thay thế** trên tài nguyên giữ dữ liệu hoặc có định danh được
  nơi khác tham chiếu (DB, cache, volume, bucket, queue, key mã hoá, load balancer,
  DNS zone) → **BLOCKER** nếu PR không nêu và không có kế hoạch dữ liệu.
  *Kiểm:* tài liệu thuộc tính ("forces replacement") hoặc plan.
- **Đổi địa chỉ tài nguyên** (đổi tên resource, chuyển vào/ra module, đổi key
  `for_each`, chuyển `count` → `for_each`) **không có khối `moved`** → xoá cũ tạo mới.
  Với tài nguyên giữ dữ liệu/được tham chiếu → **BLOCKER**.
- **`count` trên danh sách** — chèn/xoá phần tử giữa làm lệch index → thay thế hàng
  loạt phần tử phía sau. Dùng `for_each` với key ổn định có ý nghĩa.
- **Key `for_each` từ giá trị chỉ biết sau apply** → plan lỗi; key từ thuộc tính có
  thể đổi (tên hiển thị) → thay thế khi đổi tên.
- **Xoá block khỏi code** để "bỏ quản lý" → Terraform **destroy** tài nguyên thật; muốn
  bỏ quản lý phải dùng khối `removed` / thao tác state có chủ đích.
- **Tài nguyên giữ dữ liệu thiếu bảo vệ**: `prevent_destroy`, bảo vệ xoá của dịch vụ,
  snapshot cuối khi xoá, xoá cưỡng bức bucket có dữ liệu ở production.
- **Thiếu `create_before_destroy`** ở tài nguyên đang phục vụ (certificate, target
  group, template khởi chạy) → gián đoạn; có rồi mà tên cố định → trùng tên khi tạo trước.
- **`ignore_changes` mới thêm** "cho plan sạch" → che drift thật; phải có lý do. Ngoại
  lệ hợp lệ: thuộc tính do pipeline khác quản lý (image/phiên bản task do CI deploy) —
  nhưng khi đó **sửa thuộc tính đó trong Terraform sẽ không bao giờ áp dụng**. PR sửa
  cấu hình nằm trong phần bị bỏ qua → thay đổi không lên môi trường, hoặc bị pipeline
  kia ghi đè.
- **Đổi backend/key state, import, di chuyển state** không mô tả trong PR.

## 2. Bảo mật

- **Mạng mở ra internet** (`0.0.0.0/0`, `::/0`) cho cổng ngoài 80/443 (**BLOCKER**);
  DB/cache/compute nhận traffic từ ngoài thay vì chỉ từ nhóm bảo mật của tầng trước.
- **Quyền wildcard** (`Action: *`, `Resource: *`) cho hành động ghi/xoá (**BLOCKER**);
  quyền "gán role cho dịch vụ" không giới hạn → leo quyền; trust policy/binding cho
  principal bất kỳ hoặc tài khoản ngoài không điều kiện; gộp quyền runtime của ứng dụng
  với quyền hạ tầng khởi chạy.
- **Secret trong mã / file biến commit** (**BLOCKER**); secret truyền dạng biến môi
  trường rõ (hiện trong console/định nghĩa task) thay vì tham chiếu secret manager;
  secret đặt giá trị trong Terraform → **nằm trong state**.
- **State**: backend không mã hoá, không khoá đồng thời, bucket state không chặn truy
  cập công khai; output chứa secret thiếu `sensitive = true`.
- **Lưu trữ công khai** (bucket/blob) không chặn truy cập công khai ở mọi tầng; policy
  cho principal bất kỳ; CDN đọc storage không qua cơ chế truy cập riêng.
- **Mã hoá**: dữ liệu lưu trữ không mã hoá; kết nối nội bộ (cache, DB) không TLS;
  listener HTTP không chuyển HTTPS; chính sách TLS cũ.
- **Khoá mã hoá**: key policy mở rộng, không xoay vòng.
- **WAF/firewall ứng dụng**: rule mới đặt chế độ chỉ đếm thay vì chặn (hoặc ngược lại)
  không nêu lý do; chặn nhầm callback/webhook; đổi thứ tự ưu tiên làm rule rộng chạy
  trước rule ngoại lệ.
- **Log**: không đặt thời hạn lưu (giữ PII vô hạn, tốn tiền); quyền đọc log/secret
  rộng hơn cần.

## 3. Compute & load balancer — cấu hình phải khớp nhau

- **Health check** sai path/port so với app; thời gian ân hạn khởi động quá ngắn →
  orchestrator giết instance liên tục, deploy không bao giờ xong.
- **Deploy không tự rollback** khi instance mới không khoẻ; ngưỡng khoẻ tối thiểu = 0 ở
  production → downtime khi deploy.
- **Thời gian rút kết nối** (drain/deregistration) không khớp thời gian app tắt êm →
  request đang xử lý bị cắt, hoặc deploy chậm vô ích.
- **Tài nguyên cấp phát** (CPU/RAM) sát mức dùng → OOM không log rõ; đổi mà bị
  `ignore_changes` chặn (mục 1).
- **Autoscaling**: không có mức tối thiểu hợp lý; thu nhỏ quá nhanh gây dao động;
  worker scale theo CPU thay vì độ dài hàng đợi.
- **Capacity giá rẻ có thể bị thu hồi** (spot/preemptible) cho service không chịu
  được gián đoạn.

## 4. Messaging & serverless

- **Thời gian khoá message** (visibility/ack deadline) ngắn hơn thời gian xử lý tối đa
  → xử lý song song hai lần (AWS khuyến nghị ≥ 6× timeout hàm cho SQS → Lambda).
- **Không có hàng đợi lỗi** (DLQ) hoặc số lần nhận tối đa không hợp lý; DLQ giữ message
  ngắn hơn hàng đợi chính; DLQ không có cảnh báo; số lần thử ở hạ tầng không khớp logic
  đếm retry trong code.
- **Policy cho phép nguồn gửi vào hàng đợi** thiếu điều kiện nguồn → topic/tài khoản
  khác gửi được.
- **Hàng đợi có thứ tự / chống trùng**: đổi cơ chế chống trùng ở một bên (hạ tầng hay
  code) → mất hoặc trùng message.
- **Hàm serverless**: không giới hạn concurrency khi gọi DB có giới hạn kết nối; secret
  rõ trong biến môi trường; runtime sắp hết hỗ trợ; timeout sát thời gian chạy thật;
  lời gọi bất đồng bộ không có đích khi lỗi.
- **Lịch chạy** (cron) hiểu theo UTC trừ khi khai múi giờ; lịch trùng với job nặng khác.

## 5. Quan sát & cảnh báo

- **Xử lý dữ liệu thiếu của alarm** chọn sai: alarm lỗi/DLQ coi "không có dữ liệu" là
  ổn → không kêu khi metric ngừng gửi; coi là vi phạm cho metric thưa → alarm sinh ra
  đã ở trạng thái báo động.
- **Alarm không có hành động** (hoặc kênh thông báo không có người nhận).
- **Ngưỡng / số chu kỳ đánh giá** quá nhạy (nhiễu) hoặc quá lỳ (báo muộn).
- **Tài nguyên mới quan trọng không có alarm** tương đương tài nguyên cùng loại đã có.

## 6. Chất lượng mã & quản lý (HashiCorp style guide)

- **Ghim phiên bản**: `required_version` cho Terraform; provider trong
  `required_providers` với ràng buộc chặn major; module ghim version/ref; commit
  `.terraform.lock.hcl`.
- **Biến** thiếu `type`/`description`; biến/output secret thiếu `sensitive = true`;
  `validation` cho tập giá trị hữu hạn; giá trị mặc định cho biến tuỳ chọn.
- **Hardcode** id tài khoản, ARN/URI, CIDR, region, image → biến / data source.
- **Lệch giữa môi trường**: sửa một môi trường mà môi trường kia phải giống; giá trị
  riêng của môi trường nằm cứng trong module.
- **Phụ thuộc ngầm thiếu `depends_on`** (quyền phải gắn trước khi dịch vụ dùng) → apply
  lần đầu fail, lần hai qua.
- **Provisioner `local-exec`/`remote-exec`** trong môi trường dùng chung — không
  idempotent, phụ thuộc máy chạy.
- **Tag/label chuẩn** (owner, env, service, cost) thiếu — dùng tag mặc định ở provider.
- **Tài nguyên đắt** (NAT, instance lớn, multi-AZ, dịch vụ tính theo request) không nêu
  chi phí ước tính.
- **Nâng major provider/Terraform** trong cùng PR với thay đổi hạ tầng → plan lẫn diff
  do nâng cấp với diff thật; nên tách.

## Không báo — dễ báo sai

- "Sẽ replace" khi chưa kiểm tài liệu thuộc tính hoặc plan.
- `ignore_changes` cho thuộc tính rõ ràng do pipeline khác quản lý và có comment.
- Mở `0.0.0.0/0` cổng 80/443 trên load balancer công khai.
- Style/định dạng mà `terraform fmt`/linter đã lo.
- Đề xuất tách module/đổi cấu trúc thư mục trong PR thay đổi nhỏ.
