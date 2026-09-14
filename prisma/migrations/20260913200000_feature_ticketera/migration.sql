-- Seed ticketera feature flag (enabled by default for existing instances)
INSERT INTO "feature" ("key", "enabled", "value")
VALUES ('ticketera', true, NULL)
ON CONFLICT ("key") DO NOTHING;
