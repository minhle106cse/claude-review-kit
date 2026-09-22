#!/usr/bin/env bash
# Bộ công cụ review PR. Nguồn duy nhất cho: bộ lọc diff + chọn rubric theo stack.
#
#   rv.sh whoami                          repo ở cwd + danh sách submodule
#   rv.sh where [owner/repo|repo]         tìm clone local (không arg: liệt kê hết)
#
#   rv.sh [-C <dir>] fetch  <base> <pr>   nạp ref của PR, in SHA để ghi vào review
#   rv.sh [-C <dir>] ref    <base> <pr>   in lại SHA base / head / merge-base
#   rv.sh [-C <dir>] stat   <base> <pr> [path...]   thống kê đã lọc + báo vùng mù
#   rv.sh [-C <dir>] diff   <base> <pr> [path...]   diff đã lọc
#   rv.sh [-C <dir>] rubric <base> <pr>   rubric khớp stack + báo module KHÔNG nạp
#   rv.sh [-C <dir>] stacks <base> <pr>   chỉ in tên stack phát hiện được
#   rv.sh [-C <dir>] status               git status --short (xem untracked)
#   rv.sh mod    <tên>...                 nạp tay một/nhiều module rubric
#   rv.sh detect                          đọc danh sách path ở stdin, in stack (thử regex)
#   rv.sh cost                            token của lần /rvpr đang chạy + subagent của nó
#
#   rv.sh [-C <dir>] selfstat  [--base <nhánh>] [path...]   như trên, so với HEAD
#   rv.sh [-C <dir>] selfdiff  [--base <nhánh>] [path...]   (--base: so với merge-base
#   rv.sh [-C <dir>] selfrubric [--base <nhánh>]              → gồm cả commit trên nhánh)
#   rv.sh [-C <dir>] defbase                nhánh mặc định của origin
#
# -C nhận đường dẫn tuyệt đối hoặc tương đối. Không có -C thì chạy ở cwd.
# Danh sách thư mục để `where` đi tìm: review/roots.conf (mỗi dòng một path).
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Loại khỏi diff: sinh tự động, phụ thuộc, build output, nhị phân.
# Cố ý KHÔNG loại migrations/ và *.sql — đó là thứ phải review kỹ nhất.
# Lưu ý: dùng "*ten" chứ không "**/ten" — dạng "**/" không khớp file ở gốc repo.
# Mọi thứ bị loại đều được LIỆT KÊ ở phần "Vùng mù" của `stat` / `selfstat`.
EXCLUDES=(
  ":(exclude)*.lock"
  ":(exclude)*package-lock.json"
  ":(exclude)*pnpm-lock.yaml"
  ":(exclude)*yarn.lock"
  ":(exclude)*bun.lockb"
  ":(exclude)*go.sum"
  ":(exclude)*Cargo.lock"
  ":(exclude)*poetry.lock"
  ":(exclude)*composer.lock"
  ":(exclude)*Gemfile.lock"
  ":(exclude)*terraform.lock.hcl"
  ":(exclude)*node_modules/*"
  ":(exclude)*vendor/*"
  ":(exclude)*.venv/*"
  ":(exclude)*__pycache__/*"
  ":(exclude)*dist/*"
  ":(exclude)*build/*"
  ":(exclude)*.next/*"
  ":(exclude)*coverage/*"
  ":(exclude)*.terraform/*"
  ":(exclude)*.tfstate*"
  ":(exclude)*generated/*"
  ":(exclude)*.gen.*"
  ":(exclude)*.pb.go"
  ":(exclude)*_pb2.py"
  ":(exclude)*.g.dart"
  ":(exclude)*.freezed.dart"
  ":(exclude)*.d.ts"
  ":(exclude)*types/grpc/*"
  ":(exclude)*__snapshots__/*"
  ":(exclude)*.snap"
  ":(exclude)*components/ui/*"
  ":(exclude)*.min.js"
  ":(exclude)*.min.css"
  ":(exclude)*.map"
  ":(exclude)*.png"
  ":(exclude)*.jpg"
  ":(exclude)*.jpeg"
  ":(exclude)*.gif"
  ":(exclude)*.webp"
  ":(exclude)*.ico"
  ":(exclude)*.svg"
  ":(exclude)*.pdf"
  ":(exclude)*.woff"
  ":(exclude)*.woff2"
  ":(exclude)*.ttf"
)

