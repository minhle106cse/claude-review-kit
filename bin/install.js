#!/usr/bin/env node
'use strict'

// Cài bộ review (/rvpr, /rvpost, /rvself + engine rv.sh) vào ~/.claude.
// Không phụ thuộc package ngoài — chỉ Node core, chạy được ngay qua npx.

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const P = require('../lib/paths')

const ROOT = path.join(__dirname, '..')
const COMMANDS = ['rvpr', 'rvpost', 'rvself']
const MODULES = P.modulesIn(path.join(ROOT, 'review'))

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const valueOf = (f) => {
  const i = args.indexOf(f)
  return i >= 0 ? args[i + 1] : undefined
}

const DRY = has('--dry-run') || has('-n')
const FORCE = has('--force') || has('-f')
const QUIET = has('--quiet') || has('-q')
const UNINSTALL = has('--uninstall')
const NO_SETTINGS = has('--no-settings')

if (has('--help') || has('-h')) {
  console.log(`claude-review-kit — cài bộ lệnh review PR cho Claude Code

  npx claude-review-kit                 cài vào ~/.claude
  npx claude-review-kit --dry-run       in ra sẽ làm gì, không ghi file
  npx claude-review-kit --force         ghi đè cả khi file đích đã đổi
  npx claude-review-kit --uninstall     gỡ ra (giữ lại thư mục reviews/)
  npx claude-review-kit --dir <path>    cài vào thư mục .claude khác
  npx claude-review-kit --roots a,b     đặt sẵn thư mục chứa clone cho rv.sh where
  npx claude-review-kit --no-settings   không đụng vào settings.json

Biến môi trường: CLAUDE_CONFIG_DIR đổi thư mục đích (mặc định ~/.claude).`)
  process.exit(0)
}

const claudeDir = valueOf('--dir') ? path.resolve(valueOf('--dir')) : P.claudeDir()
const log = (...m) => { if (!QUIET) console.log(...m) }
const tag = DRY ? '[thử]' : '     '

let wrote = 0
let skipped = 0
const warnings = []

function ensureDir(dir) {
  if (fs.existsSync(dir)) return
  log(`${tag} tạo thư mục  ${dir}`)
  if (!DRY) fs.mkdirSync(dir, { recursive: true })
}

// Ghi file, nhưng không âm thầm đè mất bản người dùng đã tự sửa.
function writeFile(dest, content, mode) {
  const rel = path.relative(claudeDir, dest)
  if (fs.existsSync(dest)) {
    const current = fs.readFileSync(dest, 'utf8')
    if (current === content) {
      log(`${tag} không đổi   ${rel}`)
      skipped++
      return
    }
    if (!FORCE) {
      const backup = `${dest}.bak-${stamp()}`
      log(`${tag} sao lưu     ${rel} -> ${path.basename(backup)}`)
      if (!DRY) fs.copyFileSync(dest, backup)
    }
    log(`${tag} cập nhật    ${rel}`)
  } else {
    log(`${tag} tạo mới     ${rel}`)
  }
  if (!DRY) {
    fs.writeFileSync(dest, content)
    if (mode) { try { fs.chmodSync(dest, mode) } catch (_) {} }
  }
  wrote++
}

