import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const REQUIRED_COLS = [
  'BANCO','FECHA','NO_OP','DESCRIPCION','IMPORTE','TITULAR','EFECTO',
  'UUID','RFC_EMISOR','RAZON_SOCIAL','IEPS','IVA_8','IVA_16',
  'SUBTOTAL','TOTAL','CATEGORIA','PROYECTO','FRENTE','DOCUMENTO'
]

function normDate(val: string): string | null {
  if (!val) return null
  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  return null
}

function normProyecto(val: string): string {
  return String(val || '').trim().toUpperCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return new Response(JSON.stringify({ error: 'No se recibió ningún archivo' }), { status: 400 })

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true, dateNF: 'YYYY-MM-DD' })
    const wsName = wb.SheetNames.includes('MOVIMIENTOS') ? 'MOVIMIENTOS' : wb.SheetNames[0]
    const ws = wb.Sheets[wsName]
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, dateNF: 'YYYY-MM-DD' })

    if (raw.length < 2) return new Response(JSON.stringify({ error: 'Archivo vacío' }), { status: 422 })

    // Build column map from header row
    const header = (raw[0] as string[]).map(h => String(h).trim().toUpperCase())
    const map: Record<string, number> = {}
    header.forEach((h, i) => { map[h] = i })

    if (map['IMPORTE'] === undefined) {
      return new Response(JSON.stringify({ error: 'Columna IMPORTE no encontrada' }), { status: 422 })
    }

    const rows = raw.slice(1)
    const seen = new Set<string>()
    const records: any[] = []

    for (const row of rows) {
      // Skip empty rows
      if (!row || row.every((c: any) => String(c).trim() === '')) continue

      const get = (col: string) => map[col] !== undefined ? String(row[map[col]] ?? '').trim() : ''
      const getNum = (col: string) => { const v = parseFloat(get(col).replace(/[$,\s]/g,'')); return isNaN(v) ? 0 : v }

      // Filter EFECTO = INGRESO
      if (get('EFECTO').toUpperCase() !== 'INGRESO') continue

      const noOp = get('NO_OP')
      // Skip duplicates by NO_OP
      if (noOp && seen.has(noOp)) continue
      if (noOp) seen.add(noOp)

      const importeRaw = get('IMPORTE')
      const importe = parseFloat(importeRaw.replace(/[$,\s]/g,''))
      if (isNaN(importe) || importe === 0) continue

      // Normalize fecha
      const fechaRaw = get('FECHA')
      const fecha = normDate(fechaRaw)

      records.push({
        banco:        get('BANCO')       || null,
        fecha:        fecha,
        no_op:        noOp               || null,
        descripcion:  get('DESCRIPCION') || null,
        importe:      importe,
        titular:      get('TITULAR')     || null,
        efecto:       get('EFECTO').toUpperCase() || null,
        uuid:         get('UUID')        || null,
        rfc_emisor:   get('RFC_EMISOR').toUpperCase()  || null,
        razon_social: get('RAZON_SOCIAL').toUpperCase() || null,
        ieps:         getNum('IEPS'),
        iva_8:        getNum('IVA_8'),
        iva_16:       getNum('IVA_16'),
        subtotal:     getNum('SUBTOTAL'),
        total:        getNum('TOTAL'),
        categoria:    get('CATEGORIA').toUpperCase() || null,
        proyecto:     normProyecto(get('PROYECTO')) || null,
        frente:       get('FRENTE').toUpperCase()   || null,
        documento:    get('DOCUMENTO')              || null
      })
    }

    if (!records.length) {
      return new Response(JSON.stringify({ insertados: 0, mensaje: 'Sin registros INGRESO válidos' }), { status: 200 })
    }

    // Split by no_op presence for correct upsert strategy
    const withOp    = records.filter(r => r.no_op)
    const withoutOp = records.filter(r => !r.no_op)

    let insertados = 0
    const batchSize = 500

    for (let i = 0; i < withOp.length; i += batchSize) {
      const { error, count } = await supabase
        .from('transacciones')
        .upsert(withOp.slice(i, i + batchSize), { onConflict: 'no_op', count: 'exact' })
      if (error) throw error
      insertados += count ?? withOp.slice(i, i + batchSize).length
    }

    for (let i = 0; i < withoutOp.length; i += batchSize) {
      const { error, count } = await supabase
        .from('transacciones')
        .insert(withoutOp.slice(i, i + batchSize), { count: 'exact' })
      if (error) throw error
      insertados += count ?? withoutOp.slice(i, i + batchSize).length
    }

    return new Response(
      JSON.stringify({ insertados, total_procesados: records.length, archivo: file.name }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
