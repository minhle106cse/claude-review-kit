'use strict'

// Bảng ca cho bộ phát hiện stack của rv.sh. Phát hiện sai là lỗi IM LẶNG: module
// không nạp thì cả nhóm kiểm tra không chạy mà review vẫn trông bình thường.
// Thêm stack mới → thêm ca vào đây (xem README, mục "Thêm tech stack").
//
// Mỗi ca: path file → module PHẢI có (want) và module KHÔNG được có (not).

const path = require('path')
const assert = require('assert')
const { execFileSync } = require('child_process')

const RV = path.join(__dirname, '..', 'review', 'rv.sh')

const CASES = [
  // NestJS / gRPC
  { file: 'apps/user-service/src/presentation/grpc/user-grpc.controller.ts', want: ['typescript', 'backend'] },
  { file: 'apps/auth-service/src/domain/dto/account-deletion.dto.ts', want: ['backend'] },
  { file: 'apps/auth-service/src/domain/strategies/google.strategy.ts', want: ['backend'] },
  { file: 'apps/family-service/src/application/handlers/queries/get-tree.handler.ts', want: ['backend'] },
  { file: 'libs/proto/user.proto', want: ['backend'], not: ['typescript'] },
  { file: 'apps/user-service/src/infrastructure/scheduler/cleanup.worker.ts', want: ['backend'] },
  // MongoDB / SQL
  { file: 'apps/user-service/src/infrastructure/persistence/schemas/user.schema.ts', want: ['sql'] },
  { file: 'src/models/order.model.ts', want: ['sql'] },
  { file: 'db/migrations/20260901_add_index.sql', want: ['sql'] },
  { file: 'prisma/schema.prisma', want: ['sql'] },
  // React / Next
  { file: 'src/app/(main)/profile/profile-avatar.tsx', want: ['typescript', 'react'] },
  { file: 'src/hooks/use-profile.ts', want: ['react'] },
  { file: 'apps/user-service/src/main.ts', want: ['typescript'], not: ['react'] },
  // Hạ tầng
  { file: 'terraform/modules/sqs/main.tf', want: ['terraform'] },
  { file: '.github/workflows/deploy.yml', want: ['cicd'] },
  { file: 'scripts/deploy.sh', want: ['cicd'] },
  { file: 'Makefile', want: ['cicd'] },
  { file: 'docker/Dockerfile', want: ['cicd'] },
  // Ngôn ngữ khác
  { file: 'lambdas/geoip/handler.py', want: ['python', 'backend'] },
  { file: 'cmd/server/main.go', want: ['go'] },
  // Không nhầm sang stack không liên quan
  { file: 'README.md', want: [], not: ['typescript', 'react', 'backend', 'sql', 'cicd'] }
]

let failed = 0
console.log('phát hiện stack (rv.sh detect):')
for (const c of CASES) {
  const out = execFileSync('bash', [RV, 'detect'], { input: c.file + '\n', encoding: 'utf8' })
  const got = out.trim().split(/\s+/)
  try {
    assert.ok(got.includes('base'), 'thiếu base')
    for (const w of c.want) assert.ok(got.includes(w), `thiếu ${w}`)
    for (const n of c.not || []) assert.ok(!got.includes(n), `thừa ${n}`)
    console.log(`  ok   ${c.file}`)
  } catch (e) {
    failed++
    console.log(`  FAIL ${c.file} → [${got.join(' ')}]: ${e.message}`)
  }
}

console.log(failed ? `\n${failed} ca hỏng` : '\ntất cả ca đạt')
process.exit(failed ? 1 : 0)
