# Authentication

Better Auth owns credentials, sessions, Google OAuth, production cookie policy, and database-backed per-client rate limits for sign-up and sign-in. Server Components and Server Actions derive authoritative workspace access from validated sessions rather than proxy cookie presence.

Password registrations remain signed out and unverified until the user opens a
one-time email link. Verification and password-reset links expire after one
hour. Password sign-in requires a verified address, password resets revoke all
existing sessions, and public request screens always return generic responses
to avoid revealing whether an account exists. In development without Resend,
the server prints authentication email links to the terminal. Production
requires `RESEND_API_KEY` and `EMAIL_FROM`.

## External email setup

1. Add and verify a sending domain in Resend.
2. Create a sending API key with access to that domain.
3. Set `RESEND_API_KEY` and `EMAIL_FROM` in each deployed environment. The
   sender must be an address on the verified domain.
4. Redeploy so the server reads the new values.

No Better Auth token tables or callback URLs need to be configured externally.
Google OAuth remains a separate Google Cloud Console setup.

Owns Better Auth configuration, email/password and Google identity lifecycles, secure session resolution, auth Server Actions, and creation of authenticated `AccessContext`. Better Auth is mounted only at `/api/auth/[...all]`.

Google OAuth is optional and activates only when both `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` are configured. Register this exact local callback in
Google Cloud Console:

```text
http://localhost:3000/api/auth/callback/google
```

For production, register the equivalent HTTPS callback on the deployment
domain and set `BETTER_AUTH_URL` to that origin. The same Google action handles
both identity operations, while the UI supplies explicit intent: the Register
form may create a new user and the Sign-in form only admits an existing user.
A verified Google identity is linked to an existing password account only when
their normalized email addresses match exactly and the local address is already
verified; different-email linking stays disabled.
