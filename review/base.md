# Rubric — Nền tảng (áp dụng mọi PR, mọi ngôn ngữ)

## Phạm vi — quyết định TRƯỚC khi viết bất kỳ finding nào

**MUST — code nằm trong diff của PR này.**
Đây là nghĩa vụ. Soi kỹ từng dòng PR thêm hoặc sửa: đúng chưa, có gây bug
chỗ khác không, có phá caller nào không. Chỉ loại này mới được đánh BLOCKER
và mới chặn được merge.

**NÊN CÓ — code lân cận, code có sẵn, code quá khứ.**
**KHÔNG đi tìm.** Không mở thêm file để săn. Chỉ báo nếu **gặp trên đường**
làm phần MUST. Không gặp thì thôi — đó không phải thiếu sót của review.
Không bao giờ BLOCKER. Không bao giờ chặn merge.

**Ngoại lệ:** nếu PR **làm nặng thêm** một vấn đề có sẵn thì tính là MUST.
Ví dụ: trước đây một lỗi chỉ mất một phần tử, sau PR thì mất cả trang —
vấn đề có sẵn nhưng mức độ do PR gây ra.

### Đích đến của từng loại

| Loại | Đi đâu | Cách viết |
|---|---|---|
| MUST | Comment đúng dòng trên PR | Bình thường |
| NÊN CÓ — trong file PR có chạm | Khối riêng trong comment PR | Ghi rõ *"có sẵn, không do PR này gây ra"* |
| NÊN CÓ — ngoài phạm vi PR | Khối riêng trong comment PR | Ghi rõ *"phát hiện tình cờ, không liên quan PR này"* |

Không bao giờ trộn NÊN CÓ vào danh sách MUST. Người đọc PR cần biết ngay
cái gì chặn họ và cái gì không.

**Finding NÊN CÓ luôn đi kèm comment của PR đang review**, kể cả khi nó nói
về code chẳng liên quan gì tới PR đó. Không có sổ, không có backlog, không có
file trạng thái nào khác — comment PR là chỗ duy nhất nó tồn tại. Không ghi
vào đó là mất hẳn phát hiện.

Đổi lại, viết thật gọn: 1–2 dòng mỗi finding, đặt sau phần MUST, có rào chắn
rõ ràng để tác giả PR biết ngay là không cần xử lý trong PR này.

## Luật: review KHÔNG sửa code

Tuyệt đối không sửa file nguồn trong lúc review — kể cả khi bản vá hiển
nhiên và chỉ một dòng.

Lý do: reviewer sửa code thì mất khả năng đánh giá khách quan, và tác giả
mất phần học được. Thấy cách sửa thì **viết ra trong finding**, đừng áp dụng.

## Khi nào KHÔNG review

PR chỉ đụng lockfile, asset, chuỗi hiển thị, version bump, đổi tên thuần:
nói một câu — *"PR cơ học, không có logic để review"* — rồi **DỪNG**.
Đừng bịa finding để chứng minh đã làm việc.

## Mức độ

- **BLOCKER** — bug thật, lỗ hổng bảo mật, mất dữ liệu, crash, breaking change
  không được nêu. Không merge được. **Chỉ dành cho MUST.**
- **SHOULD** — sẽ gây đau về sau. Không chặn merge.
- **NIT** — style, naming, ý kiến. Một dòng, không giải thích dài.

**Câu hỏi phân định:** *"Merge rồi deploy, trong điều kiện dùng bình thường
(không cần input lạ, không cần tải cao), có người dùng hoặc dữ liệu nào bị ảnh
hưởng ngay không?"* Có, và finding là CHẮC → BLOCKER. Chỉ xảy ra khi điều kiện
X (lỗi mạng, tải lớn, dữ liệu hiếm, về sau có người sửa) → SHOULD.

### Mốc hiệu chỉnh — so với mốc gần nhất trước khi gắn mức

Rút từ review thật, đã khái quát hoá. Hai lần chạy trên cùng diff phải ra cùng
mức — mốc này là để điều đó xảy ra.

