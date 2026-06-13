import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS quantity_overrides (
      code TEXT PRIMARY KEY,
      quantity NUMERIC NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS dispatches (
      id SERIAL PRIMARY KEY,
      object_name TEXT NOT NULL,
      vehicle TEXT NOT NULL,
      photo TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS dispatch_items (
      id SERIAL PRIMARY KEY,
      dispatch_id INTEGER REFERENCES dispatches(id) ON DELETE CASCADE,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity NUMERIC NOT NULL,
      unit TEXT,
      category TEXT NOT NULL,
      note TEXT
    )
  `
  await sql`ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS photo TEXT`
  await sql`ALTER TABLE dispatch_items ADD COLUMN IF NOT EXISTS note TEXT`
  await sql`ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS dispatch_note TEXT`
  await sql`ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE`
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = await sql`SELECT value FROM settings WHERE key = ${key}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows[0] ? (rows[0] as any).value : null
}

export async function setSetting(key: string, value: string) {
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = ${value}
  `
}

export async function getOverrides(): Promise<Record<string, number>> {
  const rows = await sql`SELECT code, quantity FROM quantity_overrides`
  const map: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows.forEach((r: any) => { map[r.code] = Number(r.quantity) })
  return map
}

export async function setOverride(code: string, quantity: number) {
  await sql`
    INSERT INTO quantity_overrides (code, quantity)
    VALUES (${code}, ${quantity})
    ON CONFLICT (code) DO UPDATE SET quantity = ${quantity}, updated_at = NOW()
  `
}

export type DispatchItem = {
  item_code: string
  item_name: string
  quantity: number
  unit: string
  category: string
  note?: string
}

export async function saveDispatch(objectName: string, vehicle: string, items: DispatchItem[], photos?: string | string[]) {
  const photoVal = Array.isArray(photos)
    ? (photos.length ? JSON.stringify(photos) : null)
    : (photos ?? null)
  const [dispatch] = await sql`
    INSERT INTO dispatches (object_name, vehicle, photo)
    VALUES (${objectName}, ${vehicle}, ${photoVal})
    RETURNING id
  `
  const id = dispatch.id
  for (const it of items) {
    await sql`
      INSERT INTO dispatch_items (dispatch_id, item_code, item_name, quantity, unit, category, note)
      VALUES (${id}, ${it.item_code}, ${it.item_name}, ${it.quantity}, ${it.unit}, ${it.category}, ${it.note ?? null})
    `
  }
  return id
}

export async function deleteDispatch(id: number) {
  // Reverse quantities before delete
  const oldRows = await sql`SELECT item_code, quantity FROM dispatch_items WHERE dispatch_id = ${id}`
  const overrides = await getOverrides()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of oldRows as any[]) {
    overrides[row.item_code] = (overrides[row.item_code] ?? 0) + Number(row.quantity)
    await setOverride(row.item_code, overrides[row.item_code])
  }
  await sql`DELETE FROM dispatches WHERE id = ${id}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDispatch(id: number): Promise<any | null> {
  const rows = await sql`
    SELECT d.id, d.object_name, d.vehicle, d.photo, d.created_at, d.dispatch_note, d.is_test,
      json_agg(json_build_object(
        'item_code', di.item_code,
        'item_name', di.item_name,
        'quantity', di.quantity,
        'unit', di.unit,
        'category', di.category,
        'note', di.note
      ) ORDER BY di.id) AS items
    FROM dispatches d
    JOIN dispatch_items di ON di.dispatch_id = d.id
    WHERE d.id = ${id}
    GROUP BY d.id
  `
  return rows[0] ?? null
}

export async function updateDispatch(
  id: number,
  objectName: string,
  vehicle: string,
  newItems: DispatchItem[],
  photo?: string | string[] | null,
  dispatchNote?: string | null,
  isTest?: boolean,
) {
  // Get old items to reverse their qty effect
  const oldRows = await sql`SELECT item_code, quantity FROM dispatch_items WHERE dispatch_id = ${id}`
  const overrides = await getOverrides()

  // Reverse old items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of oldRows as any[]) {
    const cur = overrides[row.item_code] ?? 0
    overrides[row.item_code] = cur + Number(row.quantity)
  }

  // Apply new items
  for (const it of newItems) {
    const cur = overrides[it.item_code] ?? 0
    overrides[it.item_code] = Math.max(0, cur - it.quantity)
  }

  // Persist all changed overrides
  const allCodes = Array.from(new Set([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(oldRows as any[]).map((r: any) => r.item_code),
    ...newItems.map(i => i.item_code),
  ]))
  for (const code of allCodes) {
    if (overrides[code] !== undefined) {
      await setOverride(code, overrides[code])
    }
  }

  // Update dispatch header
  const photoVal = Array.isArray(photo)
    ? (photo.length ? JSON.stringify(photo) : null)
    : (photo ?? null)
  await sql`
    UPDATE dispatches SET object_name = ${objectName}, vehicle = ${vehicle}, photo = ${photoVal},
      dispatch_note = ${dispatchNote ?? null}, is_test = ${isTest ?? false}
    WHERE id = ${id}
  `

  // Replace items
  await sql`DELETE FROM dispatch_items WHERE dispatch_id = ${id}`
  for (const it of newItems) {
    await sql`
      INSERT INTO dispatch_items (dispatch_id, item_code, item_name, quantity, unit, category, note)
      VALUES (${id}, ${it.item_code}, ${it.item_name}, ${it.quantity}, ${it.unit}, ${it.category}, ${it.note ?? null})
    `
  }
}

// Returns map: item_code -> [{id, object_name, vehicle, created_at, quantity, unit}]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDispatchSummaryByCode(): Promise<Record<string, any[]>> {
  const rows = await sql`
    SELECT di.item_code, di.quantity, di.unit,
           d.id, d.object_name, d.vehicle, d.created_at
    FROM dispatch_items di
    JOIN dispatches d ON d.id = di.dispatch_id
    ORDER BY d.created_at DESC
  `
  const map: Record<string, object[]> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of rows as any[]) {
    if (!map[r.item_code]) map[r.item_code] = []
    map[r.item_code].push({
      id: r.id,
      object_name: r.object_name,
      vehicle: r.vehicle,
      created_at: r.created_at,
      quantity: Number(r.quantity),
      unit: r.unit,
    })
  }
  return map
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDispatchHistory(from?: string, to?: string): Promise<any[]> {
  const rows = await sql`
    SELECT d.id, d.object_name, d.vehicle, d.photo, d.created_at, d.dispatch_note, d.is_test,
      json_agg(json_build_object(
        'item_code', di.item_code,
        'item_name', di.item_name,
        'quantity', di.quantity,
        'unit', di.unit,
        'category', di.category,
        'note', di.note
      ) ORDER BY di.id) AS items
    FROM dispatches d
    JOIN dispatch_items di ON di.dispatch_id = d.id
    WHERE (${from ?? null}::date IS NULL OR d.created_at >= ${from ?? null}::date)
      AND (${to ?? null}::date IS NULL OR d.created_at < (${to ?? null}::date + INTERVAL '1 day'))
    GROUP BY d.id
    ORDER BY d.created_at DESC
    LIMIT 100
  `
  return rows as never[]
}
