export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-heading text-3xl font-bold tracking-tight">About Noiseless</h1>

      <div className="mt-6 space-y-4 text-muted-foreground">
        <p>
          Built by{" "}
          <a
            href="https://x.com/slaviquee"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            @slaviquee
          </a>{" "}
          and Claude.
        </p>

        <p>
          Inspired by Andrej Karpathy&apos;s{" "}
          <a
            href="https://x.com/karpathy/status/2018043254986703167"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            tweet
          </a>{" "}
          about feed fatigue &mdash; the feeling that algorithmic feeds optimize for
          engagement over understanding, and that we deserve something calmer.
        </p>

        <p>
          Noiseless is a quiet, high-signal reading app. It pulls from curated RSS
          sources and layers a lightweight recommendation system on top, so you see
          things that matter to you without the noise.
        </p>

        <p>
          The project is open source and non-commercial. You can find the code on{" "}
          <a
            href="https://github.com/lumenio/noiseless"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            GitHub
          </a>
          .
        </p>

        <p>
          All reading material comes from the{" "}
          <a
            href="/sources"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            sources catalog
          </a>
          . We plan to add community-driven source suggestions with moderation, so the
          catalog grows thoughtfully over time.
        </p>

        <p>
          Questions or feedback? Reach out at{" "}
          <a
            href="mailto:noiseless-live@proton.me"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            noiseless-live@proton.me
          </a>
          .
        </p>
      </div>
    </div>
  );
}
