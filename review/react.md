# Rubric — React & framework render phía server (SPA, SSR, RSC)

> Áp cho mọi ứng dụng React: SPA thuần, hoặc có framework render phía server
> (Next.js, Remix/React Router, TanStack Start…). Phần 1–2 chỉ áp khi có render
> phía server / server function. Tên API framework chỉ là ví dụ — tìm cơ chế tương
> đương trong framework thật của repo.
> Hành vi mặc định của framework (cache, điều hướng, thứ tự chạy) **đổi giữa các
> phiên bản** → kết luận dựa trên nó phải qua *luật bằng chứng riêng* của `base`.
> Luật hooks chỉ tính là cổng khi linter ở mức **error**; `warn`/tắt → soi tay.

## 1. Ranh giới server / client — lớp bug đắt nhất

- **Server function / server action / route handler là endpoint HTTP public.**
  Client gọi được với **bất kỳ tham số nào**, không chỉ qua nút UI cho hiện. Mỗi
  hàm phải tự: (1) xác thực, (2) kiểm quyền trên **tài nguyên cụ thể**, (3)
  validate tham số runtime. Thiếu (1)/(2) ở hàm ghi dữ liệu → **BLOCKER**.
  *Kiểm:* mọi `export` trong file đánh dấu server-only-callable (vd `'use server'`)
  đều là endpoint — helper vô tình export (nhận URL/đường dẫn tuỳ ý rồi fetch) là
  lỗ SSRF.
- **Middleware/edge guard không phải lớp bảo vệ duy nhất.** Có đường vào không đi
  qua nó (server function, matcher sai), và middleware của framework từng có lỗ
  bypass thật. Kiểm quyền phải lặp lại nơi đọc/ghi dữ liệu.
- **Matcher/route guard sửa trong PR**: đường dẫn mới có lọt khỏi vùng bảo vệ không;
  regex loại trừ tài nguyên tĩnh có loại nhầm route thật không.
- **Dữ liệu nhạy cảm theo props từ server xuống component client** → nằm nguyên
  trong payload/HTML gửi xuống trình duyệt (token, email người khác, field nội bộ).
- **Biến môi trường công khai** (tiền tố public của bundler/framework) chứa secret
  → vào bundle (**BLOCKER**); biến không công khai đọc ở client → `undefined`.
- **Module chỉ dành cho server** (đọc secret, gọi dịch vụ nội bộ) import được vào
  client — nên có chốt chặn build (`server-only` hoặc tương đương).
- **Ranh giới client đặt quá cao** kéo cả cây sang client, phình bundle.

## 2. Cache & làm mới dữ liệu (khi có render phía server / cache dữ liệu)

- **Cache dùng chung chứa dữ liệu theo người dùng**: cache của framework, CDN,
  HTTP (`Cache-Control: public` cho response có cookie), hoặc cache tự viết với key
  không gồm user/tenant → người A thấy dữ liệu của B (**BLOCKER**).
- **Giả định mặc định cache** mà không khai báo tường minh — mặc định đổi giữa
  phiên bản framework; code chép từ ví dụ cũ có thể chậm (không cache) hoặc cũ
  (cache ngoài ý muốn). *Kiểm:* chính sách cache/revalidate ghi rõ ở chỗ fetch/route.
- **Mutation xong không làm mới**: không revalidate/invalidate cache server, không
  cập nhật cache/state client (query cache, store) → UI hiện dữ liệu cũ.
- **Trang đáng tĩnh bị ép động** (đọc cookie/header/tham số request ở layout gốc)
  → render mỗi request; hoặc ngược lại trang theo người dùng bị render tĩnh.
- **Waterfall**: `await` tuần tự cho dữ liệu độc lập ở loader/server component →
  gom song song hoặc tách vùng stream.
- **Hàm điều hướng ném exception** (redirect/notFound kiểu ném) bị `try/catch` rộng
  nuốt — hành vi khác nhau theo framework/phiên bản, bắt buộc kiểm source trước khi
  kết luận (đã từng báo sai BLOCKER đúng lớp này).

