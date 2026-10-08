import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const votes = pgTable('votes', {
  id: serial('id').primaryKey(),
  optionKey: varchar('option_key', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 100 }).notNull(),
  count: integer('count').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const voteLogs = pgTable('vote_logs', {
  id: serial('id').primaryKey(),
  voterId: varchar('voter_id', { length: 100 }).notNull().unique(),
  optionId: integer('option_id').references(() => votes.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const guestbook = pgTable('guestbook', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type Vote = typeof votes.$inferSelect;
export type VoteLog = typeof voteLogs.$inferSelect;
export type GuestbookEntry = typeof guestbook.$inferSelect;
