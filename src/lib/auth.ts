/**
 * MVP single-user auth helper.
 * Per spec 37.5 - even in MVP single-user, owner_user_id must be carried
 * and is_author_view must be set by backend, never frontend.
 *
 * For MVP we use a fixed dev user. In production, replace with real auth.
 */

const MVP_DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export interface AuthContext {
  userId: string;
  /** Always true for MVP single-user mode (backend-enforced) */
  isAuthorView: boolean;
}

export async function getAuthContext(): Promise<AuthContext> {
  // TODO: replace with real session/JWT lookup when multi-user
  return {
    userId: MVP_DEFAULT_USER_ID,
    isAuthorView: true,
  };
}
