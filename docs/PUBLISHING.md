# Làm sao để `npx claude-review-kit` chạy được

> **Trạng thái hiện tại:** kit mới phát hành qua GitHub (đường 1), **chưa** publish lên
> npm. Cho tới khi làm xong đường 2, người dùng phải dùng
> `npx github:minhle106cse/claude-review-kit` — `npx claude-review-kit` sẽ tải package
> npm cùng tên của người khác nếu có ai đăng ký tên đó.

Mục tiêu: người khác gõ một dòng là cài xong, giống các skill/CLI "trên mạng".

```bash
npx claude-review-kit
```

Có hai đường tới đó. Đường GitHub không tốn gì và dùng được ngay; đường npm cho cái tên
gọn hơn. Làm đường 1 trước, thấy ổn định rồi hẵng làm đường 2.

---

## Cơ chế: vì sao `npx <tên>` lại chạy được file của mình

`npx X` làm đúng ba việc:

1. Tải package `X` (từ npm registry, hoặc từ GitHub nếu viết `github:owner/repo`) vào
   một thư mục cache tạm.
2. Đọc trường `bin` trong `package.json` của package đó.
3. Chạy file được `bin` trỏ tới, truyền lại mọi tham số phía sau.

Trong repo này:

```json
"bin": { "claude-review-kit": "bin/install.js" }
```

Nghĩa là `npx claude-review-kit --dry-run` sẽ chạy `node bin/install.js --dry-run`.

Ba điều kiện bắt buộc để nó không gãy:

- **Dòng shebang** ở dòng đầu `bin/install.js`: `#!/usr/bin/env node`. Thiếu nó, trên
  macOS/Linux file sẽ được chạy như shell script và lỗi cú pháp ngay dòng đầu.
- **Không có dependency**, hoặc nếu có thì phải khai trong `dependencies` (không phải
  `devDependencies`). Kit này cố ý dùng thuần Node core.
- **`files`** trong `package.json` phải liệt kê đủ thư mục cần thiết (`bin`, `lib`,
  `commands`, `review`, `docs`), nếu không package publish lên sẽ thiếu file và trình
  cài đặt chạy xong không ghi được gì.

---

## Đường 1 — GitHub (không cần tài khoản npm)

Người dùng gõ:

```bash
npx github:minhle106cse/claude-review-kit
```

### Các bước

```bash
cd claude-review-kit
git init
git add .
git commit -m "feat: bộ lệnh review PR cho Claude Code"
```

Tạo repo trên GitHub rồi đẩy lên:

```bash
gh repo create minhle106cse/claude-review-kit --public --source=. --remote=origin --push
```

Không dùng `gh` thì tạo repo bằng tay trên web, rồi:

```bash
git remote add origin git@github.com:minhle106cse/claude-review-kit.git
git branch -M main
git push -u origin main
```

### Kiểm tra trước khi đưa cho người khác

```bash
npx -y github:minhle106cse/claude-review-kit --dry-run
```

`--dry-run` in ra sẽ ghi gì mà không đụng file nào — chạy được lệnh này tức là toàn bộ
đường đi (clone → đọc `bin` → chạy `install.js`) đã thông.

### Ghim phiên bản

```bash
git tag -a v1.0.2 -m "v1.0.2" && git push origin v1.0.2   # khớp "version" trong package.json
```

Người dùng ghim tag:

```bash
npx github:minhle106cse/claude-review-kit#v1.0.2
```

Ưu điểm đường này: không cần npm, đẩy commit là người dùng nhận bản mới ngay. Nhược
điểm: tên lệnh dài, và repo private thì máy người dùng phải có quyền clone.

---

## Đường 2 — npm (để có `npx claude-review-kit`)

### Bước 1 — kiểm tra tên còn trống

```bash
npm view claude-review-kit
```

Báo `404 Not Found` là tên còn trống. Bị chiếm rồi thì đổi sang tên có phạm vi (scope)
theo tài khoản/tổ chức của mình:

```bash
npm pkg set name=@<tên-npm-của-bạn>/claude-review-kit
```

Tên có scope thì gói mặc định là private, phải publish kèm `--access public`.

### Bước 2 — đăng nhập