# File mà KHOẢNG TRẮNG LÀ NGỮ NGHĨA. Có mặt trong diff thì không được dùng -w,
# vì `git diff -w` giấu thay đổi thụt lề: đổi luồng Python, đổi cấp key YAML.
WS_SENSITIVE='\.(py|pyi|ya?ml|mk)$|(^|/)Makefile|(^|/)\.github/workflows/'

ALL_MODULES=(base typescript react backend sql terraform python go cicd)

die() { echo "rv.sh: $*" >&2; exit 1; }

# ── -C <dir> ────────────────────────────────────────────────────────────────
RVDIR="."
if [ "${1:-}" = "-C" ]; then
  [ $# -ge 2 ] || die "-C cần một đường dẫn"
  RVDIR="$2"; shift 2
  [ -d "$RVDIR" ] || die "không có thư mục '$RVDIR'"
fi
GIT=(git -C "$RVDIR")

# ── Tìm clone local ─────────────────────────────────────────────────────────
# Chuẩn hoá remote url về dạng owner/repo. Xử lý được cả SSH alias
# (git@github-work:owner/repo.git), ssh://, https://, và đường dẫn local.
slug_of_url() {
  local u="${1%.git}"
  u="${u%/}"
  sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##; s#^[^@/]*@##; s#^[^:/]+[:/]+##' <<<"$u" \
    | awk -F/ 'NF>=2 { print $(NF-1) "/" $NF; next } { print }'
}

slug_of_dir() {
  local u
  u="$(git -C "$1" remote get-url origin 2>/dev/null)" || return 1
  [ -n "$u" ] || return 1
  slug_of_url "$u"
}

roots() {
  local cfg="$DIR/roots.conf"
  if [ -f "$cfg" ]; then
    grep -vE '^\s*(#|$)' "$cfg"
  else
    echo "$HOME/Vscode"
    echo "$HOME/repos"
    echo "$HOME/src"
    echo "$HOME/projects"
  fi
}

# Quét mất ~15s trên ổ nhiều repo nên có cache, TTL 24h.
# `where --refresh` hoặc RV_REFRESH=1 để quét lại ngay.
CACHE="$DIR/.clones.cache"

clones() {
  if [ "${RV_REFRESH:-0}" = "1" ] || [ ! -f "$CACHE" ]      || [ -n "$(find "$CACHE" -mmin +1440 2>/dev/null)" ]; then
    echo "rv.sh: dang quet clone (~15s, sau do dung cache 24h)..." >&2
    scan_clones > "$CACHE.tmp" && mv "$CACHE.tmp" "$CACHE"
  fi
  cat "$CACHE"
}

# In "slug<TAB>path" cho mọi clone tìm được dưới các root.
scan_clones() {
  local root g d s
  while read -r root; do
    [ -d "$root" ] || continue
    while read -r g; do
      [ -n "$g" ] || continue
      d="$(dirname "$g")"
      s="$(slug_of_dir "$d")" || continue
      printf '%s\t%s\n' "$s" "$d"
    done < <(find "$root" -maxdepth 5 \
               \( -name node_modules -o -name .terraform -o -name vendor \
                  -o -name .next -o -name dist -o -name build \) -prune \
               -o -name .git -print 2>/dev/null)
  done < <(roots) | sort -u
}

# ── Phát hiện stack từ danh sách file. Đọc path trên stdin, in tên module. ───
# Thêm stack mới: một dòng ở đây + tên vào ALL_MODULES + file review/<tên>.md.
# Xem README mục "Thêm tech stack".
detect_stacks() {
  local files; files="$(cat)"
  echo "base"
  grep -qiE '\.(ts|tsx|js|jsx|mjs|cjs)$'                                  <<<"$files" && echo "typescript"
  grep -qiE '\.(tsx|jsx)$|(^|/)(components|hooks|app|pages)/'             <<<"$files" && echo "react"
  grep -qiE '\.(controller|service|module|resolver|repository|handler|guard|middleware|route|dto|gateway|strategy|interceptor|processor|consumer|worker|scheduler)\.(ts|js|py|go)$|\.proto$|(^|/)(api|server|routes|handlers|endpoints|grpc|workers?|jobs?|consumers?|lambdas?)/' <<<"$files" && echo "backend"
  grep -qiE '\.sql$|(^|/)migrations?/|\.(entity|schema|model)\.(ts|js|py)$|(^|/)(prisma|schemas?|models?)/' <<<"$files" && echo "sql"
  grep -qiE '\.(tf|tfvars|hcl)$'                                          <<<"$files" && echo "terraform"
  grep -qiE '\.py$'                                                       <<<"$files" && echo "python"
  grep -qiE '\.go$'                                                       <<<"$files" && echo "go"
  grep -qiE '(^|/)Dockerfile|docker-compose|(^|/)\.github/(workflows|actions)/|(^|/)\.gitlab-ci|Jenkinsfile|(^|/)Makefile$|\.(mk|sh)$' <<<"$files" && echo "cicd"
  return 0
}

print_rubric() {
  local mods; mods="$(detect_stacks)"
  local m f missing=()
  while read -r m; do
    [ -z "$m" ] && continue
    f="$DIR/$m.md"
    [ -f "$f" ] && cat "$f" && echo
  done <<<"$mods"
  echo "<!-- module đã nạp: $(echo "$mods" | tr '\n' ' ') -->"

  for m in "${ALL_MODULES[@]}"; do
    grep -qx "$m" <<<"$mods" || missing+=("$m")
  done
  if [ ${#missing[@]} -gt 0 ]; then
    echo
    echo "!!! MODULE KHÔNG NẠP: ${missing[*]}"
    echo "Phát hiện stack chỉ khớp theo TÊN FILE. Một service backend đặt tên không"
    echo "theo quy ước, SQL viết thẳng trong code, hay hạ tầng ở thư mục lạ sẽ KHÔNG"
    echo "kích hoạt module tương ứng — cả nhóm kiểm tra đó im lặng không chạy."
    echo "Đối chiếu với bảng phân loại file. Nếu diff thật sự có loại code đó, nạp tay:"
    echo "    RV mod <tên>"
  fi
}

# Mốc so của self*: mặc định HEAD (chỉ thay đổi chưa commit). `--base <nhánh>` →
# merge-base với nhánh đó (ưu tiên origin/<nhánh>), diff tới cây làm việc = mọi
# commit trên nhánh + thay đổi chưa commit. Đặt SELF_REF và SELF_SHIFT.
self_ref() {
  SELF_REF=HEAD; SELF_SHIFT=0
  [ "${1:-}" = --base ] || return 0
  [ $# -ge 2 ] || die "--base <nhánh>"
  local b="$2" ref
  if "${GIT[@]}" rev-parse -q --verify "origin/$b^{commit}" >/dev/null; then ref="origin/$b"
  elif "${GIT[@]}" rev-parse -q --verify "$b^{commit}" >/dev/null; then ref="$b"
  else die "không thấy nhánh '$b' (đã thử origin/$b và $b)"; fi
  SELF_REF="$("${GIT[@]}" merge-base "$ref" HEAD)" || die "không có merge-base giữa $ref và HEAD"
  SELF_SHIFT=2
  echo "# rv.sh: so với merge-base $ref = ${SELF_REF:0:8} (commit trên nhánh + chưa commit; $ref theo lần fetch gần nhất)"
}

# Liệt kê những gì diff KHÔNG cho nhìn thấy. $1 = range của git diff.
report_blind_spots() {
  local range="$1" dropped nsub
  dropped="$(comm -13 <("${GIT[@]}" diff --name-only "$range" -- "${EXCLUDES[@]}" | sort) \
                      <("${GIT[@]}" diff --name-only "$range" | sort))"
  nsub="$("${GIT[@]}" diff --raw "$range" | grep -c '160000' || true)"
  echo
  echo "-- Vùng mù của diff này --"
  if [ -n "$dropped" ]; then
    echo "Bộ lọc đã bỏ $(grep -c . <<<"$dropped") file — NỘI DUNG KHÔNG ĐƯỢC ĐỌC:"
    sed 's/^/  - /' <<<"$dropped"
    echo "  => Cái nào là code viết tay (.d.ts tự viết, components/ui/* đã sửa tay,"
    echo "     build artifact commit nhầm mà đang chạy thật) thì đọc riêng:"
    echo "         git -C $RVDIR diff $range -- <path>"
  else
    echo "Bộ lọc đã bỏ: (không có file nào)"
  fi
  if [ "${nsub:-0}" -gt 0 ]; then
    echo "CẢNH BÁO: $nsub thay đổi SUBMODULE. Diff chỉ thấy con trỏ commit, KHÔNG thấy"
    echo "  code bên trong. Phải review trong repo con (rv.sh -C <path submodule> ...)"
    echo "  — đừng kết luận 'PR cơ học'."
  fi
}

# Đặt biến toàn cục WS: (-w) hoặc rỗng nếu diff có file nhạy cảm khoảng trắng.
set_ws_flag() {
  WS=(-w)
  if grep -qiE "$WS_SENSITIVE" <<<"$1"; then
    WS=()
    echo "# rv.sh: TẮT -w — diff có file mà khoảng trắng là ngữ nghĩa (py/yaml/Makefile/workflows)." >&2
    echo "# Thay đổi thụt lề sẽ hiện ra: đọc kỹ, đó có thể là đổi luồng thực thi." >&2
  fi
}

print_refs() {
  local b="$1" p="$2" bs hs ms
  bs="$("${GIT[@]}" rev-parse --short "origin/$b" 2>/dev/null)" || bs="?"
  hs="$("${GIT[@]}" rev-parse --short "refs/remotes/pr/$p" 2>/dev/null)" || hs="?"
  ms="$("${GIT[@]}" merge-base "origin/$b" "refs/remotes/pr/$p" 2>/dev/null | cut -c1-7)" || ms="?"
  echo "REVIEWED-AT: base origin/$b@$bs - head pr/$p@$hs - merge-base $ms"
  echo "  ^ chép nguyên dòng này vào header file review. Head của PR đổi thì review"
  echo "    cũ đang nói về code khác; không có dòng này thì không ai biết."
}

CMD="${1:-}"; shift || true

case "$CMD" in
  whoami)
    if s="$(slug_of_dir "$RVDIR")"; then
      echo "cwd-repo: $s  ($(cd "$RVDIR" && pwd))"
    else
      echo "cwd-repo: (không phải git repo, hoặc không có remote origin)"
    fi
    if [ -f "$RVDIR/.gitmodules" ]; then
      echo "submodules:"
      "${GIT[@]}" config -f .gitmodules --get-regexp '^submodule\..*\.(path|url)$' 2>/dev/null \
        | awk '{ key=$1; val=$2;
                 n=split(key,a,"."); name=""; for(i=2;i<n;i++) name=name (i>2?".":"") a[i];
                 if (a[n]=="path") path[name]=val; else if (a[n]=="url") url[name]=val }
               END { for (k in path) printf "%s\t%s\n", url[k], path[k] }' \
        | while IFS=$'\t' read -r u p; do
            printf '  %-34s %s%s\n' "$(slug_of_url "$u")" "$p" \
              "$( [ -e "$RVDIR/$p/.git" ] && echo "" || echo "   (CHƯA clone: git submodule update --init $p)" )"
          done
    fi
    ;;
  where)
    if [ "${1:-}" = "--refresh" ] || [ "${1:-}" = "-r" ]; then
      export RV_REFRESH=1; shift
    fi
    q="${1:-}"
    if [ -z "$q" ]; then
      echo "Clone tim duoc (root: $(roots | tr '
' ' ')):"
      clones | awk -F'	' '{ printf "  %-40s %s\n", $1, $2 }'
      exit 0
    fi
    match() { awk -F'	' -v q="$(tr 'A-Z' 'a-z' <<<"$q")"       '{ s=tolower($1); split(s,a,"/"); if (s==q || a[2]==q) print }'; }
    hits="$(clones | match)"
    # rong: co the la repo moi clone sau lan quet truoc -> quet lai dung mot lan
    [ -z "$hits" ] && hits="$(RV_REFRESH=1 clones | match)"
    n="$(grep -c . <<<"${hits:-}")"
    if [ -z "$hits" ]; then
      echo "rv.sh: khong tim thay clone nao khop '$q'." >&2
      echo "Da tim duoi: $(roots | tr '
' ' ')" >&2
      echo "Them thu muc vao $DIR/roots.conf, hoac clone repo ve truoc." >&2
      exit 1
    fi
    if [ "$n" -gt 1 ]; then
      echo "rv.sh: '$q' khop $n clone, noi ro owner/repo:" >&2
      awk -F'	' '{ printf "  %-40s %s\n", $1, $2 }' <<<"$hits" >&2
      exit 2
    fi
    cut -f2 <<<"$hits"
    ;;
  fetch)
    [ $# -ge 2 ] || die "fetch <base> <pr>"
    "${GIT[@]}" fetch -q origin "$1" || die "không fetch được base '$1' (repo: $RVDIR)"
    "${GIT[@]}" fetch -q --force origin "pull/$2/head:refs/remotes/pr/$2" || die "không fetch được PR #$2 (repo: $RVDIR)"
    echo "fetched trong $RVDIR: origin/$1 và refs/remotes/pr/$2"
    print_refs "$1" "$2"
    ;;
  ref)
    [ $# -ge 2 ] || die "ref <base> <pr>"
    print_refs "$1" "$2"
    ;;
  stat|diff)
    [ $# -ge 2 ] || die "$CMD <base> <pr> [path...]"
    B="$1"; P="$2"; shift 2
    RANGE="origin/$B...refs/remotes/pr/$P"
    FILES="$("${GIT[@]}" diff --name-only "$RANGE" -- "$@" "${EXCLUDES[@]}")"
    set_ws_flag "$FILES"
    if [ "$CMD" = stat ]; then
      "${GIT[@]}" diff --stat ${WS[@]+"${WS[@]}"} "$RANGE" -- "$@" "${EXCLUDES[@]}"
      report_blind_spots "$RANGE"
    else
      "${GIT[@]}" diff ${WS[@]+"${WS[@]}"} "$RANGE" -- "$@" "${EXCLUDES[@]}"
    fi
    ;;
  detect)
    detect_stacks | tr '\n' ' '; echo
    ;;
  cost)
    # Đọc transcript của Claude Code: <claude-dir>/projects/*/<session>/subagents/.
    # Lần /rvpr đang chạy là agent có transcript ghi gần nhất và mở đầu bằng
    # prompt của rvpr; subagent của nó khai parentAgentId trong .meta.json.
    command -v node >/dev/null 2>&1 || { echo "không đo được (thiếu node)"; exit 0; }
    CDIR="$(cd "$DIR/.." && { pwd -W 2>/dev/null || pwd; })"
    node - "$CDIR" <<'JS' || echo "không đo được"
