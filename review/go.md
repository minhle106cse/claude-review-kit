# Rubric — Go

> Áp mọi phiên bản Go. Cổng: `go vet`, `staticcheck`/`golangci-lint`, `errcheck` ở
> mức chặn CI → không báo lại (mục 0 của `base`). Hành vi đổi theo phiên bản (vd ngữ
> nghĩa biến vòng lặp, GC timer) → đọc directive `go` trong `go.mod` trước khi báo.
> Nguồn: Go Code Review Comments (go.dev/wiki), Effective Go.
> Cách đọc: **lỗi** — hậu quả. *Kiểm:* cách xác nhận trước khi gắn CHẮC.

## 1. Goroutine & đồng thời

- **Vòng đời goroutine không rõ**: chờ channel không ai gửi/đóng, vòng lặp không kiểm
  `ctx.Done()` → rò goroutine. Phải chỉ ra được *khi nào* goroutine thoát.
- **Ghi map/slice/struct dùng chung từ nhiều goroutine không khoá** → data race; ghi map
  đồng thời là lỗi chết process, không recover được. *Kiểm:* test có chạy `-race`.
- **`WaitGroup.Add` gọi bên trong goroutine** thay vì trước `go` → `Wait` trả sớm.
- **Channel**: đóng ở phía nhận; đóng hai lần; gửi vào channel đã đóng (panic); channel
  không buffer làm người gửi kẹt khi người nhận đã thoát.
- **Tạo timer mới mỗi vòng `select`** (`time.After` trong vòng lặp) → rò tới khi hết
  hạn ở một số phiên bản; dùng timer tái dùng.
- **Biến vòng lặp bị goroutine/closure bắt** — chỉ là bug ở phiên bản Go có biến vòng
  lặp dùng chung. *Kiểm:* `go.mod` trước khi báo.
- **Giữ mutex khi gọi I/O / callback** → nghẽn, deadlock; **copy struct chứa mutex**
  (truyền theo giá trị).
- **Nhóm goroutine** không dùng context chung → một cái lỗi, cái khác chạy tới hết.
- **Hàm đồng bộ tốt hơn bất đồng bộ**: API trả channel/callback trong khi trả kết quả
  trực tiếp là đủ → khó dùng đúng, dễ rò.

## 2. Context & huỷ

- **Không truyền `context` xuống** (tạo context nền giữa chừng) → huỷ phía trên không
  huỷ DB/RPC/HTTP phía dưới. `context` là tham số đầu tiên.
- **Không `cancel()`** context có timeout/huỷ → rò timer.
- **Lưu `context` trong struct.**
- **Dùng context của request cho việc chạy nền** sau khi trả response → bị huỷ ngay.

## 3. Lỗi

- **Bỏ lỗi** bằng `_` không có lý do ghi rõ.
- **Bọc lỗi mất ngữ cảnh** hoặc bọc bằng định dạng không cho unwrap (`%v` thay `%w`)
  → caller không `errors.Is/As` được.
- **So sánh lỗi bằng `==` hoặc so chuỗi** thay vì `errors.Is/As`.
- **Lỗi trong băng** (trả `-1`, `""`, `nil` như tín hiệu lỗi) thay vì giá trị lỗi riêng.
- **`panic` cho lỗi thường**; `recover` nuốt panic không log.
- **Typed nil qua interface `error`** → `err != nil` là `true` dù "không lỗi".
- **Luồng lỗi lồng sâu** thay vì xử lý lỗi trước, đường chính ở lề trái.

## 4. Tài nguyên

- **Không đóng** body response, rows, file; `defer Close()` đặt trước khi kiểm lỗi mở →
  nil deref.
- **`defer` trong vòng lặp** → giữ tài nguyên tới hết hàm; tách thân vòng lặp thành hàm.
- **Không kiểm lỗi sau vòng đọc** (`rows.Err()`, `scanner.Err()`) → lỗi giữa chừng bị
  coi như hết dữ liệu.
- **Đọc toàn bộ body không giới hạn** → bộ nhớ theo kích thước client quyết định.

## 5. HTTP & mạng

- **Client HTTP mặc định không timeout**; server thiếu timeout đọc header/đọc/ghi →
  Slowloris.
- **Tạo client/transport mới mỗi request** → hết cổng, mất keep-alive.
- **Decode body trước khi kiểm status code.**
- **Unmarshal JSON**: field vắng thành zero value — không phân biệt "gửi 0" với "không
  gửi" nếu không dùng con trỏ; field lạ bị bỏ im lặng ở biên cần chặt.

## 6. Bảo mật

- **`math/rand` cho khoá, token, mã** (**BLOCKER**) — dùng `crypto/rand`.
- **SQL nối chuỗi** (**BLOCKER**); `text/template` cho HTML thay vì `html/template`.
- **Đường dẫn file từ input** không làm sạch/không giới hạn thư mục.
- **So sánh secret không hằng thời gian.**

## 7. Bẫy ngữ nghĩa & thiết kế

- **Slice con dùng chung mảng nền**: giữ bộ nhớ lớn; `append` vào slice con ghi đè dữ
  liệu của slice cha.
- **Giả định thứ tự lặp map.**
- **Sửa bản sao** (phần tử `range`, receiver giá trị) tưởng sửa bản gốc; trộn receiver
  giá trị và con trỏ trên cùng kiểu.
- **So sánh `time.Time` bằng `==`** → dùng `Equal`.
- **Chuyển số hẹp** (`int64` → `int32`) tràn im lặng; `len` chuỗi đếm byte.
- **Interface định nghĩa ở phía cài đặt / định nghĩa trước khi có người dùng** → nên ở
  phía sử dụng, nhỏ, theo nhu cầu thật.
- **Slice rỗng vs nil** trả ra JSON khác nhau (`null` vs `[]`) — client có phân biệt không.

## 8. Test

- Code đồng thời không có test chạy `-race`.
- Test song song dùng state chung.
- `sleep` thay cho đồng bộ hoá → flaky.

## Không báo — dễ báo sai

- Thứ vet/staticcheck/errcheck của repo chặn ở CI.
- Bắt biến vòng lặp trong closure khi `go.mod` ở phiên bản có biến riêng mỗi vòng.
- Tên ngắn trong phạm vi hẹp (`i`, `r`, `w`) — đúng quy ước Go.
- Style mà `gofmt`/`goimports` lo.
