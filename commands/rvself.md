---
description: Self-review thay đổi local (chưa commit, hoặc cả nhánh) trước khi tạo PR
argument-hint: "[đường dẫn | tên repo con] [base <nhánh>]"
model: inherit
effort: high
context: fork
background: false
allowed-tools: Bash(git status:*), Bash(bash {{RV_BASH}}:*), Bash(git log:*), Read, Grep, Glob
---

Bối cảnh: !`bash {{RV_BASH}} whoami`

`RV` = `bash {{RV_BASH}}`

## Nhiệm vụ

Lệnh này chạy trong context riêng (fork): rubric và diff không đổ vào phiên
đang code. Hệ quả: **không hỏi-rồi-đợi được**. Chỗ nào dưới đây ghi **DỪNG** →
in lý do + việc tôi cần làm, rồi kết thúc; tôi sẽ gọi lại `/rvself`.

### B0 — Chọn repo và mốc so. LÀM TRƯỚC.

**Đừng dùng `$1`** — gán sai trên client này. Tách `$ARGUMENTS` ra token:

| Token | Nghĩa |
|---|---|
| đúng chữ `base` + token kế tiếp | `<BASE>` — nhánh để so (vd `base develop`) |
| token còn lại (nếu có) | repo: đường dẫn có thật → `<D>` = nó; tên repo → `RV where <token>` (nhiều kết quả → in danh sách, DỪNG) |

Không có token repo → `<D>` = `.` (repo ở cwd).

Khối "Bối cảnh" liệt kê submodule của repo hiện tại. cwd là superproject mà
thay đổi thật nằm trong submodule → bảo tôi chạy `/rvself <tên con>`, DỪNG.
Đừng review con trỏ commit.

Mọi lệnh RV mang `-C <D>`. Nói rõ `<D>` và mốc so ở dòng đầu output.

**Mốc so** — `<SO>` là phần chèn vào sau tên lệnh `selfstat` / `selfdiff` /
`selfrubric`:
- có `<BASE>` → `<SO>` = `--base <BASE>`: so từ merge-base với nhánh đó, gồm
  **mọi commit trên nhánh + thay đổi chưa commit**.
- không có → `<SO>` rỗng: chỉ thay đổi **chưa commit** (so với HEAD).
  Nếu B2 ra **rỗng** → nhiều khả năng đã commit hết. Chạy `RV -C <D> defbase`,
  lấy tên nhánh, đặt `<SO>` = `--base <nhánh đó>`, nói rõ đã tự chuyển, chạy lại
  B2. Vẫn rỗng → "không có gì để review", DỪNG.

Review thay đổi local như thể đây là PR của người khác. Nghiêm khắc — mục
đích là bắt lỗi trước khi người khác thấy.

**Luật: KHÔNG sửa file nguồn.** Không `Edit`, không `Write`, không
`git add/commit/checkout/push` — kể cả khi repo này đã pre-approve các lệnh đó
cho việc khác. Chỉ báo cáo. Tôi tự quyết sửa gì.

**B1.** Chạy `RV -C <D> status`. File có dấu `??` là **untracked** — sẽ KHÔNG
xuất hiện trong diff, ở cả hai mốc so. Nếu có file như vậy mà không phải rác,
liệt kê ra, bảo tôi chạy `git add -N <file>` rồi gọi lại, và DỪNG. Đây là chỗ dễ
miss nhất.

**B2.** Đo trước: `RV -C <D> selfstat <SO>`

Đọc mục **"Vùng mù"** nó in ra:

- **Có cảnh báo SUBMODULE** → diff chỉ thấy con trỏ commit, không thấy code
  bên trong. **Không được kết luận "PR cơ học"**. Nói rõ submodule nào đổi, bảo
  tôi chạy `/rvself` bên trong repo con đó, DỪNG.
- **File bị bộ lọc bỏ** → liệt kê lại cho tôi. Cái nào là code viết tay
  (`.d.ts` tự viết, `components/ui/*` đã sửa tay) thì đọc riêng bằng `Read`.

