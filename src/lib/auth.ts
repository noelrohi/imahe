import { env } from "@/env";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import {
  checkout,
  polar,
  portal,
  usage,
  webhooks,
} from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

export const polarClient = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  // Use 'sandbox' if you're using the Polar Sandbox environment
  // Remember that access tokens, products, etc. are completely separated between environments.
  // Access tokens obtained in Production are for instance not usable in the Sandbox environment.
  server: "sandbox",
});

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        portal(),
        usage(),
        checkout({
          products: [
            {
              productId: "9d97501f-10fe-4186-a667-1994d6f90c93",
              slug: "free",
            },
            {
              productId: "b1854026-9971-4fd1-8c7d-7ada0ae590fe",
              slug: "pro",
            },
            {
              productId: "a9175fdc-9fe1-4f3c-bd6e-b849c472fdb0",
              slug: "usage-based",
            },
          ],
          successUrl: `${env.NEXT_PUBLIC_APP_URL}/success?checkout_id={CHECKOUT_ID}`,
          authenticatedUsersOnly: true,
        }),
        webhooks({
          secret: env.POLAR_WEBHOOK_SECRET,
          onPayload: async (payload) => {
            console.log("[POLAR] PAYLOAD ", payload);
          },
        }),
      ],
    }),
    nextCookies(),
  ],
});
