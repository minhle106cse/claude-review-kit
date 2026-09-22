# Rubric — Dữ liệu: schema, migration, truy vấn (SQL + document store)

> Nạp cho mọi code chạm tầng lưu trữ: SQL (Postgres, MySQL…), document store
> (MongoDB…), ORM/ODM bất kỳ. **Chỉ áp phần khớp DB thật của repo** — đừng đòi
> `down` migration hay kiểu `decimal` cho một collection document.
> Hành vi mặc định của ORM/ODM (cast filter, chạy validator khi update, trả bản trước
> hay sau khi sửa, lọc field lạ) **khác nhau giữa thư viện và phiên bản** → rule nói
> *phải kiểm gì*; kết luận dựa trên nó phải đọc source/tài liệu đúng version
> (*luật bằng chứng riêng* của `base`).
> Cách đọc: **lỗi** — hậu quả. *Kiểm:* cách xác nhận trước khi gắn CHẮC.

## 1. Filter & phạm vi ghi — chỗ ghi nhầm cả bảng/collection

- **Filter dựng từ tham số có thể rỗng/`undefined`**: nhiều ORM/ODM **bỏ key
  `undefined`** khi dựng filter (vd Mongoose: `updateMany({ userId: undefined })`
  thành filter `{}` — đã chạy thử) → khớp **toàn bộ**. Với update/delete hàng loạt →
  **BLOCKER**. *Kiểm:* truy từng biến trong filter tới nguồn; có bắt buộc ở biên không.
- **`UPDATE`/`DELETE` không `WHERE`**, hoặc `WHERE` dựng từ danh sách có thể rỗng
  (`IN ()` bị bỏ điều kiện, ORM bỏ mệnh đề rỗng).
- **Filter theo field không tồn tại** (gõ sai tên) — ODM có thể giữ nguyên (không
  khớp gì) hoặc bỏ đi (khớp tất cả) tuỳ chế độ strict. *Kiểm:* chế độ strict cho query.
- **Xoá mềm lọc không nhất quán**: "bằng null" khớp cả bản ghi thiếu field, "không tồn
  tại" thì không khớp bản ghi có giá trị null; query mới quên lọc → hiện dữ liệu đã xoá.
- **Thiếu ràng buộc tenant/chủ sở hữu** trong câu truy vấn (xem IDOR ở `backend`).

## 2. Injection

- **Nối chuỗi dựng câu SQL** thay vì tham số hoá (**BLOCKER**) — kể cả tên cột/bảng
  động (phải whitelist), `ORDER BY ${field}`, `LIMIT ${n}`; raw query của ORM
  (`queryRawUnsafe`, template chuỗi) với input.
- **Operator injection vào document store**: giá trị từ input (đặc biệt body JSON) đi
  thẳng vào filter (`{ email: input.email }` với `{"$ne": null}`) → khớp mọi bản ghi
  (**BLOCKER** ở đăng nhập, tra cứu theo quyền, đặt lại mật khẩu). Chặn bằng ép kiểu ở
  biên, hàm sanitize filter của ODM, hoặc toán tử bằng tường minh. *Kiểm:* parser query
  string của framework có tạo được object lồng không — không tạo được thì đường query
  string an toàn, body thì chưa.
- **Toán tử thực thi mã** (`$where`, `$function`, biểu thức từ chuỗi) với input (**BLOCKER**).
- **Regex từ input không escape** → ReDoS, khớp ngoài ý muốn; regex không neo đầu
  không dùng được index.

## 3. Ghi & cập nhật

- **Update có chạy validator của schema không?** Nhiều ODM/ORM **chỉ** validate khi
  tạo/`save`, không khi `update*` → ghi dữ liệu sai schema. *Kiểm:* tuỳ chọn validate
  khi update của thư viện; không bật thì validate phải nằm ở DTO.
- **Hàm "tìm và cập nhật" trả bản trước hay sau khi sửa** — mặc định khác nhau giữa
  thư viện; code dùng kết quả như bản mới → sai. *Kiểm:* tuỳ chọn trả bản sau.
- **Ghi đè cả object lồng/bản ghi** khi chỉ định sửa vài field → mất field khác.
- **Upsert / "tìm rồi tạo" không có ràng buộc unique** → hai request song song tạo
  trùng; thiếu phần "chỉ đặt khi tạo mới" cho field khởi tạo.