## 3. State toàn cục & SSR

- **Store tạo ở cấp module** (Redux/Zustand/biến module) mà code chạy trên server
  có ghi vào → **một store cho mọi request** → rò dữ liệu giữa người dùng
  (**BLOCKER**). *Kiểm:* truy nơi tạo store và mọi chỗ dispatch/ghi; chỉ dùng phía
  client sau hydrate thì không rò — vẫn nên tạo store theo request/cây component.
- **Ghi state trong lúc render** (không trong handler/effect) → chạy cả lúc SSR và
  lặp mỗi lần render.
- **Giá trị không serialize được** (File, Date, class instance, Promise) vào store
  → persist/devtools/SSR hỏng; tắt cảnh báo serializable là che triệu chứng.
- **Nguồn sự thật nhân đôi** (store + state cục bộ + URL + cache query) → lệch
  nhau sau mutation.
- **Không reset khi đổi ngữ cảnh**: đăng xuất, đổi tài khoản, đổi tenant/không gian
  làm việc → người sau thấy dữ liệu người trước.

## 4. Effect & vòng đời (theo "You Might Not Need an Effect" của React)

Effect chỉ dành cho **đồng bộ với hệ thống bên ngoài**. Không có hệ thống ngoài →
nghi ngờ effect:
- **Tính dữ liệu dẫn xuất trong effect** rồi `setState` → render hai lần, nháy UI;
  tính thẳng khi render (memo nếu đắt).
- **Reset state khi prop đổi bằng effect** → dùng `key` để reset cả component.
- **Logic của sự kiện người dùng đặt trong effect** (POST khi state đổi, toast khi
  cờ đổi) → chạy lại khi remount/đổi deps, chạy hai lần ở dev; chuyển vào handler.
- **Chuỗi effect set state lẫn nhau** → cascade render; tính hết trong handler.
- **Báo cha bằng effect** → gọi callback trong handler cùng lượt.
- **Subscribe store ngoài bằng effect** → dùng cơ chế subscribe chuẩn
  (`useSyncExternalStore` hoặc tương đương) để tránh tearing.
- **Effect thiếu cleanup**: listener, timer, subscription, socket, object URL,
  request đang bay.
- **Effect không idempotent** (chế độ dev chạy mount→unmount→mount) — đăng ký hai
  lần, gửi request ghi hai lần.
- **Closure cũ**: callback trong interval/listener/socket đọc state của lần render
  đầu. *Kiểm:* deps của effect đăng ký, ref, hoặc cập nhật dạng hàm.
- **Deps sai** (khi linter không chặn): thiếu dep → dữ liệu cũ; object/hàm tạo mới
  mỗi render trong deps → effect chạy vô hạn.

## 5. Bất đồng bộ trong component

- **Response về sai thứ tự** (gõ tìm nhanh, đổi tab/entity nhanh) → response cũ đè
  mới. Cần huỷ request / cờ bỏ qua / so id request. PR thêm guard cho **một** hàm →
  soát các hàm **cùng mẫu** trong cùng file.
- **Set state sau unmount / sau khi entity đổi** (callback ảnh, FileReader, timer,
  promise của request cũ).
- **Cờ loading/submitting** reset rải từng nhánh thay vì `finally` — liệt kê mọi
  đường thoát: return sớm, throw, **nhánh thành công**.
- **Nút gửi không khoá khi đang gửi** → gửi trùng, tạo hai bản ghi.
- **Cập nhật lạc quan** không rollback khi lỗi.
- **Con báo cha trước khi người dùng xác nhận** (chọn file → cha lưu luôn) → Cancel
  ở con không còn huỷ được.
- **Kết nối realtime** (WebSocket/SSE/socket client): listener không gỡ → xử lý N
  lần; reconnect không gửi lại token mới; handler dùng state cũ.

## 6. Form

- **Validate client mà server không validate lại** — client validation chỉ là UX
  (**BLOCKER** nếu server tin dữ liệu đó cho quyền, giá, số lượng).
