import type { Config } from "drizzle-kit";

import { APP_NAME } from "@/constants";
import { env } from "@/env";

export default {
  schema: "./src/server/db/schema",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  tablesFilter: [`${APP_NAME}_*`],
} satisfies Config;
