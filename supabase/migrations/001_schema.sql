-- ══ TABLA: transacciones ══
CREATE TABLE IF NOT EXISTS public.transacciones (
  id           BIGSERIAL PRIMARY KEY,
  banco        TEXT,
  fecha        DATE,
  no_op        TEXT,
  descripcion  TEXT,
  importe      NUMERIC(18,4),
  titular      TEXT,
  efecto       TEXT,
  uuid         TEXT,
  rfc_emisor   TEXT,
  razon_social TEXT,
  ieps         NUMERIC(18,4) DEFAULT 0,
  iva_8        NUMERIC(18,4) DEFAULT 0,
  iva_16       NUMERIC(18,4) DEFAULT 0,
  subtotal     NUMERIC(18,4) DEFAULT 0,
  total        NUMERIC(18,4) DEFAULT 0,
  categoria    TEXT,
  proyecto     TEXT,
  frente       TEXT,
  documento    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index on no_op (nullable — only enforced when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transacciones_no_op
  ON public.transacciones (no_op)
  WHERE no_op IS NOT NULL AND no_op <> '';

-- ══ TABLA: usuarios ══
CREATE TABLE IF NOT EXISTS public.usuarios (
  email      TEXT PRIMARY KEY,
  nombre     TEXT NOT NULL,
  rol        TEXT NOT NULL DEFAULT 'ejecutivo'
               CHECK (rol IN ('admin','operador','ejecutivo')),
  activo     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══ RLS ══
ALTER TABLE public.transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios       ENABLE ROW LEVEL SECURITY;

-- Anon key has full access (app enforces PIN auth at frontend level)
CREATE POLICY "anon_all_transacciones" ON public.transacciones
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "anon_all_usuarios" ON public.usuarios
  USING (TRUE) WITH CHECK (TRUE);