```bash
npm login
npm whoami
```

### Bước 3 — soát lại nội dung sẽ được publish

```bash
npm pack --dry-run
```

Đọc kỹ danh sách file in ra. Phải có đủ `bin/`, `lib/`, `commands/`, `review/`. Không
được có `.clones.cache`, `reviews/`, file `.bak`, hay bất cứ thứ gì chứa đường dẫn/dữ
liệu riêng. Thiếu file thì sửa `files` trong `package.json`; thừa file thì thêm vào
`.npmignore` (hoặc bỏ khỏi `files`).

### Bước 4 — publish

```bash
npm publish                  # tên thường
npm publish --access public  # tên có scope @you/...
```

### Bước 5 — thử như người dùng thật

```bash
npx -y claude-review-kit@latest --dry-run
```

Thêm `-y` để npx không hỏi xác nhận, `@latest` để không dính bản cache cũ.

### Ra bản mới

```bash
npm version patch    # 1.0.0 -> 1.0.1 (sửa lỗi)
npm version minor    # 1.0.0 -> 1.1.0 (thêm tính năng, không phá tương thích)
npm version major    # 1.0.0 -> 2.0.0 (đổi cấu trúc file cài, đổi tên lệnh...)
git push --follow-tags
npm publish
```

`npm version` tự sửa `package.json`, tạo commit và tag — chạy nó ở cây làm việc sạch.

Publish nhầm thì trong 72 giờ đầu có thể `npm unpublish <tên>@<phiên bản>`, nhưng đừng
dựa vào đó: cách lành hơn là `npm deprecate <tên>@<phiên bản> "lý do"` rồi publish bản
vá. Với thứ chạm vào `~/.claude` của người khác, một bản hỏng bị cache lại sẽ phiền hơn
nhiều so với việc chậm nửa ngày để thử kỹ.

---

## Trước mỗi lần publish

- [ ] `npm test` đạt — template render ra không còn placeholder, không lẫn đường dẫn máy mình
- [ ] `node bin/install.js --dry-run --dir /tmp/thu` chạy sạch
- [ ] Cài thật vào thư mục tạm rồi chạy `bash /tmp/thu/review/rv.sh whoami`
- [ ] `npm pack --dry-run` không chứa `.clones.cache`, `reviews/`, `*.bak`, `roots.conf`
- [ ] `grep -rn "Users[/\\\\]<tên-máy-bạn>" commands/ lib/ bin/` không ra kết quả
- [ ] README ghi đúng owner thật, không còn placeholder `<owner>`
- [ ] Đã bump version (npm từ chối publish đè lên version đã tồn tại)

---

## Tự động publish bằng GitHub Actions (tuỳ chọn)

Tạo `.github/workflows/publish.yml`:

```yaml
name: publish
on:
  push:
    tags: ['v*']
jobs:
  npm:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm test
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Cần một **Automation token** tạo ở npm (Access Tokens → Generate New Token →
Automation), lưu vào repo Secrets với tên `NPM_TOKEN`. Token loại Automation bỏ qua
2FA, đúng cho CI; token thường sẽ làm job treo chờ nhập OTP.

`--provenance` gắn chứng nhận nguồn gốc, cho người cài thấy package được build từ commit
nào — nên bật, nhưng chỉ chạy được trên CI công khai với `id-token: write`.

Từ đó, ra bản mới chỉ còn:

```bash
npm version patch && git push --follow-tags
```

---

## Cho người dùng nội bộ công ty

Không muốn publish công khai, có ba lựa chọn:

1. **Repo GitHub private** — `npx github:<org>/claude-review-kit`, mỗi người phải có
   quyền clone (SSH key hoặc `gh auth login`). Đơn giản nhất.
2. **npm registry nội bộ** (Verdaccio, Artifactory, GitHub Packages) — `npm publish` trỏ
   vào registry đó, người dùng cấu hình `.npmrc` tương ứng.
3. **Thư mục chia sẻ / tarball** — `npm pack` ra file `.tgz`, ai cần thì
   `npx ./claude-review-kit-1.0.0.tgz`. Không cần hạ tầng gì, đổi lại phải gửi file tay
   mỗi lần cập nhật.
