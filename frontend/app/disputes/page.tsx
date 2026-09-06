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
const p: React.CSSProperties = { fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.75, margin: '0 0 12px' }
const li: React.CSSProperties = { fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.75, marginBottom: '6px' }
const strongTag: React.CSSProperties = { color: 'var(--text)', fontWeight: 600 }
const note: React.CSSProperties = { ...p, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }
const link: React.CSSProperties = { color: 'var(--accent)', textDecoration: 'none' }

const stepWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '14px', margin: '0 0 20px' }
const stepCard: React.CSSProperties = { display: 'flex', gap: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', background: 'var(--bg-card)' }
const stepNum: React.CSSProperties = { flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%', background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }
const stepTitle: React.CSSProperties = { fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }
const stepBody: React.CSSProperties = { fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 }

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={stepCard}>
      <div style={stepNum}>{n}</div>
      <div>
        <p style={stepTitle}>{title}</p>
        <p style={stepBody}>{children}</p>
      </div>
    </div>
  )
}

export default function DisputesPage() {
  return (
    <div style={wrap}>
      <div style={header}>
        <a href="/" style={{ ...link, fontSize: '14px', fontWeight: 700 }}>← Archon</a>
        <div style={{ flex: 1 }} />
        <a href="/terms" style={{ ...link, fontSize: '12.5px' }}>Terms of Service</a>
        <a href="/privacy" style={{ ...link, fontSize: '12.5px' }}>Privacy Policy</a>
      </div>

      <div style={container}>
        <h1 style={h1}>Dispute Resolution</h1>
        <p style={updated}>Last updated: {UPDATED}</p>

        <p style={p}>
          This page explains what happens if a client and a freelancer disagree about a Marketplace contract —
          for example about whether delivered work meets what was agreed, or whether a payment was actually sent.
          It applies specifically to Marketplace contracts; general complaints about the Service are handled under
          our <a href="/terms" style={link}>Terms of Service</a>.
        </p>

        <p style={note}>
          <strong style={strongTag}>The short version:</strong> Archon strongly prefers to resolve disagreements
          directly, with Milad personally reviewing the situation and helping both sides reach a fair outcome. Going
          to court or formal arbitration is treated as a <strong style={strongTag}>last resort</strong> — something
          we'd rather avoid than reach for, and not our preferred path for either side.
        </p>

        <h2 style={h2}>Why Archon gets involved at all</h2>
        <p style={p}>
          As explained in our <a href="/terms" style={link}>Terms</a>, Archon is not a payment processor or escrow
          service — money moves directly between the client and the freelancer, outside the platform. Because of
          that, Archon's role in a dispute is not to reverse a transaction (we never held the funds to begin with);
          it's to look at the paper trail both parties built on the platform — the contract, milestone definitions,
          delivery notes, messages, and payment confirmations — and help the two sides reach a resolution based on
          what that record actually shows.
        </p>

        <h2 style={h2}>How a dispute is handled, step by step</h2>
        <div style={stepWrap}>
          <Step n={1} title="Try to resolve it directly, in Messages">
            Most disagreements are simple misunderstandings. Before anything else, use the contract's message thread
            to say clearly what the issue is and what outcome you're looking for. Many disputes end here.
          </Step>
          <Step n={2} title="Ask Milad to step in">
            If you can't reach an agreement yourselves, contact {SUPPORT_EMAIL} (or {SUPPORT_PHONE}) with the
            contract ID and a clear description of the disagreement. Milad — Archon's owner and its only
            administrator — will personally review the contract record: the agreed scope and milestones, any
            delivered files or links, messages between both parties, and the payment confirmation on file.
          </Step>
          <Step n={3} title="Informal mediation">
            Milad will typically talk to both sides (in Messages or directly, by phone/email) to understand each
            perspective, and will propose a resolution — for example releasing a milestone, asking for a specific
            revision, adjusting what's owed, or, in clear cases of non-delivery or non-payment, recommending a
            contract be cancelled. This stage is deliberately informal and aims to be fast and fair to both sides
            rather than procedural.
          </Step>
          <Step n={4} title="Last resort — outside help">
            If mediation genuinely doesn't resolve the disagreement, either party remains free to pursue the matter
            through the applicable courts or a formal arbitration process, as described in our{' '}
            <a href="/terms" style={link}>Terms</a>. This is a real option, not a hollow one — but it is not the
            path we recommend or expect to need, and Archon's involvement at that point is limited to providing the
            factual record it holds (contract terms, timestamps, messages, confirmations) if legitimately requested.
          </Step>
        </div>

        <h2 style={h2}>What Milad can and can't do</h2>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px' }}>
          <li style={li}><strong style={strongTag}>Can</strong>: review the on-platform record, mediate, recommend or
            record a resolution, adjust a contract's status, and — where warranted — suspend an account for clearly
            dishonest behavior (e.g. fabricated payment receipts).</li>
          <li style={li}><strong style={strongTag}>Cannot</strong>: force either party to send or return money — no
            funds ever pass through Archon, so there is nothing on the platform to reverse. Any monetary outcome of a
            dispute has to happen the same way the original payment did: directly between the two parties.</li>
          <li style={li}><strong style={strongTag}>Cannot</strong>: guarantee a particular outcome. Mediation aims for
            a fair resolution based on the evidence available, not an automatic ruling in either party's favor.</li>
        </ul>

        <h2 style={h2}>Evidence that actually helps</h2>
        <p style={p}>Disputes are resolved faster and more fairly when there's a clear record. Whenever possible:</p>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px' }}>
          <li style={li}>Agree on milestone scope in writing, inside the contract — not just verbally or off-platform.</li>
          <li style={li}>Keep delivery and feedback inside the platform&apos;s messages, not a separate channel that Milad
            can&apos;t see if asked to review the case.</li>
          <li style={li}>Submit a real reference or receipt when confirming a payment — this is the single most common
            point of dispute, and a clear reference resolves it quickly.</li>
        </ul>

        <h2 style={h2}>A note on scale</h2>
        <p style={p}>
          Archon is run by one person. Mediation is handled personally and carefully, but not instantly — please
          allow a reasonable amount of time for a response, especially outside business hours. If a matter is urgent
          (for example, a large payment about to be released), say so clearly in your message.
        </p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>To raise a dispute: <a href={`mailto:${SUPPORT_EMAIL}`} style={link}>{SUPPORT_EMAIL}</a> or {SUPPORT_PHONE}, with your contract ID.</p>
      </div>
    </div>
  )
}
