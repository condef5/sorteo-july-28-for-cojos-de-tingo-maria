bun run 1-parse-messages.ts data/wp_chat_from_2025.txt
bun run 2-filter-messages-per-day.ts ./output/first/messages.json
bun run 3-create-stats.ts output/second/filter-events.json
bun run 4-final-grouping.ts
