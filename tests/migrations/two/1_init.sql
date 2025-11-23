-- create table events (modified version for checksum test)

SET allow_experimental_json_type = 1;

CREATE TABLE IF NOT EXISTS `events` (
  `event_id` UInt64,
  `event_data` JSON,
  `modified_column` String
)
ENGINE=MergeTree()
ORDER BY (`event_id`)
SETTINGS index_granularity = 8192;