| Tình huống | Mức | Vì sao |
|---|---|---|
| Nhánh `return` sớm không reset `isLoading` → nút/màn kẹt loading vĩnh viễn, đi được bằng thao tác thường | BLOCKER | người dùng gặp ngay, không tự thoát được |
| Helper mới coi "không tìm thấy bản ghi" = "đã xoá" → tên/ảnh hiển thị rỗng thay vì fallback cũ, cho một nhóm user có thật | BLOCKER | sai dữ liệu hiển thị trên luồng chính; trước PR đúng |
| Store/biến cấp module ghi theo request trong SSR → dữ liệu user A lộ sang user B | BLOCKER | rò dữ liệu cross-request |
| Endpoint/server action mới không kiểm quyền, hoặc kiểm login mà không kiểm resource thuộc về ai | BLOCKER | bảo mật |
| Đổi hình dạng response API/gRPC làm caller **hiện có** đọc field giờ đã mất | BLOCKER | breaking thật |
| Đổi hình dạng response nhưng caller hiện tại chưa đọc field bị bỏ (đã grep) | SHOULD | hợp đồng đổi ngầm, vỡ về sau |
| `catch {}` không log, lỗi nhất thời trông y hệt kết quả hợp lệ (vd "không có dữ liệu") | SHOULD | chỉ đau khi hạ tầng lỗi, và lúc đó không lần ra |
| Gọi dịch vụ khác / DB trong vòng lặp hoặc nạp cả tập không giới hạn trên đường nóng | SHOULD | đau theo quy mô; BLOCKER chỉ khi chứng minh được quy mô hiện tại đã chạm |
| Token/secret ngắn hạn trong query string của URL redirect | SHOULD | lộ qua log/Referer, có giảm nhẹ |
| Ghi DB trong transaction rồi gọi service khác ngoài transaction, không bù trừ | SHOULD (NGỜ nếu chưa đọc ngữ nghĩa transaction) | chỉ hỏng khi commit fail sau call |
| Logic mới đáng kể (≥ ~100 dòng nhánh/điều kiện) không có test nào | SHOULD | — kéo Kết luận lên "NÊN SỬA TRƯỚC KHI MERGE" |
| Hằng số tên sai mục đích, `as` che lệch kiểu nhưng hiện tại khớp | NIT | không hậu quả quan sát được |

Không có mốc nào gần → dùng câu hỏi phân định ở trên, và ghi một câu vì sao.

## Độ tin cậy — bắt buộc gắn cho mỗi finding

- **CHẮC** — đọc diff là kết luận được. Viết khẳng định.
- **NGỜ** — cần đọc thêm mới chắc. **Viết thành câu hỏi**, và **không được
  là BLOCKER**.

Trước khi gắn CHẮC cho một finding về biến trạng thái, xác định nó là state
cục bộ tự quản lý hay state do thư viện quản lý (form, query cache, store) — và
tìm **mọi chỗ set**, không chỉ chỗ đọc. Đây là nguồn báo sai đã xảy ra thật.

Một finding NGỜ viết như khẳng định là kiểu sai đắt nhất: nó tiêu niềm tin
nhanh hơn mười finding đúng gây dựng được.
**Precision quan trọng hơn recall.** Ba finding đúng hết tốt hơn mười hai
finding trong đó năm cái sai.

## Báo cáo

Mỗi **nhóm** không có vấn đề → đúng một dòng `Nhóm <tên> — OK`.
Không liệt kê lại từng gạch đầu dòng. Không bịa finding cho đủ số lượng.

---

## Số dòng — phải chính xác

Mọi finding có số dòng thì số đó phải **có thật và chính xác**: đếm từ hunk
header `@@ -a,b +c,d @@`, lấy phía `+` (dòng sau thay đổi).

Cấm `~123`, `khoảng 110`, `dòng 100-120`. Không xác định được thì **không ghi
số dòng** — ghi tên hàm — và finding đó không được đưa vào comment inline.