const fs = require('fs'), path = require('path')
const root = path.join(process.argv[2], 'projects')
const files = []
for (const p of fs.existsSync(root) ? fs.readdirSync(root) : []) {
  const pd = path.join(root, p)
  let ss = []; try { ss = fs.readdirSync(pd) } catch (_) { continue }
  for (const s of ss) {
    const sd = path.join(pd, s, 'subagents')
    let fs2 = []; try { fs2 = fs.readdirSync(sd) } catch (_) { continue }
    for (const f of fs2) if (/^agent-.*\.jsonl$/.test(f)) {
      const fp = path.join(sd, f)
      files.push({ fp, dir: sd, id: f.slice(6, -6), mtime: fs.statSync(fp).mtimeMs })
    }
  }
}
files.sort((a, b) => b.mtime - a.mtime)
const head = (fp) => fs.readFileSync(fp, 'utf8').slice(0, 4000)
const self = files.slice(0, 20).find((f) => /Review PR \*\*#/.test(head(f.fp)) && /`RV` = `bash /.test(head(f.fp)))
if (!self) { console.log('không đo được (không thấy transcript của lần chạy này)'); process.exit(0) }
const meta = (f) => { try { return JSON.parse(fs.readFileSync(f.fp.replace(/\.jsonl$/, '.meta.json'), 'utf8')) } catch (_) { return {} } }
const siblings = files.filter((f) => f.dir === self.dir)
const tree = [self]
for (let i = 0; i < tree.length; i++) for (const f of siblings) if (meta(f).parentAgentId === tree[i].id && !tree.includes(f)) tree.push(f)
let turns = 0, fresh = 0, read = 0, write = 0, out = 0, peak = 0
const models = new Set()
for (const f of tree) for (const line of fs.readFileSync(f.fp, 'utf8').split(/\r?\n/)) {
  let o; try { o = JSON.parse(line) } catch (_) { continue }
  const u = o.message && o.message.usage
  if (!u) continue
  turns++; if (o.message.model) models.add(o.message.model.replace(/^claude-/, ''))
  fresh += u.input_tokens || 0; read += u.cache_read_input_tokens || 0
  write += u.cache_creation_input_tokens || 0; out += u.output_tokens || 0
  if (f === self) peak = Math.max(peak, (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0))
}
const M = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.round(n / 1e3) + 'k'
console.log(`${M(fresh + read + write + out)} token · ${tree.length} agent · ${turns} lượt gọi · đọc cache ${M(read)} · ghi cache ${M(write)} · output ${M(out)} · context đỉnh ${M(peak)} · ${[...models].join('+')} (chưa gồm lượt ghi file)`)
JS
    ;;
  stacks)
    [ $# -ge 2 ] || die "stacks <base> <pr>"
    "${GIT[@]}" diff --name-only "origin/$1...refs/remotes/pr/$2" -- "${EXCLUDES[@]}" | detect_stacks | tr '\n' ' '; echo
    ;;
  rubric)
    [ $# -ge 2 ] || die "rubric <base> <pr>"
    "${GIT[@]}" diff --name-only "origin/$1...refs/remotes/pr/$2" -- "${EXCLUDES[@]}" | print_rubric
    ;;
  status)
    "${GIT[@]}" status --short
    ;;
  mod)
    [ $# -ge 1 ] || die "mod <tên module>... (có: ${ALL_MODULES[*]})"
    for m in "$@"; do
      [ -f "$DIR/$m.md" ] || die "không có module '$m' (có: ${ALL_MODULES[*]})"
      cat "$DIR/$m.md"; echo
    done
    echo "<!-- module nạp tay: $* -->"
    ;;
  defbase)
    # Nhánh mặc định của origin — mốc so khi đã commit hết trên nhánh feature.
    b="$("${GIT[@]}" symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null)"
    b="${b#origin/}"
    if [ -z "$b" ]; then
      for c in develop main master; do
        "${GIT[@]}" rev-parse -q --verify "origin/$c^{commit}" >/dev/null && { b="$c"; break; }
      done
    fi
    [ -n "$b" ] || die "không đoán được nhánh mặc định — truyền --base <nhánh>"
    echo "$b"
    ;;
  selfstat)
    self_ref "$@"; shift "$SELF_SHIFT"
    FILES="$("${GIT[@]}" diff --name-only "$SELF_REF" -- "$@" "${EXCLUDES[@]}")"
    set_ws_flag "$FILES"
    "${GIT[@]}" diff --stat ${WS[@]+"${WS[@]}"} "$SELF_REF" -- "$@" "${EXCLUDES[@]}"
    report_blind_spots "$SELF_REF"
    ;;
  selfdiff)
    self_ref "$@"; shift "$SELF_SHIFT"
    FILES="$("${GIT[@]}" diff --name-only "$SELF_REF" -- "$@" "${EXCLUDES[@]}")"
    set_ws_flag "$FILES"
    "${GIT[@]}" diff ${WS[@]+"${WS[@]}"} "$SELF_REF" -- "$@" "${EXCLUDES[@]}"
    ;;
  selfrubric)
    self_ref "$@"; shift "$SELF_SHIFT"
    "${GIT[@]}" diff --name-only "$SELF_REF" -- "${EXCLUDES[@]}" | print_rubric
    ;;
  *)
    sed -n '2,24p' "$DIR/rv.sh"
    exit 1
    ;;
esac
