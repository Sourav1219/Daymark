import type { Metadata } from "next"

import { LegalPage, LegalSection } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  description: "The terms that apply when you access or use Traketo.",
  title: "Terms of Service",
}

export default function TermsPage() {
  return (
    <LegalPage
      current="terms"
      summary="These terms set the ground rules for using Traketo and explain the responsibilities shared between you and the service."
      title="Terms of Service"
    >
      <LegalSection title="1. Agreement and operator">
        <p>
          These Terms of Service are an agreement between you and Sourav Verma,
          an individual based in Jammu and Kashmir, India, who operates Traketo.
          By creating an account or using Traketo, you agree to these terms and
          the Privacy Policy. If you do not agree, do not use the service.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility">
        <p>
          You must be at least 18 years old and legally capable of entering into
          this agreement. Traketo is a general productivity service; the age
          rule is used to avoid collecting children’s data without the
          additional permissions and safeguards required for minors.
        </p>
      </LegalSection>

      <LegalSection title="3. Your account">
        <p>
          You must provide accurate information, safeguard your credentials, and
          notify us if you suspect unauthorized access. You are responsible for
          activity performed through your account. You may use Google sign-in or
          email-based authentication where available.
        </p>
      </LegalSection>

      <LegalSection title="4. The service">
        <p>
          Traketo provides tools for managing tasks, focus timers, reminders,
          progression, offline work, attachments, and shared-study sessions.
          Features may change as the service develops. We grant you a limited,
          personal, non-exclusive, non-transferable, revocable right to use the
          service in accordance with these terms.
        </p>
        <p>
          Traketo is a productivity aid, not professional, medical, financial,
          or legal advice. You remain responsible for your plans, deadlines, and
          decisions.
        </p>
      </LegalSection>

      <LegalSection title="5. Your content">
        <p>
          You retain ownership of tasks, files, and other content you submit.
          You give us a limited permission to host, process, copy, transmit, and
          display that content only as reasonably needed to operate, secure, and
          improve the service or comply with law.
        </p>
        <p>
          When you join a shared-study room, you authorize Traketo to show other
          participants the limited profile and session information required for
          that feature. Do not upload or share content you do not have the right
          to use.
        </p>
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <p>You must not:</p>
        <ul>
          <li>
            use Traketo for unlawful, fraudulent, abusive, or harmful activity;
          </li>
          <li>harass others or distribute malware or illegal content;</li>
          <li>
            probe, disrupt, overload, or bypass service security or access
            controls;
          </li>
          <li>
            access another person’s account or data without authorization;
          </li>
          <li>
            scrape or automate access in a way that burdens the service; or
          </li>
          <li>
            reverse engineer the service except where applicable law permits it.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Shared features and attachments">
        <p>
          Treat other participants respectfully and share only information you
          are comfortable making visible in the relevant room or workspace. You
          are responsible for attachments you upload and for ensuring they are
          lawful, safe, and free of malicious code. We may remove content or
          restrict access when reasonably necessary for security or compliance.
        </p>
      </LegalSection>

      <LegalSection title="8. Third-party services">
        <p>
          Traketo relies on third-party infrastructure and may offer
          integrations such as Google authentication. Those services may have
          their own terms and privacy practices. We are not responsible for
          third-party services that are outside our control.
        </p>
      </LegalSection>

      <LegalSection title="9. Availability and changes">
        <p>
          We aim to keep Traketo reliable, but the service is provided on an “as
          available” basis. Maintenance, network problems, third-party failures,
          software defects, or events outside our control may cause interruption
          or data-sync delays. Offline or queued changes can occasionally
          conflict with newer server data. Keep independent copies of
          information you cannot afford to lose.
        </p>
        <p>
          We may add, modify, suspend, or discontinue features. If paid features
          are introduced, their pricing and any additional terms will be shown
          before you purchase them.
        </p>
      </LegalSection>

      <LegalSection title="10. Suspension and termination">
        <p>
          You may stop using Traketo and delete your account at any time. We may
          suspend or terminate access when you materially breach these terms,
          create a security or legal risk, abuse the service, or when continued
          operation is no longer reasonably possible. Where appropriate, we will
          try to provide notice and an opportunity to export your data.
        </p>
      </LegalSection>

      <LegalSection title="11. Disclaimers and liability">
        <p>
          To the maximum extent permitted by law, Traketo is provided without
          warranties of uninterrupted availability, error-free operation,
          fitness for a particular purpose, or preservation of every item of
          data. Nothing in these terms excludes rights or liability that cannot
          legally be excluded.
        </p>
        <p>
          To the maximum extent permitted by law, the operator will not be
          liable for indirect, incidental, special, consequential, or punitive
          losses, or for lost data, profits, opportunities, or goodwill arising
          from your use of or inability to use Traketo.
        </p>
      </LegalSection>

      <LegalSection title="12. Governing law and disputes">
        <p>
          These terms are governed by the laws of India. Subject to any consumer
          rights or mandatory dispute forum that applies to you, courts with
          jurisdiction in Jammu and Kashmir, India will have jurisdiction over
          disputes relating to these terms or Traketo. Please contact us first
          so we can try to resolve concerns informally.
        </p>
      </LegalSection>

      <LegalSection title="13. Changes and general terms">
        <p>
          We may update these terms as Traketo changes. We will post the updated
          terms here, change the effective date, and provide additional notice
          for material changes. If one provision is unenforceable, the remaining
          provisions continue to apply. A failure to enforce a provision is not
          a waiver of it. You may not transfer this agreement without our
          consent.
        </p>
      </LegalSection>

      <div className="legal-footer">
        Questions about these terms? Email{" "}
        <a href="mailto:privacy@traketo.com">privacy@traketo.com</a>.
      </div>
    </LegalPage>
  )
}