Lý do không phải thẩm mỹ: `/rvpost inline` gửi số dòng thẳng cho GitHub. Số
gần đúng thì hoặc bị từ chối (422), hoặc tệ hơn: comment dán đúng một dòng
khác và người đọc mất thời gian vào chỗ không có vấn đề.

## Pass xác minh — bắt buộc trước khi viết

Review một lượt không có đối chứng thì báo sai kiểu khẳng định là chuyện sớm
muộn. Trước khi viết, duyệt lại **từng finding MUST**, đứng ở vị trí tác giả PR
đang phản bác. Giữ mức `CHẮC` chỉ khi trả lời được cả ba:

1. **Trích được đúng dòng code** trong diff (hoặc file đã đọc) chứng minh vấn
   đề — không phải "mẫu code này thường sai".
2. **Nêu được đường chạy cụ thể** dẫn tới hậu quả: input nào, nhánh nào, thứ
   tự nào, ai gọi.
3. **Đã đi tìm thứ phủ định nó.** Cụ thể theo loại:
   - cờ trạng thái → tìm **mọi chỗ set**, không chỉ chỗ đọc; xác định là
     state cục bộ hay state do thư viện quản lý
   - thiếu kiểm tra quyền → tìm guard / middleware / decorator ở tầng trên
   - thiếu cleanup → tìm teardown ở component cha hoặc ở nơi đăng ký
   - "caller chưa cập nhật" → thật sự grep caller, đừng suy đoán

Không đủ ba câu → **hạ xuống `NGỜ`, viết lại thành câu hỏi**, hoặc bỏ hẳn.

### Finding về hành vi của framework / thư viện — luật bằng chứng riêng