- **Đọc–sửa–lưu trên bản ghi dùng chung** (số đếm, số dư, trạng thái) → lost update;
  dùng cập nhật nguyên tử (`$inc`, `SET x = x + 1`) hoặc khoá lạc quan/bi quan.
- **Chèn hàng loạt** dừng ở lỗi đầu tiên hay tiếp tục — xử lý lỗi từng phần tử có
  đúng với chế độ đang dùng không.
- **Mảng tăng không giới hạn trong một bản ghi** (comment, log, thành viên) → chạm giới
  hạn kích thước bản ghi, mỗi lần ghi phải ghi lại cả bản ghi.
- **Schema strict âm thầm bỏ field không khai báo** khi ghi → code ghi field mới quên
  khai báo schema: không lỗi, chỉ mất dữ liệu.
- **Giá trị mặc định tính một lần lúc nạp schema** (`default: now()` thay vì truyền hàm).

## 4. Giao dịch

- **Mọi lệnh trong giao dịch phải thuộc cùng phiên/kết nối giao dịch** — sót một lệnh
  (kể cả lệnh đọc để kiểm, lệnh trong hàm helper) → chạy ngoài giao dịch, không
  rollback, có thể không thấy dữ liệu chưa commit. *Kiểm:* đọc từng lệnh DB trong khối,
  kể cả hàm được gọi.
- **Gọi ra ngoài (HTTP/RPC/queue) bên trong giao dịch** → giữ khoá/kết nối lâu; và nếu
  thư viện tự retry cả khối khi lỗi tạm, lời gọi ngoài bị lặp. Đưa side effect ra sau
  commit (outbox).
- **Giao dịch dài** (vòng lặp lớn, chờ I/O) → vượt giới hạn thời gian, khoá lâu, xung
  đột ghi, deadlock.
- **Mức cô lập** không đủ cho logic đọc-rồi-ghi (read committed không chặn race kiểm
  tra-rồi-chèn).
