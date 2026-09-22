---
description: Post review đã chốt lên PR GitHub — MUST inline, NÊN CÓ tách mục riêng
argument-hint: <PR-number> [repo] [inline] [1,3,5] [chọn|nháp]
allowed-tools: Bash(git remote get-url:*), Bash(gh pr view:*), Bash(bash {{RV_BASH}}:*), Read, Write
---

Bối cảnh: !`bash {{RV_BASH}} whoami`

`RV` = `bash {{RV_BASH}}`

## Nhiệm vụ

Đăng review của PR **#<PR>** lên GitHub — xem B0 để lấy `<PR>`.

### B0 — Đọc tham số. Thứ tự KHÔNG quan trọng, nhận dạng theo hình dạng.

**Đừng dùng tham số vị trí (`$1`, `$2`).** Chúng gán sai trên client này —
đã gặp thật: `/rvpost 187 ten-repo` làm `$1` nhận tên repo
thay vì `187`. Chỉ `$ARGUMENTS` là đáng tin. Tách nó ra token
và nhận dạng theo **hình dạng**, không theo vị trí:

| Token | Nghĩa |
|---|---|
| token **toàn chữ số** ĐẦU TIÊN | `<PR>` — số PR |
| token toàn chữ số / có dấu phẩy TIẾP THEO (`3`, `1,3,5`) | chỉ post những finding MUST số đó |
| đúng chữ `chọn` | dừng lại cho tôi chọn finding (chế độ cũ) |
| đúng chữ `nháp` | chỉ in bản nháp ra terminal, KHÔNG post |
| đúng chữ `inline` | post comment đúng dòng thay vì comment tổng |
| đúng chữ `đính chính` | rút lại finding đã đăng nhầm — xem B6 |
| còn lại | tên repo (`owner/repo` hoặc chỉ `repo`) |

**Mặc định là POST, không hỏi.** Không có token nào ở trên → lấy **toàn bộ MUST**
(BLOCKER + SHOULD, bỏ NIT) + toàn bộ NÊN CÓ, rồi đăng luôn.
Token không hiểu được → hỏi tôi, đừng đoán là repo rồi đi `RV where`.

`<REPO>`: token repo nếu có, không thì repo ở cwd. `RV where <REPO>` ra `<D>`;
mọi lệnh RV mang `-C <D>`. Không tìm được `<D>` thì vẫn post được comment tổng
(chỉ cần `gh -R <REPO>`), nhưng **không kiểm được số dòng** nên cấm `inline`.

**B1.** Đọc `{{REVIEWS_DIR_NATIVE}}/<repo-name>-PR<PR>.md`.
Không có file → bảo tôi chạy `/rvpr <PR>` trước, rồi DỪNG.

Đọc dòng `REVIEWED-AT:` trong header. Chạy `RV -C <D> ref <base> <PR>` và so lại: head
của PR đã đổi so với lúc review → **DỪNG**, báo cho tôi biết review đang nói về
commit cũ, hỏi có review lại không. Đừng post finding về code không còn nữa.

**B2 — Chọn finding. KHÔNG hỏi tôi.**

Gõ `/rvpost` đã là lệnh đăng rồi. Đừng hỏi lại, đừng bắt tôi xác nhận: chốt chặn
thật là prompt xin quyền của Claude Code ở B5, không phải một câu hỏi trong chat.

- mặc định → toàn bộ MUST (BLOCKER + SHOULD), bỏ NIT
- có danh sách số → đúng những finding đó
- có chữ `chọn` → khi đó mới liệt kê có đánh số, hỏi, và ĐỢI

Ngoại lệ duy nhất được phép dừng: `REVIEWED-AT` lệch với head hiện tại (B1), hoặc
`RV where` không tìm ra repo. Đó là lỗi dữ liệu, không phải chuyện sở thích.

**Finding NÊN CÓ thì LUÔN đưa vào, không cần tôi chọn** — kể cả khi chẳng
liên quan gì tới PR. Đây là chủ ý: comment của PR này là **chỗ duy nhất**
chúng được ghi lại, không có sổ hay backlog nào khác. Bỏ chúng đi là mất hẳn.
Chỉ loại khi tôi nói rõ từng cái.

Viết phần NÊN CÓ **thật gọn** — mỗi finding 1–2 dòng. Chúng chỉ để tham khảo,
không phải để tranh luận trong PR này.

**B2b — chống lặp.** Vì không có sổ trạng thái, cùng một finding NÊN CÓ sẽ bị
dán lại ở mọi PR chạm cùng file. Trước khi soạn, đọc comment đã có:

    gh pr view <PR> -R <REPO> --json comments

Finding NÊN CÓ nào đã từng được post ở PR này rồi thì **bỏ**, và nói cho tôi
biết đã bỏ cái nào. (Chỉ kiểm được trong phạm vi PR này — lặp giữa các PR khác
nhau thì đành chịu, đó là cái giá của thiết kế không lưu trạng thái.)

**B3.** Soạn nội dung — tiếng Việt, giọng xây dựng, NGẮN. Mỗi finding:
`file:line` + vấn đề 1–2 câu + đề xuất sửa cụ thể. Finding `NGỜ` giữ nguyên
dạng câu hỏi, không đổi thành khẳng định.

Cấu trúc comment:

```
**<dòng Kết luận của file review, nguyên văn>**
<nếu PR không có mô tả: một dòng "PR chưa có mô tả — nên bổ sung lý do cho các thay đổi hành vi bên dưới.">

<phần MUST — mỗi finding một gạch đầu dòng>

---
### Ngoài phạm vi PR này — không chặn merge
> Gặp trong lúc review, không do PR này gây ra. Ghi lại để anh/chị cân nhắc,
> không cần xử lý trong PR này.

<phần NÊN CÓ>

<dòng chân — xem dưới>
```

