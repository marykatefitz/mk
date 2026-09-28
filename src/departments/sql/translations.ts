// Snowflake ↔ DuckDB side-by-sides shown in lessons.
import type { SnowflakeNote } from './types';

export const SNOWFLAKE_TRANSLATIONS: (SnowflakeNote & { worlds: number[] })[] = [
  { worlds: [1], title: 'Case-insensitive LIKE', snowflake: "WHERE model ILIKE '%ridge%'", duckdb: "WHERE model ILIKE '%ridge%'", note: 'Identical in both.' },
  { worlds: [1], title: 'NULL defaults', snowflake: 'NVL(recon_cost, 0)  -- or IFNULL, COALESCE', duckdb: 'COALESCE(recon_cost, 0)  -- IFNULL works too' },
  { worlds: [2], title: 'Truncate to month', snowflake: "DATE_TRUNC('month', deal_date)", duckdb: "DATE_TRUNC('month', deal_date)", note: 'Same function, same arguments.' },
  { worlds: [2], title: 'Conditional count', snowflake: "COUNT_IF(status = 'Sold')", duckdb: "COUNT_IF(status = 'Sold')  -- or COUNT(*) FILTER (WHERE …)" },
  { worlds: [4], title: 'Inline IF', snowflake: "IFF(finance_type = 'Cash', 'Cash', 'Financed')", duckdb: "CASE WHEN finance_type = 'Cash' THEN 'Cash' ELSE 'Financed' END  -- DuckDB also has IF(…)" },
  { worlds: [5], title: 'Days between dates', snowflake: 'DATEDIFF(day, received_date, CURRENT_DATE)', duckdb: "DATE_DIFF('day', received_date, as_of_date())  -- or as_of_date() - received_date" },
  { worlds: [5], title: 'Add days to a date', snowflake: 'DATEADD(day, 90, due_date)', duckdb: "due_date + INTERVAL 90 DAY  -- or due_date + 90" },
  { worlds: [6], title: 'Keep one row per group', snowflake: 'QUALIFY ROW_NUMBER() OVER (PARTITION BY lead_number ORDER BY lead_id) = 1', duckdb: 'QUALIFY ROW_NUMBER() OVER (PARTITION BY lead_number ORDER BY lead_id) = 1', note: 'QUALIFY works in both, with no subquery needed.' },
  { worlds: [6], title: 'Semi-structured JSON (preview)', snowflake: "payload:utm_source::STRING\nLATERAL FLATTEN(input => payload:items)", duckdb: "payload->>'utm_source'\nUNNEST(…)", note: 'The JSON & Markdown Workshop (Phase 6) goes deep on this.' },
  { worlds: [7], title: 'Current date', snowflake: 'CURRENT_DATE()', duckdb: 'as_of_date()  -- the game freezes "today" at 2026-06-30; at work: CURRENT_DATE' },
];