- **Bất biến kiểm tra trên nhiều bản ghi rồi ghi vào một bản ghi KHÁC — transaction
  không tự bảo vệ được.** Cơ chế phát hiện xung đột ghi của hầu hết DB chỉ hoạt động
  trên bản ghi **đã ghi**, không phải bản ghi chỉ đọc để kiểm. Đếm/kiểm điều kiện
  trên tập N bản ghi (`count(...) <= 1`, tổng số dư nhiều dòng, "còn ít nhất một
  admin có role X") rồi ghi vào **một bản ghi khác** trong cùng transaction: hai
  transaction chạy đồng thời, nhắm hai bản ghi khác nhau, đều đọc cùng một số đếm
  cũ, đều pass điều kiện, đều commit — bất biến bị vi phạm dù mỗi transaction
  "đúng" khi xét riêng lẻ. Không có write-conflict để DB tự chặn, vì không transaction
  nào ghi vào bản ghi mà transaction kia đọc. *Kiểm:* bất biến có nằm trên **chính
  bản ghi bị ghi** không (dùng `findOneAndUpdate`/`UPDATE ... WHERE` với điều kiện
  nguyên tử trên field đếm sẵn có của bản ghi đó) hay đang đếm rời từ tập bản ghi
  khác? Đếm rời → cần khoá tường minh trên tài nguyên chung (advisory lock, hàng
  cấm/serializable thật, hoặc dồn bất biến về một field đếm nguyên tử trên bản ghi
  chủ) — không phải chỉ "bọc trong transaction" là đủ.
- **Giao dịch cần hạ tầng riêng** (document store cần replica set) → code có nhánh
  "không giao dịch" chỉ chạy ở dev/test.

## 5. Đọc & hiệu năng

- **Lọc/sắp/join theo cột không có index.** Index kép phải theo thứ tự
  **Bằng → Sắp → Khoảng**; sai thứ tự thì index không phủ phần sắp.
  *Kiểm:* định nghĩa index thật của bảng/collection.
- **Index trùng tiền tố** với index có sẵn → thừa, chỉ tốn ghi.
- **Phân trang offset lớn** → chậm dần; phân trang theo cột không unique không kèm
  khoá phụ → trùng/sót bản ghi giữa các trang.
- **N+1** qua lazy loading / populate trong vòng lặp; `IN`/`$in` với mảng không giới hạn.
- **Không chọn cột** (`SELECT *`, không projection) → kéo dữ liệu lớn, lộ field nhạy
  cảm nếu trả thẳng ra; code phụ thuộc thứ tự cột.
- **Đếm toàn bảng ở đường nóng** (badge, tổng số trang) mỗi request.
- **Aggregation/join**: lọc đặt sau join/unwind thay vì trước; join vào bảng không có
  index ở khoá nối.
- **Đọc từ bản sao (replica)** ngay sau khi ghi → đọc dữ liệu cũ.
- **Kết quả "thuần"** (lean/raw) mất method, getter, giá trị mặc định, kiểu id — code
  sau đó gọi method hoặc so id như chuỗi → lỗi.

## 6. Schema & thiết kế

- **Thiếu ràng buộc**: khoá ngoại/tham chiếu, unique, not null, check cho tập giá trị hữu hạn.
- **Kiểu dữ liệu**: tiền dùng số thực (**BLOCKER** — dùng decimal/số nguyên đơn vị nhỏ
  nhất); thời gian không múi giờ; chuỗi không giới hạn độ dài ở chỗ cần.
- **Field nhạy cảm mặc định được đọc ra** (mật khẩu, token, secret OTP) → lộ ở mọi truy
  vấn mặc định; nên loại khỏi projection mặc định.
- **Hook/transform serialize của schema** sửa → ảnh hưởng mọi response dùng schema đó.
- **Kiểu "tự do"** (JSON/Mixed) mới thêm → không validate, không theo dõi thay đổi.
- **Xoá theo dây chuyền** mới thêm trên quan hệ quan trọng → xoá một bản ghi kéo theo
  hàng loạt.
- **Dữ liệu phi chuẩn hoá** (bản sao tên/ảnh ở bảng khác): đổi nguồn mà không cập nhật
  bản sao, hoặc đọc bản sao đã cũ; dữ liệu phải xoá theo yêu cầu người dùng còn sót ở
  bản sao.
- **PII lưu dạng rõ** khi không cần truy vấn theo nó.

## 7. Migration & thay đổi schema khi hệ thống đang chạy

- **Không có đường lùi**, hoặc đường lùi làm mất dữ liệu.
- **Xoá/đổi tên cột/field mà code đang chạy còn dùng** → phải tách: thêm mới → ghi cả
  hai → chuyển đọc → xoá cũ, qua nhiều lần deploy (**BLOCKER** nếu làm một lần trên dữ
  liệu đang dùng). Code mới phải chịu được cả dữ liệu dạng cũ lẫn mới trong thời gian
  chuyển tiếp.
- **Thao tác khoá bảng lâu trên bảng lớn**: thêm cột bắt buộc không mặc định, tạo index
  không ở chế độ online/concurrent, thêm ràng buộc phải quét toàn bảng, đổi kiểu cột
  (rewrite, cắt dữ liệu). *Kiểm:* cách DB cụ thể xử lý thao tác đó — hành vi khác nhau
  giữa DB và phiên bản DB.
- **Index/unique tạo tự động lúc app khởi động** trên dữ liệu lớn / dữ liệu đang trùng
  → build lâu khi deploy, hoặc thất bại âm thầm → tưởng có ràng buộc mà không có.
- **Backfill trong cùng migration với đổi schema**, hoặc một câu cập nhật cả bảng →
  khoá lâu. Chia lô.
- **Sửa migration đã chạy** trên môi trường thật thay vì thêm migration mới.
- **Script dữ liệu**: không idempotent (chạy lại cộng dồn/tạo trùng), không chia lô,
  không tiếp tục được khi dừng giữa chừng, không sao lưu trước khi ghi đè hàng loạt,
  không có chế độ chạy thử.

## Không báo — dễ báo sai

- Truy vấn không index trên bảng/collection nhỏ, cố định kích thước (bảng cấu hình, enum).
- `SELECT *` trong script một lần / test.
- Đề xuất chuẩn hoá lại mô hình dữ liệu trong PR không chạm mô hình.
- "Thiếu giao dịch" cho một lệnh ghi đơn đã nguyên tử.
