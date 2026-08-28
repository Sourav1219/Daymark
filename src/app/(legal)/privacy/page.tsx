import type { Metadata } from "next"

import { LegalPage, LegalSection } from "@/components/legal/legal-page"
import { CookieSettingsButton } from "@/features/privacy/ui/cookie-consent-provider"

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  description:
    "How Traketo collects, uses, protects, and deletes personal data.",
  title: "Privacy Policy",
}

export default function PrivacyPage() {
  return (
    <LegalPage
      current="privacy"
      summary="This policy explains what Traketo collects, why it is needed, and the choices you have over your information."
      title="Privacy Policy"
    >
      <LegalSection title="1. Who operates Traketo">
        <p>
          Traketo is operated by Sourav Verma, an individual based in Jammu and
          Kashmir, India. In this policy, “Traketo”, “we”, “us”, and “our” refer
          to that service and its operator.
        </p>
        <p>
          Privacy questions and data requests can be sent to{" "}
          <a href="mailto:privacy@traketo.com">privacy@traketo.com</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <ul>
          <li>
            <strong>Account information:</strong> your name, email address,
            authentication credentials, verification status, and basic profile
            details. Passwords are stored as secure hashes, not as readable
            text.
          </li>
          <li>
            <strong>Google sign-in information:</strong> if you choose Google,
            we receive the account identifier and basic profile information that
            Google makes available for authentication.
          </li>
          <li>
            <strong>Content you create:</strong> tasks, labels, gates, workspace
            information, progression data, timers, reminders, settings, and
            files you choose to attach.
          </li>
          <li>
            <strong>Shared-study information:</strong> room membership, join
            requests, display information, timer state, and activity needed to
            operate a shared session.
          </li>
          <li>
            <strong>Device and service information:</strong> session cookies, IP
            address, browser or user-agent information, push-subscription
            details, and limited operational and security logs.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <p>We use personal data to:</p>
        <ul>
          <li>create and secure your account and keep you signed in;</li>
          <li>
            provide tasks, timers, reminders, offline access, and shared study;
          </li>
          <li>send verification codes, reminders, and service messages;</li>
          <li>
            sync your changes, prevent abuse, and diagnose service failures;
          </li>
          <li>respond to support, privacy, and security requests; and</li>
          <li>meet legal obligations and enforce our Terms of Service.</li>
        </ul>
        <p>
          We do not sell personal data or use it for third-party advertising.
        </p>
      </LegalSection>

      <LegalSection title="4. Cookies, local storage, and offline data">
        <p>
          Traketo separates storage that is essential to provide the service
          from optional preference storage. We do not use advertising,
          behavioral-tracking, or analytics cookies.
        </p>
        <ul>
          <li>
            <strong>Authentication and security:</strong> a first-party session
            cookie keeps you securely signed in and protects private routes. It
            is essential to the account service and normally expires after seven
            days.
          </li>
          <li>
            <strong>Consent preference:</strong> a first-party cookie remembers
            whether you selected essential storage only or allowed preferences.
            It expires after 180 days so Traketo does not ask on every visit.
          </li>
          <li>
            <strong>Optional interface preferences:</strong> only after you
            choose “Allow Cookies,” local storage remembers dismissed tips and
            deadline alerts you have marked as read. Choosing “Decline” removes
            these saved preferences.
          </li>
          <li>
            <strong>Requested in-session features:</strong> temporary session
            storage keeps track of an active timer while the browser tab is
            open.
          </li>
          <li>
            <strong>Encrypted offline data:</strong> offline task snapshots and
            queued changes use IndexedDB only as part of the separately opt-in
            offline feature. They are encrypted with your device passcode,
            generally expire after seven days, and can be cleared in Settings.
          </li>
        </ul>
        <p>
          You may allow or withdraw optional preference storage at any time.
          Essential authentication storage remains active while you use a
          signed-in account.
        </p>
        <CookieSettingsButton />
      </LegalSection>

      <LegalSection title="5. When information is shared">
        <p>
          We disclose information only as needed to operate Traketo, comply with
          law, protect users, or complete an action you request. Service
          providers may process limited data on our behalf, including:
        </p>
        <ul>
          <li>
            hosting and application infrastructure providers such as Vercel;
          </li>
          <li>
            database, cache, and storage providers used by the application;
          </li>
          <li>Resend for verification, reminder, and transactional email;</li>
          <li>Zoho Mail for privacy and support correspondence;</li>
          <li>Google when you choose Google authentication.</li>
        </ul>
        <p>
          In shared-study features, other participants can see the limited
          profile and session activity needed for the room to function. We may
          also preserve or disclose information when reasonably necessary to
          comply with a valid legal request or address fraud, abuse, or security
          threats.
        </p>
      </LegalSection>

      <LegalSection title="6. International processing">
        <p>
          Some providers may process or store information outside your state or
          country. Where this happens, we use providers and safeguards intended
          to protect the information consistently with applicable requirements.
        </p>
      </LegalSection>

      <LegalSection title="7. Retention and deletion">
        <p>
          Account data is generally retained while your account is active. You
          can export your data and permanently delete your account from the
          profile area. Account deletion removes active account data, subject to
          limited security, legal, backup, and deletion-processing periods.
        </p>
        <p>
          For normal cleanup, cleared tasks are generally retained for 30 days;
          synchronization tombstones may remain for another 30 days. Completed
          or cancelled reminder records may be retained for 90 days, activity
          events for up to 365 days, and expired session metadata or ended-room
          join requests for up to 30 days. Backups and logs may remain until
          their secure rotation periods end.
        </p>
      </LegalSection>

      <LegalSection title="8. Your choices and rights">
        <p>
          Depending on applicable law, you may ask to access, correct, update,
          export, or erase personal data, withdraw consent, or raise a
          grievance. Traketo also provides in-app controls for data export,
          offline storage, notification preferences, active sessions, and
          account deletion.
        </p>
        <p>
          Send requests to{" "}
          <a href="mailto:privacy@traketo.com">privacy@traketo.com</a>. We may
          need to verify your identity before completing a request.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          We use technical and organizational safeguards designed to protect
          personal data, including access controls, encrypted connections,
          password hashing, and scoped storage access. No online service can
          guarantee absolute security, so please use a unique password and keep
          your account credentials private.
        </p>
      </LegalSection>

      <LegalSection title="10. Children">
        <p>
          Traketo is intended for people aged 18 or older. We do not knowingly
          permit children under 18 to create accounts. This restriction concerns
          data-protection requirements for minors; it is not a content rating.
          If you believe a child has provided personal data, contact us so we
          can investigate and take appropriate action.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to this policy">
        <p>
          We may update this policy when Traketo’s features, providers, or legal
          obligations change. We will post the revised version here, update the
          effective date, and provide additional notice when a change materially
          affects your rights or how personal data is used.
        </p>
      </LegalSection>

      <div className="legal-footer">
        Questions or privacy requests? Email{" "}
        <a href="mailto:privacy@traketo.com">privacy@traketo.com</a>.
      </div>
    </LegalPage>
  )
}
