/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BadgeCheck, XCircle } from 'lucide-react';
import { ApiError, CredentialVerification, credentialsApi } from '../services/api';

interface CredentialVerificationProps {
  credentialId: string;
}

export const CredentialVerificationPage: React.FC<CredentialVerificationProps> = ({ credentialId }) => {
  const [result, setResult] = useState<CredentialVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError(null);
    credentialsApi.verify(credentialId).then((response) => {
      if (!cancelled) setResult(response);
    }).catch((cause: unknown) => {
      if (!cancelled) {
        setError(cause instanceof ApiError ? cause.message : 'Unable to verify this credential right now.');
      }
    });
    return () => { cancelled = true; };
  }, [credentialId, retry]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <section className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-[#141414]">
        {result ? (
          <>
            <BadgeCheck className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="mt-4 text-xs font-black uppercase tracking-widest text-emerald-600">Verified credential</p>
            <h1 className="mt-2 text-2xl font-black">{result.certificate.title}</h1>
            <dl className="mt-6 space-y-3 text-left text-sm">
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Awarded to</dt><dd className="font-bold">{result.certificate.studentName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Roll number</dt><dd className="font-bold">{result.certificate.rollNumber || '—'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Issue date</dt><dd className="font-bold">{new Date(result.certificate.issueDate).toLocaleDateString()}</dd></div>
            </dl>
          </>
        ) : error ? (
          <>
            <XCircle className="mx-auto h-12 w-12 text-rose-500" />
            <h1 className="mt-4 text-xl font-black">Credential not verified</h1>
            <p role="alert" className="mt-2 text-sm text-zinc-500">{error}</p>
            <button onClick={() => setRetry((current) => current + 1)} className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">Try again</button>
          </>
        ) : (
          <p role="status" className="text-sm font-semibold text-zinc-500">Verifying credential…</p>
        )}
      </section>
    </main>
  );
};
