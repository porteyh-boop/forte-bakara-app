import "server-only";

import tls from "node:tls";
import { Agent, fetch as undiciFetch, type RequestInfo, type RequestInit } from "undici";

type TlsWithSystemCa = typeof tls & {
  getCACertificates?: (type?: "default" | "system") => readonly string[];
};

/**
 * Node 24 on Windows often lacks corporate/root CAs in the default fetch trust store.
 * Use OS certificate store (same effect as node --use-system-ca) for Supabase/Serper HTTPS in Node.
 */
let dispatcher: Agent | undefined;

function getSystemCaDispatcher(): Agent {
  if (!dispatcher) {
    const tlsExt = tls as TlsWithSystemCa;
    const ca = [
      ...(typeof tlsExt.getCACertificates === "function"
        ? tlsExt.getCACertificates("system")
        : tls.rootCertificates),
    ];
    dispatcher = new Agent({ connect: { ca } });
  }
  return dispatcher;
}

export function supabaseSystemFetch(
  input: RequestInfo,
  init?: RequestInit
): ReturnType<typeof undiciFetch> {
  return undiciFetch(input, {
    ...init,
    dispatcher: getSystemCaDispatcher(),
  });
}
