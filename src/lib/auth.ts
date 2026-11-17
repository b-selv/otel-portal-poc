import { CognitoJwtVerifier } from "aws-jwt-verify";

const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_APP_CLIENT_ID;

if (!userPoolId || !clientId) {
  // Fail closed on API requests if server-side verification isn't configured.
  console.warn("Cognito server-side verification environment variables are not set.");
}

const verifier = userPoolId && clientId
  ? CognitoJwtVerifier.create({
      userPoolId,
      clientId,
      tokenUse: "access"
    })
  : null;

export type AuthenticatedUser = {
  sub: string;
  username?: string;
};

export async function requireUser(request: Request): Promise<AuthenticatedUser> {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match || !verifier) {
    throw new Error("UNAUTHORIZED");
  }

  try {
    const payload = await verifier.verify(match[1]);
    if (!payload.sub) throw new Error("Missing subject");
    return {
      sub: payload.sub,
      username: typeof payload.username === "string" ? payload.username : undefined
    };
  } catch {
    throw new Error("UNAUTHORIZED");
  }
}
