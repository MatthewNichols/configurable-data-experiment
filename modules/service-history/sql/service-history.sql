-- Idempotent; appended to every migration of installs that include this module.
CREATE OR REPLACE VIEW "CarServiceSummary" AS
SELECT "carId", max("date") AS "lastServiceDate", count(*)::int AS "serviceCount"
FROM "ServiceRecord"
GROUP BY "carId";
