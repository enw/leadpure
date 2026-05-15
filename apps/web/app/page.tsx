import DemoBox from '../components/demo-box';
import SignupBox from '../components/signup-box';

export default function Home() {
  return (
    <main>
      <section className="hero">
        <h1>
          Email enrichment.<br />
          <span className="accent">No lock-in.</span>
        </h1>
        <p>
          Open-source lead enrichment API. Feed it an email — get back structured data.
          Works with any CRM. Self-host or use our cloud.
        </p>
        <div className="actions">
          <a href="#demo" className="btn-primary">Try the demo</a>
          <a
            href="https://github.com/enw/leadpure"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            Star on GitHub →
          </a>
        </div>
      </section>

      <div id="demo">
        <DemoBox />
      </div>

      <div id="signup">
        <SignupBox />
      </div>

      <section className="pricing-section">
        <h2>Pricing</h2>
        <p>Pay for what you use. No expiring credits.</p>
        <div className="pricing-grid">
          {[
            { name: 'Free', price: '$0', per: '/mo', enrichments: '50 / mo' },
            { name: 'Starter', price: '$19', per: '/mo', enrichments: '1,000 / mo' },
            { name: 'Pro', price: '$79', per: '/mo', enrichments: '5,000 / mo' },
            { name: 'Business', price: '$299', per: '/mo', enrichments: '25,000 / mo' },
          ].map((tier) => (
            <div className="pricing-card" key={tier.name}>
              <div className="tier-name">{tier.name}</div>
              <div className="price">
                {tier.price}
                <span>{tier.per}</span>
              </div>
              <div className="enrichments">{tier.enrichments}</div>
              <div className="status">Coming soon</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <a href="https://github.com/enw/leadpure" target="_blank" rel="noopener noreferrer">GitHub</a>
        <span className="sep">·</span>
        <a href="/docs">API Docs</a>
        <span className="sep">·</span>
        <span>MIT License</span>
        <span className="sep">·</span>
        <span>Built in public</span>
      </footer>
    </main>
  );
}
