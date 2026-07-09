export type SignatureConfig = {
  defaultExpiryDays: number;
  inviteExpiryDays: number;
  verificationCodePrefix: string;
};

export function resolveSignatureConfig(): SignatureConfig {
  const defaultExpiryDays = Number(process.env.SIGNATURE_DEFAULT_EXPIRY_DAYS ?? 14);
  const inviteExpiryDays = Number(process.env.SIGNATURE_INVITE_EXPIRY_DAYS ?? 7);

  return {
    defaultExpiryDays: Number.isFinite(defaultExpiryDays) && defaultExpiryDays > 0 ? defaultExpiryDays : 14,
    inviteExpiryDays: Number.isFinite(inviteExpiryDays) && inviteExpiryDays > 0 ? inviteExpiryDays : 7,
    verificationCodePrefix: process.env.SIGNATURE_VERIFICATION_PREFIX?.trim() || 'DOQYN',
  };
}
