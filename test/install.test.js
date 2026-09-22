'use strict'

// Chạy trình cài đặt THẬT vào thư mục tạm, như người dùng mới chạy npx. Hai test
// kia chỉ kiểm template và bộ phát hiện stack — installer hỏng cú pháp vẫn qua được
// chúng (đã xảy ra thật). Test này bắt đúng lớp lỗi đó.

const fs = require('fs')
const os = require('os')
const path = require('path')
const assert = require('assert')
const { execFileSync } = require('child_process')

const INSTALL = path.join(__dirname, '..', 'bin', 'install.js')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crk-install-'))
const dir = path.join(tmp, '.claude')

const run = (...args) =>
  execFileSync(process.execPath, [INSTALL, '--dir', dir, ...args], { encoding: 'utf8' })

let failed = 0
const check = (name, fn) => {
  try {
    fn()
    console.log(`  ok   ${name}`)
  } catch (e) {
    failed++
    console.log(`  FAIL ${name}\n       ${e.message}`)
  }
}

console.log('cài thật vào thư mục tạm:', dir)

// Người dùng đã có settings.json riêng — installer phải giữ nguyên phần của họ.
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(
  path.join(dir, 'settings.json'),
  JSON.stringify({ model: 'sonnet', permissions: { deny: ['Bash(rm -rf:*)'] }, env: { FOO: '1' } })
)

let first = ''
check('cài lần đầu chạy không lỗi', () => {
  first = run('--roots', '/c/code')
})

check('ghi đủ lệnh, engine, rubric', () => {
  for (const c of ['rvpr', 'rvpost', 'rvself']) {
    assert.ok(fs.existsSync(path.join(dir, 'commands', `${c}.md`)), `thiếu commands/${c}.md`)
  }
  assert.ok(fs.existsSync(path.join(dir, 'review', 'rv.sh')), 'thiếu review/rv.sh')
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'review')).filter((f) => f.endsWith('.md'))) {
    assert.ok(fs.existsSync(path.join(dir, 'review', f)), `thiếu review/${f}`)
  }
})

check('lệnh đã render, không còn placeholder', () => {
  const rvpr = fs.readFileSync(path.join(dir, 'commands', 'rvpr.md'), 'utf8')
  assert.ok(!/\{\{[A-Z_]+\}\}/.test(rvpr), 'còn placeholder')
})

check('settings.json giữ nguyên cấu hình riêng, chỉ thêm allow-list', () => {
  const s = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'))
  assert.strictEqual(s.model, 'sonnet')
  assert.deepStrictEqual(s.permissions.deny, ['Bash(rm -rf:*)'])
  assert.deepStrictEqual(s.env, { FOO: '1' })
  assert.ok(s.permissions.allow.some((a) => a.includes('rv.sh')), 'thiếu allow cho rv.sh')
})

check('in ra roots.conf đang tìm clone ở đâu', () => {
  assert.ok(first.includes('/c/code'), 'không in thư mục roots')
})

check('chạy thử trên máy mới vẫn báo roots sẽ ghi', () => {
  const fresh = path.join(tmp, 'fresh', '.claude')
  const out = execFileSync(
    process.execPath,
    [INSTALL, '--dry-run', '--dir', fresh, '--roots', '/c/somewhere'],
    { encoding: 'utf8' }
  )
  assert.ok(out.includes('/c/somewhere'), 'không in roots ở chế độ chạy thử')
  assert.ok(!fs.existsSync(fresh), 'chạy thử mà vẫn ghi file')
})

check('gợi ý cài lại dùng đúng lệnh, không có dấu \\', () => {
  const hint = first.split('\n').find((l) => l.includes('--roots'))
  assert.ok(hint, 'thiếu dòng gợi ý --roots')
  // Chạy từ bản clone (không qua npx) → gợi ý node <đường dẫn install.js>.
  assert.ok(/node .*\/bin\/install\.js --roots/.test(hint), hint)
  assert.ok(!hint.includes('\\'), `còn dấu \\: ${hint}`)
})

check('cài lại lần hai không ghi gì', () => {
  const out = run()
  assert.ok(/Xong: 0 file ghi/.test(out), out.split('\n').find((l) => l.startsWith('Xong')))
})

// Giả lập cấu trúc cache của npx: _npx/<hash>/package.json ghi spec người dùng gõ,
// package nằm ở _npx/<hash>/node_modules/claude-review-kit.
const KIT = path.join(__dirname, '..')
function fakeNpx(spec) {
  const hashDir = path.join(tmp, '_npx', Math.random().toString(16).slice(2))
  const pkg = path.join(hashDir, 'node_modules', 'claude-review-kit')
  fs.mkdirSync(pkg, { recursive: true })
  for (const d of ['bin', 'lib', 'commands', 'review']) {
    fs.cpSync(path.join(KIT, d), path.join(pkg, d), { recursive: true })
  }
  fs.copyFileSync(path.join(KIT, 'package.json'), path.join(pkg, 'package.json'))
  if (spec) {
    fs.writeFileSync(
      path.join(hashDir, 'package.json'),
      JSON.stringify({ dependencies: { 'claude-review-kit': spec } })
    )
  }
  const out = execFileSync(
    process.execPath,
    [path.join(pkg, 'bin', 'install.js'), '--dry-run', '--dir', path.join(hashDir, '.claude')],
    { encoding: 'utf8' }
  )
  return out.split('\n').find((l) => l.includes('--roots')) || ''
}

check('qua npx có ghim version → gợi ý giữ nguyên #v1.0.0', () => {
  const hint = fakeNpx('github:minhle106cse/claude-review-kit#v1.0.0')
  assert.ok(hint.includes('npx github:minhle106cse/claude-review-kit#v1.0.0 --roots'), hint)
})

check('qua npx không đọc được spec → quay về trường repository', () => {
  const hint = fakeNpx(null)
  const repo = require('../package.json').repository
  assert.ok(hint.includes(`npx ${repo} --roots`), hint)
})

check('gỡ cài đặt giữ lại reviews/', () => {
  fs.writeFileSync(path.join(dir, 'reviews', 'keep.md'), 'x')
  run('--uninstall')
  assert.ok(!fs.existsSync(path.join(dir, 'commands', 'rvpr.md')), 'chưa xoá rvpr.md')
  assert.ok(fs.existsSync(path.join(dir, 'reviews', 'keep.md')), 'mất file review')
})

fs.rmSync(tmp, { recursive: true, force: true })
console.log(failed ? `\n${failed} kiểm tra hỏng` : '\ntất cả kiểm tra đạt')
process.exit(failed ? 1 : 0)
