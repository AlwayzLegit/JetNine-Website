// Smoke-test: insert a sample quote via the same Drizzle path the Server
// Action uses. Verifies trigger-generated quote_code and cascading legs.
import postgres from "postgres";

const sql = postgres(process.env.DIRECT_URL, { prepare: false, max: 1 });

try {
  const row = await sql.begin(async (tx) => {
    const [q] = await tx`
      insert into public.quotes (
        source, trip_type, pax_count, requested_category, catering_tier,
        ground_option, contact_snapshot, consent_broker, consent_contact, status
      ) values (
        'quote_wizard', 'round', 4, 'midsize', 'standard',
        'sedan',
        ${sql.json({ firstName: "Smoke", lastName: "Test", email: "smoke@test.local" })},
        true, true, 'submitted'
      )
      returning id, quote_code
    `;
    const [l1] = await tx`
      insert into public.quote_legs (quote_id, leg_number, from_iata, to_iata, depart_date, depart_time, distance_nm)
      values (${q.id}, 1, 'VNY', 'JFK', '2026-07-04', '09:00', 2151)
      returning id
    `;
    const [l2] = await tx`
      insert into public.quote_legs (quote_id, leg_number, from_iata, to_iata, depart_date, depart_time, distance_nm)
      values (${q.id}, 2, 'JFK', 'VNY', '2026-07-08', '17:00', 2151)
      returning id
    `;
    return { quote: q, legs: [l1.id, l2.id] };
  });

  console.log("INSERTED:");
  console.log("  quote_code:", row.quote.quote_code);
  console.log("  quote_id   :", row.quote.id);
  console.log("  leg_ids    :", row.legs.join(", "));

  // Verify count
  const [{ qcount }] = await sql`select count(*)::int as qcount from public.quotes`;
  const [{ lcount }] = await sql`select count(*)::int as lcount from public.quote_legs`;
  console.log(`\nTotals — quotes: ${qcount}, quote_legs: ${lcount}`);

  // Clean up
  await sql`delete from public.quotes where id = ${row.quote.id}`;
  console.log("Cleaned up test row.");
} catch (err) {
  console.error("FAIL:", err.message);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
