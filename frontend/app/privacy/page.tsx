'use client'

const UPDATED = 'September 7, 2026'
const SUPPORT_EMAIL = 'armila.design16@gmail.com'

const wrap: React.CSSProperties = { minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)' }
const header: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }
const container: React.CSSProperties = { maxWidth: '760px', margin: '0 auto', padding: '40px 20px 80px' }
const h1: React.CSSProperties = { fontSize: '26px', fontWeight: 800, color: 'var(--text)', margin: '0 0 6px' }
const updated: React.CSSProperties = { fontSize: '12.5px', color: 'var(--text-dim)', margin: '0 0 32px' }
const h2: React.CSSProperties = { fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: '32px 0 10px' }
const h3: React.CSSProperties = { fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', margin: '18px 0 6px' }
const p: React.CSSProperties = { fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.75, margin: '0 0 12px' }
const li: React.CSSProperties = { fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.75, marginBottom: '6px' }
const strongTag: React.CSSProperties = { color: 'var(--text)', fontWeight: 600 }
const note: React.CSSProperties = { ...p, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }
const link: React.CSSProperties = { color: 'var(--accent)', textDecoration: 'none' }
const tableWrap: React.CSSProperties = { overflowX: 'auto', margin: '0 0 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 700, borderBottom: '1px solid var(--border)' }
const td: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }

function Row({ cells }: { cells: string[] }) {
  return (
    <tr>
      {cells.map((c, i) => (
        <td key={i} style={td}>{c}</td>
      ))}
    </tr>
  )
}

export default function PrivacyPage() {
  return (
    <div style={wrap}>
      <div style={header}>
        <a href="/" style={{ ...link, fontSize: '14px', fontWeight: 700 }}>← Archon</a>
        <div style={{ flex: 1 }} />
        <a href="/terms" style={{ ...link, fontSize: '12.5px' }}>Terms of Service</a>
        <a href="/disputes" style={{ ...link, fontSize: '12.5px' }}>Dispute Resolution</a>
      </div>

      <div style={container}>
        <h1 style={h1}>Privacy Policy</h1>
        <p style={updated}>Last updated: {UPDATED}</p>

        <p style={p}>
          This Privacy Policy explains what personal data Archon collects, why, and what control you have over it.
          Archon is operated by <strong style={strongTag}>Milad Rostami</strong>, an individual doing business as
          "<strong style={strongTag}>Armila Design</strong>" — there is no separate corporate entity behind the
          Service. If anything here is unclear, contact {SUPPORT_EMAIL}.
        </p>

        <h2 style={h2}>1. Data we collect about you (the account holder)</h2>
        <div style={tableWrap}>
          <table style={table}>
            <thead><tr><th style={th}>Category</th><th style={th}>Examples</th><th style={th}>Why</th></tr></thead>
            <tbody>
              <Row cells={['Account', 'Name, email, password (hashed), username', 'Create and secure your account']} />
              <Row cells={['Profile', 'Headline, bio, skills, portfolio, education, experience, avatar, location, company, phone, website', 'Power your public/marketplace profile']} />
              <Row cells={['Billing (CRM plans)', 'Plan selected, payment reference/receipt you submit for manual verification', 'Activate and track your subscription']} />
              <Row cells={['Identity & payout (Marketplace)', 'Legal name, government ID / national ID (کد ملی), address, bank details, card number, IBAN (شماره شبا)', 'Verify who you are and send or confirm manual payouts between Marketplace users']} />
              <Row cells={['Marketplace activity', 'Projects, proposals, contracts, milestones, payment confirmations, reviews, messages', 'Operate the Marketplace and keep a record both parties can rely on']} />
              <Row cells={['Usage & device', 'Login timestamps, IP address, browser/device info', 'Security, fraud prevention, debugging']} />
              <Row cells={['Communications', 'Support emails, in-app messages you send other users']} />
            </tbody>
          </table>
        </div>
        <p style={note}>
          <strong style={strongTag}>About the identity and payout data:</strong> because Archon does not use an
          automated payment gateway (see our <a href="/terms" style={link}>Terms</a>), a human administrator manually
          verifies your identity and payout details before confirming a milestone as funded or sending a payout
          record. This data is stored in a separate, access-restricted record readable only by you and the
          administrator — it is never sold, and it is never shown to the other party in a contract beyond what's
          needed to complete the transfer (e.g., the name on the account you're paying).
        </p>

        <h2 style={h2}>2. Data we collect about companies and contacts you research (CRM)</h2>
        <p style={p}>
          Archon's CRM tool includes a catalog of companies and business contacts — names, emails, phone numbers,
          LinkedIn links, and similar business information — gathered from public sources for legitimate B2B outreach.
          <strong style={strongTag}> These individuals are not Archon users</strong> and have not created an account
          or agreed to this policy. If you are a person or company represented in this catalog and would like your
          information reviewed, corrected, or removed, contact us at {SUPPORT_EMAIL} and we will act on your request.
          We do not currently operate consent-collection or cookie-based tracking infrastructure for this catalog
          data, and residents of the EU/EEA or other jurisdictions with data protection rights should reach out using
          the same address to exercise those rights.
        </p>

        <h2 style={h2}>3. How we use your data</h2>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px' }}>
          <li style={li}>Operate, maintain, and improve the CRM and Marketplace.</li>
          <li style={li}>Verify payments and identity, and manually record Marketplace payouts.</li>
          <li style={li}>Send you transactional emails (signup, invites, contract/milestone updates, billing).</li>
          <li style={li}>Detect and prevent fraud, abuse, and violations of our Terms.</li>
          <li style={li}>Respond to support requests and legal obligations.</li>
        </ul>
        <p style={p}>We do not sell your personal data. We do not use it for third-party advertising.</p>

        <h2 style={h2}>4. Who can see your data</h2>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px' }}>
          <li style={li}><strong style={strongTag}>Other Marketplace users</strong> see what your public profile and
            activity naturally expose — your headline, portfolio, skills, ratings, and (for a client or freelancer
            you're under contract with) the information needed to complete a payment.</li>
          <li style={li}><strong style={strongTag}>Milad, as the platform's sole administrator</strong>, can see
            account, billing, verification, and Marketplace data as needed to run the Service — including manually
            verifying payments and mediating disputes (see <a href="/disputes" style={link}>Dispute Resolution</a>).
            There is no larger internal team; this access is not distributed to employees or contractors beyond that.</li>
          <li style={li}><strong style={strongTag}>Service providers</strong> we rely on to run Archon — for example
            our hosting providers (Vercel, Railway), file storage, and our email-sending service — process data on
            our behalf under their own security practices, strictly to provide those services.</li>
          <li style={li}>We may disclose data if required by law, or to protect the rights, safety, or property of
            Archon, its users, or the public.</li>
        </ul>

        <h2 style={h2}>5. Data retention and account deletion</h2>
        <p style={p}>
          You can delete your account at any time from your profile settings. When you do, we remove the personal
          data tied to your account that only you have a stake in — profile content, uploaded files, personal
          settings, and similar.
        </p>
        <p style={note}>
          <strong style={strongTag}>Important limitation you should know about:</strong> if you have participated in
          a Marketplace contract (as a client or a freelancer), records tied to that contract — the contract itself,
          its milestones, payment confirmations, and reviews — are <strong style={strongTag}>not deleted</strong> when
          you delete your own account, because the other party to that contract has a legitimate interest in keeping
          their own record of what was agreed, delivered, and paid intact. Today, this retention happens
          automatically for any user with active Marketplace history; we have not yet built a way to anonymize your
          name on those retained records after deletion, so your name may remain visible on a contract you were part
          of even after your account is gone. If this matters to you, contact {SUPPORT_EMAIL} before deleting your
          account and we'll help you understand exactly what would remain.
        </p>
        <p style={p}>Absent Marketplace history, data is generally deleted promptly on request, except where we must
          keep limited records to comply with law, resolve disputes, or enforce our agreements.</p>

        <h2 style={h2}>6. Your rights</h2>
        <p style={p}>Depending on where you live, you may have the right to access, correct, export, or delete your
          personal data, or to object to certain processing. You can handle most of this yourself from your profile
          settings; for anything else, email {SUPPORT_EMAIL} and we will respond as promptly as we can. Because Archon
          is run by one person rather than a dedicated privacy team, response times may be longer than at a larger
          company, but every request is read and acted on personally.</p>

        <h2 style={h2}>7. Data security</h2>
        <p style={p}>We take reasonable technical and organizational measures to protect your data — including
          password hashing, access-restricted storage for sensitive identity/payout records, and hosting with
          established providers. No method of transmission or storage is perfectly secure, and we cannot guarantee
          absolute security. If we become aware of a breach affecting your personal data, we will notify you as
          required by applicable law.</p>

        <h2 style={h2}>8. International transfers</h2>
        <p style={p}>Archon is operated from Iran and hosted on infrastructure that may be located in other countries
          (our frontend and backend hosting providers operate data centers outside Iran). By using the Service, you
          understand your data may be processed and stored outside your own country.</p>

        <h2 style={h2}>9. Cookies and tracking</h2>
        <p style={p}>Archon uses only the minimum technical storage needed to keep you logged in (an authentication
          token) and to remember basic preferences (like light/dark theme). We do not currently use third-party
          advertising or analytics cookies.</p>

        <h2 style={h2}>10. Children's privacy</h2>
        <p style={p}>Archon is not directed at anyone under 18, and we do not knowingly collect personal data from
          children. If you believe a child has provided us data, contact us and we will delete it.</p>

        <h2 style={h2}>11. Changes to this policy</h2>
        <p style={p}>We may update this Privacy Policy as the Service evolves. Material changes will update the "Last
          updated" date above and, where practical, will be announced in-app.</p>

        <h2 style={h2}>12. Contact</h2>
        <p style={p}>Questions or requests about your data: <a href={`mailto:${SUPPORT_EMAIL}`} style={link}>{SUPPORT_EMAIL}</a>.</p>
      </div>
    </div>
  )
}