Finding mà kết luận nằm ở **framework hay thư viện xử lý thế nào**, chứ không ở
code trong repo ("`redirect()` ném exception nên phải rethrow", "hook này tự
cleanup", "ORM này chạy trong transaction", "middleware này bắt lỗi đó"), thì
câu 3 ở trên **chưa được tính là đã trả lời** nếu bằng chứng chỉ là hiểu biết
sẵn có về tài liệu. Phải có một trong hai:

- đọc **source thật trong `node_modules/<pkg>`** (hoặc `vendor/`, `site-packages/`,
  `$GOPATH/pkg/mod`) của **đúng version trong lockfile**; hoặc
- changelog / release note của đúng version đó nói rõ hành vi.

Không có thì **trần là `NGỜ`**, viết dạng câu hỏi — không bao giờ BLOCKER.

Lý do có luật này: đã báo sai một BLOCKER thật theo đúng kiểu đó — khẳng định
"bắt exception điều hướng mà không ném lại thì điều hướng chết", dựa trên
pattern trong tài liệu framework. Grep caller trong repo (đúng câu 3) không bác
được, vì thứ bác được nằm **ngoài repo**: ở phiên bản đang dùng, framework điều
hướng bằng cơ chế khác (header phản hồi), không phụ thuộc exception. Source đó
nằm sẵn trên đĩa, cách một lệnh grep.

Bài học: **phiên bản quyết định hành vi.** Cùng một API, hai phiên bản xử lý
khác nhau; trí nhớ về tài liệu không mang theo số phiên bản. Rubric vì vậy cố ý
viết rule dạng "phải kiểm gì", không khẳng định mặc định của thư viện.

Báo cáo kết quả pass này thành một dòng: `Pass xác minh: n giữ CHẮC, m hạ
NGỜ, k bỏ`. Dòng đó cho người đọc biết review đã tự đối chứng, và cho phép
kiểm lại sau này.

## Vùng mù — phải nói ra, không được im lặng

Review nào cũng có chỗ không nhìn tới. Chỗ nguy hiểm không phải chỗ nhìn sót,
mà là chỗ **sót mà không ai biết là đã sót**. Bắt buộc liệt kê:

- **File bị bộ lọc diff bỏ** (`RV stat` in sẵn danh sách). Cái nào là code
  viết tay — `.d.ts` tự viết, `components/ui/*` đã sửa tay, artifact trong
  `dist/` mà lại là code chạy thật — thì đọc riêng; phần còn lại ghi ra là
  vùng mù.
- **Module rubric không nạp** (`RV rubric` in sẵn danh sách). Phát hiện stack
  khớp theo tên file, nên một service backend đặt tên lạ sẽ làm cả nhóm kiểm
  tra quyền / N+1 / transaction / idempotency **im lặng không chạy**. Ghi ra
  nhóm nào đã không chạy.
- **Submodule thay đổi.** Diff chỉ thấy con trỏ commit. Không được kết luận
  "PR cơ học" khi thứ duy nhất thay đổi là submodule.
- **Danh sách file có thể bị cắt** ở 100 phần tử với PR lớn.
- **Số file đã đọc thêm ngoài diff** — tách hai loại: file **code** (giới
  hạn 3) và file **cổng/test** (cấu hình lint/tsconfig/CI cho mục 0, test cho
  mục 7 — không tính vào giới hạn vì chính rubric bắt đọc). Ghi ra để luật
  này kiểm lại được.

Một review nói "tôi đã không nhìn vào X" đáng tin hơn một review im lặng.

---

## 0. Cổng tự động — kiểm tra MỘT LẦN, không lặp lại mỗi dòng

**Không báo lại thứ cổng đã bắt.**

Đọc cấu hình **thật** của repo (compiler, linter, CI) — đừng giả định. Ví dụ
cổng phổ biến:

| Loại cổng | Ví dụ | Nếu CÓ ở mức chặn thì đừng báo |
|---|---|---|
| Compiler chế độ chặt | TS `strict`, mypy/pyright strict | null chưa kiểm, kiểu ngầm `any` |
| Kiểm tra index an toàn | TS `noUncheckedIndexedAccess` | truy cập index coi như luôn có |
| Linter có thông tin kiểu | typescript-eslint type-checked | promise trôi, async trong callback đồng bộ |
| Luật hooks | eslint-plugin-react-hooks | deps sai, hook trong nhánh điều kiện |
| Linter Python | ruff / flake8-bugbear | mặc định mutable, `except:` trần |
| Công cụ Go | `go vet`, `staticcheck`, `errcheck` | lỗi bị bỏ, printf sai |
| Formatter | prettier, black, gofmt, terraform fmt | mọi thứ về định dạng |

Cổng thiếu là **một finding hạ tầng ở đầu review** (SHOULD), không phải lý
do để báo lại từng dòng.

**Cổng chỉ cảnh báo thì KHÔNG tính là có cổng.** Nhiều preset để luật quan
trọng (vd deps của hooks) ở mức `warn` — không chặn CI, không chặn merge, và
thực tế bị cuộn qua. Quy tắc: cổng chặn được (`error`, hoặc bước CI fail) → im
lặng; cổng chỉ warn hoặc bị tắt → **vẫn báo**, mức SHOULD. Không chắc cổng ở
mức nào thì báo, kèm một câu nói rõ là linter có thể đã warn.

## 1. Ý định

- Thay đổi có khớp mô tả PR không? Lệch → báo ngay dòng đầu tiên.
- PR **không có mô tả** → một dòng ở mục "Khớp mô tả", **không** thành finding
  đánh số. Finding là từng thay đổi hành vi cụ thể không có lý do đi kèm.
- Có thay đổi nào **ngoài phạm vi** PR mô tả không? Chỗ bug hay trốn.
- Breaking change (đổi signature, kiểu trả về, format response, xoá field) —
  caller đã cập nhật chưa? Có nêu trong description không?

## 2. Correctness

- Biên: `null` / rỗng / `0` / số âm / rất lớn / chuỗi rất dài / unicode
- Off-by-one: index, slice, pagination (page vs offset), điều kiện vòng lặp
- Nhánh nào không bao giờ chạy tới, hoặc luôn đúng
- Phụ thuộc thứ tự thao tác mà không được bảo đảm
- Tiền dùng số thực (**BLOCKER**), timestamp không timezone, so sánh chuỗi
  bỏ qua locale
- Hàm trả `T[] | null` — dùng `null` thay mảng rỗng là nguồn bug; soát caller

## 3. Xử lý lỗi & trạng thái

- Lỗi bị nuốt: bắt rồi không làm gì, hoặc chỉ in console
- Phân biệt lỗi người dùng (đầu vào sai) và lỗi hệ thống (hạ tầng hỏng)
- **Cờ trạng thái đặt rải rác ở từng nhánh thay vì `finally`/`defer`** —
  liệt kê MỌI đường thoát (return sớm, throw, **nhánh thành công**) và kiểm
  tra đường nào không reset cờ
- Trạng thái đã đổi một nửa rồi lỗi — có rollback không
- Retry có giới hạn và backoff không

## 4. Đồng thời & tài nguyên

- Hai luồng cùng ghi một state / một record — có bảo vệ không
- Thao tác tạo/thanh toán có **idempotent** không
- Tài nguyên mở mà không đóng: file, socket, connection, transaction, lock
- Tác vụ nặng chặn luồng chính / event loop
- Có huỷ được không khi người gọi bỏ cuộc

## 5. Bảo mật

- Secret, API key, token, credential trong source → **BLOCKER**
- Đầu vào người dùng đi thẳng vào query, lệnh shell, đường dẫn file, HTML
- Kiểm tra **quyền** (authorization), không chỉ đăng nhập (authentication).
  Đặc biệt: điều kiện phân quyền bị **thu hẹp** so với trước
- Log ra token, mật khẩu, PII
- Tin dữ liệu client cho quyết định quan trọng (giá, quyền, số lượng)

## 6. Thiết kế & bảo trì

- **Đặt sai chỗ**: logic nghiệp vụ trong controller/component, truy cập DB ở
  tầng trình bày, luật phân quyền rải ở nhiều nơi thay vì một chỗ — lần sửa sau
  sẽ sửa sót một chỗ.
- **Over-engineering**: abstraction/generic/tham số cấu hình cho nhu cầu giả định
  tương lai, không có caller thứ hai. "Giải quyết vấn đề đang có, không phải vấn
  đề có thể có" (Google eng-practices).
- **Trùng lặp**: PR viết lại thứ đã có trong repo (helper, hằng, hook, service).
  *Kiểm:* grep trước khi báo.
- **Một PR làm nhiều việc không liên quan** → khó review, khó revert; đề xuất tách
  (chỉ NIT/SHOULD, không chặn).
- **Làm suy giảm sức khoẻ code**: tăng độ phức tạp mà không cần — hàm dài lồng
  nhiều tầng, cờ boolean điều khiển hành vi, copy-paste với khác biệt nhỏ.
- Tên biến/hàm nói dối so với việc nó làm
- Magic number/string không đặt tên
- Nhánh code không bao giờ chạy tới, feature flag chết
- Comment mô tả sai so với code bên dưới
- Prop/tham số được set nhưng bị vô hiệu hoá ở nơi khác (khai báo không có
  hiệu lực)

## 7. Test

- Đổi logic có test kèm không
- Test có assert điều gì thật, hay chỉ chạy cho có
- Test có phủ nhánh lỗi, không chỉ nhánh thành công
- Test phụ thuộc thời gian thật, thứ tự chạy, hoặc mạng thật → sẽ flaky

---

## Ngoại lệ — KHÔNG báo những cái này

- File sinh tự động, lockfile, build output, asset — đã bị lọc khỏi diff
- **Bất cứ thứ gì cổng ở mục 0 đã bắt** — kể cả khi bạn nhìn thấy nó
- Lỗi format/indent, import thừa, biến không dùng — linter đã lo
- Không đề xuất đổi kiến trúc tổng thể trong một PR nhỏ
- Không đòi test cho PR chỉ sửa chuỗi hiển thị, asset, hoặc config
- Không đòi comment cho code đã tự rõ nghĩa
