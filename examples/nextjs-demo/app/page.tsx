export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">@crazyglegit/support</p>
      <h1>Support Kit interfaces</h1>
      <p>
        The prebuilt customer widget is mounted through the public React
        package.
      </p>
      <p>Use the support launcher to start or continue a conversation.</p>
      <p>
        The protected <code>/support</code> route mounts the complete public{" "}
        <code>SupportDashboard</code> component when the demo host session is
        verified.
      </p>
    </main>
  );
}
