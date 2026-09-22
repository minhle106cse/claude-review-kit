# Rubric — TypeScript / JavaScript (mọi runtime: trình duyệt, Node, edge)

> **Nguyên tắc chung của mọi module:** rule mô tả *lỗi bản chất*, đúng với mọi
> thư viện/phiên bản. Chỗ nào hành vi phụ thuộc thư viện (mặc định timeout, cách
> ép kiểu, cách cast filter…), rule nói **phải kiểm cái gì** — không khẳng định
> giá trị. Kết luận dựa trên hành vi thư viện → áp *luật bằng chứng riêng* của
> `base`: đọc source trong `node_modules` đúng version lockfile, không thì trần NGỜ.
>
> Cổng: thứ mà compiler ở chế độ strict và linter type-aware của repo đã bắt ở mức
> **error** → không báo (mục 0 của `base`). Kiểm cấu hình thật trước khi im lặng.
>
> Cách đọc mỗi mục: **lỗi** — hậu quả. *Kiểm:* cách xác nhận trước khi gắn CHẮC.

## 1. Hệ kiểu bị qua mặt — compiler nói OK nhưng không bảo đảm gì

- **Ép kiểu thêm mới để bịt lỗi** (`as T`, `as unknown as T`, `<T>x`, `!`) —
  thay đổi hình dạng phía nguồn (API, RPC, DB, thư viện) thành vô hình. Nguy hiểm
  nhất ở kết quả gọi ra ngoài và object dựng tay để trả response.
  *Kiểm:* hình dung bỏ phép ép — compiler sẽ báo gì? Báo thiếu/thừa field → đó là
  bug đang bị giấu.
- **`any` rò vào code nghiệp vụ**: `JSON.parse`, body response, `catch (e)`,
  thư viện không kiểu, `Record<string, any>` — một `any` ở biên làm mọi kiểu phía
  sau thành lời hứa suông.
- **Type guard / assertion function tự viết kiểm ít hơn kiểu nó khẳng định**
  (`x is User` chỉ kiểm `id`) — compiler tin tuyệt đối vào nó.
- **Hai nguồn sự thật cho một hình dạng**: interface viết tay cho response song
  song với schema runtime / định nghĩa sinh tự động. PR đổi một bên, không đổi bên
  kia → lệch lúc chạy.
- **Union/enum thêm nhánh** mà `switch`/bảng tra cũ không xử lý, không có kiểm
  tra vét cạn (`never`). *Kiểm:* grep mọi nơi rẽ nhánh trên kiểu đó.
- **Enum số / giá trị ngoài miền**: nhận số bất kỳ không lỗi; ở biên API nên là
  union literal hoặc string enum có validate.
- **Field tuỳ chọn cho thứ nghiệp vụ bắt buộc** (`?:`, `Partial<T>`) → mọi chỗ
  dùng phải kiểm lại, và sẽ có chỗ quên.
- **Truy cập index coi như luôn có** (`arr[i]`, `obj[key]`, `map.get(k)!`) khi
  index đến từ input hoặc phép tính — trừ khi repo bật kiểm tra index an toàn.

## 2. Bất đồng bộ & đồng thời

- **`forEach(async …)` / `.map(async …)` không gom `await`** — không ai chờ, lỗi
  trôi, thứ tự không bảo đảm.
- **`await` tuần tự trong vòng lặp** cho việc độc lập → chậm N lần. Ngược lại:
  **song song không giới hạn** (`Promise.all` trên mảng do người dùng điều khiển)
  → hàng nghìn request/kết nối cùng lúc; cần giới hạn đồng thời.
- **Một lỗi hỏng cả nhóm** (`Promise.all`) cho tác vụ "tốt nhất có thể" (gửi
  thông báo, dọn dẹp) → dùng dạng gom kết quả từng phần.
- **Check-then-act qua `await`**: đọc → kiểm → ghi, hai luồng xen kẽ đều qua bước
  kiểm. *Kiểm:* có điều kiện nguyên tử / khoá / ràng buộc unique ở tầng lưu trữ không.
- **Gọi ra ngoài không có timeout** — nhiều HTTP client và SDK mặc định chờ vô
  hạn. *Kiểm:* cấu hình timeout của client/instance thật sự dùng; không thấy thì
  coi là không có.
- **Không huỷ được**: tác vụ dài không nhận tín hiệu huỷ (`AbortSignal`) khi người
  gọi bỏ cuộc.
- **Retry** không backoff/jitter, retry cả lỗi không nên retry (4xx, validate), hoặc
  retry thao tác không idempotent (tạo mới) → bản ghi trùng.
- **Timer / listener / subscription không dọn** → rò bộ nhớ, callback chạy trên
  state đã chết.
- **Promise trôi trong callback đồng bộ** (event emitter, stream, handler) → lỗi
  thành unhandled rejection; trên server có thể làm process chết.
- **Chặn event loop**: xử lý CPU nặng đồng bộ (hash, nén, parse file lớn, vòng
  lặp lớn, hàm `*Sync`) trên đường xử lý request.

## 3. Dữ liệu từ ngoài — kiểu TypeScript không tồn tại lúc chạy

- **Không validate runtime ở biên**: body, query, header, message queue, storage
  trình duyệt, cookie, env, response service khác. Kiểu tĩnh chỉ là lời hứa.
- **Parse dữ liệu không tin được** không bắt lỗi và không kiểm hình dạng sau parse.
- **Biến môi trường dùng thẳng** không kiểm tồn tại → `undefined` lan tới runtime
  (URL `"undefined/api"`, secret rỗng). Nên validate cấu hình một lần lúc khởi động.
