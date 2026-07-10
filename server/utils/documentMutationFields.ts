import type { AuthUser } from '../auth/types.js';
import { resolveDocumentOwnerName } from './userDisplayName.js';

export type DocumentActorIdentity = {
  userId: string;
  displayName: string;
};

export async function resolveDocumentActorIdentity(input: {
  tenantId: string;
  actor: AuthUser;
}): Promise<DocumentActorIdentity> {
  const userId = input.actor.id;
  const displayName = await resolveDocumentOwnerName({
    tenantId: input.tenantId,
    ownerUserId: userId,
    actor: input.actor,
  });
  return { userId, displayName };
}

export function buildDocumentMutationFields(input: {
  actorUserId: string;
  actorDisplayName: string;
  now?: Date;
}): {
  updatedBy: string;
  updatedByName: string;
  updatedAt: Date;
} {
  const now = input.now ?? new Date();
  return {
    updatedBy: input.actorUserId,
    updatedByName: input.actorDisplayName,
    updatedAt: now,
  };
}

export function buildInitialDocumentOwnershipFields(input: {
  ownerUserId: string;
  ownerName: string;
  now?: Date;
}): {
  ownerUserId: string;
  ownerName: string;
  createdBy: string;
  updatedBy: string;
  updatedByName: string;
  createdAt: Date;
  updatedAt: Date;
} {
  const now = input.now ?? new Date();
  return {
    ownerUserId: input.ownerUserId,
    ownerName: input.ownerName,
    createdBy: input.ownerUserId,
    updatedBy: input.ownerUserId,
    updatedByName: input.ownerName,
    createdAt: now,
    updatedAt: now,
  };
}
