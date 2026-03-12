# Flujo Make.com: OneDrive → Supabase Edge Function

## Resumen del flujo

OneDrive (nuevo archivo Excel) → HTTP Request (Edge Function) → Supabase transacciones

---

## Módulos a configurar en Make

### 1. Trigger — Watch Files (OneDrive)

| Campo | Valor |
|-------|-------|
| Connection | Tu cuenta OneDrive/Microsoft |
| Drive | OneDrive |
| Folder | `/Cielco/Movimientos` (o la carpeta que uses) |
| Watch files | New files only |
| Maximum number of files | 1 |

### 2. HTTP — Make a Request

| Campo | Valor |
|-------|-------|
| URL | `https://TU_PROYECTO.supabase.co/functions/v1/procesar-archivo` |
| Method | `POST` |
| Headers → Authorization | `Bearer TU_ANON_KEY` |
| Body type | `form-data/multipart` |
| Fields → Name | `file` |
| Fields → Value | `{{1.data}}` (el archivo del paso 1) |
| Fields → Filename | `{{1.name}}` |
| Fields → MIME type | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

> **URL real del endpoint** (reemplaza `TU_PROYECTO` con tu Project ID de Supabase):
> `https://TU_PROYECTO.supabase.co/functions/v1/procesar-archivo`

### 3. (Opcional) Filter — Solo procesar `.xlsx`

Agrega un filtro entre módulo 1 y 2:
- Condition: `{{1.name}}` — `ends with` — `.xlsx`

---

## Respuesta esperada del endpoint

```json
{
  "insertados": 142,
  "total_procesados": 145,
  "archivo": "enero_movimientos.xlsx"
}
```

Los 3 registros de diferencia serían duplicados (mismo NO_OP) ya ignorados.

---

## Variables de entorno necesarias en Supabase

En el dashboard de Supabase → Edge Functions → Environment Variables:

| Variable | Valor |
|----------|-------|
| `SUPABASE_URL` | Se inyecta automáticamente |
| `SUPABASE_SERVICE_ROLE_KEY` | Se inyecta automáticamente |

No necesitas configurar nada adicional — Supabase inyecta estas variables automáticamente en todas las Edge Functions.

---

## Reglas de limpieza aplicadas por el endpoint

1. **Conserva solo las 19 columnas** del esquema estándar
2. **Elimina filas vacías**
3. **Filtra solo EFECTO = INGRESO**
4. **Elimina duplicados** por `NO_OP` (mismo número de operación bancaria)
5. **Normaliza PROYECTO**: mayúsculas + sin espacios extra (el valor completo se conserva: `5294-POWERCHINA` queda como `5294-POWERCHINA`)
6. **Normaliza fechas** a `YYYY-MM-DD`

---

## Notas

- El endpoint es **idempotente**: subir el mismo archivo dos veces no duplica datos (los registros con NO_OP ya existentes se actualizan con `ON CONFLICT DO UPDATE`).
- Archivos grandes se procesan en lotes de 500 registros.
- Si Make no tiene módulo nativo para OneDrive, usa el módulo genérico **HTTP Watch** o el conector de **Microsoft 365**.
