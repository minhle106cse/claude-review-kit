'use strict'

// Kiểm tra duy nhất một thứ, nhưng là thứ dễ làm hỏng kit nhất: template trong
// commands/ phải render ra đúng đường dẫn thật, và render xong không được còn
// sót placeholder nào. Sai chỗ này thì lệnh cài xong sẽ trỏ vào đường dẫn ma.

const fs = require('fs')
const path = require('path')
const assert = require('assert')

// Thư mục tạm được đọc từ env mỗi lần gọi, nên đặt trước khi render là đủ để
// tách hẳn kết quả khỏi máy đang chạy test.
const FAKE_TMP = process.platform === 'win32' ? 'D:\\fake\\Temp' : '/fake/tmp'
process.env.TEMP = FAKE_TMP
process.env.TMP = FAKE_TMP

const P = require('../lib/paths')

const ROOT = path.join(__dirname, '..')
const COMMANDS = ['rvpr', 'rvpost', 'rvself']
const FAKE = process.platform === 'win32' ? 'D:\\home\\tester\\.claude' : '/home/tester/.claude'

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

console.log('render template với thư mục đích giả:', FAKE)

for (const c of COMMANDS) {
  const tpl = fs.readFileSync(path.join(ROOT, 'commands', `${c}.md`), 'utf8')
  const out = P.render(tpl, FAKE)

  check(`${c}: không còn placeholder sau khi render`, () => {
    assert.deepStrictEqual(P.leftoverTokens(out), [])
  })

  check(`${c}: không lẫn đường dẫn của máy khác`, () => {
    assert.ok(!/[/\\][Uu]sers[/\\]user[/\\]/.test(out), 'còn đường dẫn cứng của máy gốc')
  })

  check(`${c}: render -> unrender quay về đúng template`, () => {
    assert.strictEqual(P.unrender(out, FAKE), tpl)
  })

  // Placeholder rồi nối tiếp bằng `\` chỉ đúng trên Windows; macOS/Linux sẽ ra
  // `/tmp\` hoặc `.../reviews\x.md`. Nối bằng `/` — Windows cũng chấp nhận.
  check(`${c}: không nối placeholder bằng dấu \\`, () => {
    const bad = tpl.match(/\{\{[A-Z_]+\}\}\\/g)
    assert.ok(!bad, `dùng '/' thay cho '\\' sau: ${bad && bad.join(', ')}`)
  })

  check(`${c}: trỏ tới rv.sh trong thư mục đích`, () => {
    assert.ok(out.includes(P.values(FAKE).RV_BASH), 'không thấy đường dẫn rv.sh đã render')
  })
}

check('toBashPath đổi đúng ổ đĩa Windows', () => {
  assert.strictEqual(P.toBashPath('C:\\Users\\ten\\.claude'), '/c/Users/ten/.claude')
})

check('mọi file rubric mà rv.sh khai báo đều có mặt', () => {
  const rv = fs.readFileSync(path.join(ROOT, 'review', 'rv.sh'), 'utf8')
  const m = /ALL_MODULES=\(([^)]*)\)/.exec(rv)
  assert.ok(m, 'không đọc được ALL_MODULES trong rv.sh')
  for (const mod of m[1].trim().split(/\s+/)) {
    assert.ok(fs.existsSync(path.join(ROOT, 'review', `${mod}.md`)), `thiếu review/${mod}.md`)
  }
})

// Chiều ngược: thêm review/<x>.md mà quên khai báo trong rv.sh thì module đó
// không bao giờ được nạp, và cũng không hiện trong "MODULE KHÔNG NẠP".
check('mọi file review/*.md đều được rv.sh khai báo và phát hiện', () => {
  const rv = fs.readFileSync(path.join(ROOT, 'review', 'rv.sh'), 'utf8')
  const declared = /ALL_MODULES=\(([^)]*)\)/.exec(rv)[1].trim().split(/\s+/)
  for (const mod of P.modulesIn(path.join(ROOT, 'review'))) {
    assert.ok(declared.includes(mod), `review/${mod}.md chưa có trong ALL_MODULES của rv.sh`)
    if (mod === 'base') continue
    assert.ok(new RegExp(`echo "${mod}"`).test(rv), `rv.sh detect_stacks chưa có dòng nào echo "${mod}"`)
  }
})

console.log(failed ? `\n${failed} kiểm tra hỏng` : '\ntất cả kiểm tra đạt')
process.exit(failed ? 1 : 0)
