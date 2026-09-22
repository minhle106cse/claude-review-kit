#!/usr/bin/env node
'use strict'

// Chiều ngược của install.js: lấy bản đang chạy trong ~/.claude về lại kit,
// chuyển đường dẫn tuyệt đối thành placeholder. Dùng sau khi sửa prompt trực
// tiếp trong ~/.claude/commands rồi muốn commit thay đổi đó vào kit.

const fs = require('fs')
const path = require('path')
const P = require('../lib/paths')

const ROOT = path.join(__dirname, '..')
const COMMANDS = ['rvpr', 'rvpost', 'rvself']

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run') || args.includes('-n')
const valueOf = (f) => {
  const i = args.indexOf(f)
  return i >= 0 ? args[i + 1] : undefined
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Kéo bản đang chạy trong ~/.claude về kit này.

  npm run sync              đồng bộ về, ghi đè file trong kit
  npm run sync -- -n        chỉ in file nào sẽ đổi
  npm run sync -- --dir X   đọc từ thư mục .claude khác`)
  process.exit(0)
}

const claudeDir = valueOf('--dir') ? path.resolve(valueOf('--dir')) : P.claudeDir()
const tag = DRY ? '[thử]' : '     '
let changed = 0
let same = 0
const missing = []

function pull(srcAbs, destAbs, templatize) {
  const rel = path.relative(ROOT, destAbs)
  if (!fs.existsSync(srcAbs)) {
    missing.push(path.relative(claudeDir, srcAbs))
    return
  }
  const raw = fs.readFileSync(srcAbs, 'utf8')
  const out = templatize ? P.unrender(raw, claudeDir) : raw
  const before = fs.existsSync(destAbs) ? fs.readFileSync(destAbs, 'utf8') : null
  if (before === out) {
    same++
    return
  }
  console.log(`${tag} ${before === null ? 'thêm    ' : 'cập nhật'} ${rel}`)
  if (!DRY) fs.writeFileSync(destAbs, out)
  changed++

  if (templatize && /[Uu]sers[\\/][^\\/\s]+[\\/]\.claude/.test(out)) {
    console.log(`       ! ${rel} vẫn còn đường dẫn tuyệt đối — kiểm tra lib/paths.js có thiếu token không`)
  }
}

console.log(`đồng bộ ${claudeDir} -> kit${DRY ? '   (chạy thử)' : ''}\n`)

for (const c of COMMANDS) {
  pull(path.join(claudeDir, 'commands', `${c}.md`), path.join(ROOT, 'commands', `${c}.md`), true)
}
// Hợp của hai bên: module mới tạo trong ~/.claude cũng được kéo về kit.
const MODULES = [...new Set([
  ...P.modulesIn(path.join(claudeDir, 'review')),
  ...P.modulesIn(path.join(ROOT, 'review'))
])].sort()
for (const m of MODULES) {
  pull(path.join(claudeDir, 'review', `${m}.md`), path.join(ROOT, 'review', `${m}.md`), false)
}
pull(path.join(claudeDir, 'review', 'rv.sh'), path.join(ROOT, 'review', 'rv.sh'), false)

console.log(`\n${changed} file đổi, ${same} file giống nhau.`)
if (missing.length) {
  console.log('\nKhông tìm thấy (chưa cài, hoặc đã xoá):')
  for (const m of missing) console.log(`  - ${m}`)
}
if (changed && !DRY) console.log('\nXem lại rồi commit:  git -C . diff')
