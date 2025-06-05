import { APP_NAME } from "@/constants";
import { pgTableCreator } from "drizzle-orm/pg-core";

export const pgTable = pgTableCreator((name) => `${APP_NAME}_${name}`);