Chỉ đụng lockfile / asset / chuỗi → nói một câu rồi DỪNG.

**B3.** Nạp rubric khớp stack: `RV -C <D> selfrubric <SO>`
**CẤM truncate** output lệnh này (`| tail`, `| head`, `| grep`) — rubric phải vào
context nguyên vẹn, nếu không là review không có rubric mà không ai nhìn ra.
Chỉ áp rule của stack nó in ra.
Cuối output có khối `!!! MODULE KHÔNG NẠP` — đối chiếu với danh sách file:
có loại code đó mà tên file không theo quy ước thì nạp tay `RV mod <tên>`.
Dù nạp hay không, **nói ra module nào đã không chạy**.

**B4.** Ngưỡng: >2000 dòng → báo số, đề xuất tách thành nhiều PR theo thư mục /
chức năng (PR cỡ đó cũng khó cho người review), DỪNG.
Còn lại: `RV -C <D> selfdiff <SO>`

Nếu in ra `# rv.sh: TẮT -w` → diff có Python/YAML/Makefile, thay đổi thụt lề
là thay đổi **thật** (đổi luồng thực thi, đổi cấp key YAML). Đọc kỹ.

**B5.** Áp rubric. Phân loại **MUST / NÊN CÓ** và gắn **CHẮC / NGỜ** theo mục
"Phạm vi" và "Độ tin cậy" của rubric `base`. Chỉ MUST được BLOCKER.
Không đi tìm finding NÊN CÓ — chỉ báo nếu gặp trên đường.
Số dòng phải chính xác, đếm từ hunk header. Cấm `~123`.
Đổi logic → xem test có phủ không (nhóm 7). Không có test nào chạm tới nhánh
vừa đổi thì nói rõ — self-review là lúc rẻ nhất để thêm test.

**B6 — Pass xác minh.** Trước khi in, duyệt lại từng finding MUST: trích được
đúng dòng code chưa, nêu được đường chạy cụ thể chưa, đã đi tìm thứ phủ định
nó chưa (cờ trạng thái → tìm mọi chỗ `set*`; thiếu quyền → tìm guard tầng
trên; thiếu cleanup → tìm teardown ở cha; "caller vỡ" → grep caller thật).
Không đủ ba → hạ xuống `NGỜ`, viết thành câu hỏi, hoặc bỏ.

**B7.** In ra — không ghi file, đây là vòng nhanh. Đây là toàn bộ kết quả trả
về phiên chính, nên in **đầy đủ**, không tóm tắt thêm:

```
<D> = … · so với: HEAD (chưa commit) | merge-base origin/<nhánh> (<sha8>)

## MUST — trong thay đổi này
1. file:line — [BLOCKER|SHOULD|NIT] [CHẮC|NGỜ] — vấn đề + đường chạy + cách sửa gợi ý
2. …
## NÊN CÓ — code có sẵn xung quanh   (rỗng thì ghi "không gặp")
N+1. …                              (đánh số TIẾP, không bắt đầu lại)
## Đã kiểm — OK        (đủ 7 nhóm của base, mỗi nhóm một dòng)
## Vùng mù             (file bị lọc · module không nạp · submodule · untracked ·
                        Pass xác minh: a giữ CHẮC, b hạ NGỜ, c bỏ)
```

**Đánh số mọi finding, liên tục từ 1** — dòng kết luận trỏ vào số này.

Kết thúc bằng đúng một dòng, theo luật "Chọn Kết luận" giống `/rvpr`:
- có BLOCKER → `KHÔNG NÊN PUSH — n BLOCKER`
- không BLOCKER nhưng có SHOULD CHẮC loại nặng (sai hành vi luồng chính, dữ
  liệu, bảo mật, đổi hợp đồng ngầm, logic mới không test) → `NÊN SỬA TRƯỚC KHI
  PUSH — #a, #b` (đúng số finding ở trên)
- còn lại → `OK để push`

Gắn mức BLOCKER/SHOULD theo mốc hiệu chỉnh trong `base` (mục "Mức độ").
