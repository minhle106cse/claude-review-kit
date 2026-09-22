# claude-review-kit

Bộ lệnh review PR cho [Claude Code](https://claude.com/claude-code). Ba slash command
(`/rvpr`, `/rvpost`, `/rvself`) cộng một engine bash (`rv.sh`) lo phần lọc diff và chọn
rubric theo tech stack của chính PR đang xem.

Điểm khác với việc bảo Claude "review PR này":

- **Rubric theo stack, không phải checklist chung chung.** `rv.sh` nhìn danh sách file
  trong diff để quyết định nạp module nào (`typescript`, `react`, `backend`, `sql`,
  `terraform`, `python`, `go`, `cicd`), và **in rõ module nào KHÔNG nạp** để người đọc
  biết vùng nào chưa được soi.
- **Tách MUST và NÊN CÓ.** MUST là thứ chặn merge (BLOCKER/SHOULD). NÊN CÓ là thứ gặp
  trong lúc review nhưng không do PR gây ra — vẫn ghi lại, nhưng để riêng, không làm
  loãng phần cần sửa.
- **Báo vùng mù.** File bị bộ lọc bỏ, submodule chỉ thấy con trỏ commit, module rubric
  không nạp, số file đã đọc thêm ngoài diff — đều được liệt kê ở cuối review.
- **Ghi lại `REVIEWED-AT`.** Mỗi review đóng dấu SHA của base/head/merge-base. Khi đăng
  lên GitHub, `/rvpost` so lại SHA: head đã đổi thì dừng, không đăng finding về code
  không còn tồn tại.

---

## Cài đặt

### Yêu cầu

| Thứ | Vì sao cần | Kiểm tra |
|---|---|---|
| Node.js ≥ 16 | chạy trình cài đặt | `node -v` |
| Git | `rv.sh` chạy trên `git diff` | `git --version` |
| Bash | Git Bash trên Windows; có sẵn trên macOS/Linux | `bash --version` |
| [GitHub CLI](https://cli.github.com) đã đăng nhập | đọc & đăng comment PR | `gh auth status` |
| Claude Code **bản mới** | nơi slash command chạy | `claude --version` → `claude update` |

**Cập nhật Claude Code trước khi cài.** Frontmatter của `/rvpr` dùng `context: fork`,
`effort: high`, `background: false`. Bản cũ không hiểu các khoá này sẽ **lặng lẽ bỏ
qua** chứ không báo lỗi: review chạy ngay trong phiên chính (làm đầy context), không
theo mức effort đã đặt — kết quả khác hẳn bản đã thử.

### Cách 1 — `npx` thẳng từ GitHub (không cần publish npm)

```bash
npx github:minhle106cse/claude-review-kit
```

`npx` clone repo về cache tạm, đọc `bin` trong `package.json` rồi chạy `bin/install.js`.
Không cần cài gì vào máy, không để lại package toàn cục. Repo phải public, hoặc máy đang
chạy phải có quyền `git clone` repo private đó.

Chỉ định nhánh/tag cụ thể:

```bash
npx github:minhle106cse/claude-review-kit#v1.0.0
```

### Cách 2 — `npx` từ npm (sau khi đã publish)

```bash
npx claude-review-kit
```

Đây là dạng gọn nhất, cũng là dạng các skill "trên mạng" hay dùng. Muốn có nó thì phải
publish package lên npm trước — xem [docs/PUBLISHING.md](docs/PUBLISHING.md).

### Cách 3 — clone về rồi cài

```bash
git clone https://github.com/minhle106cse/claude-review-kit.git
cd claude-review-kit
node bin/install.js
```

Dùng cách này khi muốn sửa prompt/rubric rồi cài lại nhiều lần.

### Tuỳ chọn của trình cài đặt

```bash
node bin/install.js --dry-run          # in ra sẽ ghi gì, không đụng file nào
node bin/install.js --force            # ghi đè, không tạo file .bak (roots.conf vẫn giữ)
node bin/install.js --dir <path>       # cài vào thư mục .claude khác
node bin/install.js --roots a,b,c      # đặt sẵn roots.conf (thư mục chứa clone)
node bin/install.js --no-settings      # không đụng settings.json
node bin/install.js --uninstall        # gỡ ra
node bin/install.js --help
```

Biến môi trường `CLAUDE_CONFIG_DIR` đổi thư mục đích, giống cờ `--dir`.

**Lưu ý:** file đích đã tồn tại và khác nội dung sắp ghi thì trình cài đặt **sao lưu
thành `.bak-<ngày giờ>` trước**, trừ khi truyền `--force`. Không bao giờ xoá thư mục
`reviews/` (các file review đã viết) — kể cả khi gỡ cài đặt.

### Sau khi cài

Mở lại phiên Claude Code (slash command chỉ nạp lúc khởi động), rồi:

```
/rvpr 123 ten-repo
```

Kiểm tra engine chạy được, ngoài Claude Code:

```bash
bash ~/.claude/review/rv.sh whoami
```

---

## Cài gì vào đâu

```
~/.claude/
├── commands/
│   ├── rvpr.md            prompt của /rvpr    (đường dẫn đã render theo máy này)
│   ├── rvpost.md          prompt của /rvpost
│   └── rvself.md          prompt của /rvself
├── review/
│   ├── rv.sh              engine: lọc diff, phát hiện stack, in rubric
│   ├── base.md            rubric luôn nạp
│   ├── typescript.md      ┐
│   ├── react.md           │
│   ├── backend.md         │ chỉ nạp khi diff có loại file tương ứng
│   ├── sql.md             │
│   ├── terraform.md       │
│   ├── python.md          │
│   ├── go.md              │
│   ├── cicd.md            ┘
│   ├── roots.conf         thư mục để `rv.sh where` đi tìm clone
│   └── .clones.cache      cache 24h của lần quét clone (tự sinh)
├── reviews/               file review xuất ra, mỗi PR một file (tự sinh)
└── settings.json          được THÊM allow-list, không ghi đè phần khác
```

### Vì sao phải render đường dẫn

Prompt của slash command có nhắc đường dẫn tuyệt đối tới `rv.sh`, và khai báo
`allowed-tools` cũng cần đường dẫn tuyệt đối. Máy khác nhau thì home khác nhau, nên
trong repo này các file `commands/*.md` lưu ở dạng **template** với placeholder:

| Placeholder | Render thành (ví dụ trên Windows) |
|---|---|
| `{{RV_BASH}}` | `/c/Users/ten/.claude/review/rv.sh` |
| `{{CLAUDE_DIR_BASH}}` | `/c/Users/ten/.claude` |
| `{{CLAUDE_DIR_NATIVE}}` | `C:\Users\ten\.claude` |
| `{{REVIEWS_DIR_NATIVE}}` | `C:\Users\ten\.claude\reviews` |
| `{{REVIEWS_DIR_GLOB}}` | `//c/Users/ten/.claude/reviews` |
| `{{TMP_DIR_NATIVE}}` | `C:\Users\ten\AppData\Local\Temp` |

Có nhiều dạng của cùng một thư mục vì Claude Code nhận đường dẫn ở ba ngữ cảnh khác
nhau: lệnh Bash chạy qua Git Bash cần `/c/...`, văn bản cho người đọc cần `C:\...`, còn
glob trong `allowed-tools: Write(...)` cần dạng hai dấu gạch đầu.

`node test/roundtrip.test.js` kiểm tra đúng chuyện này: render với một home giả rồi
khẳng định không còn placeholder nào sót và không lẫn đường dẫn của máy gốc.

---

## Ba lệnh

### `/rvpr <PR> [repo] [nhanh]` — review

```
/rvpr 776 web-app
/rvpr 776 acme/web-app
/rvpr 776 web-app nhanh      bỏ pha fan-out, nhanh hơn, soi nông hơn
```

Tìm clone local của repo, fetch PR, lọc diff, nạp rubric khớp stack, review, rồi ghi
`~/.claude/reviews/<repo>-PR<số>.md`. File này là **scratchpad** — chạy lại cùng PR sẽ
ghi đè, đó là chủ ý. Sổ lưu thật là comment trên GitHub.

Thứ tự tham số không quan trọng: token toàn chữ số đầu tiên là số PR, phần còn lại là
tên repo.

**Chi phí token.** `/rvpr` đặt `model: inherit` + `effort: high`, và mặc định chạy thêm
pha fan-out (2 agent quét) cùng một verifier độc lập — tức là một lần review gọi model
vài lượt. Nó dùng model đang chọn của phiên, nên nếu phiên đang để Opus thì tốn hơn
nhiều. Gợi ý:

- Chuyển phiên sang **Sonnet** trước khi `/rvpr` (`/model sonnet`, hoặc chọn model trong
  app) — bộ rubric được thử chủ yếu trên Sonnet.
- PR nhỏ / sửa lặt vặt: thêm token `nhanh` để bỏ pha fan-out.
- PR > 2000 dòng (hoặc > 20 file logic): `/rvpr` dừng lại, đề xuất chia theo thư mục
  và hỏi — đừng ép review một lần.

**Kết luận có ba mức**, chọn theo luật chứ không theo cảm giác:

| Kết luận | Khi nào |
|---|---|
| `CẦN SỬA — n BLOCKER` | có ít nhất một BLOCKER |
| `NÊN SỬA TRƯỚC KHI MERGE — #a, #b` | không BLOCKER, nhưng có SHOULD chắc chắn về hành vi luồng chính, dữ liệu, bảo mật, hợp đồng API ngầm, hoặc logic mới không test |
| `MERGE ĐƯỢC` | còn lại |

BLOCKER hay SHOULD được gắn bằng cách so với bảng **mốc hiệu chỉnh** trong
`review/base.md` (mục "Mức độ") — để hai người chạy trên cùng PR ra cùng mức.

### `/rvpost <PR> [repo] [tuỳ chọn]` — đăng lên GitHub

```
/rvpost 776 web-app            đăng toàn bộ MUST + NÊN CÓ (mặc định)
/rvpost 776 web-app 1,3        chỉ đăng finding MUST số 1 và 3
/rvpost 776 web-app nháp       in bản nháp ra terminal, không đăng
/rvpost 776 web-app chọn       liệt kê rồi hỏi chọn finding nào
/rvpost 776 web-app inline     comment đúng dòng thay vì comment tổng
```

Trước khi đăng: đọc lại `REVIEWED-AT` trong file review và so với head hiện tại của PR;
lệch thì dừng. Cũng đọc comment đã có trên PR để không dán lại finding NÊN CÓ trùng.

Lệnh này **không** approve, không request-changes, không merge, không close.

Comment đăng **dưới tên bạn**. Dòng chân mặc định là *"Pass đầu có hỗ trợ AI"*. Chỉ
khi bạn nói rõ trong lượt đó là đã tự đọc lại (vd `/rvpost 776 web-app` rồi nhắn
"đã kiểm") thì mới ghi *"đã được review lại thủ công"*. Nên đọc file review trước khi
đăng — finding sai đứng tên bạn trên PR của đồng nghiệp.

### `/rvself [path...]` — tự review trước khi tạo PR

```
/rvself
/rvself src/app
```

So với `HEAD` thay vì với base của PR. Dùng khi code còn trong working tree.

---

## Cấu hình

### `roots.conf` — nơi tìm clone

`rv.sh where <repo>` quét các thư mục trong `~/.claude/review/roots.conf` để tìm clone
local. Mỗi dòng một path, dạng Git Bash trên Windows:

```
/c/Users/ten/Vscode
/c/Users/ten/work
```

Quét mất khoảng 15 giây nên có cache 24h. Vừa clone repo mới mà `where` chưa thấy:

```bash
bash ~/.claude/review/rv.sh where --refresh <repo>
```

### `settings.json` — bớt prompt xin quyền

Trình cài đặt **chỉ thêm** các mục còn thiếu vào `permissions.allow`, không xoá gì:

```json
"Bash(gh pr view:*)", "Bash(gh pr list:*)", "Bash(git remote get-url:*)",
"Bash(git status:*)", "Bash(git log:*)", "Bash(git blame:*)",
"Bash(bash <đường dẫn>/review/rv.sh:*)"
```

Cố ý **không** allow-list `gh pr comment` và `gh api ... /reviews` — đó là chốt chặn
cuối trước khi có thứ gì đó xuất hiện công khai trên GitHub, nên để Claude Code hỏi.

File `settings.json` hỏng cú pháp JSON thì trình cài đặt bỏ qua và in ra danh sách để
tự thêm tay, chứ không ghi đè.

---

## Sửa prompt rồi đồng bộ ngược

Sửa nhanh trực tiếp trong `~/.claude/commands/rvpr.md` (đang chạy thật, thử ngay được),
rồi kéo về kit để commit:

```bash
npm run sync          # ~/.claude -> kit, tự đổi đường dẫn thành placeholder
npm run sync -- -n    # chỉ in file nào sẽ đổi
npm test              # kiểm tra template còn render đúng
git diff
```

Chiều ngược lại (kit → `~/.claude`) là `node bin/install.js`.

---

## `rv.sh` dùng riêng được

Engine không phụ thuộc Claude Code, chạy tay cũng được:

```bash
RV="bash ~/.claude/review/rv.sh"

$RV whoami                        # repo ở cwd + danh sách submodule
$RV where web-app             # tìm clone local
$RV -C <dir> fetch develop 776    # nạp ref PR, in SHA
$RV -C <dir> ref develop 776      # in lại SHA (dùng để so head có đổi không)
$RV -C <dir> stat develop 776     # thống kê diff đã lọc + báo vùng mù
$RV -C <dir> diff develop 776 [path...]
$RV -C <dir> rubric develop 776   # rubric khớp stack + module KHÔNG nạp
$RV -C <dir> stacks develop 776   # chỉ in tên stack
$RV mod sql terraform             # nạp tay module rubric
$RV -C <dir> selfdiff [path...]   # so với HEAD
echo "lib/a/b.dart" | $RV detect  # thử bộ phát hiện stack với một path
```

Vài quyết định trong bộ lọc đáng biết:

- **Không** loại `migrations/` và `*.sql` — đó là thứ phải soi kỹ nhất.
- Tự tắt `git diff -w` khi diff có file mà khoảng trắng là ngữ nghĩa (`.py`, `.yaml`,
  `Makefile`, workflow) — vì `-w` sẽ giấu mất thay đổi thụt lề, tức là đổi luồng chạy.
- Thay đổi submodule chỉ hiện con trỏ commit; `stat` cảnh báo rõ để không kết luận nhầm
  "PR cơ học".

---

## Stack đang phủ

| Module | Nạp khi diff có | Phủ gì đáng chú ý |
|---|---|---|
| `base` | luôn luôn | phạm vi MUST/NÊN CÓ, luật bằng chứng, **mốc hiệu chỉnh BLOCKER/SHOULD**, 7 nhóm kiểm |
| `typescript` | `.ts .tsx .js .jsx .mjs .cjs` | chỗ compiler bị qua mặt, async, dữ liệu ngoài, bẫy Date/sort/JSON |
| `react` | `.tsx .jsx`, `components/ hooks/ app/ pages/` | hook, cờ trạng thái, Next.js App Router, server action, race response, Radix |
| `backend` | `*.controller/service/dto/guard/strategy/worker…`, `.proto`, `api/ grpc/ handlers/ workers/ jobs/ lambdas/` | biên vào/ra, NestJS (ValidationPipe, guard, CQRS, cron), **hợp đồng gRPC/proto**, Lambda+SQS |
| `sql` | `.sql`, `migrations/`, `*.entity/schema/model`, `prisma/ schemas/ models/` | SQL migration/truy vấn **và MongoDB/Mongoose** (operator injection, filter `undefined`, session transaction, index) |
| `terraform` | `.tf .tfvars .hcl` | bảo mật, replace ngoài ý muốn, `moved {}`, cặp cấu hình AWS (SQS↔Lambda, alarm, S3) |
| `python` | `.py` | injection, async, timeout, datetime naive, Lambda handler |
| `go` | `.go` | goroutine/context, defer, timeout, loop var theo version |
| `cicd` | Dockerfile, compose, `.github/workflows|actions`, Makefile, `.sh` | secret trong image, script injection trong Actions, OIDC, `set -euo pipefail` |

**Rubric không gắn phiên bản, không gắn repo.** Mỗi rule mô tả một *lỗi bản chất*
đúng với mọi thư viện/framework cùng loại; tên thư viện chỉ xuất hiện làm ví dụ. Chỗ
nào hành vi phụ thuộc thư viện hay phiên bản (mặc định timeout, cách ép kiểu, thuộc
tính nào gây replace…), rule nói **phải kiểm gì** thay vì khẳng định giá trị — và luật
bằng chứng của `base` bắt model đọc source/lockfile thật trước khi gắn `CHẮC`. Mỗi
module kết thúc bằng mục **"Không báo"** để giữ precision.

Nguồn tham chiếu: OWASP Cheat Sheets (REST, Authorization, Node.js), Google
eng-practices, React "You Might Not Need an Effect", protobuf.dev Dos & Don'ts,
GitHub Actions security hardening, Docker build best practices, HashiCorp Terraform
style guide, Go Code Review Comments.

Mỗi review nạp khoảng **13–18k token** rubric (chỉ module khớp stack) — rubric không
được nạp lại vào subagent finder/verifier.

Stack **chưa** có module (vd Dart/Flutter, Java, PHP…) vẫn review được, nhưng chỉ với
`base` — review sẽ in rõ điều đó ở mục "Module không nạp". Muốn phủ thì thêm module:

## Thêm tech stack

Ba chỗ, không có chỗ thứ tư — installer và sync tự nhận mọi file `review/*.md`.

**1. Viết rubric** — `review/<tên>.md`, ví dụ `review/dart.md`:

```markdown
# Rubric — Dart / Flutter

> Đã bỏ các mục `flutter analyze` / `very_good_analysis` bắt được.
> Nếu repo không chạy analyzer trong CI, xem mục 0 của `base`.

## <nhóm>
- <điều cần soi> — <vì sao là bug, khi nào là BLOCKER>
```

Nguyên tắc viết (đọc `review/react.md` hoặc `review/backend.md` làm mẫu):

- **Chỉ ghi thứ linter/compiler KHÔNG bắt.** Thứ cổng tự động đã bắt thì review
  không được báo lại (mục 0 của `base`) — viết vào rubric chỉ tạo nhiễu.
- **Mỗi gạch đầu là một lỗi cụ thể có hậu quả**, không phải lời khuyên chung
  ("viết code sạch", "xử lý lỗi tốt" là vô dụng — model đã biết).
- **Đánh dấu `(**BLOCKER**)`** cho mục mà hễ gặp là chặn merge; còn lại để trống,
  mức sẽ gắn theo mốc trong `base`.
- **Không gắn phiên bản, không gắn repo.** Viết lỗi bản chất; tên thư viện chỉ làm
  ví dụ. Hành vi phụ thuộc thư viện/phiên bản thì viết thành **việc phải kiểm**
  ("kiểm mặc định timeout của client đang dùng"), không khẳng định giá trị — xem cách
  `go.md` viết mục biến vòng lặp, `sql.md` viết mục validator khi update.
- **Kèm `*Kiểm:*`** cho mục dễ báo sai: cách xác nhận trước khi gắn CHẮC.
- **Kết thúc bằng mục "Không báo"** — những thứ trông giống lỗi nhưng không phải.
  Precision của review đến từ đây nhiều hơn từ danh sách lỗi.
- Dựa trên **nguồn có thẩm quyền** (hướng dẫn chính thức, OWASP, style guide của ngôn
  ngữ) và **bug đã xảy ra thật** (viết lại ở dạng tổng quát).

**2. Khai báo trong `review/rv.sh`:**

```bash
ALL_MODULES=(base typescript react ... cicd dart)          # thêm tên
# trong detect_stacks():
grep -qiE '\.dart$|(^|/)pubspec\.yaml$'  <<<"$files" && echo "dart"
```

Regex khớp theo **đường dẫn file**, không đọc nội dung. Thiếu thì module im lặng
không nạp; thừa thì tốn token cho rule không áp dụng — thiếu nguy hiểm hơn thừa.
Nếu stack có file sinh tự động, thêm vào `EXCLUDES` (vd `*.g.dart` đã có sẵn).

**3. Thêm ca vào `test/stacks.test.js`** — vài path thật của repo đó, với module
phải có (`want`) và không được có (`not`). Rồi:

```bash
echo "lib/features/auth/login_page.dart" | bash review/rv.sh detect
npm test
node bin/install.js        # cài vào ~/.claude để dùng thử
```

`npm test` sẽ báo lỗi nếu có file `review/*.md` mà `rv.sh` chưa khai báo, hoặc
ngược lại — hai chỗ này lệch là lỗi im lặng khó thấy nhất.

Sửa trực tiếp trong `~/.claude/review/` cũng được (thử nhanh hơn), rồi `npm run sync`
để kéo về kit — module mới cũng được kéo về.

---

## Gỡ cài đặt

```bash
npx github:minhle106cse/claude-review-kit --uninstall
# hoặc
node bin/install.js --uninstall
```

Xoá `commands/rv*.md` và `review/`. **Giữ nguyên** `~/.claude/reviews/` và không đụng
tới `settings.json` (tự xoá mục allow-list nếu muốn).

---

## Trục trặc thường gặp

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| `/rvpr` không hiện trong Claude Code | Chưa mở lại phiên. Slash command chỉ nạp lúc khởi động. |
| `rv.sh: khong tim thay clone nao khop` | Thư mục chứa clone chưa có trong `roots.conf`, hoặc cache cũ — thêm path rồi `where --refresh`. |
| `'q' khop N clone` | Hai repo trùng tên. Ghi rõ `owner/repo`. |
| `bash: command not found` (Windows) | Chưa có Git Bash trong PATH. Cài [Git for Windows](https://git-scm.com/download/win). |
| `gh: To get started with GitHub CLI, please run: gh auth login` | `gh auth login`. |
| `gh` báo không tìm thấy repo | Remote dùng SSH alias. Mọi lệnh `gh` phải có `-R owner/repo` tường minh. |
| Review nói về code đã cũ | Head PR đã đổi sau lúc review. Chạy lại `/rvpr` trước khi `/rvpost`. |
| Module rubric cần thiết không nạp | Phát hiện stack dựa trên tên file. Nạp tay: `$RV mod backend sql`. |

---

## Cấu trúc repo này

```
claude-review-kit/
├── .github/workflows/  CI: npm test trên Ubuntu + Windows, Node 18 + 22
├── bin/
│   ├── install.js      npx entry — render template rồi ghi vào ~/.claude
│   └── sync.js         chiều ngược: ~/.claude -> kit
├── lib/
│   └── paths.js        bảng placeholder + render/unrender, dùng chung cho 2 script
├── commands/           prompt slash command, dạng template
├── review/             rv.sh + 9 module rubric
├── test/
│   ├── roundtrip.test.js   template render đúng, module khai báo khớp rv.sh
│   ├── stacks.test.js      bảng ca cho bộ phát hiện stack
│   └── install.test.js     chạy installer thật vào thư mục tạm
├── docs/
│   └── PUBLISHING.md   cách publish để `npx claude-review-kit` chạy được
└── package.json
```

Trình cài đặt chỉ dùng Node core, không có dependency — `npx` không phải tải thêm gì,
và không có chuỗi phụ thuộc nào để mà mục ruỗng theo thời gian.

## Giấy phép

MIT.
