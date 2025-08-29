BEGIN;

ALTER TABLE public.usuario DROP CONSTRAINT IF EXISTS usuario_tipo_check;
ALTER TABLE public.usuario ADD CONSTRAINT usuario_tipo_check CHECK (tipo IN ('aluno','professor','admin','coordenador'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='registro' AND column_name='inicio') THEN
    ALTER TABLE public.registro ADD COLUMN inicio timestamptz NOT NULL DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='registro' AND column_name='fim') THEN
    ALTER TABLE public.registro ADD COLUMN fim timestamptz NOT NULL DEFAULT NOW() + interval '1 hour';
  END IF;
END $$;

ALTER TABLE public.registro DROP CONSTRAINT IF EXISTS registro_tempos_check;
ALTER TABLE public.registro ADD CONSTRAINT registro_tempos_check CHECK (fim > inicio);

CREATE EXTENSION IF NOT EXISTS btree_gist;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='registro' AND column_name='periodo') THEN
    ALTER TABLE public.registro ADD COLUMN periodo tstzrange GENERATED ALWAYS AS (tstzrange(inicio, fim, '[)')) STORED;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registro_no_overlap') THEN
    BEGIN
      ALTER TABLE public.registro ADD CONSTRAINT registro_no_overlap EXCLUDE USING gist (id_sala WITH =, periodo WITH &&);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Falha ao criar constraint de overlap. Limpe conflitos e crie manualmente.';
    END;
  END IF;
END $$;

COMMIT;
