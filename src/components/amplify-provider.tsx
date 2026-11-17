"use client";

import { Amplify } from "aws-amplify";

// This module is imported by a client component. Configure Amplify before
// page components attempt to read the current Cognito session.
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;
const domain = process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN;
const redirectSignIn = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (userPoolId && userPoolClientId && domain) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          oauth: {
            domain,
            scopes: ["openid", "email", "profile"],
            redirectSignIn: [redirectSignIn],
            redirectSignOut: [redirectSignIn],
            responseType: "code"
          }
        }
      }
    }
  });
}

export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  return children;
}
