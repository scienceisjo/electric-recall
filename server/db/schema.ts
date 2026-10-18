import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const dailyVisits = sqliteTable("daily_visits", {
  day: text("day").notNull(),
  visitorDigest: text("visitor_digest").notNull(),
}, (table) => [primaryKey({ columns: [table.day, table.visitorDigest] })]);
