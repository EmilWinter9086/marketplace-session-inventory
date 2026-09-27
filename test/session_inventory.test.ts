import assert from "node:assert/strict";
import { marketplaceHandoff } from "../src/session_inventory.ts";

const previousKey = process.env.INFRAI_API_KEY;
try {
  delete process.env.INFRAI_API_KEY;
  await assert.rejects(() => marketplaceHandoff({ user_id: "buyer-7", current_session_id: "session-current" }), /INFRAI_API_KEY/);
} finally {
  if (previousKey !== undefined) process.env.INFRAI_API_KEY = previousKey;
}
await assert.rejects(() => marketplaceHandoff({ user_id: "", current_session_id: "x" }), (error: unknown) =>
  error instanceof Error && error.name === "ZodError"
);
console.log("request boundary test passed");
