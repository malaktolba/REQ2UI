import { neon } from "@neondatabase/serverless";
import { env } from "../config/env";

const rawSql = neon(env.DATABASE_URL);

// Neon's serverless driver occasionally throws a transient "fetch failed" when
// the connection blips or the free-tier compute is waking from sleep. These
// almost always succeed on a quick retry, so wrap the tagged-template call with
// a short exponential backoff instead of letting one blip abort a request or a
// whole pipeline run. All queries in this codebase use the tagged-template form.
function isTransient(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err);
  return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket hang up/i.test(msg);
}

async function withRetry(strings: TemplateStringsArray, values: any[]): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await (rawSql as any)(strings, ...values);
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

// Preserve any helper props the driver attaches (e.g. .query) while routing the
// tagged-template call through the retry wrapper.
export const sql = Object.assign(
  (strings: TemplateStringsArray, ...values: any[]) => withRetry(strings, values),
  rawSql
) as typeof rawSql;