function stamp() {
  const d = new Date()
  const p2 = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`
}

function haveCmd(cmd, cmdArgs) {
  try {
    execFileSync(cmd, cmdArgs, { stdio: 'ignore' })
    return true
  } catch (_) {
    return false
  }
}

// ── Gỡ cài đặt ───────────────────────────────────────────────────────────────
function uninstall() {
  log(`Gỡ khỏi ${claudeDir}`)
  for (const c of COMMANDS) {
    const f = path.join(claudeDir, 'commands', `${c}.md`)
    if (fs.existsSync(f)) {
      log(`${tag} xoá        commands/${c}.md`)
      if (!DRY) fs.unlinkSync(f)
    }
  }
  for (const m of [...MODULES.map((x) => `${x}.md`), 'rv.sh', 'roots.conf', '.clones.cache']) {
    const f = path.join(claudeDir, 'review', m)
    if (fs.existsSync(f)) {
      log(`${tag} xoá        review/${m}`)
      if (!DRY) fs.unlinkSync(f)
    }
  }
  const reviewDir = path.join(claudeDir, 'review')
  if (fs.existsSync(reviewDir) && fs.readdirSync(reviewDir).length === 0 && !DRY) fs.rmdirSync(reviewDir)
  log('')
  log(`Đã gỡ. Thư mục ${path.join(claudeDir, 'reviews')} (các file review đã viết) được giữ nguyên.`)
}

// ── Cài đặt ──────────────────────────────────────────────────────────────────
function install() {
  log(`claude-review-kit -> ${claudeDir}${DRY ? '   (chạy thử, không ghi gì)' : ''}`)
  log('')

  ensureDir(claudeDir)
  ensureDir(path.join(claudeDir, 'commands'))
  ensureDir(path.join(claudeDir, 'review'))
  ensureDir(path.join(claudeDir, 'reviews'))

  // 1. Command: render placeholder theo máy này.
  for (const c of COMMANDS) {
    const src = fs.readFileSync(path.join(ROOT, 'commands', `${c}.md`), 'utf8')
    const out = P.render(src, claudeDir)
    const left = P.leftoverTokens(out)
    if (left.length) warnings.push(`commands/${c}.md còn placeholder chưa thay: ${left.join(', ')}`)
    writeFile(path.join(claudeDir, 'commands', `${c}.md`), out)
  }

  // 2. Engine + rubric. rv.sh giữ nguyên văn, chỉ cần quyền chạy.
  for (const m of MODULES) {
    writeFile(
      path.join(claudeDir, 'review', `${m}.md`),
      fs.readFileSync(path.join(ROOT, 'review', `${m}.md`), 'utf8')
    )
  }
  writeFile(
    path.join(claudeDir, 'review', 'rv.sh'),
    fs.readFileSync(path.join(ROOT, 'review', 'rv.sh'), 'utf8'),
    0o755
  )

  // 3. roots.conf — nơi `rv.sh where` đi tìm clone. Không đè nếu đã có.
  writeRoots()

  // 4. settings.json — thêm allow-list để bớt prompt xin quyền.
  if (!NO_SETTINGS) mergeSettings()

  checkDeps()
  report()
}

function writeRoots() {
  const dest = path.join(claudeDir, 'review', 'roots.conf')
  // --force chỉ dành cho file của kit. roots.conf là cấu hình của người dùng:
  // chỉ ghi lại khi họ truyền --roots tường minh.
  if (fs.existsSync(dest) && !valueOf('--roots')) {
    log(`${tag} giữ nguyên  review/roots.conf (đã có — sửa tay nếu cần thêm thư mục)`)
    skipped++
    return
  }
  const explicit = valueOf('--roots')
  let roots
  if (explicit) {
    roots = explicit.split(',').map((s) => s.trim()).filter(Boolean)
  } else {
    const guesses = ['Vscode', 'repos', 'src', 'projects', 'code', 'dev', 'work', 'git']
    roots = guesses
      .map((g) => path.join(os.homedir(), g))
      .filter((p) => fs.existsSync(p))
      .map((p) => P.toBashPath(p))
    if (!roots.length) roots = [P.toBashPath(os.homedir())]
  }
  const body = [
    '# Thư mục gốc để `rv.sh where` đi tìm clone. Mỗi dòng một path.',
    '# Dùng dạng Git Bash trên Windows: /c/Users/ten/Vscode',
    ...roots
  ].join('\n') + '\n'
  writeFile(dest, body)
}

// Chỉ THÊM entry còn thiếu, không xoá gì của người dùng; hỏng JSON thì bỏ qua
// chứ không ghi đè — file này có thể chứa cấu hình họ đã chỉnh tay.
function mergeSettings() {
  const dest = path.join(claudeDir, 'settings.json')
  const rv = P.values(claudeDir).RV_BASH
  const need = [
    'Bash(gh pr view:*)',
    'Bash(gh pr list:*)',
    'Bash(git remote get-url:*)',
    'Bash(git status:*)',
    'Bash(git log:*)',
    'Bash(git blame:*)',
    `Bash(bash ${rv}:*)`
  ]

  let settings = {}
  if (fs.existsSync(dest)) {
    const raw = fs.readFileSync(dest, 'utf8')
    try {
      settings = JSON.parse(raw)
    } catch (e) {
      warnings.push(`settings.json không parse được (${e.message}) — bỏ qua, tự thêm allow-list bằng tay:\n    ${need.join('\n    ')}`)
      return
    }
  }

  settings.permissions = settings.permissions || {}
  const allow = Array.isArray(settings.permissions.allow) ? settings.permissions.allow : []
  const added = need.filter((n) => !allow.includes(n))
  if (!added.length) {
    log(`${tag} không đổi   settings.json (allow-list đã đủ)`)
    skipped++
    return
  }
  settings.permissions.allow = [...allow, ...added]
  writeFile(dest, JSON.stringify(settings, null, 2) + '\n')
  log(`${tag}             + ${added.length} mục allow-list`)
}

function checkDeps() {
  const bash = process.platform === 'win32'
    ? haveCmd('bash', ['-c', 'exit 0'])
    : haveCmd('bash', ['-c', 'exit 0'])
  if (!bash) warnings.push('không tìm thấy `bash` trong PATH — rv.sh cần Git Bash (Windows) hoặc bash (macOS/Linux)')
  if (!haveCmd('git', ['--version'])) warnings.push('không tìm thấy `git` trong PATH')
  if (!haveCmd('gh', ['--version'])) {
    warnings.push('không tìm thấy GitHub CLI `gh` — /rvpr và /rvpost cần nó để đọc & đăng PR (cài: https://cli.github.com)')
  } else if (!haveCmd('gh', ['auth', 'status'])) {
    warnings.push('`gh` chưa đăng nhập — chạy: gh auth login')
  }
}

function report() {
  log('')
  log(`Xong: ${wrote} file ghi, ${skipped} file không đổi.`)
  if (warnings.length) {
    log('')
    log('Cần chú ý:')
    for (const w of warnings) log(`  ! ${w}`)
  }
  log('')
  log('Dùng thử trong Claude Code (mở lại phiên để nạp lệnh mới):')
  log('  /rvpr 123 ten-repo      review PR #123')
  log('  /rvpost 123 ten-repo    đăng review đó lên GitHub')
  log('  /rvself                 tự review thay đổi local trước khi tạo PR')
  log('')
  log(`Kiểm tra engine chạy được:  bash ${P.values(claudeDir).RV_BASH} whoami`)
}

try {
  if (UNINSTALL) uninstall()
  else install()
} catch (e) {
  console.error(`\nLỗi: ${e.message}`)
  process.exit(1)
}