Nếu không có finding NÊN CÓ nào thì **bỏ hẳn khối đó**, đừng để tiêu đề rỗng.

**Dòng chân — không được nói dối.** Comment đăng dưới tên người đang chạy lệnh.
- Mặc định: `_Pass đầu có hỗ trợ AI (claude-review-kit)._`
- Chỉ khi tôi **nói rõ trong lượt này** rằng đã tự đọc lại finding (vd "đã
  kiểm", "tôi review lại rồi"), mới được dùng
  `_Pass đầu có hỗ trợ AI, đã được review lại thủ công._`
Đừng suy ra "đã kiểm" từ việc tôi gõ `/rvpost` — gõ lệnh đăng không có nghĩa
là đã đọc lại.

Câu dẫn "không do PR này gây ra" chỉ đúng với code có sẵn từ trước. Finding NÊN
CÓ mà **chính PR này để lại** (rác code trong lúc sửa, import bị comment, TODO
quên xoá) thì đổi câu dẫn thành *"Nhỏ, không chặn merge — dọn khi tiện."* Dán
câu sai vào rồi tự tay viết ngược lại ngay dòng dưới là chuyện đã xảy ra thật.

**B4.** In **toàn bộ** nội dung ra terminal — để tôi đọc được cái đã đăng, không
phải để xin phép. Rồi đi thẳng B5 trong cùng lượt. **Không hỏi, không đợi.**

Có token `nháp` → dừng ở đây, không post.

**B5.** Ghi ra file tạm trong thư mục
`{{TMP_DIR_NATIVE}}` rồi chạy:

*Mặc định — comment tổng ở cuối PR:*

    gh pr comment <PR> -R <REPO> --body-file <file tạm>

*Nếu tôi yêu cầu `inline`:* chỉ finding **MUST** mới được comment đúng dòng —
finding NÊN CÓ nằm ngoài diff nên GitHub sẽ từ chối, và dù có được cũng sai
chỗ.

Trước khi dựng payload, **kiểm số dòng của từng finding**:

1. Finding nào ghi dòng dạng `~123`, `khoảng 110`, `100-120`, hoặc không có số
   → **loại khỏi inline**, đẩy xuống phần body chung. Không được đoán.
2. Với số dòng còn lại, chạy `RV -C <D> diff <base> <PR> <path>` và xác nhận dòng đó
   nằm trong một hunk, phía `+` (dòng sau thay đổi). Không nằm trong hunk →
   đẩy xuống body chung, nói rõ lý do.
3. Nội dung finding phải được escape đúng JSON (dấu `"`, xuống dòng, backtick
   trong code fence). Dựng file bằng `Write`, không nối chuỗi trong shell.

Payload:

    {"event":"COMMENT","body":"<mở đầu + khối NÊN CÓ nếu có>","comments":[
      {"path":"src/x.ts","line":123,"side":"RIGHT","body":"..."}
    ]}

rồi:

    gh api repos/<REPO>/pulls/<PR>/reviews -X POST --input <file.json>

Gặp 422 → fallback sang comment tổng, nói rõ đã fallback và finding nào là thủ
phạm. Đường inline này **chưa từng chạy thật lần nào** — chạy lần đầu thì báo
kết quả cho tôi, đừng im lặng fallback.

Hai lệnh ở B5 **cố ý không** nằm trong allow-list nên Claude Code sẽ hỏi
quyền — đó là chốt chặn cuối, và là chốt chặn DUY NHẤT. Đừng thêm chốt chặn
bằng câu hỏi trong chat.

**B6 — Đính chính finding đã đăng nhầm.** Chỉ chạy khi có token `đính chính`.

Review sai thì chuyện đã rồi, nhưng để nguyên một BLOCKER sai trên PR là bắt
tác giả đi sửa thứ không hỏng — tốn hơn nhiều so với việc nhận sai. Đây là
đường đi cho việc đó, vì trước khi có nó tôi đã phải ứng biến giữa chừng.

Trình tự:

1. `gh pr view <PR> -R <REPO> --json comments` — tìm comment chứa finding sai.
   Không tìm thấy → hỏi tôi, đừng đoán.
2. Hỏi tôi **finding nào sai và bằng chứng bác nó là gì**, trừ khi tôi đã nói
   rõ trong lượt này rồi. Đính chính mà không có bằng chứng mới thì chỉ là đổi
   ý — đừng đăng.
3. Soạn comment mới, KHÔNG sửa và KHÔNG xoá comment cũ (lịch sử thảo luận có
   giá trị; tác giả có thể đã đọc và đã trả lời nó rồi). Cấu trúc:

```
### Đính chính review trước

**Rút lại:** <trích nguyên văn finding sai, có `file:line`>

**Vì sao sai:** <bằng chứng bác nó — trích dòng code / source thư viện / version>

**Trạng thái đúng:** <chỗ đó thật ra ổn | vẫn đáng xem nhưng chỉ ở mức câu hỏi>

Xin lỗi vì nhiễu. Các finding còn lại trong review trước không đổi.
```

4. Đăng bằng `gh pr comment` như B5 (vẫn qua chốt xin quyền).
5. Sửa luôn file review trong `{{REVIEWS_DIR_NATIVE}}`: đánh dấu finding đó là
   `[ĐÃ RÚT]` kèm lý do một dòng — để lần sau chạy `/rvpost` cùng PR không đăng
   lại nó.

Nếu nguyên nhân sai là một lỗ hổng trong rubric (chứ không phải sơ suất một
lần), nói cho tôi biết nên vá luật nào trong `review/base.md`.

### Cấm

Không `gh pr review --approve`, không `--request-changes`, không `gh pr merge`,
không `gh pr close`. Không sửa file nguồn, không `git add/commit/push`.
