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

> **Ngôn ngữ:** prompt, rubric, file review và comment `/rvpost` đăng lên PR đều bằng
> **tiếng Việt**. Team đọc ngôn ngữ khác thì cần dịch `commands/*.md` và `review/*.md`
> trước khi dùng `/rvpost`.

---

## Bắt đầu nhanh

```bash
npx github:minhle106cse/claude-review-kit
```

1. Đọc cuối output của lệnh cài: nó in các thư mục mà `/rvpr` sẽ tìm clone. Repo của
   bạn nằm chỗ khác thì cài lại với `--roots <thư mục 1>,<thư mục 2>`.
2. Mở lại phiên Claude Code (slash command chỉ nạp lúc khởi động).
3. Trong Claude Code, review một PR **đang mở**:
   ```
   /rvpr 123 owner/repo
   ```
4. Đọc file review nó ghi ra, rồi mới đăng lên PR:
   ```
   /rvpost 123 owner/repo nháp     xem trước nội dung sẽ đăng
   /rvpost 123 owner/repo          đăng (Claude Code sẽ hỏi quyền trước khi gọi GitHub)
   ```

Output ở terminal sau `/rvpr` trông như sau (ví dụ minh hoạ):

```
<D> = /c/Users/ten/code/web-app

Kết luận: CẦN SỬA — 1 BLOCKER
Stack: base typescript react · module không nạp: backend sql terraform python go cicd

MUST
1. src/app/orders/actions.ts:42 — [BLOCKER] — server action cập nhật đơn hàng không kiểm
   đơn thuộc về người gọi (chỉ kiểm đăng nhập)
2. src/components/order-list.tsx:88 — [NIT] — key là index trong danh sách có sắp xếp

NÊN CÓ: 0 trong file PR chạm · 1 ngoài phạm vi
Vùng mù: tier nhỏ · 0 file bị lọc · code 1/3 + cổng/test 2 · xác minh: tự · 2 CHẮC/0 NGỜ/0 bỏ
File review: ~/.claude/reviews/web-app-PR123.md
```

---

## Cài đặt

### Yêu cầu

| Thứ | Vì sao cần | Kiểm tra |
|---|---|---|
| Node.js ≥ 18 | chạy trình cài đặt (CI kiểm Node 18 và 22) | `node -v` |
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
Không cần cài gì vào máy, không để lại package toàn cục.

Ghim một bản phát hành cụ thể (xem danh sách ở tab Releases/Tags của repo):

```bash
npx github:minhle106cse/claude-review-kit#v1.0.4
```

> **Kit chưa được publish lên npm.** Đừng chạy `npx claude-review-kit` (không có
> `github:`): tên đó trên npm không thuộc về repo này, ai đăng ký trước thì lệnh sẽ
> chạy code của họ. Luôn dùng dạng `npx github:minhle106cse/claude-review-kit`.

### Cách 2 — clone về rồi cài

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

### `/rvpr <PR> [repo] [nhanh] [lượt A/n -- path...]` — review

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

**Chi phí token.** `/rvpr` đặt `model: inherit` + `effort: high`. Với PR cỡ vừa, nó
chỉ chạy thêm pha fan-out (tối đa 2 agent quét) khi diff có tín hiệu rủi ro: đổi hợp
đồng export, ghi state dùng chung, chạm quyền / tiền / dữ liệu / migration / API, hoặc
xoá nhiều code. Verifier độc lập chỉ chạy khi có ≥ 3 finding MUST hoặc có ứng viên
BLOCKER. Lệnh dùng model đang chọn của phiên, nên nếu phiên đang để Opus thì tốn hơn
nhiều. Gợi ý:

- Chuyển phiên sang **Sonnet** trước khi `/rvpr` (`/model sonnet`, hoặc chọn model trong
  app) — bộ rubric được thử chủ yếu trên Sonnet.
- PR nhỏ / sửa lặt vặt: thêm token `nhanh` để bỏ pha fan-out.
- PR > 2000 dòng (hoặc > 20 file logic): `/rvpr` dừng lại và in sẵn các dòng lệnh chia
  lượt, vd `/rvpr 444 api lượt A/3 -- src/auth/ src/guards/`. Chạy **từng dòng một,
  mỗi dòng một lần gọi riêng**. Các lượt ghép dần vào cùng một file review nên
  `/rvpost` vẫn dùng như thường. Dồn nhiều lượt vào một phiên tốn gấp ~5 lần, vì
  context phình ra và bị đọc lại ở mỗi lượt gọi tool.

