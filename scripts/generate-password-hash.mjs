import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  console.error('Use: node scripts/generate-password-hash.mjs sua_senha');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);

console.log(hash);