- **Ép kiểu số lỏng**: `Number('')` = `0`, `Number('12abc')` = `NaN`,
  `parseInt('1e3')` = `1`; không kiểm hữu hạn/khoảng → phân trang âm, `limit` khổng lồ.
- **Prototype pollution**: merge sâu / gán theo đường dẫn với key từ input
  (`__proto__`, `constructor`, `prototype`) (**BLOCKER** nếu input người dùng tới được).
- **Regex từ input** hoặc regex có lượng từ lồng nhau (`(a+)+`) chạy trên chuỗi do
  người dùng kiểm soát → ReDoS.
- **Tham số lặp (HTTP parameter pollution)**: `?id=1&id=2` thành mảng ở chỗ code
  giả định chuỗi.

## 4. Bẫy ngữ nghĩa của ngôn ngữ

- **Falsy hợp lệ**: `!v`, `v || d` khi `0` / `""` / `false` là giá trị đúng → `??`
  hoặc so sánh tường minh.
- **Thời gian**: chuỗi ngày không có múi giờ bị hiểu khác nhau (chỉ ngày → UTC, có
  giờ không `Z` → giờ máy); lấy phần ngày từ chuỗi ISO UTC ở múi giờ dương cho ra
  **ngày hôm trước**; tháng đếm từ 0; cộng ngày bằng mili giây sai khi có DST; so
  sánh đối tượng ngày bằng `===`; trộn hai thư viện ngày với hai quy ước múi giờ.
- **Số**: tiền/số lượng dùng số thực (**BLOCKER** cho tiền); id 64-bit vượt
  `MAX_SAFE_INTEGER` mất chính xác — phải là chuỗi.
- **Mảng**: `sort()` không comparator sắp theo chuỗi; `sort`/`reverse`/`splice`
  **đổi mảng gốc** (có thể là state, prop, cache dùng chung).
- **So sánh tham chiếu**: id dạng object (ObjectId, Buffer, Date) so bằng `===`
  hoặc `includes()` luôn sai → kiểm quyền sai.
- **Serialize**: ngày thành chuỗi và không quay lại thành ngày; `BigInt` ném lỗi;
  `undefined`/hàm bị bỏ; `Map`/`Set` thành `{}`; vòng tham chiếu ném lỗi.
- **Sao chép nông** rồi sửa object lồng → sửa luôn bản gốc.
- **Chuỗi**: sắp xếp bỏ locale (tên có dấu); `.length`/`slice` đếm code unit —
  cắt emoji/ký tự ghép làm vỡ ký tự; so khớp tên có dấu không chuẩn hoá Unicode.
- **Ngẫu nhiên**: `Math.random()` cho token, mã OTP, id khó đoán (**BLOCKER**) —
  dùng nguồn ngẫu nhiên mật mã.

## 5. Lỗi & ngoại lệ

- **Nuốt lỗi**: `catch {}` / `catch { return [] }` — lỗi hạ tầng trông y hệt
  "không có dữ liệu". Tối thiểu log kèm ngữ cảnh; tốt hơn phân biệt "không có" với
  "không lấy được".
- **Ném không phải `Error`** → mất stack; **bọc lỗi không giữ nguyên nhân**
  (`{ cause }`).
- **Đọc thuộc tính của `e`** trong `catch` mà không thu hẹp kiểu.
- **`return` trong `finally`** nuốt exception.
- **Lỗi trả về dạng giá trị** mà caller không kiểm → coi như thành công.
- **Event emitter không lắng nghe sự kiện `error`** → process chết.

## 6. Module & cấu trúc

- **Trạng thái cấp module** (biến `let`, cache `Map`, singleton) trong code chạy
  phía server → dùng chung giữa mọi request/người dùng. Hỏi: một bản mỗi process
  hay mỗi request? Ghi dữ liệu theo request vào đó = rò dữ liệu (**BLOCKER**).
- **Side effect lúc import** (kết nối, đọc env, đăng ký listener) → thứ tự khởi
  động mong manh, test khó.
- **Import vòng** — giá trị `undefined` lúc khởi tạo tuỳ thứ tự nạp.
- **Import cả thư viện nặng phía client** cho một hàm → bundle phình.
- **Trùng lặp**: viết lại helper đã có. *Kiểm:* grep trước khi báo.
- **Code "để dành"**: export/tham số/abstraction không có caller → over-engineering.

## 7. Test

- **Test không thể fail**: assert trên chính mock, thiếu `await` trước assert bất
  đồng bộ, `toBeDefined()` cho mọi thứ.
- **Mock quá sâu** tới mức test chỉ kiểm lại mock; mock chính hàm đang test.
- **Rò state giữa test**: mock/spy không khôi phục, biến module dùng chung, fake
  timer không trả lại.
- **Phụ thuộc thời gian thật / múi giờ máy / thứ tự chạy / mạng thật** → flaky.
- **Snapshot khổng lồ** thay cho assert có chủ đích.
- Đổi nhánh lỗi mà test chỉ phủ nhánh thành công.

## Không báo — dễ báo sai

- Thứ compiler/linter của repo bắt ở mức error (đọc cấu hình trước).
- `as const`, `satisfies`, ép kiểu trong test fixture, ép kiểu có comment giải thích
  bất biến cụ thể.
- `!` ngay sau một kiểm tra mà compiler không thu hẹp được (vd sau `Map.has`).
- Chọn `await` tuần tự khi thứ tự là yêu cầu nghiệp vụ, hoặc để giới hạn tải.
- Sở thích phong cách (`function` vs arrow, `type` vs `interface`) — linter/formatter lo.
