/**
 * One-shot admin reset script.
 *
 * Usage (from billing-and-contract-admin/ folder):
 *   npx tsx scripts/reset-admin.ts <newEmail> <newPassword>
 *
 * - Updates the admin user's email + password
 * - Clears failed attempts and lockout
 * - Regenerates 10 recovery codes (printed to stdout — save them now!)
 * - Leaves the TOTP secret intact so your authenticator app keeps working
 */
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase()
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`)
  }
  return codes
}

async function main() {
  const [, , emailArg, passwordArg] = process.argv
  if (!emailArg || !passwordArg) {
    console.error('Usage: npx tsx scripts/reset-admin.ts <newEmail> <newPassword>')
    process.exit(1)
  }
  if (passwordArg.length < 10) {
    console.error('Password must be at least 10 characters.')
    process.exit(1)
  }

  const user = await prisma.adminUser.findFirst()
  if (!user) {
    console.error('No admin user found. Run the initial /setup flow first.')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(passwordArg, 12)
  const newCodes = generateRecoveryCodes(10)
  const recoveryHashes = await Promise.all(newCodes.map((c) => bcrypt.hash(c, 10)))

  await prisma.adminUser.update({
    where: { id: user.id },
    data: {
      email: emailArg,
      passwordHash,
      recoveryCodes: recoveryHashes,
      failedAttempts: 0,
      lockedUntil: null,
    },
  })

  console.log('\n✓ Admin reset complete.')
  console.log(`  Email:    ${emailArg}`)
  console.log(`  Password: (the one you just set)`)
  console.log('\nNew recovery codes — save these NOW (shown only once):\n')
  for (const c of newCodes) console.log('  ' + c)
  console.log('\nYour existing 2FA (authenticator app) still works unchanged.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