- **Schema cho có**: mọi field chỉ "là chuỗi", không độ dài/định dạng/khoảng.
- **Giá trị mặc định từ dữ liệu async** mà không reset form khi dữ liệu về → submit
  ghi đè dữ liệu thật bằng rỗng.
- **Field không đăng ký / sai tên** → không vào payload, lặng lẽ.
- **Input số**: chuỗi rỗng thành `NaN` hoặc `0` tuỳ cách ép — `0` là giá trị hợp lệ
  sai.
- **Lỗi server không hiện** cho người dùng, hoặc hiện message kỹ thuật thô.
- **Schema dùng chung giữa client và server** nhưng hai bên dùng thư viện/major
  khác nhau → cùng schema, kết quả khác nhau (mặc định, ép kiểu, thông báo lỗi).

## 7. Render & hiệu năng

- **`key` là index** trong danh sách có chèn/xoá/sắp xếp → state của item lệch
  sang item khác; `key` không ổn định (random) → remount mỗi render.
- **Hydration mismatch**: thời gian hiện tại, số ngẫu nhiên, API trình duyệt,
  locale máy **trong lúc render** → khác server/client. Tắt cảnh báo là che triệu
  chứng.
- **Danh sách lớn render hết** không ảo hoá/phân trang.
- **Context value tạo mới mỗi render** → mọi consumer render lại.
- **Ảnh**: không khai kích thước (layout shift), tải ảnh gốc cho ô nhỏ, ảnh chính
  không ưu tiên tải.
- **Thư viện nặng tải ở trang đầu** (editor, chart, lịch, bản đồ) không tách chunk.
- **Memo rải khắp nơi** không có lý do đo được — không phải bug, chỉ NIT.

## 8. Đa ngôn ngữ & định dạng

- **Chuỗi hiển thị hardcode** trong repo đã có i18n.
- **Key thêm ở một ngôn ngữ, thiếu ở ngôn ngữ khác.** *Kiểm:* grep key trong mọi
  file bản dịch.
- **Nối chuỗi dịch** thay vì tham số → sai ngữ pháp ở ngôn ngữ khác thứ tự từ;
  số nhiều tự xử lý bằng `if`.
- **Định dạng ngày/số/tiền tự làm** không truyền locale/múi giờ → lệch server/client
  và giữa người dùng.

## 9. Bảo mật phía client & khả năng tiếp cận

- **Chèn HTML thô** (`dangerouslySetInnerHTML`, HTML từ rich-text editor) với nội dung
  người dùng không sanitize (**BLOCKER**); sanitize phải ở server hoặc bằng thư viện
  chuyên dụng, không regex tự viết.
- **URL từ người dùng vào `href`/`src`** không chặn `javascript:` (**BLOCKER**);
  `target="_blank"` tới trang ngoài.
- **Token trong storage trình duyệt** đọc được từ JS → XSS lấy được phiên.
- **Mở redirect**: tham số `next`/`returnUrl` dùng thẳng để điều hướng.
- **Phần tử bấm được không phải `<button>`/`<a>`** — không focus, không dùng bàn
  phím; input không nhãn; nút icon không tên.
- **Dialog/overlay** tắt chế độ modal (mất focus trap, khoá cuộn, thuộc tính
  modal cho trình đọc màn hình) không có comment lý do; overlay lồng nhau để kẹt
  trạng thái chặn tương tác sau khi đóng.
- **Sửa tay component sinh từ generator UI** (thư mục bị bộ lọc diff bỏ) → nhắc
  trong Vùng mù, đọc riêng.

## Không báo — dễ báo sai

- Deps của hook khi linter hooks ở mức error.
- Effect có cleanup đầy đủ và đúng là đồng bộ với hệ thống ngoài.
- `key` là index cho danh sách tĩnh không bao giờ đổi thứ tự.
- Cờ trạng thái cục bộ "không bao giờ reset" khi chưa tìm **mọi chỗ set** và chưa
  xác định nó là state cục bộ hay state của thư viện form (đã báo sai thật).
- Tối ưu hiệu năng không có dấu hiệu vấn đề đo được.
