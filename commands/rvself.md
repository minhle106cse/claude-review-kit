---
description: Self-review thay đổi local trước khi tạo PR
argument-hint: "[đường dẫn hoặc tên repo con, mặc định: cwd]"
allowed-tools: Bash(git status:*), Bash(bash {{RV_BASH}}:*), Bash(git log:*), Read, Grep, Glob
---

Bối cảnh: !`bash {{RV_BASH}} whoami`

`RV` = `bash {{RV_BASH}}`

## Nhiệm vụ

### B0 — Chọn repo. LÀM TRƯỚC.

**Đừng dùng `$1`** — gán sai trên client này. Dùng `$ARGUMENTS`, lấy token đầu:

- rỗng → `<D>` = `.` (repo ở cwd)
- là đường dẫn có thật → `<D>` = đường dẫn đó
- là tên repo → `RV where <token>` để lấy `<D>`; nhiều kết quả thì hỏi tôi

Khối "Bối cảnh" liệt kê submodule của repo hiện tại. cwd là superproject mà
thay đổi thật nằm trong submodule → nói cho tôi biết chạy `/rvself <tên con>`,
đừng review con trỏ commit.

Mọi lệnh RV mang `-C <D>`. Nói rõ `<D>` ở dòng đầu output.
Trạng thái file: `RV -C <D> status` (B1 cần nó).

Review thay đổi local như thể đây là PR của người khác. Nghiêm khắc — mục
đích là bắt lỗi trước khi người khác thấy.

**Luật: KHÔNG sửa file nguồn.** Không `Edit`, không `Write`, không
`git add/commit/checkout/push` — kể cả khi repo này đã pre-approve các lệnh đó
cho việc khác. Chỉ báo cáo. Tôi tự quyết sửa gì.

**B1.** Chạy `RV -C <D> status`. File có dấu `??` là **untracked** — sẽ KHÔNG xuất hiện trong
diff. Nếu có file như vậy mà không phải rác, liệt kê ra và bảo tôi chạy
`git add -N <file>` trước, rồi ĐỢI. Đây là chỗ dễ miss nhất.

**B2.** Đo trước: `RV -C <D> selfstat`

Đọc mục **"Vùng mù"** nó in ra:

- **Có cảnh báo SUBMODULE** → diff chỉ thấy con trỏ commit, không thấy code
  bên trong. **Không được kết luận "PR cơ học"**. Nói rõ submodule nào đổi và
  bảo tôi chạy `/rvself` bên trong repo con đó, rồi ĐỢI.
- **File bị bộ lọc bỏ** → liệt kê lại cho tôi. Cái nào là code viết tay
  (`.d.ts` tự viết, `components/ui/*` đã sửa tay) thì đọc riêng bằng `Read`.

Chỉ đụng lockfile / asset / chuỗi → nói một câu rồi DỪNG.

**B3.** Nạp rubric khớp stack: `RV -C <D> selfrubric`
**CẤM truncate** output lệnh này (`| tail`, `| head`, `| grep`) — rubric phải vào
context nguyên vẹn, nếu không là review không có rubric mà không ai nhìn ra.
Chỉ áp rule của stack nó in ra.
Cuối output có khối `!!! MODULE KHÔNG NẠP` — đối chiếu với danh sách file:
có loại code đó mà tên file không theo quy ước thì nạp tay `RV mod <tên>`.
Dù nạp hay không, **nói ra module nào đã không chạy**.

**B4.** Ngưỡng: >2000 dòng thì dừng, báo số, hỏi tôi chọn thư mục.
Còn lại: `RV -C <D> selfdiff`

Nếu in ra `# rv.sh: TẮT -w` → diff có Python/YAML/Makefile, thay đổi thụt lề
là thay đổi **thật** (đổi luồng thực thi, đổi cấp key YAML). Đọc kỹ.

**B5.** Áp rubric. Phân loại **MUST / NÊN CÓ** và gắn **CHẮC / NGỜ** theo mục
"Phạm vi" và "Độ tin cậy" của rubric `base`. Chỉ MUST được BLOCKER.
Không đi tìm finding NÊN CÓ — chỉ báo nếu gặp trên đường.
Số dòng phải chính xác, đếm từ hunk header. Cấm `~123`.

**B6 — Pass xác minh.** Trước khi in, duyệt lại từng finding MUST: trích được
đúng dòng code chưa, nêu được đường chạy cụ thể chưa, đã đi tìm thứ phủ định
nó chưa (cờ trạng thái → tìm mọi chỗ `set*`; thiếu quyền → tìm guard tầng
trên; thiếu cleanup → tìm teardown ở cha). Không đủ ba → hạ xuống `NGỜ`, viết
thành câu hỏi, hoặc bỏ.

**B7.** In thẳng ra terminal — không ghi file, đây là vòng nhanh:

```
## MUST — trong thay đổi này
## NÊN CÓ — code có sẵn xung quanh   (rỗng thì ghi "không gặp")
## Đã kiểm — OK        (đủ 7 nhóm của base)
## Vùng mù             (file bị lọc · module không nạp · submodule · xác minh a/b/c)
```

Kết thúc bằng đúng một dòng, theo luật "Chọn Kết luận" giống `/rvpr`:
- có BLOCKER → `KHÔNG NÊN PUSH — n BLOCKER`
- không BLOCKER nhưng có SHOULD CHẮC loại nặng (sai hành vi luồng chính, dữ
  liệu, bảo mật, đổi hợp đồng ngầm, logic mới không test) → `NÊN SỬA TRƯỚC KHI
  PUSH — #a, #b`
- còn lại → `OK để push`

Gắn mức BLOCKER/SHOULD theo mốc hiệu chỉnh trong `base` (mục "Mức độ").
