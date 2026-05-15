"use client";

import Head from "next/head";

export default function Page() {
  return (
    <div>
      <Head>
        <title>Example Page</title>
        <meta name="description" content="An example page." />
      </Head>

      <main style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h1>
          Example Page
        </h1>
        <p>This is a placeholder page. Sentry has been removed.</p>
      </main>
    </div>
  );
}
