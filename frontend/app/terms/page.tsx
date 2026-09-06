'use client'

const UPDATED = 'September 7, 2026'
const SUPPORT_EMAIL = 'armila.design16@gmail.com'
const SUPPORT_PHONE = '+98 935 666 8505'

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

export default function TermsPage() {
  return (
    <div style={wrap}>
      <div style={header}>
        <a href="/" style={{ ...link, fontSize: '14px', fontWeight: 700 }}>← Archon</a>
        <div style={{ flex: 1 }} />
        <a href="/privacy" style={{ ...link, fontSize: '12.5px' }}>Privacy Policy</a>
        <a href="/disputes" style={{ ...link, fontSize: '12.5px' }}>Dispute Resolution</a>
      </div>

      <div style={container}>
        <h1 style={h1}>Terms of Service</h1>
        <p style={updated}>Last updated: {UPDATED}</p>

        <p style={p}>
          These Terms of Service ("<strong style={strongTag}>Terms</strong>") govern your access to and use of Archon
          (the "<strong style={strongTag}>Service</strong>"), operated by <strong style={strongTag}>Milad Rostami</strong>,
          an individual doing business as "<strong style={strongTag}>Armila Design</strong>" ("<strong style={strongTag}>we</strong>",
          "<strong style={strongTag}>us</strong>", or "<strong style={strongTag}>Archon</strong>"). Archon is not a
          separately incorporated company — it is operated directly by its owner. By creating an account or using the
          Service in any way, you agree to be bound by these Terms. If you do not agree, do not use the Service.
        </p>

        <h2 style={h2}>1. What Archon is</h2>
        <p style={p}>Archon has two parts, available from the same account:</p>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px' }}>
          <li style={li}><strong style={strongTag}>A lead-generation and CRM tool</strong> that helps architecture and
            design studios research companies, track outreach, and manage a sales pipeline.</li>
          <li style={li}><strong style={strongTag}>A freelance marketplace</strong> ("<strong style={strongTag}>Marketplace</strong>")
            where clients can post projects and freelancers can send proposals, be hired under a contract, and be paid
            through milestones.</li>
        </ul>
        <p style={p}>The Marketplace is currently offered in <strong style={strongTag}>beta</strong>. Features, limits,
          and pricing may change, and we may add, remove, or restrict functionality at any time, with or without
          notice, as the product develops.</p>

        <h2 style={h2}>2. Eligibility and accounts</h2>
        <p style={p}>You must be at least 18 years old and able to form a binding contract to use Archon. You are
          responsible for the accuracy of the information you provide, for keeping your password confidential, and for
          all activity that happens under your account. Tell us immediately at {SUPPORT_EMAIL} if you suspect
          unauthorized access.</p>
        <p style={p}>One account can operate as both a client and a freelancer on the Marketplace ("account mode" is a
          display preference, not a separate account) — you are responsible for your conduct in both capacities.</p>

        <h2 style={h2}>3. CRM subscription plans and billing</h2>
        <p style={p}>CRM plans (Trial, Basic, Pro, Agency, Enterprise) are billed for a fixed period shown at checkout.
          <strong style={strongTag}> Archon does not use an automated payment gateway.</strong> Paid plans are activated
          manually: you send payment by one of the methods we display (for example card-to-card inside Iran, or
          PayPal) and submit a reference or receipt; we verify it and activate your plan once confirmed. Your account
          remains usable at the free/trial level while a paid plan is pending verification.</p>
        <p style={p}>Plans do not renew automatically. Unless we say otherwise in writing, payments are
          <strong style={strongTag}> non-refundable</strong> once a plan has been activated, including if you stop using
          the Service before the period ends. We may adjust plan limits and pricing going forward; changes apply to
          future billing periods, not ones already paid for.</p>

        <h2 style={h2}>4. How the Marketplace actually works</h2>
        <p style={note}>
          <strong style={strongTag}>Important — read this section carefully.</strong> Archon is <strong style={strongTag}>not
          a payment processor, escrow provider, or bank</strong>, and money paid between a client and a freelancer
          never passes through an Archon-controlled account. Every payment happens directly between the client and the
          freelancer, outside the platform (bank transfer, card-to-card, PayPal, or another method they agree on).
          Archon's role is to record the terms, let the client mark a milestone as paid with a reference or receipt,
          and let an administrator manually confirm that the transfer actually happened before the milestone is
          treated as funded, and again manually record a payout once a client approves delivered work. This process
          exists to add a layer of accountability and a shared paper trail — it is <strong style={strongTag}>not a
          guarantee</strong> that any payment will occur, and Archon does not hold, insure, or have custody of anyone's
          funds at any point.
        </p>
        <p style={p}>Specific mechanics you should understand before using the Marketplace:</p>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px' }}>
          <li style={li}>Every contract is currently capped at a maximum value (shown in the product, $500 by default)
            while the Marketplace is in beta. We may raise this limit for a specific account on request.</li>
          <li style={li}>Archon does not currently charge a commission or platform fee on Marketplace contracts. We may
            introduce fees in the future; if we do, we will state them clearly before you're charged.</li>
          <li style={li}>A milestone is only "funded" or "released" once an administrator has manually verified it — we
            rely on the information the parties give us (receipts, references, delivery links) and do not independently
            audit every transfer. If you submit false or misleading payment information, your account may be
            suspended or terminated, and you may be liable for any resulting loss.</li>
          <li style={li}>Reviews, ratings, and verification badges reflect information supplied by users and Archon's
            own checks; they are not a warranty of any freelancer's or client's quality, solvency, or reliability.</li>
        </ul>
        <p style={p}>See our separate <a href="/disputes" style={link}>Dispute Resolution</a> page for what happens if a
          client and freelancer disagree about a Marketplace contract.</p>

        <h2 style={h2}>5. Identity verification and payout information</h2>
        <p style={p}>To reduce fraud and make manual payouts possible, we may ask Marketplace participants for
          identity and payout details — for example a legal name, a government ID, an address, and bank or card
          details (including, for Iranian accounts, a national ID number and IBAN/شماره شبا). This information is kept
          in a separate, access-restricted record readable only by you and Archon's administrator, and is used solely
          to verify who you are and to send or confirm payouts. See our <a href="/privacy" style={link}>Privacy
          Policy</a> for full details on how this data is handled.</p>

        <h2 style={h2}>6. Acceptable use</h2>
        <p style={p}>You agree not to:</p>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px' }}>
          <li style={li}>Use the Service for any unlawful purpose, or in a way that violates the rights of others.</li>
          <li style={li}>Circumvent the Marketplace to avoid Archon's records — for example agreeing off-platform to a
            contract that was negotiated through Archon in order to avoid any future review of the deal.</li>
          <li style={li}>Submit false payment confirmations, fabricated receipts, or misrepresent your identity during
            verification.</li>
          <li style={li}>Scrape, resell, or redistribute the company/contact data available through the CRM catalog or
            the Data API outside the scope of your own outreach, or in violation of the API's rate limits.</li>
          <li style={li}>Harass, defraud, or attempt to deceive other users, or interfere with the normal operation of
            the Service.</li>
        </ul>
        <p style={p}>We may suspend or terminate accounts that violate this section, withhold pending payouts under
          active investigation, and — where relevant — cooperate with law enforcement.</p>

        <h2 style={h2}>7. CRM lead data</h2>
        <p style={p}>The CRM catalog includes information about third-party companies and individuals (names, emails,
          phone numbers, and similar business-contact details) gathered from public sources for legitimate business
          outreach purposes. You may use this data only for your own outreach through Archon and must comply with
          applicable law (including anti-spam and data protection law) when contacting these companies. If you are a
          person or company listed in our catalog and want your information reviewed, corrected, or removed, contact
          us at {SUPPORT_EMAIL}.</p>

        <h2 style={h2}>8. Intellectual property</h2>
        <p style={p}>Archon and its underlying software, design, and branding belong to us. You keep ownership of the
          content you upload (portfolio items, project descriptions, messages, and similar), but you grant us a
          license to host, display, and process it as needed to operate the Service — for example showing your
          portfolio to a prospective client, or including your proposal in a contract record.</p>

        <h2 style={h2}>9. Termination</h2>
        <p style={p}>You may deactivate or permanently delete your account at any time from your profile settings.
          Deleting your account removes your own data, but records tied to a Marketplace contract, milestone, payment,
          or review that another user relies on may be retained even after your account is deleted, so that the other
          party's record of what happened stays intact — see our <a href="/privacy" style={link}>Privacy Policy</a> for
          details. We may suspend or terminate any account, with or without notice, for violating these Terms.</p>

        <h2 style={h2}>10. Disclaimers</h2>
        <p style={p}>The Service is provided "as is" and "as available," without warranties of any kind, express or
          implied. We do not warrant that the Service will be uninterrupted, error-free, or that any lead, proposal,
          contract, or payment will lead to a successful outcome. You use the Marketplace, and enter into contracts
          with other users, at your own risk and judgment.</p>

        <h2 style={h2}>11. Limitation of liability</h2>
        <p style={p}>To the fullest extent permitted by law, Archon and its owner are not liable for any indirect,
          incidental, or consequential damages, or for any loss of profits, data, or business opportunity, arising
          from your use of the Service — including any dispute, non-payment, or undelivered work between Marketplace
          users. Our total liability for any claim relating to the Service is limited to the amount you paid us, if
          any, in the three months before the claim arose.</p>

        <h2 style={h2}>12. Governing law</h2>
        <p style={p}>These Terms are governed by the laws applicable to the owner's place of business (Iran), without
          regard to conflict-of-law principles. As described in our <a href="/disputes" style={link}>Dispute
          Resolution</a> page, we strongly prefer to resolve disagreements directly or through informal mediation;
          formal legal proceedings are a last resort for either side.</p>

        <h2 style={h2}>13. Changes to these Terms</h2>
        <p style={p}>We may update these Terms as the Service evolves. If we make a material change, we will update the
          "Last updated" date above and, where practical, notify you in-app. Continuing to use Archon after a change
          takes effect means you accept the updated Terms.</p>

        <h2 style={h2}>14. Contact</h2>
        <p style={p}>Questions about these Terms can be sent to <a href={`mailto:${SUPPORT_EMAIL}`} style={link}>{SUPPORT_EMAIL}</a> or
          {' '}{SUPPORT_PHONE}.</p>
      </div>
    </div>
  )
}
