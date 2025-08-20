import React from 'react';
import Head from 'next/head';
import { Dashboard } from '../components/Dashboard';

export default function Home() {
  return (
    <>
      <Head>
        <title>KPC Knowledge System</title>
        <meta name="description" content="Intelligent frontend code generation system" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Dashboard />
    </>
  );
}