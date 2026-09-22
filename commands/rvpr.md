---
description: Review PR theo rubric khớp tech stack, tách MUST / NÊN CÓ, xuất file markdown
argument-hint: <PR-number> [owner/repo | repo] [nhanh] [lượt A/4 -- path...]
model: inherit
effort: high
context: fork
background: false
allowed-tools: Bash(git remote get-url:*), Bash(gh pr view:*), Bash(bash {{RV_BASH}}:*), Bash(git log:*), Bash(git blame:*), Bash(git ls-tree:*), Bash(git show:*), Read, Grep, Glob, Agent, Write({{REVIEWS_DIR_GLOB}}/**)
---

Bối cảnh: !`bash {{RV_BASH}} whoami`

`RV` = `bash {{RV_BASH}}`

## Nhiệm vụ

Review PR **#<PR>** — xem B0 để lấy `<PR>` từ `$ARGUMENTS`.

### B0 — Xác định repo và thư mục làm việc. LÀM TRƯỚC MỌI THỨ KHÁC.

Khối "Bối cảnh" ở trên in repo tại cwd và danh sách submodule của nó — cwd có
thể là superproject, còn PR lại thuộc một submodule.

**Đừng dùng tham số vị trí (`$1`, `$2`).** Chúng gán sai trên client này —
đã gặp thật: `/rvpost 187 ten-repo` làm `$1` nhận tên repo
thay vì `187`. Chỉ `$ARGUMENTS` là đáng tin. Tách nó ra token
và nhận dạng theo **hình dạng**, không theo vị trí:

| Token | Nghĩa |
|---|---|
| token **toàn chữ số** ĐẦU TIÊN | `<PR>` — số PR |
| token toàn chữ số hoặc chữ+dấu phẩy TIẾP THEO | bỏ qua (lệnh này không dùng) |
| đúng chữ `nhanh` | **chế độ nhanh** — bỏ B7.5 (fan-out) kể cả tier VỪA, xem B7.5 |
| đúng chữ `lượt` + token kế tiếp dạng `A/4` | `<LƯỢT>` — lượt thứ mấy / tổng mấy lượt, xem B6 "Chia lượt" |
| `--` | mọi token SAU nó là `<SCOPE>` — các path giới hạn lượt này |
| token còn lại (trước `--`) | `<REPO>` — tên repo (`owner/repo` hoặc chỉ `repo`) |

Không có token repo → `<REPO>` = repo ở cwd.
Không có token toàn chữ số → hỏi tôi số PR, **ĐỢI**. Đừng đoán.
Token `nhanh` (nếu có) → nhớ, dùng ở B7.5.
Có `<SCOPE>` → từ B4 trở đi, mọi `RV stat` / `RV diff` đều thêm `<SCOPE>` vào
cuối, và tier ở B6 tính **chỉ trên phạm vi đó**.

Tìm thư mục clone tương ứng:

    RV where <REPO>

- in ra một đường dẫn → đó là `<D>`
- thoát mã 2 (khớp nhiều clone) → in danh sách cho tôi, hỏi chọn, **ĐỢI**
- thoát mã 1 (không thấy) → báo tôi. Repo vừa clone xong thì thử
  `RV where --refresh <REPO>`; vẫn không có thì thêm thư mục gốc vào
  `~/.claude/review/roots.conf`, hoặc clone repo về. **DỪNG**, đừng đoán.

`<REPO>` dạng đầy đủ `owner/repo` lấy ở cột trái của `RV where`. `gh` không suy
được repo từ remote SSH alias — **luôn truyền `-R <REPO>`**.

**Từ đây mọi lệnh RV đều mang `-C <D>`.** `Read` / `Grep` / `Glob` cũng phải
dùng đường dẫn tuyệt đối bắt đầu bằng `<D>` — cwd của phiên làm việc không
nhất thiết là repo đang review. Nói rõ `<D>` ở dòng đầu output.

### Ba luật tuyệt đối

1. **KHÔNG sửa file nguồn.** Không `Edit`, không `Write` ra ngoài thư mục
   `~/.claude/reviews/`, không `git add` / `git commit` / `git checkout` /
   `git push` — kể cả khi repo này đã pre-approve các lệnh đó cho việc khác.
   Thấy cách sửa thì viết vào finding, không áp dụng.
2. **KHÔNG chạm GitHub.** Không `gh pr comment`, `gh api`, `gh pr review`,
   `gh pr merge`. Muốn post thì tôi gọi `/rvpost <PR>`.
3. **Diff CHỈ được lấy qua `RV diff`.** Không `gh pr diff`, không `git log -p`,
   không `git diff` trực tiếp. Hai lệnh đầu trả diff **chưa lọc** và được
   pre-approve nên chạy im lặng — dùng chúng là vô hiệu hoá bộ lọc mà không ai
   biết. Ngoại lệ duy nhất: đọc riêng một file bị bộ lọc bỏ mà B4 đã liệt kê,
   và phải nói rõ đang làm vậy vì lý do gì.

### Quy trình

**B1 — Metadata, đúng một lệnh:**

    gh pr view <PR> -R <REPO> --json title,body,author,baseRefName,files,additions,deletions

`body` thường là template PR dài, phần lớn là `<!-- hướng dẫn -->` chưa xoá.
**Bỏ qua mọi khối HTML comment**, chỉ đọc phần tác giả thật sự gõ vào. Nếu sau
khi bỏ comment mà không còn gì → PR **không có mô tả**: ghi **một dòng** ở mục
"Khớp mô tả PR" (không kiểm tra được phạm vi), **đừng trích lại template**.
**Không** biến nó thành finding MUST đánh số — ở team hay bỏ trống mô tả, nó
chiếm MUST #1 ở mọi review và dạy người đọc lướt qua mục MUST. Thay vào đó,
từng **thay đổi hành vi / breaking change cụ thể** mà không có lý do đi kèm
thì báo thành finding riêng ở nhóm 1 (Ý định), trỏ đúng dòng.

Nếu `files` trả về **đúng 100 phần tử** → nhiều khả năng danh sách đã bị cắt
(API phân trang). Nói rõ điều đó trong review và đối chiếu với số file mà
`RV stat` in ra ở B4 — đừng coi bảng phân loại là đầy đủ.

**B2 — PR này có đáng review không?**
Chỉ đụng lockfile / asset / chuỗi hiển thị / version bump → nói một câu rồi
**DỪNG**. Không bịa finding.
**Trừ khi** `RV stat` báo có thay đổi submodule: lúc đó diff chỉ thấy con trỏ
commit, KHÔNG được kết luận "PR cơ học" — báo rõ là phải review trong repo con.

**B3 — Phân loại file. CHƯA đọc diff.**
Từ `files` (đã kèm số dòng ±), in bảng gọn:

| File | ± | Mức |

Mức = `KỸ` (logic, quyền, tiền, migration, hạ tầng, biên vào/ra)
· `LIẾC` (test, config, chuỗi) · `BỎ` (sinh tự động, lock, asset).

Nêu luôn: thay đổi có khớp `body` không, có gì ngoài phạm vi mô tả không.

**B4 — Nạp ref và đo:**

    RV -C <D> fetch <baseRefName> <PR>
    RV -C <D> stat <baseRefName> <PR>

`RV fetch` in một dòng `REVIEWED-AT: ...` — **chép nguyên văn vào header file
review**. Không có nó thì không ai biết review nói về commit nào.

`RV stat` in mục **"Vùng mù"**: danh sách file bộ lọc đã bỏ, và cảnh báo
submodule. Đọc nó. File nào trong đó là **code viết tay** (`.d.ts` tự viết,
`components/ui/*` đã sửa tay, artifact trong `dist/` mà lại là code chạy thật)
thì nói rõ và đọc riêng file đó. Phần còn lại giữ nguyên là vùng mù và **phải
liệt kê trong review** — không được im lặng.

**B5 — Nạp rubric khớp stack:**

    RV -C <D> rubric <baseRefName> <PR>

**CẤM truncate output của lệnh này.** Không `| tail`, không `| head`,
không `| grep`, không `2>&1 | tail -n`. Rubric phải vào context nguyên vẹn —
đó là toàn bộ nội dung review dựa vào. Truncate để "xem cho nhanh khối
MODULE KHÔNG NẠP" = review không có rubric, và không ai nhìn ra điều đó từ
kết quả. Đã xảy ra thật một lần.

Luật này áp cho cả `RV mod` và `RV diff`. Diff quá lớn thì xử lý bằng ngưỡng ở
B6 (lọc theo file mức KỸ), không bao giờ bằng `head`/`tail`.

Chỉ áp rule của stack nó in ra. Đừng áp rule của stack không xuất hiện.

Cuối output có khối `!!! MODULE KHÔNG NẠP`. **Bắt buộc xử lý nó:** đối chiếu
với bảng phân loại ở B3. Có file backend / SQL / hạ tầng / job mà tên không
theo quy ước nên module không nạp → nạp tay `RV mod <tên>` rồi nói rõ đã nạp
thêm gì. Không có thì thôi — nhưng vẫn ghi vào review dòng "module không nạp:
…" để người đọc biết nhóm kiểm tra nào **đã không chạy**.

**Tự quyết, KHÔNG hỏi tôi.** Đây là việc nội bộ của review. Chỉ báo cáo một
dòng trong output là đủ.

**B6 — Ngưỡng, bắt buộc.** (Con số dưới đây là ước lượng theo kinh nghiệm,
chưa được đo — coi là mốc dừng để hỏi, không phải chân lý.)

- **tier NHỎ** — ≤ 800 dòng và ≤ 10 file mức KỸ → `RV -C <D> diff <baseRefName> <PR>`
- **tier VỪA** — 801–2000 dòng, hoặc 11–20 file KỸ → chỉ file mức `KỸ`:
  `RV -C <D> diff <baseRefName> <PR> <path>...`, nói rõ đã bỏ qua file nào
- **quá lớn** — > 2000 dòng, hoặc > 20 file KỸ → **DỪNG**, báo con số, đề xuất
  chia lượt (xem dưới), hỏi tôi

**Chia lượt.** Chia theo thư mục / cụm chức năng sao cho mỗi lượt ≤ 800 dòng
code (tier NHỎ), lượt biên bảo mật (auth, quyền, tiền) đứng đầu. In đề xuất
thành **các dòng lệnh chạy được ngay**, mỗi lượt một dòng:

    /rvpr <PR> <REPO> lượt A/4 -- src/guards/ src/auth/
    /rvpr <PR> <REPO> lượt B/4 -- src/cache/
    …

rồi DỪNG. **Mỗi lượt = một lần gọi `/rvpr` riêng**, không bao giờ review
nhiều lượt trong cùng một lần gọi — kể cả khi tôi bảo "chạy hết một mạch". Chi
phí token ≈ số lượt gọi tool × độ lớn context: dồn 6 lượt vào một phiên từng
làm context phình tới ~500k và tốn ~72M token đọc lại, gấp ~5 lần chạy riêng
từng lượt. Được yêu cầu chạy nhiều lượt → chỉ làm lượt đầu, in lại các dòng
lệnh còn lại. (Người/agent điều phối gọi lần lượt từng dòng thì đúng cách.)

Khi đang ở một lượt (`<LƯỢT>` có giá trị):
- Tier tính trên `<SCOPE>`. Scope vẫn > 2000 dòng → DỪNG, đề xuất chia nhỏ tiếp.
- Lượt đầu (`A/…`) → ghi file review mới như bình thường.
- Lượt sau → trước B7, `Read` file review hiện có của PR này. Header phải cùng
  head SHA (`REVIEWED-AT`) — khác SHA thì báo tôi và DỪNG, đừng ghép hai commit.
  Chỉ đọc để: không báo lại finding đã có, đánh số **tiếp** từ số lớn nhất.
  Không đọc lại diff của lượt trước.
- Ghi file: **giữ nguyên** mọi finding cũ, chèn finding lượt này vào đúng mục,
  cập nhật Kết luận cho **toàn bộ các lượt đã chạy**, header thêm dòng
  `LƯỢT: A,B/4 — phạm vi lượt này: <SCOPE>`. Chưa đủ lượt → Kết luận thêm câu
  `(mới review a/n lượt — chưa phải kết luận cuối)`. Nhờ vậy `/rvpost` luôn
  đọc một file duy nhất.

Ghi lại **tier** (NHỎ / VỪA) — B7.5 và B8 dùng nó để quyết định có fan-out không.
Ngân sách token của review buộc phải theo tier: PR nhỏ thì một lượt đọc là đủ,
đừng nổ 5 subagent cho một đổi 200 dòng.

Token `nhanh` **không** bỏ qua ngưỡng "quá lớn" — PR > 2000 dòng vẫn phải DỪNG
hỏi cách chia. `nhanh` chỉ bỏ fan-out (B7.5), không bỏ việc chia lượt.

Nếu `RV diff` in `# rv.sh: TẮT -w` → diff có Python/YAML/Makefile. Thay đổi
thụt lề sẽ hiện ra và **là thay đổi thật** (đổi luồng thực thi, đổi cấp key),
không phải nhiễu format. Đọc kỹ, đừng bỏ qua như thay đổi khoảng trắng.

**B7 — Đọc file gốc chỉ khi cần xác nhận một finding MUST cụ thể.**
Tối đa 3 file **code**, nói *file nào và tại sao* TRƯỚC khi đọc.
**Không mở file để đi săn finding NÊN CÓ** — loại đó chỉ báo khi gặp trên
đường, theo rubric.

**Không tính vào giới hạn 3** — vì chính rubric bắt đọc chúng:
- file **cấu hình cổng** cho nhóm 0: `tsconfig*.json`, `eslint.config.*` /
  `.eslintrc*`, `package.json`, `pyproject.toml` / `ruff.toml`, workflow CI
  — đọc **một lần** mỗi review, chỉ để xác định cổng nào có và ở mức nào;
- file **test** tương ứng code đổi, cho nhóm 7 — tối đa 2 file.

Ghi riêng hai nhóm trong mục Vùng mù: `code: n/3 — <tên>` và `cổng/test: <tên>`
— để luật này kiểm lại được. Vượt 3 file code thì **nói lý do** ở đó, đừng im.
Giới hạn 3 file này áp cho **bạn**, không áp cho subagent ở B7.5 — chúng có
context riêng, và việc của angle 2 chính là mở callsite.

**B7.5 — Quét bổ sung. Theo tier ở B6.**

B1–B7 đọc diff **một lần theo checklist**. Checklist chỉ tìm được thứ nó liệt
kê. Ba lớp bug dưới đây không có mục nào trong rubric bắt được và là chỗ review
một-lượt sót: (a) code bị **xoá** mang theo bảo đảm không ai dựng lại; (b)
caller **ngoài diff** vỡ vì đổi hợp đồng; (c) luật `CLAUDE.md` bị vi phạm.

**Điều kiện chạy — bắt buộc theo tier:**

- **Token `nhanh`** (B0) → **BỎ QUA B7.5 hoàn toàn**, kể cả tier VỪA, kể cả
  ngoại lệ hẹp. Chỉ luồng tuyến tính B1–B7 + tự đối chứng B8 (~40–60k). Ghi
  Vùng mù `Pha quét: không (chế độ nhanh)` và một dòng cảnh báo trong Kết luận:
  *"chế độ nhanh — không quét cross-file/removed-behavior, recall thấp hơn"*.
  Dùng khi user đã hiểu PR hoặc chỉ cần pass rubric nhanh.
- **tier NHỎ** → **BỎ QUA B7.5.** Luồng B1–B7 + tự đối chứng ở B8 đủ cho PR cỡ
  này; nổ subagent cho đổi < 800 dòng là đốt token vô ích. Ghi Vùng mù
  `Pha quét: không (tier nhỏ)`, sang thẳng B8.
  **Ngoại lệ hẹp:** nếu ở B1–B7 bạn thấy diff **đổi chữ ký / kiểu trả về / hình
  dạng response / điều kiện tiên quyết** của một symbol export ra ngoài file —
  chạy **riêng angle 2** (1 finder, ngân sách như dưới). Đây là lỗ hổng thật
  của tier nhỏ, và nó chỉ tốn 1 agent khi thật sự có contract đổi.
- **tier VỪA** (không có `nhanh`) → **chỉ chạy khi có tín hiệu**, tối đa 2
  finder, không bao giờ 3. Mỗi angle có cổng riêng:
  - angle 1 — theo điều kiện xoá ở dưới (≥ 150 dòng `-` hoặc ≥ 30%).
  - angle 2 — chỉ khi diff có **ít nhất một** trong: đổi chữ ký / kiểu trả về /
    hình dạng response / điều kiện tiên quyết của symbol export ra ngoài file ·
    ghi vào state dùng chung (store, singleton, biến cấp module) · chạm biên
    quyền / tiền / ghi dữ liệu / migration / hợp đồng API-gRPC-event.
  Không angle nào đạt cổng → **BỎ QUA B7.5**, ghi Vùng mù
  `Pha quét: không (tier vừa, không có tín hiệu: <lý do một dòng>)`. PR vừa mà
  chỉ đổi UI nội bộ, copy, refactor thân hàm thì không cần nổ agent — đó là
  phần lớn chi phí thừa đã đo được.
  Ghi rõ cổng nào đạt và vì sao — để người đọc kiểm lại quyết định bỏ quét.

**Angle (c) — CLAUDE.md — parent tự làm, KHÔNG spawn agent.**
`git -C <D> ls-tree -r pr/<PR> --name-only | grep -iE 'CLAUDE\.(md|local\.md)$'`
- rỗng → không có file, angle (c) xong, ghi `angle CLAUDE.md: không có file`.
- có → đọc chính file đó (không tính vào giới hạn 3 file code của B7 — nó là
  luật, không phải code), tự đối chiếu diff
  với luật trong đó; chỉ báo khi **trích nguyên văn luật** + **đúng dòng vi
  phạm**. Một agent riêng chỉ để phát hiện "repo không có CLAUDE.md" tốn ~30k
  token — đã đo, không lặp lại.

**Spawn finder** bằng Agent `Explore` (read-only → không vi phạm Luật tuyệt đối
1), **cùng một lượt tool call**, **`run_in_background: false`**.

> `run_in_background: false` là bắt buộc. Agent mặc định chạy nền; review không
> có việc gì khác trong lúc chờ, và nếu đọc transcript lúc chưa ghi xong sẽ
> thấy **rỗng 0 byte** → tưởng thất bại → chạy lại inline → kết quả thật về sau
> rơi vào session cha, mất trắng. Đã xảy ra thật. Rỗng = **chưa xong**.

Mỗi finder nhận: `<D>`, `<baseRefName>`, `<PR>`, lệnh `RV -C <D> diff …` mà B6
đã chọn, và một **brief 3 dòng** nói đúng việc của angle. **KHÔNG nạp lại
rubric** vào finder — nó làm việc từ diff.

Ngân sách mỗi finder, cứng: **≤ 5 candidate · ≤ 15 tool call · ≤ ~90k token.**
Chạm trần thì dừng, trả những gì đã có. Mỗi candidate: `file:line` (phía `+`,
đếm từ hunk header) + một câu vấn đề + **đường chạy cụ thể** dẫn tới hậu quả.

*Angle 1 — Cái đã bị xoá.* **CHỈ chạy khi** phần `-` của diff ≥ 150 dòng **hoặc**
≥ 30% tổng thay đổi. Dưới mức đó bỏ — ghi `angle 1: bỏ (xoá < 150 dòng)`. Khi
chạy: với mỗi dòng **XOÁ / thay thế**, gọi tên bảo đảm nó đang giữ (guard,
validate, nhánh lỗi, fallback, test), tìm chỗ code mới dựng lại. Không thấy →
candidate. Không soi code thêm mới.

*Angle 2 — Va chạm ngoài diff.* Chạy khi đạt cổng ở trên. Hai việc:

(a) **Caller.** Grep **tối đa 6 symbol** mà diff đổi **chữ ký / kiểu trả về /
    hình dạng response / điều kiện tiên quyết / ném thêm lỗi**. Bỏ qua symbol
    chỉ đổi thân hàm. Mở callsite tầng 1.

(b) **Ghi vào state dùng chung.** Nếu code MỚI `dispatch` / ghi biến cấp
    module / ghi singleton / ghi store toàn cục / mutate object import từ nơi
    khác — **truy tới định nghĩa của state đó** (đọc file khai báo store /
    context / biến), bất kể mấy hop. Hỏi: state này một-instance-per-process
    hay per-request? Ghi lúc render hay lúc effect? Đây là lớp bug đắt nhất
    (rò dữ liệu cross-request khi SSR) và nó KHÔNG lộ qua "đổi chữ ký".

Ngoài (a) và (b), không trace bắc cầu. Grep thật, ghi rõ symbol / file đã mở.

**Finder CỐ Ý thiên về recall. ĐỪNG TỰ LỌC.** Candidate nào gọi tên được đường
chạy thì đẩy qua, kể cả tin một nửa. Finder tự âm thầm bỏ candidate là nguyên
nhân sót lớn nhất — nó cắt luôn B8, chỗ **duy nhất** được phép loại. Phạm vi
giữ nguyên: chỉ soi code trong diff + caller của nó. **Không săn NÊN CÓ.**

Không spawn được Agent → **KHÔNG bỏ pha này**: tự chạy angle 1 + 2 tuần tự,
ghi Vùng mù `Pha quét: inline (không fan-out)`.

**B8 — Xác minh. BẮT BUỘC, làm trước khi viết.**

Gộp candidate của B7.5 (nếu có) với finding tự tìm ở B1–B7. Dedup: cùng lỗi,
cùng chỗ, cùng lý do → giữ một.

**Tier NHỎ, chế độ `nhanh`, hoặc không spawn được Agent** → **tự đối chứng**,
không spawn verifier: đứng ở vị trí tác giả PR đang phản bác, trả lời ba câu
hỏi bên dưới cho từng finding. Ghi `Xác minh: tự đối chứng`.

**Tier VỪA mà sau dedup chỉ còn ≤ 2 finding MUST và không cái nào là BLOCKER**
→ cũng **tự đối chứng** như trên (verifier ~100k token để kiểm 1–2 SHOULD là
không đáng). Ghi `Xác minh: tự đối chứng (tier vừa, ≤ 2 finding)`.

**Tier VỪA còn lại** (≥ 3 finding MUST, hoặc có ứng viên BLOCKER) → **một** Agent `Explore` verifier, `run_in_background: false`,
**một batch duy nhất**. Nhận `<D>` + cách lấy diff + **danh sách candidate
trần** — KHÔNG lý do, KHÔNG suy luận; điểm của bước này là một cái đầu chưa đầu
tư gì vào kết luận. Ngân sách: **≤ 12 candidate · ≤ 20 tool call · ≤ ~110k
token.** Chi tiêu theo mức nghi: candidate trông chắc → xác nhận nhanh (1–2
tool call); candidate lung lay → đào. Trên 12 candidate: tự dedup/gộp mạnh tay
xuống 12, đừng chia hai agent (đắt gấp đôi, đã đo 229k).

Verifier trả về đúng một mức cho mỗi candidate, kèm dòng code làm chứng:

- **CHẮC** — trả lời được cả ba:
  1. Trích được **đúng dòng code** trong diff (hoặc file gốc) chứng minh vấn
     đề — không phải "mẫu code này thường sai".
  2. Nêu được **đường chạy cụ thể**: input nào, nhánh nào, thứ tự nào, ai gọi.
  3. Đã đi tìm **thứ phủ định nó**: cờ trạng thái → tìm mọi chỗ `set*` (không
     chỉ chỗ đọc) và xác định state cục bộ hay state do thư viện quản lý;
     thiếu kiểm tra quyền → tìm guard/middleware/decorator tầng trên; thiếu
     cleanup → tìm teardown ở cha; "caller chưa cập nhật" → grep caller thật.
  **Kết luận nằm ở hành vi framework/thư viện** (không ở code repo) → câu 3 chỉ
  tính là đã trả lời khi đã đọc source trong `node_modules/<pkg>` của đúng
  version trong lockfile, hoặc changelog của version đó. Chỉ dựa vào hiểu biết
  về docs → **trần là NGỜ**. Xem `base.md`, mục "luật bằng chứng riêng".
- **NGỜ** — không đủ ba câu nhưng cũng không bác được. Viết lại thành **câu
  hỏi**, không bao giờ BLOCKER.
- **BỎ** — bác được từ chính code: sai sự thật (trích dòng thật), bất khả thi
  (kiểu / hằng / invariant chứng minh được), diff này đã xử lý rồi (trích
  guard), hoặc thuần style không có hậu quả quan sát được.

Đây là bước bắt lỗi báo sai đã từng xảy ra thật (khẳng định một biến state cục
bộ "không bao giờ reset"). Ở tier vừa, tách verifier ra agent riêng để cắt
thiên kiến tự-xác-nhận của agent đã viết finding.

B8 là chỗ **duy nhất** được loại finding. Ghi kết quả một dòng:
`Pass xác minh: n giữ CHẮC, m hạ NGỜ, k bỏ`.

**B9 — Viết review.**

### Quy tắc finding

- **Đánh số finding MUST liên tục từ 1**, theo thứ tự xuất hiện trong mục MUST,
  không phân biệt BLOCKER/SHOULD/NIT. Số này là cách tôi chọn finding khi
  `/rvpost` — thiếu số thì không chọn được.
- Format: `**<n>.** path/file.ts:123` — `[BLOCKER|SHOULD|NIT]` `[CHẮC|NGỜ]` — vấn đề — cách sửa
  Finding NÊN CÓ **không đánh số** (luôn được post cả cụm, không phải chọn).
- **Số dòng phải chính xác và có thật.** Đếm từ hunk header `@@ -a,b +c,d @@`
  của `RV diff`, lấy số dòng **sau thay đổi** (phía `+`). Cấm `~123`,
  `khoảng 110`, `dòng 100-120`. Không xác định được dòng chính xác → không
  ghi số dòng, ghi tên hàm, và finding đó **không được đưa vào comment inline**.
  (`/rvpost inline` cần số dòng đúng hunk, GitHub trả 422 nếu sai.)
- Phân loại **MUST / NÊN CÓ** theo mục "Phạm vi" của rubric `base`. Chỉ MUST
  được BLOCKER. NGỜ không bao giờ được BLOCKER, và viết dạng câu hỏi.
- Mỗi **nhóm** rubric không có vấn đề: đúng một dòng `Nhóm <tên> — OK`.
  Phải liệt kê **đủ 7 nhóm** của `base` (1 Ý định … 7 Test), mỗi nhóm hoặc
  `OK`, hoặc trỏ tới finding, hoặc `không áp dụng — <lý do>`. Nhóm nào không
  xuất hiện trong danh sách nghĩa là đã quên chạy.
- Tôn trọng phần "Ngoại lệ" và mục 0 (cổng tự động) của `base`.
- Gắn mức theo **mốc hiệu chỉnh** trong `base` (mục "Mức độ"), không theo cảm
  giác. Phân vân BLOCKER/SHOULD → đối chiếu với ví dụ mốc gần nhất và nói đã
  so với mốc nào.

### Chọn Kết luận — theo luật, không theo cảm giác

- Có ≥ 1 BLOCKER → `CẦN SỬA — n BLOCKER`.
- Không BLOCKER, nhưng có SHOULD **CHẮC** thuộc một trong: hành vi người dùng
  thấy sai trên luồng chính · dữ liệu ghi sai / mất · bảo mật · đổi hợp đồng
  API/gRPC/event ngầm · logic mới đáng kể mà không test nào chạm tới
  → `NÊN SỬA TRƯỚC KHI MERGE — #a, #b` (liệt kê đúng số finding đó).
- Còn lại → `MERGE ĐƯỢC`.

Lý do có mức giữa: trước đây kết luận chỉ đếm BLOCKER, nên một PR 2000 dòng
không test, có bug hiển thị sai dữ liệu vẫn ra "MERGE ĐƯỢC" — người đọc chỉ
nhìn dòng đó rồi merge.

### Đầu ra — hai phần

**(a) Ghi file** bằng Write vào
`{{REVIEWS_DIR_NATIVE}}/<repo-name>-PR<PR>.md`
(`<repo-name>` = phần sau dấu `/` của `<REPO>`)

Cấu trúc bắt buộc, đúng thứ tự này:

```
# Review PR #<n> — <title>
<author> · base <branch> · <n> file · +x/-y · stack: <đã phát hiện>
REVIEWED-AT: <chép nguyên dòng RV fetch in ra>

## Kết luận
MERGE ĐƯỢC | NÊN SỬA TRƯỚC KHI MERGE — #a, #b | CẦN SỬA — n BLOCKER
<một câu: vì sao chọn mức này>

## Khớp mô tả PR
<có/không, lệch chỗ nào — hoặc "PR không có mô tả, không kiểm được phạm vi">

## Phân loại file
<bảng>

## MUST — trong diff PR này
<finding, có thể có BLOCKER>

## NÊN CÓ — code có sẵn trong file PR chạm
> Không do PR này gây ra. Không chặn merge.
<finding, không BLOCKER>

## NÊN CÓ — ngoài phạm vi PR
> Phát hiện tình cờ, không liên quan PR này. Tác giả tự quyết có tạo issue không.
<finding, không BLOCKER>

## Đã kiểm — OK
<đủ 7 nhóm của base, mỗi nhóm một dòng>

## Vùng mù — những gì review này KHÔNG nhìn tới
- File bộ lọc đã bỏ: <danh sách, hoặc "không có">
- Module rubric không nạp: <danh sách> → nhóm kiểm tra tương ứng đã không chạy
- Submodule thay đổi: <có/không>
- File đọc thêm ngoài diff: code <n>/3 — <tên file> · cổng/test: <tên file>
- Tier B6: <nhỏ | vừa> <+ " · chế độ nhanh" nếu có token `nhanh`>
- Pha quét B7.5: <không (tier nhỏ) | không (chế độ nhanh) | không (tier vừa,
  không có tín hiệu: …) | fan-out <1|2> angle — cổng đạt: … |
  inline> — <n> candidate; angle 1 <chạy | bỏ, xoá < 150 dòng>;
  CLAUDE.md <không có file | n vi phạm>
- Xác minh: <verifier độc lập (1 batch) | tự đối chứng | tự đối chứng (tier vừa, ≤ 2 finding)>
- Pass xác minh: <n giữ CHẮC, m hạ NGỜ, k bỏ>
- Chi phí: <chép nguyên dòng `RV cost` in ra>
```

Ngay trước Write, chạy `RV cost` (không `-C`) — nó cộng token của chính lần
chạy này và mọi subagent nó gọi. In "không đo được" thì chép nguyên câu đó, đừng
ước lượng. Lượt sau của PR chia lượt: giữ dòng Chi phí của lượt trước, thêm dòng
mới có nhãn lượt.

Mục NÊN CÓ nào rỗng thì ghi `(không gặp)` — đừng đi tìm cho có.
Mục **Vùng mù không bao giờ được rỗng** — luôn có ít nhất một dòng mỗi gạch đầu.

**(b) In ra terminal bản RÚT GỌN:**

1. Một dòng kết luận (đúng một trong ba mức)
2. Stack đã phát hiện + module KHÔNG nạp
3. MUST: BLOCKER và SHOULD, mỗi cái **đúng một dòng**, có số:
   `<n>. file:line — [MỨC] — tóm tắt`. Số phải khớp với số trong file review —
   đây là thứ tôi nhìn để gõ `/rvpost <pr> 1,3`.
4. NÊN CÓ: chỉ **đếm** số lượng của mỗi mục
5. NIT: chỉ đếm
6. Một dòng vùng mù: `tier nhỏ|vừa|nhanh · n file bị lọc · code n/3 + cổng/test m ·
   quét: không|fan-out 2|inline, n candidate · xác minh: verifier|tự ·
   a CHẮC/b NGỜ/c bỏ`
7. Dòng chi phí từ `RV cost`
8. Đường dẫn file đã ghi
9. PR chia lượt mà còn lượt chưa chạy → in lại dòng lệnh `/rvpr … lượt …` kế tiếp

Không in lại toàn bộ review ra terminal.