Mỗi file review có dòng **Chi phí** ở mục Vùng mù (tổng token, số agent, context đỉnh),
lấy từ transcript bằng `rv.sh cost`. Mức đo thực tế: PR nhỏ hoặc `nhanh` khoảng 2M
token, còn một lần đủ quy trình (fan-out + verifier) khoảng 8–15M. Gần như toàn bộ là
đọc lại cache, loại token rẻ nhất.

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

### `/rvself [repo] [base <nhánh>]` — tự review trước khi tạo PR

```
/rvself                        thay đổi chưa commit của repo ở cwd
/rvself web-app                repo khác (tên hoặc đường dẫn)
/rvself base develop           cả nhánh: mọi commit từ merge-base với develop + chưa commit
```

Mặc định so với `HEAD`. Nếu không còn gì chưa commit (đã commit hết trên nhánh feature),
lệnh tự chuyển sang so với nhánh mặc định của `origin` và nói rõ đã chuyển. So theo
`origin/<nhánh>` ở lần fetch gần nhất — `git fetch` trước nếu base vừa có commit mới.

Chạy trong context riêng như `/rvpr` (rubric và diff không làm đầy phiên đang code), in
kết quả ra terminal, không ghi file. Finding đánh số liên tục; dòng cuối là
`KHÔNG NÊN PUSH` / `NÊN SỬA TRƯỚC KHI PUSH — #a` / `OK để push`. File untracked không nằm
trong diff — nó sẽ nhắc `git add -N <file>` rồi dừng.

---

## Cấu hình

### `roots.conf` — nơi tìm clone

`rv.sh where <repo>` quét các thư mục trong `~/.claude/review/roots.conf` để tìm clone
local (sâu tối đa 5 cấp). Mỗi dòng một đường dẫn tuyệt đối — không dùng `~` hay
`$HOME`, vì file được đọc nguyên văn:

```
# Windows (dạng Git Bash)
/c/Users/ten/code
/d/work

# macOS / Linux
/Users/ten/code
/home/ten/work
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
$RV where web-app                  # tìm clone local
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
| `typescript` | `.ts .tsx .js .jsx .mjs .cjs` | chỗ hệ kiểu bị qua mặt, bất đồng bộ, dữ liệu từ ngoài, bẫy ngày giờ/số/mảng |
| `react` | `.tsx .jsx`, `components/ hooks/ app/ pages/` | ranh giới server/client, cache theo người dùng, state khi SSR, effect, response về sai thứ tự, form, a11y |
| `backend` | `*.controller/service/dto/guard/strategy/worker…`, `.proto`, `api/ grpc/ handlers/ workers/ jobs/ lambdas/` | phân quyền/IDOR, xác thực & phiên, biên vào/ra, giao dịch + gọi ra ngoài, job/message, framework DI, **hợp đồng RPC/proto** |
| `sql` | `.sql`, `migrations/`, `*.entity/schema/model`, `prisma/ schemas/ models/` | SQL **và document store**: injection, filter rỗng ghi nhầm cả bảng, giao dịch, index, migration khi hệ thống đang chạy |
| `terraform` | `.tf .tfvars .hcl` | thay thế tài nguyên ngoài ý muốn, `moved`/`removed`, bảo mật, compute/LB, messaging, cảnh báo |
| `python` | `.py` | injection, timeout, async, thời gian không múi giờ, handler serverless |
| `go` | `.go` | vòng đời goroutine, context, lỗi, tài nguyên, HTTP |
| `cicd` | Dockerfile, compose, `.github/workflows\|actions`, Makefile, `.sh` | script injection, ghim action, OIDC, secret trong image, script shell |

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
| `/rvpr` báo diff rỗng / dừng với PR đã merge | Lệnh so PR với nhánh base **hiện tại**. PR đã merge thì base đã chứa hết code của PR nên không còn gì để so. Chỉ dùng cho PR đang mở. |
| `/rvpr` dừng, đề xuất chia lượt | PR vượt ngưỡng (> 2000 dòng hoặc > 20 file logic). Chọn một nhóm thư mục cho mỗi lượt như nó đề xuất. |

## Giới hạn đã biết

- Chỉ review PR **đang mở** trên GitHub (cần `gh`); không hỗ trợ GitLab/Bitbucket.
- Review dựa trên diff: bug nằm ở tương tác xa ngoài diff có thể sót — mục "Vùng mù"
  của mỗi review nói rõ đã không nhìn tới đâu.
- Output bằng tiếng Việt (xem đầu README).
- Là **ý kiến thứ hai**, không phải cổng chặn merge: chất lượng chưa được đo trên số
  lượng PR lớn. Đọc file review trước khi `/rvpost`.

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

[MIT](LICENSE).
